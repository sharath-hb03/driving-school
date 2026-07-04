// DELETE /api/payments/:id
import { ok, notFound } from '../../_lib/utils.js'

export async function onRequestDelete(context) {
  const { env, params, data } = context
  const row = await env.DB.prepare('SELECT id FROM payments WHERE id=? AND school_id=?').bind(params.id, data.schoolId).first()
  if (!row) return notFound('Payment not found')
  await env.DB.prepare('DELETE FROM payments WHERE id=? AND school_id=?').bind(params.id, data.schoolId).run()
  return ok({ deleted: true })
}
