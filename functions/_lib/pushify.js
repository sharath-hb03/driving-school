// Pushify push notification client (replaces OneSignal).
// Requires env.PUSHIFY_API_KEY.

export async function sendPush(env, { heading, message, url, subscriptionIds }) {
  const apiKey = env.PUSHIFY_API_KEY
  if (!apiKey) {
    console.warn('[pushify] PUSHIFY_API_KEY not set — skipping push')
    return { sent: false, reason: 'PUSHIFY_API_KEY not configured' }
  }
  if (!subscriptionIds || subscriptionIds.length === 0) {
    return { sent: false, reason: 'No subscription IDs provided' }
  }

  const body = {
    headings: { en: heading || 'DriveSchool' },
    contents: { en: message },
    include_subscription_ids: subscriptionIds,
    ...(url ? { url } : {})
  }

  try {
    const res = await fetch('https://pushify.com/api/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify(body)
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) return { sent: false, reason: data?.error || `HTTP ${res.status}` }
    return { sent: true, data }
  } catch (err) {
    return { sent: false, reason: err.message }
  }
}

// Collect all subscription IDs from school users (admin + staff) and send push.
export async function pushToSchoolStaff(env, DB, schoolId, heading, message) {
  const { results } = await DB.prepare(
    'SELECT pushify_sub FROM users WHERE school_id = ? AND pushify_sub IS NOT NULL'
  ).bind(schoolId).all()
  const subs = results.map((r) => r.pushify_sub).filter(Boolean)
  if (!subs.length) return { sent: false, reason: 'No staff subscriptions' }
  return sendPush(env, { heading, message, subscriptionIds: subs })
}
