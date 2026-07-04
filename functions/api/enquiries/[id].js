// GET/PUT/DELETE /api/enquiries/:id
import { ok, notFound, readJson } from '../../_lib/utils.js'

export async function onRequestGet(context) {
  const { env, params, data } = context
  const row = await env.DB.prepare('SELECT * FROM enquiries WHERE id=? AND school_id=?').bind(params.id, data.schoolId).first()
  if (!row) return notFound('Enquiry not found')
  return ok({ enquiry: row })
}

export async function onRequestPut(context) {
  const { env, params, data, request } = context
  const sid = data.schoolId
  const body = await readJson(request)
  const allowed = ['status', 'name', 'phone', 'message', 'staff_notes']
  const sets = []; const vals = []
  
  for (const k of allowed) {
    if (k in body) {
      sets.push(`${k}=?`)
      vals.push(body[k] ?? null)
    }
  }
  
  // Support mapping 'notes' alias to 'staff_notes'
  if ('notes' in body && !('staff_notes' in body)) {
    sets.push('staff_notes=?')
    vals.push(body.notes ?? null)
  }
  
  if (sets.length) {
    vals.push(params.id, sid)
    await env.DB.prepare(`UPDATE enquiries SET ${sets.join(',')} WHERE id=? AND school_id=?`).bind(...vals).run()
  }
  return ok({ updated: true })
}

export async function onRequestDelete(context) {
  const { env, params, data } = context
  await env.DB.prepare('DELETE FROM enquiries WHERE id=? AND school_id=?').bind(params.id, data.schoolId).run()
  return ok({ deleted: true })
}
