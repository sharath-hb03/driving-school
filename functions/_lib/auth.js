// Auth helpers: PBKDF2 password hashing + HMAC-signed session JWTs.
// All built on the Web Crypto API available in Cloudflare Workers.

const enc = new TextEncoder()
const PBKDF2_ITERATIONS = 100_000
const SESSION_DAYS = 30

// ---------- base64url ----------
function b64urlEncode(bytes) {
  let bin = ''
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  for (const b of arr) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
function b64urlDecode(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/')
  while (str.length % 4) str += '='
  const bin = atob(str)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}
const toHex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
const fromHex = (hex) => new Uint8Array(hex.match(/.{1,2}/g).map((b) => parseInt(b, 16)))

// ---------- password hashing ----------
export async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    key,
    256
  )
  return `${toHex(salt)}:${toHex(bits)}`
}

export async function verifyPassword(password, stored) {
  if (!stored || !stored.includes(':')) return false
  const [saltHex, hashHex] = stored.split(':')
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: fromHex(saltHex), iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    key,
    256
  )
  return timingSafeEqual(toHex(bits), hashHex)
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

// ---------- JWT (HS256) ----------
async function hmacKey(secret) {
  return crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify'])
}

export async function signSession(payload, secret) {
  const header = { alg: 'HS256', typ: 'JWT' }
  const now = Math.floor(Date.now() / 1000)
  const body = { ...payload, iat: now, exp: now + SESSION_DAYS * 86400 }
  const data = `${b64urlEncode(enc.encode(JSON.stringify(header)))}.${b64urlEncode(enc.encode(JSON.stringify(body)))}`
  const sig = await crypto.subtle.sign('HMAC', await hmacKey(secret), enc.encode(data))
  return `${data}.${b64urlEncode(sig)}`
}

export async function verifySession(token, secret) {
  if (!token) return null
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const data = `${parts[0]}.${parts[1]}`
  const valid = await crypto.subtle.verify('HMAC', await hmacKey(secret), b64urlDecode(parts[2]), enc.encode(data))
  if (!valid) return null
  try {
    const payload = JSON.parse(new TextDecoder().decode(b64urlDecode(parts[1])))
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null
    return payload
  } catch {
    return null
  }
}

// ---------- cookies ----------
export function parseCookies(request) {
  const header = request.headers.get('Cookie') || ''
  const out = {}
  header.split(';').forEach((part) => {
    const i = part.indexOf('=')
    if (i > -1) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim())
  })
  return out
}

export function sessionCookie(token) {
  const maxAge = SESSION_DAYS * 86400
  return `session=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`
}

export const clearCookie = () => 'session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0'

// Resolve the current user from the request cookie. Returns payload or null.
export async function getUser(request, env) {
  const token = parseCookies(request).session
  if (!token) return null
  return verifySession(token, env.AUTH_SECRET || 'dev-insecure-secret-change-me')
}
