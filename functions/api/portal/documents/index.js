// GET  /api/portal/documents  -> the logged-in student's own uploaded documents
// POST /api/portal/documents  -> add or replace one document (upsert by doc_type)
import { ok, created, badRequest, forbidden, readJson, id, pick } from '../../../_lib/utils.js'

// Keep in sync with the client whitelist in src/lib/studentDocs.js
const DOC_TYPES = new Set(['aadhaar', 'photo', 'signature', 'address_proof', 'dob_proof', 'll_scan', 'dl_scan', 'other'])

export async function onRequestGet(context) {
  const { env, data } = context
  const { user } = data
  if (user.role !== 'student') return forbidden('Student portal only')
  const sid = data.schoolId
  const studentId = user.sub || user.id

  const { results } = await env.DB.prepare(
    'SELECT id, doc_type, file_key, file_format, doc_number, notes, uploaded_by, created_at FROM student_documents WHERE student_id = ? AND school_id = ? ORDER BY created_at DESC'
  ).bind(studentId, sid).all()
  return ok({ documents: results })
}

export async function onRequestPost(context) {
  const { env, data, request } = context
  const { user } = data
  if (user.role !== 'student') return forbidden('Student portal only')
  const sid = data.schoolId
  const studentId = user.sub || user.id

  const body = await readJson(request)
  if (!body) return badRequest('Invalid JSON')
  if (!DOC_TYPES.has(body.doc_type)) return badRequest('Unknown document type')
  if (!body.file_key) return badRequest('No file attached')

  const p = pick(body, ['doc_type', 'file_key', 'file_format', 'doc_number', 'notes'])

  // Upsert: one document per type per student (uploading again replaces it).
  const existing = await env.DB.prepare(
    'SELECT id FROM student_documents WHERE student_id = ? AND school_id = ? AND doc_type = ?'
  ).bind(studentId, sid, p.doc_type).first()

  let docId = existing?.id
  if (existing) {
    await env.DB.prepare(
      'UPDATE student_documents SET file_key = ?, file_format = ?, doc_number = ?, notes = ?, uploaded_by = ?, created_at = datetime(\'now\') WHERE id = ? AND school_id = ?'
    ).bind(p.file_key, p.file_format || null, p.doc_number || null, p.notes || null, 'student', existing.id, sid).run()
  } else {
    docId = id('sdoc_')
    await env.DB.prepare(
      `INSERT INTO student_documents (id, school_id, student_id, doc_type, file_key, file_format, doc_number, notes, uploaded_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'student')`
    ).bind(docId, sid, studentId, p.doc_type, p.file_key, p.file_format || null, p.doc_number || null, p.notes || null).run()
  }

  const row = await env.DB.prepare(
    'SELECT id, doc_type, file_key, file_format, doc_number, notes, uploaded_by, created_at FROM student_documents WHERE id = ? AND school_id = ?'
  ).bind(docId, sid).first()
  return created({ document: row })
}
