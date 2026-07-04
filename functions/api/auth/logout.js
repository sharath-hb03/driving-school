// POST /api/auth/logout
import { clearCookie } from '../../_lib/auth.js'
import { json } from '../../_lib/utils.js'

export async function onRequestPost() {
  return json({ ok: true }, { headers: { 'Set-Cookie': clearCookie() } })
}
