import { ok, badRequest, readJson } from '../../_lib/utils.js'

export async function onRequestPost(context) {
  const { env, data, request } = context
  const user = data.user
  const sid = data.schoolId

  const body = await readJson(request)
  if (!body || !body.subscription_id) {
    return badRequest('subscription_id is required')
  }

  const subId = body.subscription_id

  await env.DB.prepare(
    'UPDATE users SET pushify_sub = ? WHERE id = ? AND school_id = ?'
  ).bind(subId, user.sub || user.id, sid).run()

  return ok({ success: true })
}
