// GET/POST /api/packages
import { ok, created, badRequest, readJson, requireFields, id } from '../../_lib/utils.js'

export async function onRequestGet(context) {
  const { env, data } = context
  const { results } = await env.DB.prepare('SELECT * FROM packages WHERE school_id=? ORDER BY name ASC').bind(data.schoolId).all()
  return ok({ packages: results })
}

export async function onRequestPost(context) {
  const { env, data, request } = context
  const sid = data.schoolId
  const body = await readJson(request)
  if (!body) return badRequest('Invalid JSON')
  const missing = requireFields(body, ['name', 'fee'])
  if (missing) return badRequest(missing)
  const pId = id('pkg_')
  await env.DB.prepare('INSERT INTO packages (id,school_id,name,license_type,fee,total_classes,active) VALUES (?,?,?,?,?,?,?)')
    .bind(pId, sid, String(body.name).trim(), body.license_type || 'both', Number(body.fee), Number(body.total_classes) || 10, 1).run()
  const pkg = await env.DB.prepare('SELECT * FROM packages WHERE id=?').bind(pId).first()
  return created({ package: pkg })
}
