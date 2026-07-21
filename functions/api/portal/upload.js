// POST /api/portal/upload — multipart/form-data with `file` (image or PDF, max 10 MB).
// Portal counterpart of /api/upload: lets students/instructors upload from the portal,
// where the staff-only /api/upload is blocked by the middleware. Confined to this school.
import { ok, badRequest, forbidden } from '../../_lib/utils.js'
import { cloudinaryUpload } from '../../_lib/cloudinary.js'

export async function onRequestPost(context) {
  const { env, request, data } = context
  const { user } = data
  if (!user) return forbidden('Not authenticated')

  let formData
  try {
    formData = await request.formData()
  } catch {
    return badRequest('Expected multipart/form-data')
  }

  const file = formData.get('file')
  if (!file || typeof file === 'string') return badRequest('No file provided')
  if (file.size > 10 * 1024 * 1024) return badRequest('File too large (max 10 MB)')

  const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf']
  if (!ALLOWED_TYPES.includes(file.type)) {
    return badRequest('Unsupported file type (images or PDF only)')
  }

  const rawFolder = formData.get('folder')
  const sub = typeof rawFolder === 'string' ? rawFolder.replace(/[^a-z0-9_-]/gi, '').slice(0, 40) : ''
  const folder = `instrukt/${data.schoolId || 'common'}${sub ? `/${sub}` : ''}`

  try {
    const result = await cloudinaryUpload(file, env, { folder })
    return ok(result)
  } catch (err) {
    return badRequest(err.message)
  }
}
