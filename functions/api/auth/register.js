// POST /api/auth/register — admin/staff only (creates school staff)
import { hashPassword } from '../../_lib/auth.js'
import { readJson, requireFields, badRequest, forbidden, json, id } from '../../_lib/utils.js'

export async function onRequestPost(context) {
  const { request, env, data } = context
  const user = data.user
  if (!user || user.role !== 'admin') return forbidden('Only school admins can add staff')

  const body = await readJson(request)
  if (!body) return badRequest('Invalid JSON')
  const missing = requireFields(body, ['email', 'password', 'name'])
  if (missing) return badRequest(missing)
  if (String(body.password).length < 8) return badRequest('Password must be at least 8 characters')

  const email = String(body.email).trim().toLowerCase()
  const exists = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first()
  if (exists) return badRequest('That email is already registered')

  const userId = id('usr_')
  const passwordHash = await hashPassword(body.password)
  const role = body.role === 'staff' ? 'staff' : 'admin'

  await env.DB.prepare(
    'INSERT INTO users (id, school_id, email, name, role, password_hash) VALUES (?,?,?,?,?,?)'
  ).bind(userId, user.school_id, email, String(body.name).trim(), role, passwordHash).run()

  return json({ ok: true, user: { id: userId, email, name: body.name, role, school_id: user.school_id } }, { status: 201 })
}
