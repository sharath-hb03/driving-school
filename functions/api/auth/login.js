// POST /api/auth/login  { email, password }
// Checks: super_admins → users → students → instructors
import { verifyPassword, signSession, sessionCookie } from '../../_lib/auth.js'
import { readJson, requireFields, badRequest, unauthorized, json } from '../../_lib/utils.js'

export async function onRequestPost(context) {
  const { request, env } = context
  const body = await readJson(request)
  if (!body) return badRequest('Invalid JSON')
  const missing = requireFields(body, ['email', 'password'])
  if (missing) return badRequest(missing)

  const email = String(body.email).trim().toLowerCase()
  const DB = env.DB

  // 1. Super admin
  const sa = await DB.prepare('SELECT * FROM super_admins WHERE email = ?').bind(email).first()
  if (sa) {
    const valid = await verifyPassword(body.password, sa.password_hash)
    if (!valid) return unauthorized('Invalid email or password')
    const token = await signSession(
      { sub: sa.id, email: sa.email, name: sa.name, role: 'super_admin', school_id: null },
      env.AUTH_SECRET
    )
    const user = { id: sa.id, email: sa.email, name: sa.name, role: 'super_admin', school_id: null, school_name: null }
    return json({ ok: true, user }, { headers: { 'Set-Cookie': sessionCookie(token) } })
  }

  // 2. School users (admin / staff)
  const u = await DB.prepare(
    `SELECT u.*, s.name AS school_name, s.slug AS school_slug FROM users u
     JOIN schools s ON s.id = u.school_id
     WHERE u.email = ?`
  ).bind(email).first()
  if (u) {
    const valid = await verifyPassword(body.password, u.password_hash)
    if (!valid) return unauthorized('Invalid email or password')
    if (!u.active && u.active !== undefined) return unauthorized('This account has been deactivated')
    const token = await signSession(
      { sub: u.id, email: u.email, name: u.name, role: u.role, school_id: u.school_id, school_name: u.school_name, school_slug: u.school_slug },
      env.AUTH_SECRET
    )
    const user = { id: u.id, email: u.email, name: u.name, role: u.role, school_id: u.school_id, school_name: u.school_name, school_slug: u.school_slug }
    return json({ ok: true, user }, { headers: { 'Set-Cookie': sessionCookie(token) } })
  }

  // 3. Students (portal login)
  const st = await DB.prepare(
    `SELECT st.*, s.name AS school_name, s.slug AS school_slug FROM students st
     JOIN schools s ON s.id = st.school_id
     WHERE st.email = ? AND st.password_hash IS NOT NULL`
  ).bind(email).first()
  if (st) {
    const valid = await verifyPassword(body.password, st.password_hash)
    if (!valid) return unauthorized('Invalid email or password')
    const token = await signSession(
      { sub: st.id, email: st.email, name: st.name, role: 'student', school_id: st.school_id, school_name: st.school_name, school_slug: st.school_slug },
      env.AUTH_SECRET
    )
    const user = { id: st.id, email: st.email, name: st.name, role: 'student', school_id: st.school_id, school_name: st.school_name, school_slug: st.school_slug }
    return json({ ok: true, user }, { headers: { 'Set-Cookie': sessionCookie(token) } })
  }

  // 4. Instructors (portal login)
  const ins = await DB.prepare(
    `SELECT i.*, s.name AS school_name, s.slug AS school_slug FROM instructors i
     JOIN schools s ON s.id = i.school_id
     WHERE i.email = ? AND i.password_hash IS NOT NULL`
  ).bind(email).first()
  if (ins) {
    const valid = await verifyPassword(body.password, ins.password_hash)
    if (!valid) return unauthorized('Invalid email or password')
    const token = await signSession(
      { sub: ins.id, email: ins.email, name: ins.name, role: 'instructor', school_id: ins.school_id, school_name: ins.school_name, school_slug: ins.school_slug },
      env.AUTH_SECRET
    )
    const user = { id: ins.id, email: ins.email, name: ins.name, role: 'instructor', school_id: ins.school_id, school_name: ins.school_name, school_slug: ins.school_slug }
    return json({ ok: true, user }, { headers: { 'Set-Cookie': sessionCookie(token) } })
  }

  return unauthorized('Invalid email or password')
}
