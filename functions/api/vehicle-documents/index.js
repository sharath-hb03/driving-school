// GET  /api/vehicle-documents?vehicle_id=&expiring=30   -> list documents (school-scoped)
// POST /api/vehicle-documents                            -> add a document / renewal
import { ok, created, readJson, requireFields, badRequest, id, pick } from '../../_lib/utils.js'

const SELECT = `
  SELECT d.*, v.vehicle_number, v.model
  FROM vehicle_documents d 
  JOIN vehicles v ON v.id = d.vehicle_id`

export async function onRequestGet(context) {
  const { env, data, request } = context
  const sid = data.schoolId
  const url = new URL(request.url)
  const vehicleId = url.searchParams.get('vehicle_id')
  const expiring = url.searchParams.get('expiring') // days; only the CURRENT doc per (vehicle, type)

  if (expiring !== null) {
    const days = Math.max(0, parseInt(expiring, 10) || 0)
    const today = url.searchParams.get('date') || new Date().toISOString().slice(0, 10)

    const { results } = await env.DB.prepare(
      `${SELECT}
       WHERE d.school_id = ? 
         AND v.school_id = ?
         AND d.id IN (
           SELECT id FROM vehicle_documents vd
           WHERE vd.school_id = ? 
             AND vd.expiry_date = (
               SELECT MAX(expiry_date) FROM vehicle_documents
               WHERE vehicle_id = vd.vehicle_id AND doc_type = vd.doc_type AND school_id = ?
             )
         )
         AND date(d.expiry_date) <= date(?, '+' || ? || ' days')
       ORDER BY d.expiry_date ASC`
    )
      .bind(sid, sid, sid, sid, today, String(days))
      .all()
    return ok({ documents: results })
  }

  const sql = vehicleId
    ? `${SELECT} WHERE d.school_id = ? AND v.school_id = ? AND d.vehicle_id = ? ORDER BY d.doc_type ASC, d.expiry_date DESC`
    : `${SELECT} WHERE d.school_id = ? AND v.school_id = ? ORDER BY d.expiry_date ASC LIMIT 500`
  const binds = vehicleId ? [sid, sid, vehicleId] : [sid, sid]
  const { results } = await env.DB.prepare(sql).bind(...binds).all()
  return ok({ documents: results })
}

export async function onRequestPost(context) {
  const { env, data, request } = context
  const sid = data.schoolId
  const body = await readJson(request)
  if (!body) return badRequest('Invalid JSON')
  const missing = requireFields(body, ['vehicle_id', 'doc_type', 'expiry_date'])
  if (missing) return badRequest(missing)

  // Verify vehicle belongs to school
  const vehicle = await env.DB.prepare('SELECT id FROM vehicles WHERE id=? AND school_id=?').bind(body.vehicle_id, sid).first()
  if (!vehicle) return badRequest('Vehicle not found')

  const p = pick(body, ['vehicle_id', 'doc_type', 'provider', 'doc_number', 'amount', 'start_date', 'expiry_date', 'file_key', 'notes'])
  const did = id('vdoc_')
  await env.DB.prepare(
    `INSERT INTO vehicle_documents
       (id, school_id, vehicle_id, doc_type, provider, doc_number, amount, start_date, expiry_date, file_key, notes, reminded_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      did,
      sid,
      p.vehicle_id,
      p.doc_type,
      p.provider || null,
      p.doc_number || null,
      p.amount != null && p.amount !== '' ? Number(p.amount) : null,
      p.start_date || null,
      p.expiry_date,
      p.file_key || null,
      p.notes || null,
      null // reminded_at
    )
    .run()
  const row = await env.DB.prepare(`${SELECT} WHERE d.id = ? AND d.school_id = ?`).bind(did, sid).first()
  return created({ document: row })
}
