// PUT /api/super-admin/schools/:id/status  — { active: 0|1 }
import { ok, badRequest, readJson } from '../../../../_lib/utils.js'

export async function onRequestPut(context) {
  const { env, params, request } = context
  const body = await readJson(request)
  if (body.active === undefined) return badRequest('active field required')
  await env.DB.prepare('UPDATE schools SET active=? WHERE id=?').bind(body.active ? 1 : 0, params.id).run()
  return ok({ updated: true, active: !!body.active })
}
