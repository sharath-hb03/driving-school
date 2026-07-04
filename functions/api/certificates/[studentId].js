// GET  /api/certificates/:studentId  -> the student's certificate (or null)
// POST /api/certificates/:studentId  -> issue / regenerate it
// Staff-only (the middleware blocks portal roles from any non-/portal route).
// Admin & staff may override the completion check.
import { ok, badRequest } from '../../_lib/utils.js'
import { getCertificate, issueCertificate } from '../../_lib/certificate.js'

export async function onRequestGet(context) {
  const { env, params, data } = context
  const certificate = await getCertificate(env, params.studentId, data.schoolId)
  return ok({ certificate: certificate || null })
}

export async function onRequestPost(context) {
  const { env, params, data } = context
  const body = await context.request.json().catch(() => ({}))
  const issuedBy = `${data.user.role}:${data.user.sub}`
  try {
    const certificate = await issueCertificate(env, params.studentId, data.schoolId, {
      issuedBy,
      allowOverride: true,
      instructorId: body?.instructor_id || null, // chosen in the dropdown (else most-attended)
      signatoryName: data.user.name || null       // the logged-in admin / staff
    })
    return ok({ certificate })
  } catch (err) {
    return badRequest(err.message)
  }
}
