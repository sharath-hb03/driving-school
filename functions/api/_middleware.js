// Runs for every /api/* request. Enforces auth + school_id scoping.
import { getUser } from '../_lib/auth.js'
import { unauthorized, forbidden, json } from '../_lib/utils.js'

const PUBLIC_PATHS = new Set([
  '/api/auth/login',
  '/api/auth/me',
  '/api/health',
  '/api/manifest',
  '/api/icon',
  '/api/notify/cron',
])
const SUPER_ADMIN_PREFIX = '/api/super-admin/'
const PORTAL_PREFIX = '/api/portal/'
const STAFF_ROLES = new Set(['admin', 'staff'])

export async function onRequest(context) {
  const { request, next, env } = context
  const url = new URL(request.url)
  const path = url.pathname

  if (request.method === 'OPTIONS') return new Response(null, { status: 204 })

  // Public enquiry form (POST only — no auth needed for public form submission)
  const isPublicEnquiry = path === '/api/enquiries' && request.method === 'POST'
  // Public school info
  const isPublicInfo = path.startsWith('/api/public/')

  if (PUBLIC_PATHS.has(path) || isPublicEnquiry || isPublicInfo) {
    const user = await getUser(request, env)
    context.data.user = user
    if (user && user.school_id) {
      context.data.schoolId = user.school_id
    }
    return next()
  }

  // Auth logout allowed for everyone
  if (path === '/api/auth/logout') {
    context.data.user = await getUser(request, env)
    return next()
  }

  const user = await getUser(request, env)
  if (!user) return unauthorized('Please sign in')
  context.data.user = user

  // ---- Super-admin routes ----
  if (path.startsWith(SUPER_ADMIN_PREFIX)) {
    if (user.role !== 'super_admin') return forbidden('Super admin only')
    return next()
  }

  // ---- Portal routes (student / instructor) ----
  if (path.startsWith(PORTAL_PREFIX)) {
    if (user.role !== 'student' && user.role !== 'instructor') return forbidden('Portal access only')
    context.data.schoolId = user.school_id
    return next()
  }

  // ---- All other routes: admin / staff only ----
  if (!STAFF_ROLES.has(user.role)) return forbidden('Not allowed for this account')

  // Verify school is active
  if (user.school_id) {
    const school = await env.DB.prepare('SELECT active FROM schools WHERE id = ?')
      .bind(user.school_id).first()
    if (!school || !school.active) return forbidden('This school is suspended. Contact the platform admin.')
    context.data.schoolId = user.school_id
  }

  try {
    return await next()
  } catch (err) {
    return json({ ok: false, error: err?.message || 'Server error' }, { status: 500 })
  }
}
