// GET / PUT / DELETE  /api/vehicle-documents/:id (school-scoped)
import { ok, notFound, badRequest, readJson, buildUpdate, pick } from '../../_lib/utils.js'

const ALLOWED = ['doc_type', 'provider', 'doc_number', 'amount', 'start_date', 'expiry_date', 'file_key', 'notes']

const SELECT = `
  SELECT d.*, v.vehicle_number, v.model
  FROM vehicle_documents d JOIN vehicles v ON v.id = d.vehicle_id`

export async function onRequestGet(context) {
  const { env, params, data } = context
  const sid = data.schoolId
  const row = await env.DB.prepare(`${SELECT} WHERE d.id = ? AND d.school_id = ? AND v.school_id = ?`).bind(params.id, sid, sid).first()
  if (!row) return notFound('Document not found')
  return ok({ document: row })
}

export async function onRequestPut(context) {
  const { env, params, data, request } = context
  const sid = data.schoolId
  const body = await readJson(request)
  if (!body) return badRequest('Invalid JSON')

  const fields = pick(body, ALLOWED)
  if (fields.amount !== undefined) {
    fields.amount = fields.amount === '' || fields.amount === null ? null : Number(fields.amount)
  }

  const upd = buildUpdate('vehicle_documents', fields, params.id, sid, ALLOWED)
  if (!upd) return badRequest('Nothing to update')

  await env.DB.prepare(upd.sql).bind(...upd.values).run()
  const row = await env.DB.prepare(`${SELECT} WHERE d.id = ? AND d.school_id = ? AND v.school_id = ?`).bind(params.id, sid, sid).first()
  if (!row) return notFound('Document not found after update')
  return ok({ document: row })
}

export async function onRequestDelete(context) {
  const { env, params, data } = context
  const sid = data.schoolId
  await env.DB.prepare('DELETE FROM vehicle_documents WHERE id = ? AND school_id = ?').bind(params.id, sid).run()
  return ok({ deleted: true })
}
