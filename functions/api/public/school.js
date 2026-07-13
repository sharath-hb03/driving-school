// GET /api/public/school?slug=grace
// Publicly resolves a school's name + logo from its slug (used on login screen)
import { json } from '../../_lib/utils.js'
import { logoDisplayUrl } from '../../_lib/cloudinary.js'

export async function onRequestGet(context) {
  const { env, request } = context
  const url = new URL(request.url)
  const slug = url.searchParams.get('slug') || ''

  if (!slug) {
    return json({ ok: false, error: 'Missing school slug' }, { status: 400 })
  }

  if (!env.DB) {
    return json({ ok: false, error: 'Database binding missing' }, { status: 500 })
  }

  try {
    const school = await env.DB.prepare(
      'SELECT name, active, logo_key FROM schools WHERE slug = ?'
    ).bind(slug).first()

    if (!school) {
      return json({ ok: false, error: 'School not found' }, { status: 404 })
    }

    if (!school.active) {
      return json({ ok: false, error: 'This school is suspended' }, { status: 403 })
    }

    return json({
      ok: true,
      school: {
        name: school.name,
        slug: slug,
        logo_url: logoDisplayUrl(env, school.logo_key)
      }
    })
  } catch (err) {
    return json({ ok: false, error: err.message || 'Database error' }, { status: 500 })
  }
}
