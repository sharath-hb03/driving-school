// GET /api/vehicles/:id  PUT /api/vehicles/:id  DELETE /api/vehicles/:id
import { ok, notFound, badRequest, readJson } from '../../_lib/utils.js'

export async function onRequestGet(context) {
  const { env, params, data } = context
  const row = await env.DB.prepare('SELECT * FROM vehicles WHERE id=? AND school_id=?').bind(params.id, data.schoolId).first()
  if (!row) return notFound('Vehicle not found')
  const docs = await env.DB.prepare('SELECT * FROM vehicle_documents WHERE vehicle_id=? ORDER BY expiry_date DESC').bind(params.id).all()
  return ok({ vehicle: row, documents: docs.results })
}

export async function onRequestPut(context) {
  const { env, params, data, request } = context
  const sid = data.schoolId
  const body = await readJson(request)
  const allowed = ['vehicle_number','model','license_type','status']
  const sets = []; const vals = []
  for (const k of allowed) { if (k in body) { sets.push(`${k}=?`); vals.push(body[k] ?? null) } }
  if (!sets.length) return badRequest('Nothing to update')
  vals.push(params.id, sid)
  await env.DB.prepare(`UPDATE vehicles SET ${sets.join(',')} WHERE id=? AND school_id=?`).bind(...vals).run()
  return ok({ updated: true })
}

export async function onRequestDelete(context) {
  const { env, params, data } = context
  await env.DB.prepare('DELETE FROM vehicles WHERE id=? AND school_id=?').bind(params.id, data.schoolId).run()
  return ok({ deleted: true })
}
