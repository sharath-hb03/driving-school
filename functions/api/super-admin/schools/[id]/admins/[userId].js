// PUT    /api/super-admin/schools/:id/admins/:userId  { password }
// DELETE /api/super-admin/schools/:id/admins/:userId
import { ok, notFound, readJson } from '../../../../../_lib/utils.js'
import { hashPassword } from '../../../../../_lib/auth.js'

export async function onRequestPut(context) {
  const { env, params, request } = context
  const body = await readJson(request)
  if (!body?.password) return notFound('password required')
  const hash = await hashPassword(body.password)
  const r = await env.DB.prepare('UPDATE users SET password_hash=? WHERE id=? AND school_id=?')
    .bind(hash, params.userId, params.id).run()
  if (!r.meta.changes) return notFound('Admin not found')
  return ok({ reset: true })
}

export async function onRequestDelete(context) {
  const { env, params } = context
  const r = await env.DB.prepare('DELETE FROM users WHERE id=? AND school_id=?')
    .bind(params.userId, params.id).run()
  if (!r.meta.changes) return notFound('Admin not found')
  return ok({ deleted: true })
}
