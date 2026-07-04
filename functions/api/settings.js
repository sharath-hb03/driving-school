// GET /api/settings  PUT /api/settings
import { ok, badRequest, readJson } from '../_lib/utils.js'

export async function onRequestGet(context) {
  const { env, data } = context
  const sid = data.schoolId
  const [school, staffRes] = await Promise.all([
    env.DB.prepare('SELECT * FROM schools WHERE id=?').bind(sid).first(),
    env.DB.prepare('SELECT id,name,email,role,created_at FROM users WHERE school_id=? ORDER BY created_at ASC').bind(sid).all()
  ])
  
  const defaultStages = [
    { id: 'stage_app', name: 'Application Submitted' },
    { id: 'stage_ll', name: 'Learner\'s Licence (LL)' },
    { id: 'stage_training', name: 'Practical Training' },
    { id: 'stage_dl', name: 'Driving Licence (DL)' }
  ]
  
  let stages = defaultStages
  if (school && school.stages) {
    try {
      stages = JSON.parse(school.stages)
    } catch (e) {}
  }

  return ok({ school: { ...school, stages }, staff: staffRes.results })
}

export async function onRequestPut(context) {
  const { env, data, request } = context
  const sid = data.schoolId
  const body = await readJson(request)
  if (!body) return badRequest('Invalid JSON')
  const allowed = ['name','phone','email','address','logo_key','stages']
  const cols = Object.keys(body).filter(k => allowed.includes(k))
  if (!cols.length) return badRequest('Nothing to update')
  const set = cols.map(c => `${c}=?`).join(',')
  const vals = cols.map(c => {
    if (c === 'stages') {
      return typeof body[c] === 'string' ? body[c] : JSON.stringify(body[c])
    }
    return body[c]
  })
  await env.DB.prepare(`UPDATE schools SET ${set} WHERE id=?`).bind(...vals, sid).run()
  const school = await env.DB.prepare('SELECT * FROM schools WHERE id=?').bind(sid).first()
  
  let stages = []
  if (school && school.stages) {
    try {
      stages = JSON.parse(school.stages)
    } catch (e) {}
  }
  return ok({ school: { ...school, stages } })
}
