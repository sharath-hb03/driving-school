// DELETE /api/portal/documents/:id -> the student removes one of their own documents
import { ok, forbidden, notFound } from '../../../_lib/utils.js'

export async function onRequestDelete(context) {
  const { env, data, params } = context
  const { user } = data
  if (user.role !== 'student') return forbidden('Student portal only')
  const sid = data.schoolId
  const studentId = user.sub || user.id

  const doc = await env.DB.prepare(
    'SELECT id FROM student_documents WHERE id = ? AND student_id = ? AND school_id = ?'
  ).bind(params.id, studentId, sid).first()
  if (!doc) return notFound('Document not found')

  await env.DB.prepare('DELETE FROM student_documents WHERE id = ? AND student_id = ? AND school_id = ?')
    .bind(params.id, studentId, sid).run()
  return ok({ deleted: true })
}
