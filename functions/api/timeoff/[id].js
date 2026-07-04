// GET/PUT/DELETE /api/timeoff/:id
import { ok, notFound, readJson } from '../../_lib/utils.js'

export async function onRequestGet(context) {
  const { env, params, data } = context
  const row = await env.DB.prepare('SELECT * FROM instructor_time_off WHERE id=? AND school_id=?').bind(params.id, data.schoolId).first()
  if (!row) return notFound('Time off not found')
  return ok({ timeoff: row })
}

export async function onRequestPut(context) {
  const { env, params, data, request } = context
  const sid = data.schoolId
  const body = await readJson(request)
  if (!body) return ok({ updated: false })
  const allowed = ['instructor_id', 'start_date', 'end_date', 'reason']
  const sets = []
  const vals = []
  for (const k of allowed) {
    if (k in body) {
      sets.push(`${k}=?`)
      vals.push(body[k] ?? null)
    }
  }
  if (sets.length) {
    vals.push(params.id, sid)
    await env.DB.prepare(`UPDATE instructor_time_off SET ${sets.join(',')} WHERE id=? AND school_id=?`).bind(...vals).run()
  }
  return ok({ updated: true })
}

export async function onRequestDelete(context) {
  const { env, params, data } = context
  await env.DB.prepare('DELETE FROM instructor_time_off WHERE id=? AND school_id=?').bind(params.id, data.schoolId).run()
  return ok({ deleted: true })
}
