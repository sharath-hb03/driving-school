// PUT /api/portal/profile -> the logged-in student saves their LL application details.
// Stored as a JSON blob on students.ll_profile ({ personal, present, permanent }).
import { ok, badRequest, forbidden } from '../../_lib/utils.js'

// Guard against a runaway payload; the form is a few dozen short text fields.
const MAX_BYTES = 16 * 1024

export async function onRequestPut(context) {
  const { env, data, request } = context
  const { user } = data
  if (user.role !== 'student') return forbidden('Student portal only')
  const sid = data.schoolId
  const studentId = user.sub || user.id

  let body
  try {
    body = await request.json()
  } catch {
    return badRequest('Invalid JSON')
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return badRequest('Invalid profile')

  // Only persist the three known sections; ignore anything else the client sends.
  const profile = {
    personal: body.personal && typeof body.personal === 'object' ? body.personal : {},
    present: body.present && typeof body.present === 'object' ? body.present : {},
    permanent: body.permanent && typeof body.permanent === 'object' ? body.permanent : {}
  }
  const jsonStr = JSON.stringify(profile)
  if (jsonStr.length > MAX_BYTES) return badRequest('Profile is too large')

  const student = await env.DB.prepare('SELECT id FROM students WHERE id = ? AND school_id = ?')
    .bind(studentId, sid).first()
  if (!student) return forbidden('Student not found')

  await env.DB.prepare('UPDATE students SET ll_profile = ? WHERE id = ? AND school_id = ?')
    .bind(jsonStr, studentId, sid).run()
  return ok({ saved: true, profile })
}
