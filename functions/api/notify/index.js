// POST /api/notify  — send push notification to school staff or specific users
import { sendPush } from '../../_lib/onesignal.js'
import { readJson, badRequest, ok } from '../../_lib/utils.js'

export async function onRequestPost(context) {
  const { env, data, request } = context
  const sid = data.schoolId
  const body = await readJson(request)
  if (!body) return badRequest('Invalid JSON')
  if (!body.message) return badRequest('message is required')

  let subscriptionIds = []

  if (body.subscriptionIds?.length) {
    subscriptionIds = body.subscriptionIds
  } else {
    // Broadcast to all staff in this school
    const { results } = await env.DB.prepare(
      'SELECT pushify_sub FROM users WHERE school_id=? AND pushify_sub IS NOT NULL'
    ).bind(sid).all()
    subscriptionIds = results.map(r => r.pushify_sub).filter(Boolean)

    // Optionally also students and instructors
    if (body.includeStudents) {
      const { results: subs } = await env.DB.prepare(
        'SELECT pushify_sub FROM students WHERE school_id=? AND pushify_sub IS NOT NULL'
      ).bind(sid).all()
      subscriptionIds.push(...subs.map(r => r.pushify_sub).filter(Boolean))
    }
    if (body.includeInstructors) {
      const { results: isubs } = await env.DB.prepare(
        'SELECT pushify_sub FROM instructors WHERE school_id=? AND pushify_sub IS NOT NULL'
      ).bind(sid).all()
      subscriptionIds.push(...isubs.map(r => r.pushify_sub).filter(Boolean))
    }
  }

  if (!subscriptionIds.length) return ok({ sent: false, reason: 'No push subscriptions found' })

  const result = await sendPush(env, {
    heading: body.heading || 'Instrukt',
    message: body.message,
    url: body.url,
    subscriptionIds
  })
  return ok(result)
}
