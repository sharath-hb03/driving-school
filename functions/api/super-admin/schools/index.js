// GET /api/super-admin/schools?search=&status=&page=1&limit=20
// POST /api/super-admin/schools  { name, slug, phone, email, address, adminName?, adminEmail?, adminPassword? }
import { ok, created, badRequest, json, id, readJson, requireFields, slugify } from '../../../_lib/utils.js'
import { hashPassword } from '../../../_lib/auth.js'

export async function onRequestGet(context) {
  const { env, request } = context
  const url = new URL(request.url)
  const search = url.searchParams.get('search') || ''
  const status = url.searchParams.get('status') || 'all'
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'))
  const limit = Math.min(100, parseInt(url.searchParams.get('limit') || '20'))
  const offset = (page - 1) * limit
  const monthPrefix = new Date().toISOString().slice(0, 7)

  let where = 'WHERE 1=1'
  const params = []
  if (search) { where += ' AND s.name LIKE ?'; params.push(`%${search}%`) }
  if (status === 'active') { where += ' AND s.active=1' }
  if (status === 'suspended') { where += ' AND s.active=0' }

  const countRow = await env.DB.prepare(`SELECT COUNT(*) AS n FROM schools s ${where}`).bind(...params).first()
  const { results } = await env.DB.prepare(`
    SELECT s.id, s.name, s.slug, s.phone, s.email, s.address, s.logo_key, s.active, s.created_at,
      (SELECT COUNT(*) FROM students st WHERE st.school_id=s.id) AS student_count,
      (SELECT COUNT(*) FROM instructors i WHERE i.school_id=s.id AND i.active=1) AS instructor_count,
      (SELECT COALESCE(SUM(p.amount),0) FROM payments p WHERE p.school_id=s.id AND substr(p.paid_at,1,7)=?) AS revenue_this_month,
      (SELECT u.email FROM users u WHERE u.school_id=s.id AND u.role='admin' LIMIT 1) AS admin_email
    FROM schools s ${where}
    ORDER BY s.created_at DESC LIMIT ? OFFSET ?
  `).bind(monthPrefix, ...params, limit, offset).all()

  return ok({ schools: results, total: countRow.n, page, limit })
}

export async function onRequestPost(context) {
  const { env, request } = context
  const body = await readJson(request)
  if (!body) return badRequest('Invalid JSON')
  const missing = requireFields(body, ['name'])
  if (missing) return badRequest(missing)

  const slug = body.slug ? String(body.slug).toLowerCase().trim() : slugify(body.name)
  if (!/^[a-z0-9-]+$/.test(slug)) return badRequest('Slug must only contain lowercase letters, numbers, and hyphens')

  const exists = await env.DB.prepare('SELECT id FROM schools WHERE slug=?').bind(slug).first()
  if (exists) return badRequest('A school with this slug already exists')

  const schoolId = id('sch_')
  await env.DB.prepare(
    'INSERT INTO schools (id,name,slug,phone,email,address) VALUES (?,?,?,?,?,?)'
  ).bind(schoolId, String(body.name).trim(), slug, body.phone||null, body.email||null, body.address||null).run()

  let admin = null
  if (body.adminName && body.adminEmail && body.adminPassword) {
    if (String(body.adminPassword).length < 8) return badRequest('Admin password must be at least 8 characters')
    const adminId = id('usr_')
    const hash = await hashPassword(body.adminPassword)
    const adminEmail = String(body.adminEmail).trim().toLowerCase()
    await env.DB.prepare(
      'INSERT INTO users (id,school_id,email,name,role,password_hash) VALUES (?,?,?,?,?,?)'
    ).bind(adminId, schoolId, adminEmail, String(body.adminName).trim(), 'admin', hash).run()
    admin = { id: adminId, email: adminEmail, name: body.adminName, role: 'admin' }
  }

  const school = await env.DB.prepare('SELECT * FROM schools WHERE id=?').bind(schoolId).first()
  return created({ school, admin })
}
