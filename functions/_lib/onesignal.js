// OneSignal REST API client (Web Push v16).
// Sends notifications targeting the subscription IDs the web SDK gives us
// (stored server-side in the `pushify_sub` column — kept for schema stability).
//
// Requires:
//   ONESIGNAL_APP_ID        — public OneSignal app id (also VITE_ONESIGNAL_APP_ID on the client)
//   ONESIGNAL_REST_API_KEY  — secret REST API key (OneSignal dashboard → Settings → Keys & IDs)

const ONESIGNAL_URL = 'https://api.onesignal.com/notifications'

export async function sendPush(env, { heading, message, url, subscriptionIds }) {
  const appId = env.ONESIGNAL_APP_ID
  const apiKey = env.ONESIGNAL_REST_API_KEY

  if (!appId || !apiKey) {
    console.warn('[onesignal] ONESIGNAL_APP_ID / ONESIGNAL_REST_API_KEY not set — skipping push')
    return { sent: false, reason: 'OneSignal not configured' }
  }
  if (apiKey === 'your-onesignal-rest-api-key-here') {
    console.log(`[onesignal mock] [${heading}] "${message}" -> ${(subscriptionIds || []).join(', ')}`)
    return { sent: true, mock: true }
  }

  const tokens = (subscriptionIds || []).filter((t) => t && t !== 'null')
  if (!tokens.length) return { sent: false, reason: 'No subscription IDs provided' }

  const body = {
    app_id: appId,
    include_subscription_ids: tokens,
    headings: { en: heading || 'Instrukt' },
    contents: { en: message },
    ...(url ? { web_url: url } : {})
  }

  try {
    const res = await fetch(ONESIGNAL_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Modern OneSignal auth. If you have a legacy REST key, use `Basic ${apiKey}`.
        Authorization: `Key ${apiKey}`
      },
      body: JSON.stringify(body)
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok || (data.errors && data.errors.length)) {
      return { sent: false, reason: JSON.stringify(data.errors || data) }
    }
    return { sent: true, id: data.id, recipients: data.recipients }
  } catch (err) {
    return { sent: false, reason: err.message }
  }
}

// Collect all subscription IDs from a school's staff (admin + staff) and send.
export async function pushToSchoolStaff(env, DB, schoolId, heading, message) {
  const { results } = await DB.prepare(
    'SELECT pushify_sub FROM users WHERE school_id = ? AND pushify_sub IS NOT NULL'
  ).bind(schoolId).all()
  const subs = results.map((r) => r.pushify_sub).filter(Boolean)
  if (!subs.length) return { sent: false, reason: 'No staff subscriptions' }
  return sendPush(env, { heading, message, subscriptionIds: subs })
}
