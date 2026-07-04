// GET/POST /api/timeoff
import { ok, created, badRequest, readJson, requireFields, id, json } from '../../_lib/utils.js'

export async function onRequestGet(context) {
  const { env, data, request } = context
  const sid = data.schoolId
  const url = new URL(request.url)
  const instructor = url.searchParams.get('instructor') || url.searchParams.get('instructor_id')
  const from = url.searchParams.get('from')
  const to = url.searchParams.get('to')

  const where = ['t.school_id = ?']
  const binds = [sid]

  if (instructor) {
    where.push('t.instructor_id = ?')
    binds.push(instructor)
  }
  // Overlap with [from, to]: range starts on/before `to` and ends on/after `from`.
  if (to) {
    where.push('t.start_date <= ?')
    binds.push(to)
  }
  if (from) {
    where.push('t.end_date >= ?')
    binds.push(from)
  }

  const sql = `
    SELECT t.*, i.name AS instructor_name 
      FROM instructor_time_off t
      JOIN instructors i ON i.id = t.instructor_id 
     WHERE ${where.join(' AND ')} 
     ORDER BY t.start_date ASC
  `
  const { results } = await env.DB.prepare(sql).bind(...binds).all()
  return ok({ timeoff: results })
}

export async function onRequestPost(context) {
  const { env, data, request } = context
  const sid = data.schoolId
  const body = await readJson(request)
  if (!body) return badRequest('Invalid JSON')

  const missing = requireFields(body, ['instructor_id', 'start_date'])
  if (missing) return badRequest(missing)

  const start = body.start_date
  const end = body.end_date || start
  if (end < start) return badRequest('End date is before start date')

  // Verify instructor belongs to school
  const ins = await env.DB.prepare('SELECT id FROM instructors WHERE id=? AND school_id=?').bind(body.instructor_id, sid).first()
  if (!ins) return badRequest('Instructor not found')

  // Classes already booked for this instructor during the leave
  const { results: clashes } = await env.DB.prepare(`
    SELECT c.id, c.scheduled_at, s.name AS student_name
      FROM classes c 
      JOIN students s ON s.id = c.student_id
     WHERE c.instructor_id = ? 
       AND c.status = 'scheduled'
       AND c.school_id = ? 
       AND s.school_id = ?
       AND substr(c.scheduled_at, 1, 10) BETWEEN ? AND ?
     ORDER BY c.scheduled_at ASC
  `).bind(body.instructor_id, sid, sid, start, end).all()

  // Block unless the caller confirms (then we cancel those classes).
  if (clashes.length && !body.force) {
    return json({ ok: false, error: 'Classes are booked during this leave', conflicts: clashes }, { status: 409 })
  }

  const tId = id('toff_')
  const stmts = [
    env.DB.prepare(`
      INSERT INTO instructor_time_off (id, school_id, instructor_id, start_date, end_date, reason) 
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(tId, sid, body.instructor_id, start, end, body.reason || null)
  ]

  if (clashes.length) {
    const ph = clashes.map(() => '?').join(',')
    stmts.push(
      env.DB.prepare(`
        UPDATE classes 
           SET status = 'cancelled' 
         WHERE id IN (${ph}) 
           AND school_id = ?
      `).bind(...clashes.map((c) => c.id), sid)
    )
  }

  await env.DB.batch(stmts)

  const t = await env.DB.prepare('SELECT * FROM instructor_time_off WHERE id = ? AND school_id = ?').bind(tId, sid).first()
  return created({ timeoff: t, cancelled: clashes.length })
}
