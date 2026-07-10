import { hashPassword } from '../../../_lib/auth.js'
import { ok, badRequest, forbidden, readJson } from '../../../_lib/utils.js'

export async function onRequestPut(context) {
  const { env, params, data, request } = context
  const sid = data.schoolId

  if (data.user?.role !== 'admin') return forbidden('Only school admins can manage staff')

  const body = await readJson(request)
  if (!body || !body.password) {
    return badRequest('password is required')
  }

  const password = String(body.password)
  if (password.length < 8) {
    return badRequest('Password must be at least 8 characters')
  }

  const hash = await hashPassword(password)
  const result = await env.DB.prepare(
    'UPDATE users SET password_hash = ? WHERE id = ? AND school_id = ?'
  ).bind(hash, params.id, sid).run()

  if (result.meta.changes === 0) {
    return badRequest('Staff account not found')
  }

  return ok({ success: true })
}
