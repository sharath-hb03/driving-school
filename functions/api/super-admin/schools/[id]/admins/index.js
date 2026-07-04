// GET /api/super-admin/schools/:id/admins
// POST /api/super-admin/schools/:id/admins  { name, email, password, role }
import { ok, created, badRequest, readJson, requireFields, id } from '../../../../../_lib/utils.js'
import { hashPassword } from '../../../../../_lib/auth.js'

export async function onRequestGet(context) {
  const { env, params } = context
  const admins = await env.DB.prepare(
    "SELECT id, name, email, role, created_at FROM users WHERE school_id=? ORDER BY created_at"
  ).bind(params.id).all()
  return ok({ admins: admins.results })
}

export async function onRequestPost(context) {
  const { env, params, request } = context
  const body = await readJson(request)
  const err = requireFields(body, ['name','email','password'])
  if (err) return badRequest(err)
  const existing = await env.DB.prepare('SELECT id FROM users WHERE email=? AND school_id=?').bind(body.email, params.id).first()
  if (existing) return badRequest('Email already registered for this school')
  const hash = await hashPassword(body.password)
  const uid = id()
  await env.DB.prepare(
    'INSERT INTO users (id, school_id, name, email, password_hash, role) VALUES (?,?,?,?,?,?)'
  ).bind(uid, params.id, body.name, body.email.toLowerCase(), hash, body.role || 'admin').run()
  return created({ id: uid, name: body.name, email: body.email, role: body.role || 'admin' })
}
