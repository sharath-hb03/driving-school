// GET    /api/students/:id
// PUT    /api/students/:id
// DELETE /api/students/:id
import { ok, notFound, badRequest, readJson } from '../../_lib/utils.js'
import { hashPassword } from '../../_lib/auth.js'
import { sendPush } from '../../_lib/onesignal.js'

export async function onRequestGet(context) {
  const { env, params, data } = context
  const sid = data.schoolId
  const student = await env.DB.prepare(
    `SELECT s.*, pkg.name as package_name, pkg.fee, pkg.total_classes,
       (SELECT COUNT(*) FROM classes WHERE student_id=s.id AND status='attended') as completed_classes,
       (SELECT SUM(amount) FROM payments WHERE student_id=s.id) as paid_amount,
       lli.name as ll_instructor_name,
       dli.name as dl_instructor_name
     FROM students s
     LEFT JOIN packages    pkg ON s.package_id=pkg.id
     LEFT JOIN instructors lli ON s.ll_instructor_id=lli.id
     LEFT JOIN instructors dli ON s.dl_instructor_id=dli.id
     WHERE s.id=? AND s.school_id=?`
  ).bind(params.id, sid).first()
  if (!student) return notFound('Student not found')

  const balance = Math.max(0, ((student.fee||0) - (student.discount||0)) - (student.paid_amount||0))
  const classes  = await env.DB.prepare(
    `SELECT c.*, i.name as instructor_name, v.vehicle_number FROM classes c
     LEFT JOIN instructors i ON c.instructor_id=i.id
     LEFT JOIN vehicles v ON c.vehicle_id=v.id
     WHERE c.student_id=? AND c.school_id=? ORDER BY c.scheduled_at DESC LIMIT 200`
  ).bind(params.id, sid).all()
  const [paymentsRes, certificate, school] = await Promise.all([
    env.DB.prepare('SELECT * FROM payments WHERE student_id=? AND school_id=? ORDER BY paid_at DESC').bind(params.id, sid).all(),
    env.DB.prepare('SELECT * FROM certificates WHERE student_id=? AND school_id=?').bind(params.id, sid).first(),
    env.DB.prepare('SELECT stages FROM schools WHERE id=?').bind(sid).first()
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

  return ok({
    student: { ...student, balance },
    classes: classes.results,
    payments: paymentsRes.results,
    certificate: certificate || null,
    stages
  })
}

export async function onRequestPut(context) {
  const { env, params, data, request } = context
  const sid = data.schoolId
  const body = await readJson(request)
  if (!body) return badRequest('Invalid JSON')

  const student = await env.DB.prepare('SELECT * FROM students WHERE id=? AND school_id=?').bind(params.id, sid).first()
  if (!student) return notFound('Student not found')

  // Fetch school stages to resolve dynamic LL/DL stages
  const school = await env.DB.prepare('SELECT stages FROM schools WHERE id=?').bind(sid).first()
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
    progress = typeof student.stage_progress === 'string'
      ? JSON.parse(student.stage_progress || '{}')
      : (student.stage_progress || {})
  } catch (e) {}

  // 1. If stage_progress is updated, sync to LL/DL status
  if ('stage_progress' in body) {
    let newProgress = body.stage_progress
    if (typeof newProgress === 'string') {
      try { newProgress = JSON.parse(newProgress) } catch (e) { newProgress = {} }
    }
    newProgress = newProgress || {}

    // Sync Learner's Licence (LL)
    if (newProgress[llStageId]?.completed) {
      if (body.ll_status === undefined && student.ll_status !== 'passed') {
        body.ll_status = 'passed'
      }
      if (body.ll_test_date === undefined && !student.ll_test_date) {
        body.ll_test_date = newProgress[llStageId].date || new Date().toISOString().slice(0, 10)
      }
    } else if (newProgress[llStageId] && !newProgress[llStageId].completed) {
      if (body.ll_status === undefined && student.ll_status === 'passed') {
        body.ll_status = null
      }
    }

    // Sync Driving Licence (DL)
    if (newProgress[dlStageId]?.completed) {
      if (body.dl_status === undefined && student.dl_status !== 'passed') {
        body.dl_status = 'passed'
      }
      if (body.dl_test_date === undefined && !student.dl_test_date) {
        body.dl_test_date = newProgress[dlStageId].date || new Date().toISOString().slice(0, 10)
      }
    } else if (newProgress[dlStageId] && !newProgress[dlStageId].completed) {
      if (body.dl_status === undefined && student.dl_status === 'passed') {
        body.dl_status = null
      }
    }
  } else {
    // 2. If status or numbers are updated, sync back to stage_progress
    let progressChanged = false

    // Check LL
    if ('ll_status' in body || 'll_number' in body) {
      const nextStatus = 'll_status' in body ? body.ll_status : student.ll_status
      const nextNumber = 'll_number' in body ? body.ll_number : student.ll_number
      const isPassed = nextStatus === 'passed' || !!nextNumber

      if (isPassed && !progress[llStageId]?.completed) {
        const testDate = body.ll_test_date || student.ll_test_date || new Date().toISOString().slice(0, 10)
        progress[llStageId] = {
          completed: true,
          date: testDate,
          notes: 'Completed via Licence/Test update'
        }
        progressChanged = true
      } else if (!isPassed && progress[llStageId]?.completed) {
        progress[llStageId] = {
          completed: false,
          date: null,
          notes: ''
        }
        progressChanged = true
      }
    }

    // Check DL
    if ('dl_status' in body || 'dl_number' in body) {
      const nextStatus = 'dl_status' in body ? body.dl_status : student.dl_status
      const nextNumber = 'dl_number' in body ? body.dl_number : student.dl_number
      const isPassed = nextStatus === 'passed' || !!nextNumber

      if (isPassed && !progress[dlStageId]?.completed) {
        const testDate = body.dl_test_date || student.dl_test_date || new Date().toISOString().slice(0, 10)
        progress[dlStageId] = {
          completed: true,
          date: testDate,
          notes: 'Completed via Licence/Test update'
        }
        progressChanged = true
      } else if (!isPassed && progress[dlStageId]?.completed) {
        progress[dlStageId] = {
          completed: false,
          date: null,
          notes: ''
        }
        progressChanged = true
      }
    }

    if (progressChanged) {
      body.stage_progress = progress
    }
  }

  const { password, ...fields } = body

  const sets = []
  const vals = []
  const allowed = ['name','phone','email','address','license_type','joining_date','package_id','status',
    'discount','notes','ll_test_date','ll_test_time','ll_status','ll_number','ll_expiry','ll_instructor_id',
    'dl_test_date','dl_test_time','dl_status','dl_number','dl_expiry','dl_instructor_id', 'stage_progress',
    'opt_for_license']
  for (const k of allowed) {
    if (k in fields) {
      let value = fields[k] === '' ? null : fields[k]
      if (k === 'stage_progress' && value !== null) {
        value = typeof value === 'string' ? value : JSON.stringify(value)
      }
      sets.push(`${k}=?`)
      vals.push(value ?? null)
    }
  }
  if (password) {
    const hash = await hashPassword(password)
    sets.push('password_hash=?'); vals.push(hash)
  }
  if (!sets.length) return badRequest('Nothing to update')
  vals.push(params.id, sid)
  await env.DB.prepare(`UPDATE students SET ${sets.join(',')} WHERE id=? AND school_id=?`).bind(...vals).run()

  // Notify student on license date or status changes
  const pushifySub = student.pushify_sub
  if (pushifySub && pushifySub !== 'null') {
    try {
      // 1. Learner's Licence (LL) test schedule change
      const llDateChanged = 'll_test_date' in fields && fields.ll_test_date !== student.ll_test_date
      const llTimeChanged = 'll_test_time' in fields && fields.ll_test_time !== student.ll_test_time
      if ((llDateChanged || llTimeChanged) && fields.ll_test_date) {
        const dateVal = fields.ll_test_date
        const timeVal = fields.ll_test_time || student.ll_test_time || ''
        await sendPush(env, {
          heading: "Learner's Licence Test",
          message: `Your Learner's Licence test has been scheduled for ${dateVal}${timeVal ? ` at ${timeVal}` : ''}.`,
          subscriptionIds: [pushifySub]
        })
      }

      // 2. LL status change
      const llStatusChanged = 'll_status' in fields && fields.ll_status !== student.ll_status
      if (llStatusChanged && fields.ll_status) {
        await sendPush(env, {
          heading: "Learner's Licence Status",
          message: `Your Learner's Licence test status is updated: ${fields.ll_status.toUpperCase()}.`,
          subscriptionIds: [pushifySub]
        })
      }

      // 3. Driving Licence (DL) test schedule change
      const dlDateChanged = 'dl_test_date' in fields && fields.dl_test_date !== student.dl_test_date
      const dlTimeChanged = 'dl_test_time' in fields && fields.dl_test_time !== student.dl_test_time
      if ((dlDateChanged || dlTimeChanged) && fields.dl_test_date) {
        const dateVal = fields.dl_test_date
        const timeVal = fields.dl_test_time || student.dl_test_time || ''
        await sendPush(env, {
          heading: "Driving Licence Test",
          message: `Your Driving Licence test has been scheduled for ${dateVal}${timeVal ? ` at ${timeVal}` : ''}.`,
          subscriptionIds: [pushifySub]
        })
      }

      // 4. DL status change
      const dlStatusChanged = 'dl_status' in fields && fields.dl_status !== student.dl_status
      if (dlStatusChanged && fields.dl_status) {
        await sendPush(env, {
          heading: "Driving Licence Status",
          message: `Your Driving Licence test status is updated: ${fields.dl_status.toUpperCase()}.`,
          subscriptionIds: [pushifySub]
        })
      }
    } catch (err) {
      console.error('[notify] Error sending student license update notification:', err)
    }
  }

  return ok({ updated: true })
}

export async function onRequestDelete(context) {
  const { env, params, data } = context
  const sid = data.schoolId
  await env.DB.prepare('DELETE FROM students WHERE id=? AND school_id=?').bind(params.id, sid).run()
  return ok({ deleted: true })
}
