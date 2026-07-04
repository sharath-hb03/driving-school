// GET /api/vehicles  POST /api/vehicles
import { ok, created, badRequest, readJson, requireFields, id } from '../../_lib/utils.js'

export async function onRequestGet(context) {
  const { env, data } = context
  const sid = data.schoolId
  const { results } = await env.DB.prepare('SELECT * FROM vehicles WHERE school_id=? ORDER BY vehicle_number ASC').bind(sid).all()
  return ok({ vehicles: results })
}

export async function onRequestPost(context) {
  const { env, data, request } = context
  const sid = data.schoolId
  const body = await readJson(request)
  if (!body) return badRequest('Invalid JSON')
  const missing = requireFields(body, ['vehicle_number'])
  if (missing) return badRequest(missing)
  const vId = id('veh_')
  await env.DB.prepare('INSERT INTO vehicles (id,school_id,vehicle_number,model,license_type,status) VALUES (?,?,?,?,?,?)')
    .bind(vId, sid, String(body.vehicle_number).trim(), body.model || null, body.license_type || '4W', body.status || 'available').run()
  const vehicle = await env.DB.prepare('SELECT * FROM vehicles WHERE id=?').bind(vId).first()
  return created({ vehicle })
}
