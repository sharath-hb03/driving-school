// GET/PUT/DELETE /api/packages/:id
import { ok, notFound, badRequest, readJson } from '../../_lib/utils.js'

export async function onRequestGet(context) {
  const { env, params, data } = context
  const row = await env.DB.prepare('SELECT * FROM packages WHERE id=? AND school_id=?').bind(params.id, data.schoolId).first()
  if (!row) return notFound('Package not found')
  return ok({ package: row })
}

export async function onRequestPut(context) {
  const { env, params, data, request } = context
  const sid = data.schoolId
  const body = await readJson(request)
  const allowed = ['name','license_type','total_classes','duration_days','fee','active','description']
  const sets = []; const vals = []
  for (const k of allowed) { if (k in body) { sets.push(`${k}=?`); vals.push(body[k] ?? null) } }
  if (!sets.length) return badRequest('Nothing to update')
  vals.push(params.id, sid)
  await env.DB.prepare(`UPDATE packages SET ${sets.join(',')} WHERE id=? AND school_id=?`).bind(...vals).run()
  return ok({ updated: true })
}

export async function onRequestDelete(context) {
  const { env, params, data } = context
  await env.DB.prepare('DELETE FROM packages WHERE id=? AND school_id=?').bind(params.id, data.schoolId).run()
  return ok({ deleted: true })
}
