// GET /api/payments?student_id=&from=&to=
// POST /api/payments
import { ok, created, badRequest, readJson, requireFields, id } from '../../_lib/utils.js'

export async function onRequestGet(context) {
  const { env, data, request } = context
  const sid = data.schoolId
  const url = new URL(request.url)
  const studentId = url.searchParams.get('student_id')
  const from = url.searchParams.get('from')
  const to = url.searchParams.get('to')

  let where = 'WHERE p.school_id=?'
  const params = [sid]
  if (studentId) { where += ' AND p.student_id=?'; params.push(studentId) }
  if (from) { where += ' AND p.paid_at>=?'; params.push(from) }
  if (to) { where += ' AND p.paid_at<=?'; params.push(to) }

  const { results } = await env.DB.prepare(`
    SELECT p.*,s.name AS student_name,s.phone AS student_phone FROM payments p
    JOIN students s ON s.id=p.student_id ${where} ORDER BY p.paid_at DESC
  `).bind(...params).all()
  return ok({ payments: results })
}

export async function onRequestPost(context) {
  const { env, data, request } = context
  const sid = data.schoolId
  const body = await readJson(request)
  if (!body) return badRequest('Invalid JSON')
  const missing = requireFields(body, ['student_id', 'amount'])
  if (missing) return badRequest(missing)
  const student = await env.DB.prepare('SELECT id FROM students WHERE id=? AND school_id=?').bind(body.student_id, sid).first()
  if (!student) return badRequest('Student not found in this school')
  const pId = id('pay_')
  await env.DB.prepare(`INSERT INTO payments (id,school_id,student_id,amount,method,paid_at,note) VALUES (?,?,?,?,?,?,?)`)
    .bind(pId, sid, body.student_id, Number(body.amount), body.method || 'cash',
      body.paid_at || new Date().toISOString(), body.note || null).run()
  const payment = await env.DB.prepare('SELECT * FROM payments WHERE id=?').bind(pId).first()
  return created({ payment })
}
