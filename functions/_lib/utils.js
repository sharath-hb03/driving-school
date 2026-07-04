// Shared helpers for Cloudflare Pages Functions.

export const json = (data, init = {}) =>
  new Response(JSON.stringify(data), {
    ...init,
    headers: { 'content-type': 'application/json; charset=utf-8', ...(init.headers || {}) }
  })

export const ok = (data = {}) => json({ ok: true, ...data })
export const created = (data = {}) => json({ ok: true, ...data }, { status: 201 })
export const badRequest = (error = 'Bad request') => json({ ok: false, error }, { status: 400 })
export const unauthorized = (error = 'Unauthorized') => json({ ok: false, error }, { status: 401 })
export const forbidden = (error = 'Forbidden') => json({ ok: false, error }, { status: 403 })
export const notFound = (error = 'Not found') => json({ ok: false, error }, { status: 404 })
export const serverError = (error = 'Server error') => json({ ok: false, error }, { status: 500 })

// Short, URL-safe, sortable-ish id (prefix + time + random).
export function id(prefix = '') {
  const rand = crypto.getRandomValues(new Uint8Array(8))
  const hex = [...rand].map((b) => b.toString(16).padStart(2, '0')).join('')
  return `${prefix}${Date.now().toString(36)}${hex}`
}

export async function readJson(request) {
  try { return await request.json() } catch { return null }
}

// Pick only allowed keys from an object (whitelist for inserts/updates).
export function pick(obj, keys) {
  const out = {}
  for (const k of keys) if (obj[k] !== undefined) out[k] = obj[k]
  return out
}

export const isValidPhone = (v) => /^\d{10}$/.test(String(v ?? '').trim())

export function requireFields(obj, fields) {
  const missing = fields.filter((f) => obj?.[f] === undefined || obj[f] === null || obj[f] === '')
  return missing.length ? `Missing required field(s): ${missing.join(', ')}` : null
}

// Build a parameterised UPDATE from a plain object.
export function buildUpdate(table, data, idValue, schoolId, allowed) {
  const cols = Object.keys(data).filter((k) => allowed.includes(k))
  if (!cols.length) return null
  const setClause = cols.map((c) => `${c} = ?`).join(', ')
  const values = cols.map((c) => data[c])
  values.push(idValue, schoolId)
  return { sql: `UPDATE ${table} SET ${setClause} WHERE id = ? AND school_id = ?`, values }
}

// Slugify a name into a URL-safe identifier.
export function slugify(name) {
  return String(name)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
