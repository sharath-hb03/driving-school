import { ok, badRequest, readJson } from '../../_lib/utils.js'

export async function onRequestPost(context) {
  const { env, data, request } = context
  const user = data.user
  const sub = user.sub || user.id
  const sid = data.schoolId

  const body = await readJson(request)
  if (!body || !body.subscription_id) {
    return badRequest('subscription_id is required')
  }

  const subId = body.subscription_id

  if (user.role === 'student') {
    await env.DB.prepare(
      'UPDATE students SET pushify_sub = ? WHERE id = ? AND school_id = ?'
    ).bind(subId, sub, sid).run()
  } else if (user.role === 'instructor') {
    await env.DB.prepare(
      'UPDATE instructors SET pushify_sub = ? WHERE id = ? AND school_id = ?'
    ).bind(subId, sub, sid).run()
  } else {
    return badRequest('Invalid portal role')
  }

  return ok({ success: true })
}
