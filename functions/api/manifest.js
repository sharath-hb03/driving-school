// GET /api/manifest?slug=grace
// Returns a school-branded Web App Manifest dynamically from D1

export async function onRequestGet(context) {
  const { env, request } = context
  const url  = new URL(request.url)
  const slug = url.searchParams.get('slug') || ''

  let name       = 'DriveSchool Manager'
  let short_name = 'DriveSchool'
  let start_url  = '/login'

  if (slug && env.DB) {
    const school = await env.DB.prepare(
      'SELECT name FROM schools WHERE slug=? AND active=1'
    ).bind(slug).first()

    if (school) {
      name      = school.name
      // Trim to ≤ 12 chars for home screen
      short_name = school.name.length > 12 ? school.name.slice(0, 12).trimEnd() : school.name
      start_url  = `/login?school=${encodeURIComponent(slug)}`
    }
  }

  const manifest = {
    name,
    short_name,
    description: `${name} — Driving School Management`,
    start_url,
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#f8fafc',
    theme_color: '#4f46e5',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }

  return new Response(JSON.stringify(manifest, null, 2), {
    headers: {
      'Content-Type': 'application/manifest+json',
      'Cache-Control': 'no-cache, no-store',
    },
  })
}
