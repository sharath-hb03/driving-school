// POST /api/upload  — multipart/form-data with `file` field
// Optional field: `folder` (default: 'dsms')
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

  const folder = formData.get('folder') || `dsms/${data.schoolId || 'common'}`

  try {
    const result = await cloudinaryUpload(file, env, { folder })
    return ok(result)
  } catch (err) {
    return badRequest(err.message)
  }
}
