// GET /api/instructors?active=
// POST /api/instructors
import { ok, created, badRequest, readJson, requireFields, id } from '../../_lib/utils.js'
import { hashPassword } from '../../_lib/auth.js'

export async function onRequestGet(context) {
  const { env, data, request } = context
  const sid = data.schoolId
  const url = new URL(request.url)
  const active = url.searchParams.get('active')
  let where = 'WHERE school_id=?'
  const params = [sid]
  if (active === '1') { where += ' AND active=1' }
  if (active === '0') { where += ' AND active=0' }
  const { results } = await env.DB.prepare(`SELECT * FROM instructors ${where} ORDER BY name ASC`).bind(...params).all()
  return ok({ instructors: results })
}

export async function onRequestPost(context) {
  const { env, data, request } = context
  const sid = data.schoolId
  const body = await readJson(request)
  if (!body) return badRequest('Invalid JSON')
  const missing = requireFields(body, ['name'])
  if (missing) return badRequest(missing)

  const instId = id('ins_')
  let passwordHash = null
  if (body.password) {
    if (String(body.password).length < 8) return badRequest('Password must be at least 8 characters')
    passwordHash = await hashPassword(body.password)
  }
  const email = body.email ? String(body.email).trim().toLowerCase() : null
  if (email) {
    const ex = await env.DB.prepare('SELECT id FROM instructors WHERE email=? AND password_hash IS NOT NULL').bind(email).first()
    if (ex) return badRequest('Email already registered')
  }

  await env.DB.prepare(`INSERT INTO instructors (id,school_id,name,phone,email,password_hash,license_type,active,notes,work_days,work_start,work_end)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).bind(
    instId, sid,
    String(body.name).trim(),
    body.phone || null, email, passwordHash,
    body.license_type || 'both',
    body.active !== undefined ? (body.active ? 1 : 0) : 1,
    body.notes || null,
    body.work_days || '1,2,3,4,5,6',
    body.work_start || '06:00',
    body.work_end || '20:00'
  ).run()

  const instructor = await env.DB.prepare('SELECT * FROM instructors WHERE id=?').bind(instId).first()
  return created({ instructor })
}
