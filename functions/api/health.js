// GET /api/health
import { ok } from '../_lib/utils.js'

export async function onRequestGet(context) {
  return ok({ status: 'ok', ts: Date.now() })
}
