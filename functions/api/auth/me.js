// GET /api/auth/me -> { ok, user }
import { json } from '../../_lib/utils.js'

export async function onRequestGet(context) {
  const { data, env } = context
  if (!data.user) return json({ ok: true, user: null })

  const u = data.user
  let school_name = u.school_name || null
  let school_slug = u.school_slug || null

  // Refresh school name + slug from DB for non-super-admin roles
  if (u.school_id && (!u.school_name || !u.school_slug)) {
    const s = await env.DB.prepare('SELECT name, slug FROM schools WHERE id = ?').bind(u.school_id).first()
    school_name = s?.name || null
    school_slug = s?.slug || null
  }

  return json({
    ok: true,
    user: {
      id:          u.sub || u.id,
      email:       u.email,
      name:        u.name,
      role:        u.role,
      school_id:   u.school_id   || null,
      school_name,
      school_slug,
    }
  })
}
