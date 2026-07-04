// GET/PUT/DELETE /api/super-admin/schools/:id
import { ok, notFound, badRequest, readJson } from '../../../_lib/utils.js'

export async function onRequestGet(context) {
  const { env, params } = context
  const school = await env.DB.prepare('SELECT * FROM schools WHERE id=?').bind(params.id).first()
  if (!school) return notFound('School not found')

  const stats = await env.DB.prepare(`
    SELECT
      (SELECT COUNT(*) FROM students WHERE school_id=?) as totalStudents,
      (SELECT COUNT(*) FROM students WHERE school_id=? AND status='active') as activeStudents,
      (SELECT COUNT(*) FROM instructors WHERE school_id=?) as instructors,
      (SELECT COUNT(*) FROM vehicles WHERE school_id=?) as vehicles,
      (SELECT COALESCE(SUM(amount),0) FROM payments WHERE school_id=? AND strftime('%Y-%m', paid_at)=strftime('%Y-%m','now')) as revenueThisMonth,
      (SELECT COALESCE(SUM(amount),0) FROM payments WHERE school_id=?) as totalRevenue
  `).bind(params.id, params.id, params.id, params.id, params.id, params.id).first()

  const admins = await env.DB.prepare("SELECT id,name,email,role FROM users WHERE school_id=? ORDER BY created_at").bind(params.id).all()

  return ok({ school, stats, admins: admins.results })
}

export async function onRequestPut(context) {
  const { env, params, request } = context
  const body = await readJson(request)
  const allowed = ['name','slug','phone','email','address','active']
  const sets = []; const vals = []
  for (const k of allowed) { if (k in body) { sets.push(`${k}=?`); vals.push(body[k] ?? null) } }
  if (!sets.length) return badRequest('Nothing to update')
  vals.push(params.id)
  await env.DB.prepare(`UPDATE schools SET ${sets.join(',')} WHERE id=?`).bind(...vals).run()
  return ok({ updated: true })
}

export async function onRequestDelete(context) {
  const { env, params } = context
  await env.DB.prepare('DELETE FROM schools WHERE id=?').bind(params.id).run()
  return ok({ deleted: true })
}
