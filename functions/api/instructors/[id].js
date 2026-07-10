// GET /api/instructors/:id  PUT /api/instructors/:id  DELETE /api/instructors/:id
import { ok, notFound, badRequest, forbidden, readJson } from '../../_lib/utils.js'
import { hashPassword } from '../../_lib/auth.js'

export async function onRequestGet(context) {
  const { env, params, data } = context
  const sid = data.schoolId
  const row = await env.DB.prepare('SELECT * FROM instructors WHERE id=? AND school_id=?').bind(params.id, sid).first()
  if (!row) return notFound('Instructor not found')

  // Students this instructor currently has scheduled.
  const { results: students } = await env.DB.prepare(
    `SELECT DISTINCT s.id, s.name, s.phone, s.license_type
       FROM classes c JOIN students s ON s.id = c.student_id
      WHERE c.instructor_id = ? AND c.status = 'scheduled' AND c.school_id = ? AND s.school_id = ?
      ORDER BY s.name`
  ).bind(params.id, sid, sid).all()

  // RTO tests this instructor is assigned to.
  const { results: assigned } = await env.DB.prepare(
    `SELECT s.id AS student_id, s.name AS student_name,
            s.ll_instructor_id, s.ll_test_date, s.ll_test_time, s.ll_status,
            s.dl_instructor_id, s.dl_test_date, s.dl_test_time, s.dl_status
       FROM students s
      WHERE (s.ll_instructor_id = ? OR s.dl_instructor_id = ?) AND s.school_id = ?`
  ).bind(params.id, params.id, sid).all()

  const tests = []
  for (const r of assigned || []) {
    if (r.ll_instructor_id === params.id && r.ll_test_date)
      tests.push({ student_id: r.student_id, student_name: r.student_name, type: "Learner's Licence", date: r.ll_test_date, time: r.ll_test_time, status: r.ll_status })
    if (r.dl_instructor_id === params.id && r.dl_test_date)
      tests.push({ student_id: r.student_id, student_name: r.student_name, type: 'Driving Test', date: r.dl_test_date, time: r.dl_test_time, status: r.dl_status })
  }
  tests.sort((a, b) => a.date.localeCompare(b.date))

  return ok({ instructor: row, students, tests })
}

export async function onRequestPut(context) {
  const { env, params, data, request } = context
  const sid = data.schoolId
  const body = await readJson(request)
  const { password, ...fields } = body
  if (password && data.user?.role !== 'admin') {
    return forbidden('Only school admins can reset instructor passwords')
  }
  const allowed = ['name','phone','email','license_type','active','notes','work_days','work_start','work_end']
  const sets = []; const vals = []
  for (const k of allowed) { if (k in fields) { sets.push(`${k}=?`); vals.push(fields[k] ?? null) } }
  if (password) { const h = await hashPassword(password); sets.push('password_hash=?'); vals.push(h) }
  if (!sets.length) return badRequest('Nothing to update')
  vals.push(params.id, sid)
  await env.DB.prepare(`UPDATE instructors SET ${sets.join(',')} WHERE id=? AND school_id=?`).bind(...vals).run()
  return ok({ updated: true })
}

export async function onRequestDelete(context) {
  const { env, params, data } = context
  if (data.user?.role !== 'admin') return forbidden('Only school admins can delete instructors')
  await env.DB.prepare('DELETE FROM instructors WHERE id=? AND school_id=?').bind(params.id, data.schoolId).run()
  return ok({ deleted: true })
}
