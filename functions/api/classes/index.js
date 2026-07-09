// GET  /api/classes?from=&to=&student=&instructor=&status=&date=
// POST /api/classes  { student_id, instructor_id, vehicle_id, scheduled_at, duration_min, notes, slots[], dryRun }
import { ok, created, badRequest, readJson, requireFields, id } from '../../_lib/utils.js'
import { findBookingConflicts } from '../../_lib/schedule.js'
import { sendPush } from '../../_lib/onesignal.js'

const SELECT = `
  SELECT c.*,
         s.name AS student_name, s.phone AS student_phone,
         i.name AS instructor_name,
         v.vehicle_number, v.model AS vehicle_model
    FROM classes c
    JOIN students s ON s.id = c.student_id
    LEFT JOIN instructors i ON i.id = c.instructor_id
    LEFT JOIN vehicles v ON v.id = c.vehicle_id`

export async function onRequestGet(context) {
  const { env, request, data } = context
  const sid = data.schoolId
  const url = new URL(request.url)
  const where = ['c.school_id = ?']
  const binds = [sid]

  const date = url.searchParams.get('date')
  if (date) { where.push("substr(c.scheduled_at,1,10) = ?"); binds.push(date) }
  const from = url.searchParams.get('from')
  const to   = url.searchParams.get('to')
  if (from) { where.push('c.scheduled_at >= ?'); binds.push(from) }
  if (to)   { where.push('c.scheduled_at <= ?'); binds.push(to) }
  for (const [param, col] of [
    ['student',    'c.student_id'],
    ['instructor', 'c.instructor_id'],
    ['status',     'c.status'],
  ]) {
    const v = url.searchParams.get(param)
    if (v) { where.push(`${col} = ?`); binds.push(v) }
  }

  const sql = `${SELECT} WHERE ${where.join(' AND ')} ORDER BY c.scheduled_at ASC`
  const { results } = await env.DB.prepare(sql).bind(...binds).all()
  return ok({ classes: results })
}

export async function onRequestPost(context) {
  const { env, request, data } = context
  const sid  = data.schoolId
  const body = await readJson(request)
  if (!body) return badRequest('Invalid JSON')

  const duration = Number(body.duration_min) || 45

  // Support single slot or batch
  let slots = Array.isArray(body.slots) ? body.slots.filter(Boolean) : []
  if (!slots.length && body.scheduled_at) slots = [body.scheduled_at]

  // ── Conflict detection ─────────────────────────────────────────────
  const conflicts = await findBookingConflicts(env.DB, {
    school_id:     sid,
    instructor_id: body.instructor_id || null,
    vehicle_id:    body.vehicle_id    || null,
    duration_min:  duration,
    slots,
    exclude_id:    body.exclude_id    || null,
  })

  // Preview (dry run) — return what would clash without booking anything
  if (body.dryRun) return ok({ conflicts })

  // Hard block: if booking a single slot, reject with 409
  if (conflicts.length && slots.length === 1) {
    const c = conflicts[0]
    const msg = c.type === 'instructor'
      ? `Instructor is already booked at this time (with ${c.with?.student_name})`
      : c.type === 'vehicle'
      ? `Vehicle is already in use at this time`
      : c.type === 'holiday'
      ? `Cannot book on a holiday: ${c.label}`
      : `Instructor is on leave: ${c.label}`
    return new Response(JSON.stringify({ ok: false, error: msg, conflicts }), {
      status: 409, headers: { 'Content-Type': 'application/json' }
    })
  }

  const err = requireFields(body, ['student_id'])
  if (err) return badRequest(err)
  if (!slots.length) return badRequest('Missing required field: scheduled_at')

  // Batch: skip clashing slots, book the rest
  const clashed = new Set(conflicts.map((c) => c.scheduled_at))
  const free    = slots.filter((s) => !clashed.has(s))

  const createdIds = []
  const stmts = []
  for (const slot of free) {
    const cid = id('cls_')
    createdIds.push(cid)
    stmts.push(env.DB.prepare(
      `INSERT INTO classes (id, school_id, student_id, instructor_id, vehicle_id, scheduled_at, duration_min, status, notes)
       VALUES (?,?,?,?,?,?,?,?,?)`
    ).bind(cid, sid, body.student_id, body.instructor_id || null, body.vehicle_id || null,
           slot, duration, body.status || 'scheduled', body.notes || null))
  }
  if (stmts.length) await env.DB.batch(stmts)

  let classes = []
  if (createdIds.length) {
    const ph  = createdIds.map(() => '?').join(',')
    const res = await env.DB.prepare(`${SELECT} WHERE c.id IN (${ph}) ORDER BY c.scheduled_at ASC`).bind(...createdIds).all()
    classes = res.results || []
  }

  // Notify student and instructor about the booked classes
  if (classes.length) {
    try {
      const student = await env.DB.prepare('SELECT name, pushify_sub FROM students WHERE id = ?').bind(body.student_id).first()
      let instructor = null
      if (body.instructor_id) {
        instructor = await env.DB.prepare('SELECT name, pushify_sub FROM instructors WHERE id = ?').bind(body.instructor_id).first()
      }

      for (const c of classes) {
        const timeStr = new Date(c.scheduled_at.includes('T') ? c.scheduled_at : c.scheduled_at.replace(' ', 'T')).toLocaleString('en-IN', {
          timeZone: 'Asia/Kolkata',
          weekday: 'short',
          day: 'numeric',
          month: 'short',
          hour: 'numeric',
          minute: '2-digit',
          hour12: true
        })

        if (student && student.pushify_sub && student.pushify_sub !== 'null') {
          await sendPush(env, {
            heading: 'Class Booked',
            message: `A new driving class has been booked for you on ${timeStr}${instructor ? ` with instructor ${instructor.name}` : ''}.`,
            subscriptionIds: [student.pushify_sub]
          })
        }

        if (instructor && instructor.pushify_sub && instructor.pushify_sub !== 'null') {
          await sendPush(env, {
            heading: 'New Class Assigned',
            message: `You have a new class scheduled with student ${student ? student.name : 'Student'} on ${timeStr}.`,
            subscriptionIds: [instructor.pushify_sub]
          })
        }
      }
    } catch (err) {
      console.error('[notify] Error sending booking notification:', err)
    }
  }

  return created({ classes, class: classes[0] || null, skipped: conflicts })
}
