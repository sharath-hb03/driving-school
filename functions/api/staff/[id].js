import { ok, badRequest, forbidden } from '../../_lib/utils.js'

export async function onRequestDelete(context) {
  const { env, params, data } = context
  const sid = data.schoolId
  const user = data.user

  if (user?.role !== 'admin') return forbidden('Only school admins can manage staff')

  if (params.id === user.sub || params.id === user.id) {
    return badRequest('You cannot delete your own account')
  }

  const result = await env.DB.prepare(
    'DELETE FROM users WHERE id = ? AND school_id = ?'
  ).bind(params.id, sid).run()

  if (result.meta.changes === 0) {
    return badRequest('Staff account not found')
  }

  return ok({ deleted: true })
}
