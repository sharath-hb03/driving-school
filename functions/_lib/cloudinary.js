// Cloudinary signed upload + delivery-URL helpers (Web Crypto only — runs on Workers).
// We upload an SVG (as a data URI) and let Cloudinary rasterize it to PNG on delivery,
// so the certificate is a real downloadable image without any server-side canvas.

const API_BASE = 'https://api.cloudinary.com/v1_1'
const CDN_BASE = 'https://res.cloudinary.com'

export function isConfigured(env) {
  return Boolean(env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET)
}

// UTF-8 safe base64 (avoids the deprecated unescape); mirrors _lib/auth.js byte handling.
export function svgDataUri(svg) {
  const bytes = new TextEncoder().encode(svg)
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return `data:image/svg+xml;base64,${btoa(bin)}`
}

async function sha1Hex(str) {
  const buf = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(str))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

// Cloudinary signature: sort the signed params, join as k=v&…, append the api_secret, SHA-1 hex.
export async function signParams(params, apiSecret) {
  const sorted = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join('&')
  return sha1Hex(`${sorted}${apiSecret}`)
}

// POST a data URI to Cloudinary's signed upload endpoint. Returns the parsed JSON
// ({ secure_url, public_id, version, … }) or throws with Cloudinary's error message.
export async function uploadDataUri(env, { dataUri, publicId, overwrite = true, eager, tags }) {
  if (!isConfigured(env)) throw new Error('Cloudinary is not configured')

  const toSign = { timestamp: String(Math.floor(Date.now() / 1000)) }
  if (publicId) toSign.public_id = publicId
  if (overwrite !== undefined) toSign.overwrite = overwrite ? 'true' : 'false'
  if (eager) toSign.eager = eager
  if (tags) toSign.tags = tags

  const signature = await signParams(toSign, env.CLOUDINARY_API_SECRET)

  const form = new FormData()
  form.append('file', dataUri)
  form.append('api_key', env.CLOUDINARY_API_KEY)
  for (const [k, v] of Object.entries(toSign)) form.append(k, v)
  form.append('signature', signature)

  const res = await fetch(`${API_BASE}/${env.CLOUDINARY_CLOUD_NAME}/image/upload`, { method: 'POST', body: form })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json?.error?.message || `Cloudinary upload failed (${res.status})`)
  return json
}

// ---- File upload (for existing file/blob use-cases) ----
export async function cloudinaryUpload(file, env, opts = {}) {
  const cloudName   = env.CLOUDINARY_CLOUD_NAME
  const apiKey      = env.CLOUDINARY_API_KEY
  const apiSecret   = env.CLOUDINARY_API_SECRET
  if (!cloudName || !apiKey || !apiSecret) throw new Error('Cloudinary credentials not configured')

  const folder        = opts.folder        || 'dsms'
  const resource_type = opts.resource_type || 'auto'
  const timestamp     = String(Math.round(Date.now() / 1000))

  const signableParams = { folder, timestamp }
  const signature  = await signParams(signableParams, apiSecret)

  const fd = new FormData()
  fd.append('file', file)
  fd.append('api_key', apiKey)
  fd.append('timestamp', timestamp)
  fd.append('folder', folder)
  fd.append('signature', signature)

  const res = await fetch(
    `${API_BASE}/${cloudName}/${resource_type}/upload`,
    { method: 'POST', body: fd }
  )
  const data = await res.json()
  if (!res.ok || data.error) throw new Error(data.error?.message || 'Cloudinary upload failed')

  return {
    url:       data.secure_url,
    public_id: data.public_id,
    format:    data.format,
    bytes:     data.bytes,
    width:     data.width,
    height:    data.height,
  }
}

// ---- Delivery URLs (rasterize the uploaded SVG to PNG on the fly; version busts cache on regen) ----
const ver = (v) => (v ? `v${v}/` : '')

export function rasterUrl(env, publicId, version) {
  return `${CDN_BASE}/${env.CLOUDINARY_CLOUD_NAME}/image/upload/f_png,q_auto,c_limit,w_1600/${ver(version)}${publicId}.png`
}

export function attachmentUrl(env, publicId, version, filename) {
  const safe = String(filename || 'certificate').replace(/[^a-z0-9_-]/gi, '_')
  return `${CDN_BASE}/${env.CLOUDINARY_CLOUD_NAME}/image/upload/fl_attachment:${safe},f_png,c_limit,w_1600/${ver(version)}${publicId}.png`
}

export async function cloudinaryDelete(publicId, env) {
  const cloudName = env.CLOUDINARY_CLOUD_NAME
  const apiKey    = env.CLOUDINARY_API_KEY
  const apiSecret = env.CLOUDINARY_API_SECRET
  const timestamp = String(Math.round(Date.now() / 1000))
  const sig = await signParams({ public_id: publicId, timestamp }, apiSecret)

  const fd = new FormData()
  fd.append('public_id', publicId)
  fd.append('api_key', apiKey)
  fd.append('timestamp', timestamp)
  fd.append('signature', sig)

  const res = await fetch(
    `${API_BASE}/${cloudName}/image/destroy`,
    { method: 'POST', body: fd }
  )
  return res.json()
}
