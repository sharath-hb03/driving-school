// GET /api/auth/me -> { ok, user }
import { json } from '../../_lib/utils.js'
import { logoDisplayUrl } from '../../_lib/cloudinary.js'

export async function onRequestGet(context) {
  const { data, env } = context
  if (!data.user) return json({ ok: true, user: null })

  const u = data.user
  let school_name = u.school_name || null
  let school_slug = u.school_slug || null
  let school_logo = null

  // Refresh school branding from DB (name/slug may be stale in the token; logo is never in it)
  if (u.school_id) {
    const s = await env.DB.prepare('SELECT name, slug, logo_key FROM schools WHERE id = ?').bind(u.school_id).first()
    if (s) {
      school_name = s.name || school_name
      school_slug = s.slug || school_slug
      school_logo = logoDisplayUrl(env, s.logo_key)
    }
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
      school_logo,
    }
  })
}
