// GET  /api/portal/certificate              -> student: own certificate
//      /api/portal/certificate?student_id=  -> instructor: a student they teach
// POST /api/portal/certificate              -> student: issue own (must be completed)
//      /api/portal/certificate {student_id} -> instructor: issue for their student (override allowed)
import { ok, badRequest, forbidden } from '../../_lib/utils.js'
import { getCertificate, issueCertificate } from '../../_lib/certificate.js'

// An instructor may act on a student they teach (a shared class) or test (LL/DL examiner).
async function instructorTeaches(env, instructorId, studentId, schoolId) {
  const cls = await env.DB.prepare('SELECT 1 FROM classes WHERE instructor_id = ? AND student_id = ? AND school_id = ? LIMIT 1')
    .bind(instructorId, studentId, schoolId)
    .first()
  if (cls) return true
  const test = await env.DB.prepare('SELECT 1 FROM students WHERE id = ? AND school_id = ? AND (ll_instructor_id = ? OR dl_instructor_id = ?) LIMIT 1')
    .bind(studentId, schoolId, instructorId, instructorId)
    .first()
  return Boolean(test)
}

export async function onRequestGet(context) {
  const { env, request, data } = context
  const { sub, role } = data.user
  const sid = data.schoolId

  if (role === 'student') {
    return ok({ certificate: (await getCertificate(env, sub, sid)) || null })
  }
  if (role === 'instructor') {
    const studentId = new URL(request.url).searchParams.get('student_id')
    if (!studentId) return badRequest('student_id is required')
    if (!(await instructorTeaches(env, sub, studentId, sid))) return forbidden('Not your student')
    return ok({ certificate: (await getCertificate(env, studentId, sid)) || null })
  }
  return forbidden('Not a portal account')
}

export async function onRequestPost(context) {
  const { env, data } = context
  const { sub, role } = data.user
  const sid = data.schoolId

  try {
    if (role === 'student') {
      // Students can only generate once their own course is completed.
      const certificate = await issueCertificate(env, sub, sid, { issuedBy: `student:${sub}`, allowOverride: false })
      return ok({ certificate })
    }
    if (role === 'instructor') {
      const body = await context.request.json().catch(() => null)
      const studentId = body?.student_id
      if (!studentId) return badRequest('student_id is required')
      if (!(await instructorTeaches(env, sub, studentId, sid))) return forbidden('Not your student')
      // The issuing instructor signs as the instructor; signatory stays the admin (default).
      const certificate = await issueCertificate(env, studentId, sid, { issuedBy: `instructor:${sub}`, allowOverride: true, instructorId: sub })
      return ok({ certificate })
    }
    return forbidden('Not a portal account')
  } catch (err) {
    return badRequest(err.message)
  }
}
