// Scheduled Worker that pings the Instrukt reminder endpoint with the secure header.
// The secret never appears in a URL — it's sent as X-Cron-Secret.

async function runCron(env) {
  const url = env.CRON_TARGET_URL
  if (!url) {
    console.error('[cron-worker] CRON_TARGET_URL not configured')
    return { ok: false, status: 0, body: 'CRON_TARGET_URL not configured' }
  }
  if (!env.CRON_SECRET) {
    console.error('[cron-worker] CRON_SECRET not configured')
    return { ok: false, status: 0, body: 'CRON_SECRET not configured' }
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'X-Cron-Secret': env.CRON_SECRET }
  })
  const body = await res.text()
  console.log(`[cron-worker] ${res.status} ${body}`)
  return { ok: res.ok, status: res.status, body }
}

export default {
  // Fired by the cron trigger (every 15 min per wrangler.toml).
  async scheduled(event, env, ctx) {
    ctx.waitUntil(runCron(env))
  },

  // Health check only — does NOT trigger the cron, so it stays safe to leave open.
  async fetch(request, env) {
    return new Response('instrukt cron worker is alive', {
      status: 200,
      headers: { 'Content-Type': 'text/plain' }
    })
  }
}
