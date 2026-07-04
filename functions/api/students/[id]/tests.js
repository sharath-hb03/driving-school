// GET  /api/students/:id/tests?type=ll|dl
// POST /api/students/:id/tests  { type, test_date, test_time, status, notes }
// PUT  /api/students/:id/tests/:testId  { status, notes }
import { ok, created, badRequest, readJson, requireFields, id } from '../../../_lib/utils.js'

export async function onRequestGet(context) {
  const { env, params, data, request } = context
  const sid = data.schoolId
  const url  = new URL(request.url)
  const type = url.searchParams.get('type') || null

  // Verify student belongs to this school
  const student = await env.DB.prepare('SELECT id FROM students WHERE id=? AND school_id=?').bind(params.id, sid).first()
  if (!student) return badRequest('Student not found')

  let sql = 'SELECT * FROM student_tests WHERE student_id=? AND school_id=?'
  const binds = [params.id, sid]
  if (type) { sql += ' AND type=?'; binds.push(type) }
  sql += ' ORDER BY test_date DESC, created_at DESC'

  const { results } = await env.DB.prepare(sql).bind(...binds).all()
  return ok({ tests: results || [] })
}

export async function onRequestPost(context) {
  const { env, params, data, request } = context
  const sid  = data.schoolId
  const body = await readJson(request)

  const err = requireFields(body, ['type', 'test_date', 'status'])
  if (err) return badRequest(err)
  if (!['ll', 'dl'].includes(body.type)) return badRequest('type must be ll or dl')
  if (!['pending', 'passed', 'failed'].includes(body.status)) return badRequest('Invalid status')

  // Verify student belongs to this school
  const student = await env.DB.prepare('SELECT id FROM students WHERE id=? AND school_id=?').bind(params.id, sid).first()
  if (!student) return badRequest('Student not found')

  const testId = id('test_')
  await env.DB.prepare(
    'INSERT INTO student_tests (id, school_id, student_id, type, test_date, test_time, status, notes) VALUES (?,?,?,?,?,?,?,?)'
  ).bind(testId, sid, params.id, body.type, body.test_date, body.test_time || null, body.status, body.notes || null).run()

  // Also update the latest status on the student record for backwards compat
  const prefix = body.type
  await env.DB.prepare(
    `UPDATE students SET ${prefix}_test_date=?, ${prefix}_test_time=?, ${prefix}_status=? WHERE id=? AND school_id=?`
  ).bind(body.test_date, body.test_time || null, body.status, params.id, sid).run()

  // Sync to student stage_progress
  const [studentFull, school] = await Promise.all([
    env.DB.prepare('SELECT stage_progress FROM students WHERE id=? AND school_id=?').bind(params.id, sid).first(),
    env.DB.prepare('SELECT stages FROM schools WHERE id=?').bind(sid).first()
  ])
  if (studentFull) {
    const defaultStages = [
      { id: 'stage_app', name: 'Application Submitted' },
      { id: 'stage_ll', name: 'Learner\'s Licence (LL)' },
      { id: 'stage_training', name: 'Practical Training' },
      { id: 'stage_dl', name: 'Driving Licence (DL)' }
    ]
    let stages = defaultStages
    if (school && school.stages) {
      try { stages = JSON.parse(school.stages) || defaultStages } catch (e) {}
    }

    // Resolve LL stage ID
    let llStageId = 'stage_ll'
    if (!stages.some(st => st.id === 'stage_ll')) {
      const matched = stages.find(st => {
        const name = String(st.name || '').toLowerCase()
        return name.includes('ll') || name.includes('learner')
      })
      if (matched) llStageId = matched.id
    }

    // Resolve DL stage ID
    let dlStageId = 'stage_dl'
    if (!stages.some(st => st.id === 'stage_dl')) {
      const matched = stages.find(st => {
        const name = String(st.name || '').toLowerCase()
        return name.includes('dl') || name.includes('driving') || name.includes('licence') || name.includes('license')
      })
      if (matched) dlStageId = matched.id
    }

    let progress = {}
    try {
      progress = typeof studentFull.stage_progress === 'string'
        ? JSON.parse(studentFull.stage_progress || '{}')
        : (studentFull.stage_progress || {})
    } catch (e) {}

    const isPassed = body.status === 'passed'
    let progressChanged = false

    if (body.type === 'll') {
      if (isPassed && !progress[llStageId]?.completed) {
        progress[llStageId] = { completed: true, date: body.test_date, notes: 'Completed via Test Attempt' }
        progressChanged = true
      } else if (!isPassed && progress[llStageId]?.completed) {
        progress[llStageId] = { completed: false, date: null, notes: '' }
        progressChanged = true
      }
    } else if (body.type === 'dl') {
      if (isPassed && !progress[dlStageId]?.completed) {
        progress[dlStageId] = { completed: true, date: body.test_date, notes: 'Completed via Test Attempt' }
        progressChanged = true
      } else if (!isPassed && progress[dlStageId]?.completed) {
        progress[dlStageId] = { completed: false, date: null, notes: '' }
        progressChanged = true
      }
    }

    if (progressChanged) {
      await env.DB.prepare('UPDATE students SET stage_progress=? WHERE id=? AND school_id=?')
        .bind(JSON.stringify(progress), params.id, sid).run()
    }
  }

  const test = await env.DB.prepare('SELECT * FROM student_tests WHERE id=?').bind(testId).first()
  return created({ test })
}
