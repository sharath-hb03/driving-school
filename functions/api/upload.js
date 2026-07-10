// POST /api/upload  — multipart/form-data with `file` field (images or PDF, max 10 MB)
// Optional field: `folder` — a subfolder name, always nested under this school's namespace
// Returns: { url, public_id, format, bytes }
import { ok, badRequest, forbidden } from '../_lib/utils.js'
import { cloudinaryUpload } from '../_lib/cloudinary.js'

export async function onRequestPost(context) {
  const { env, request, data } = context
  const { user } = data

  // Only authenticated users can upload
  if (!user) return forbidden('Not authenticated')

  let formData
  try {
    formData = await request.formData()
  } catch {
    return badRequest('Expected multipart/form-data')
  }

  const file = formData.get('file')
  if (!file || typeof file === 'string') return badRequest('No file provided')

  // Limit file size to 10 MB
  if (file.size > 10 * 1024 * 1024) return badRequest('File too large (max 10 MB)')

  // Only allow images and PDFs
  const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf']
  if (!ALLOWED_TYPES.includes(file.type)) {
    return badRequest('Unsupported file type (images or PDF only)')
  }

  // Client may name a subfolder, but it is always confined to this school's namespace —
  // strip anything but [a-z0-9_-] so no path traversal or cross-tenant folder is possible.
  const rawFolder = formData.get('folder')
  const sub = typeof rawFolder === 'string' ? rawFolder.replace(/[^a-z0-9_-]/gi, '').slice(0, 40) : ''
  const folder = `dsms/${data.schoolId || 'common'}${sub ? `/${sub}` : ''}`

  try {
    const result = await cloudinaryUpload(file, env, { folder })
    return ok(result)
  } catch (err) {
    return badRequest(err.message)
  }
}
