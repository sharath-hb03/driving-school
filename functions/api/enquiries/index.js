// GET/POST /api/enquiries  (POST is public — no auth required)
import { ok, created, badRequest, readJson, requireFields, id } from '../../_lib/utils.js'
import { sendPush } from '../../_lib/onesignal.js'

export async function onRequestGet(context) {
  const { env, data, request } = context
  const sid = data.schoolId
  const url = new URL(request.url)
  const status = url.searchParams.get('status') || 'all'
  let where = 'WHERE school_id=?'
  const params = [sid]
  if (status !== 'all') { where += ' AND status=?'; params.push(status) }
  const { results } = await env.DB.prepare(`SELECT * FROM enquiries ${where} ORDER BY created_at DESC`).bind(...params).all()
  return ok({ enquiries: results })
}

export async function onRequestPost(context) {
  const { env, data, request } = context
  const body = await readJson(request)
  if (!body) return badRequest('Invalid JSON')
  const missing = requireFields(body, ['name', 'phone'])
  if (missing) return badRequest(missing)

  // If school_id comes from auth, use it; otherwise use slug from query param
  let sid = data.schoolId
  if (!sid && body.school_slug) {
    const school = await env.DB.prepare('SELECT id FROM schools WHERE slug=? AND active=1').bind(body.school_slug).first()
    if (!school) return badRequest('School not found')
    sid = school.id
  }
  if (!sid) return badRequest('school_slug required for public form')

  const eId = id('enq_')
  const source = body.source || 'web'
  const notes = body.staff_notes || body.notes || null

  await env.DB.prepare('INSERT INTO enquiries (id,school_id,name,phone,message,staff_notes,source) VALUES (?,?,?,?,?,?,?)')
    .bind(eId, sid, String(body.name).trim(), String(body.phone).trim(), body.message || null, notes, source).run()
  const enquiry = await env.DB.prepare('SELECT * FROM enquiries WHERE id=?').bind(eId).first()

  // Notify admins of new lead
  if (sid) {
    try {
      const { results: admins } = await env.DB.prepare(
        "SELECT pushify_sub FROM users WHERE school_id = ? AND role = 'admin' AND pushify_sub IS NOT NULL"
      ).bind(sid).all()
      const adminSubs = (admins || []).map(r => r.pushify_sub).filter(Boolean)

      if (adminSubs.length > 0) {
        await sendPush(env, {
          heading: 'New Enquiry Lead',
          message: `New enquiry received from ${String(body.name).trim()} (${String(body.phone).trim()}): "${body.message || ''}"`,
          subscriptionIds: adminSubs
        })
      }
    } catch (err) {
      console.error('[notify] Error sending new enquiry notification to admins:', err)
    }
  }

  return created({ enquiry })
}
