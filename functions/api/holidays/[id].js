// DELETE /api/holidays/:id
import { ok, notFound } from '../../_lib/utils.js'

export async function onRequestDelete(context) {
  const { env, params, data } = context
  const row = await env.DB.prepare('SELECT id FROM holidays WHERE id=? AND school_id=?').bind(params.id, data.schoolId).first()
  if (!row) return notFound('Holiday not found')
  await env.DB.prepare('DELETE FROM holidays WHERE id=? AND school_id=?').bind(params.id, data.schoolId).run()
  return ok({ deleted: true })
}
