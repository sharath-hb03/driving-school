const BASE = import.meta.env.VITE_API_BASE || '/api'

async function request(path, { method = 'GET', body, headers } = {}) {
  const opts = { method, credentials: 'include', headers: { ...(headers || {}) } }
  if (body !== undefined) {
    if (body instanceof FormData) {
      opts.body = body
    } else {
      opts.headers['Content-Type'] = 'application/json'
      opts.body = JSON.stringify(body)
    }
  }
  const res = await fetch(`${BASE}${path}`, opts)
  let data = null
  try { data = await res.json() } catch { /* non-JSON */ }
  if (!res.ok) {
    const err = new Error(data?.error || `Request failed (${res.status})`)
    err.status = res.status
    err.data = data
    throw err
  }
  return data
}

export const api = {
  get: (p) => request(p),
  post: (p, body) => request(p, { method: 'POST', body }),
  put: (p, body) => request(p, { method: 'PUT', body }),
  del: (p) => request(p, { method: 'DELETE' }),
  upload: (file, folder) => {
    const fd = new FormData()
    fd.append('file', file)
    if (folder) fd.append('folder', folder)
    return request('/upload', { method: 'POST', body: fd })
  },
  // Portal users (students/instructors) upload here — /upload is staff-only.
  portalUpload: (file, folder) => {
    const fd = new FormData()
    fd.append('file', file)
    if (folder) fd.append('folder', folder)
    return request('/portal/upload', { method: 'POST', body: fd })
  }
}

export const fileUrl = (key) => {
  if (!key) return null
  if (key.startsWith('http://') || key.startsWith('https://')) return key
  return `${BASE}/files/${key}`
}
