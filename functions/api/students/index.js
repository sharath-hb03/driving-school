// GET /api/students?q=&status=&page=&limit=
// POST /api/students
import { ok, created, badRequest, readJson, requireFields, id } from '../../_lib/utils.js'

export async function onRequestGet(context) {
  const { env, request, data } = context
  const sid = data.schoolId
  const url = new URL(request.url)
  const q = url.searchParams.get('q') || ''
  const status = url.searchParams.get('status') || 'all'

  let where = 'WHERE s.school_id=?'
  const params = [sid]
  if (status !== 'all') { where += ' AND s.status=?'; params.push(status) }
  if (q) { where += ' AND (s.name LIKE ? OR s.phone LIKE ?)'; params.push(`%${q}%`, `%${q}%`) }

  const [studentsRes, school] = await Promise.all([
    env.DB.prepare(`
      SELECT s.id, s.name, s.phone, s.email, s.license_type, s.status, s.joining_date, s.photo_key, s.discount,
        s.stage_progress, s.opt_for_license,
        s.ll_test_date, s.ll_test_time, s.ll_status,
        s.dl_test_date, s.dl_test_time, s.dl_status,
        p.name AS package_name, p.fee, p.total_classes,
        (SELECT COUNT(*) FROM classes c WHERE c.student_id=s.id AND c.status='attended') AS completed_classes,
        (COALESCE(p.fee,0)-COALESCE(s.discount,0)-COALESCE((SELECT SUM(amount) FROM payments pm WHERE pm.student_id=s.id),0)) AS balance
      FROM students s LEFT JOIN packages p ON p.id=s.package_id
      ${where} ORDER BY s.created_at DESC
    `).bind(...params).all(),
    env.DB.prepare('SELECT stages FROM schools WHERE id=?').bind(sid).first()
  ])

  const defaultStages = [
    { id: 'stage_app', name: 'Application Submitted' },
    { id: 'stage_ll', name: 'Learner\'s Licence (LL)' },
    { id: 'stage_training', name: 'Practical Training' },
    { id: 'stage_dl', name: 'Driving Licence (DL)' }
  ]

  let stages = defaultStages
  if (school && school.stages) {
    try {
      stages = JSON.parse(school.stages)
    } catch (e) {}
  }

  return ok({ students: studentsRes.results || [], stages })
}

export async function onRequestPost(context) {
  const { env, request, data } = context
  const sid = data.schoolId
  const body = await readJson(request)
  if (!body) return badRequest('Invalid JSON')
  const missing = requireFields(body, ['name'])
  if (missing) return badRequest(missing)

  const studentId = id('stu_')
  await env.DB.prepare(`
    INSERT INTO students (id,school_id,name,phone,email,address,license_type,joining_date,package_id,status,notes,discount,opt_for_license)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).bind(
    studentId, sid,
    String(body.name).trim(),
    body.phone || null, body.email || null, body.address || null,
    body.license_type || '4W',
    body.joining_date || null,
    body.package_id || null,
    body.status || 'active',
    body.notes || null,
    Number(body.discount) || 0,
    body.opt_for_license !== undefined ? (body.opt_for_license ? 1 : 0) : 1
  ).run()

  const student = await env.DB.prepare('SELECT * FROM students WHERE id=?').bind(studentId).first()
  return created({ student })
}
