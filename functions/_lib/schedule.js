// Schedule clash detection — multi-tenant version (school_id scoped)
// Checks: instructor double-booking, vehicle double-booking, school holidays, instructor leave

const ms = (v) => {
  if (!v) return NaN
  return new Date(String(v).includes('T') ? v : String(v).replace(' ', 'T')).getTime()
}
const dayKey  = (millis) => new Date(millis).toISOString().slice(0, 10)
const dateOf  = (s) => String(s).slice(0, 10)

/**
 * Low-level overlap check for instructor / vehicle conflicts.
 */
export async function findConflicts(db, { school_id, instructor_id, vehicle_id, duration_min = 45, slots = [], exclude_id = null }) {
  const hasInstructor = Boolean(instructor_id)
  const hasVehicle    = Boolean(vehicle_id)
  if ((!hasInstructor && !hasVehicle) || !slots.length) return []

  const dur    = Number(duration_min) || 45
  const starts = slots.map(ms).filter((t) => !Number.isNaN(t))
  if (!starts.length) return []

  const lo = dayKey(Math.min(...starts) - 86400000)
  const hi = dayKey(Math.max(...starts) + 86400000)

  const resourceCond = []
  const binds = []
  if (hasInstructor) { resourceCond.push('c.instructor_id = ?'); binds.push(instructor_id) }
  if (hasVehicle)    { resourceCond.push('c.vehicle_id = ?');    binds.push(vehicle_id) }
  binds.push(school_id, lo, hi)

  const sql = `
    SELECT c.id, c.student_id, c.instructor_id, c.vehicle_id,
           c.scheduled_at, c.duration_min, c.status,
           s.name AS student_name
      FROM classes c
      JOIN students s ON s.id = c.student_id
     WHERE c.status != 'cancelled'
       AND (${resourceCond.join(' OR ')})
       AND c.school_id = ?
       AND substr(c.scheduled_at, 1, 10) BETWEEN ? AND ?`

  const { results } = await db.prepare(sql).bind(...binds).all()
  const existing = (results || []).filter((r) => r.id !== exclude_id)
  if (!existing.length) return []

  const conflicts = []
  for (const slot of slots) {
    const start = ms(slot)
    if (Number.isNaN(start)) continue
    const end = start + dur * 60000
    for (const e of existing) {
      const es = ms(e.scheduled_at)
      const ee = es + (Number(e.duration_min) || 45) * 60000
      if (!(start < ee && es < end)) continue // no overlap
      const type = hasInstructor && e.instructor_id === instructor_id ? 'instructor' : 'vehicle'
      conflicts.push({
        scheduled_at: slot,
        type,
        with: {
          id:           e.id,
          student_name: e.student_name,
          scheduled_at: e.scheduled_at,
          duration_min: e.duration_min,
          status:       e.status,
        }
      })
    }
  }
  return conflicts
}

/**
 * Full booking validation: overlaps + school holidays + instructor leave.
 */
export async function findBookingConflicts(db, opts) {
  const { school_id, instructor_id, slots = [] } = opts
  const conflicts = await findConflicts(db, opts)
  if (!slots.length) return conflicts

  const dates = [...new Set(slots.map(dateOf))]

  // School holidays (scoped to this school)
  const ph = dates.map(() => '?').join(',')
  const { results: hols } = await db
    .prepare(`SELECT date, name FROM holidays WHERE school_id = ? AND date IN (${ph})`)
    .bind(school_id, ...dates)
    .all()
  const holMap = {}
  for (const h of hols || []) holMap[h.date] = h.name
  for (const s of slots) {
    if (holMap[dateOf(s)]) conflicts.push({ scheduled_at: s, type: 'holiday', label: holMap[dateOf(s)] })
  }

  // Instructor leave — table: instructor_time_off, cols: start_date / end_date
  if (instructor_id) {
    const min = dates.reduce((a, b) => (a < b ? a : b))
    const max = dates.reduce((a, b) => (a > b ? a : b))
    const { results: offs } = await db
      .prepare(`SELECT start_date, end_date, reason FROM instructor_time_off
                 WHERE instructor_id = ? AND school_id = ?
                   AND end_date >= ? AND start_date <= ?`)
      .bind(instructor_id, school_id, min, max)
      .all()
    for (const s of slots) {
      const d   = dateOf(s)
      const hit = (offs || []).find((o) => d >= o.start_date && d <= o.end_date)
      if (hit) conflicts.push({ scheduled_at: s, type: 'leave', label: hit.reason || 'On leave' })
    }
  }

  return conflicts
}
