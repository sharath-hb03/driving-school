// GET/POST /api/holidays  DELETE /api/holidays/:id
import { ok, created, badRequest, readJson, requireFields, id } from '../../_lib/utils.js'

export async function onRequestGet(context) {
  const { env, data, request } = context
  const url = new URL(request.url)
  const where = ['school_id = ?']
  const binds = [data.schoolId]
  const from = url.searchParams.get('from')
  const to = url.searchParams.get('to')
  if (from) { where.push('date >= ?'); binds.push(from) }
  if (to) { where.push('date <= ?'); binds.push(to) }
  const sql = `SELECT * FROM holidays WHERE ${where.join(' AND ')} ORDER BY date ASC`
  const { results } = await env.DB.prepare(sql).bind(...binds).all()
  return ok({ holidays: results })
}

export async function onRequestPost(context) {
  const { env, data, request } = context
  const sid = data.schoolId
  const body = await readJson(request)
  if (!body) return badRequest('Invalid JSON')
  const missing = requireFields(body, ['date', 'name'])
  if (missing) return badRequest(missing)
  const hId = id('hol_')
  try {
    await env.DB.prepare('INSERT INTO holidays (id,school_id,date,name) VALUES (?,?,?,?)').bind(hId, sid, body.date, String(body.name).trim()).run()
  } catch (e) {
    if (String(e.message || '').includes('UNIQUE')) return badRequest('That date is already a holiday')
    return badRequest('Failed to add holiday')
  }
  const holiday = await env.DB.prepare('SELECT * FROM holidays WHERE id=?').bind(hId).first()
  return created({ holiday })
}
