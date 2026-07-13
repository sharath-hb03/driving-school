// GET /api/icon?slug=grace&size=192
// Serves the school's logo as a square PNG (apple-touch-icon / favicon).
// Falls back to the bundled default icon when the school has no logo.
// Proxies the bytes (no redirect) because iOS doesn't reliably follow
// redirects for apple-touch-icon.
import { logoIconUrl } from '../_lib/cloudinary.js'

const SIZES = [192, 512]

export async function onRequestGet(context) {
  const { env, request } = context
  const url  = new URL(request.url)
  const slug = url.searchParams.get('slug') || ''
  const size = SIZES.includes(Number(url.searchParams.get('size'))) ? Number(url.searchParams.get('size')) : 192

  // An icon must never 500 — any failure falls through to the default icon.
  let logoUrl = null
  try {
    if (slug && env.DB) {
      const school = await env.DB.prepare(
        'SELECT logo_key FROM schools WHERE slug=? AND active=1'
      ).bind(slug).first()
      logoUrl = logoIconUrl(env, school?.logo_key, size)
    }
  } catch { /* fall back to default */ }

  if (logoUrl) {
    const res = await fetch(logoUrl).catch(() => null)
    if (res?.ok) {
      return new Response(res.body, {
        headers: {
          'Content-Type': 'image/png',
          // Short cache so a newly uploaded logo shows up soon
          'Cache-Control': 'public, max-age=3600',
        },
      })
    }
  }

  // Default bundled icon (served via the static assets binding)
  const fallback = new URL(`/icons/icon-${size}.png`, url.origin)
  if (env.ASSETS) return env.ASSETS.fetch(new Request(fallback))
  return Response.redirect(fallback.toString(), 302)
}
