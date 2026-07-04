// PUT /api/portal/classes/:id — instructor marks class attended/absent
import { ok, forbidden, badRequest, readJson } from '../../../_lib/utils.js'
import { maybeCompleteAndCertify } from '../../../_lib/certificate.js'

export async function onRequestPut(context) {
  const { env, params, data, request } = context
  const { user } = data
  if (user.role !== 'instructor') return forbidden('Instructors only')

  const body = await readJson(request)
  const { status } = body
  if (!['attended','absent','cancelled'].includes(status)) return badRequest('Invalid status')

  const cls = await env.DB.prepare(
    'SELECT * FROM classes WHERE id=? AND instructor_id=? AND school_id=?'
  ).bind(params.id, user.instructorId || user.sub, data.schoolId).first()
  if (!cls) return forbidden('Not your class')

  await env.DB.prepare('UPDATE classes SET status=? WHERE id=?').bind(status, params.id).run()

  // Auto-complete & auto-certify when attendance is marked
  if (status === 'attended' && cls.student_id) {
    await maybeCompleteAndCertify(env, cls.student_id, data.schoolId, { issuedBy: `instructor:${user.sub}` }).catch(() => {})
  }

  return ok({ updated: true })
}
