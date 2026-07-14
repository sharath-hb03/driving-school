// GET /api/portal/me — student or instructor profile + classes, tests, timeoff, holidays
import { ok, forbidden } from '../../_lib/utils.js'

export async function onRequestGet(context) {
  const { env, data } = context
  const user = data.user
  const sub = user.sub || user.id
  const sid = data.schoolId

  if (user.role === 'student') {
    const student = await env.DB.prepare(`
      SELECT s.id, s.name, s.phone, s.email, s.address, s.license_type, s.joining_date,
             s.status, s.photo_key, s.discount, s.stage_progress, s.opt_for_license, s.ll_profile,
             s.ll_number, s.ll_test_date, s.ll_test_time, s.ll_status, s.ll_expiry,
             s.dl_number, s.dl_test_date, s.dl_test_time, s.dl_status, s.dl_expiry,
             lli.name AS ll_instructor_name, dli.name AS dl_instructor_name,
             p.name AS package_name, p.fee AS package_fee, p.total_classes AS total_classes,
             (COALESCE(p.fee, 0) - COALESCE(s.discount, 0)) AS net_fee,
             COALESCE((SELECT SUM(amount) FROM payments pm WHERE pm.student_id = s.id AND pm.school_id = s.school_id), 0) AS paid,
             (COALESCE(p.fee, 0) - COALESCE(s.discount, 0) - COALESCE((SELECT SUM(amount) FROM payments pm WHERE pm.student_id = s.id AND pm.school_id = s.school_id), 0)) AS balance,
             (SELECT COUNT(*) FROM classes c WHERE c.student_id = s.id AND c.status = 'attended' AND c.school_id = s.school_id) AS completed_classes
      FROM students s
      LEFT JOIN packages p ON p.id = s.package_id
      LEFT JOIN instructors lli ON lli.id = s.ll_instructor_id
      LEFT JOIN instructors dli ON dli.id = s.dl_instructor_id
      WHERE s.id = ? AND s.school_id = ?
    `).bind(sub, sid).first()
    if (!student) return forbidden('Student not found')

    const { results: payments } = await env.DB.prepare(
      'SELECT id, amount, method, paid_at, note FROM payments WHERE student_id = ? AND school_id = ? ORDER BY paid_at DESC'
    )
      .bind(sub, sid)
      .all()

    const { results: classes } = await env.DB.prepare(
      `SELECT c.id, c.scheduled_at, c.duration_min, c.status,
              i.name AS instructor_name, i.phone AS instructor_phone, v.vehicle_number
         FROM classes c
         LEFT JOIN instructors i ON i.id = c.instructor_id
         LEFT JOIN vehicles v ON v.id = c.vehicle_id
        WHERE c.student_id = ? AND c.school_id = ?
        ORDER BY c.scheduled_at DESC`
    )
      .bind(sub, sid)
      .all()

    const certificate = await env.DB.prepare('SELECT * FROM certificates WHERE student_id = ? AND school_id = ?').bind(sub, sid).first()

    const { results: documents } = await env.DB.prepare(
      'SELECT id, doc_type, file_key, file_format, doc_number, notes, uploaded_by, created_at FROM student_documents WHERE student_id = ? AND school_id = ? ORDER BY created_at DESC'
    ).bind(sub, sid).all()

    // Fetch school stages
    const school = await env.DB.prepare('SELECT stages FROM schools WHERE id = ?').bind(sid).first()
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

    return ok({ role: user.role, student, payments, classes, certificate: certificate || null, stages, documents })
  }

  if (user.role === 'instructor') {
    const instructor = await env.DB.prepare(
      'SELECT id, name, phone, email, license_type, active, work_days, work_start, work_end FROM instructors WHERE id = ? AND school_id = ?'
    )
      .bind(sub, sid)
      .first()
    if (!instructor) return forbidden('Instructor not found')

    const { results: classes } = await env.DB.prepare(
      `SELECT c.id, c.scheduled_at, c.duration_min, c.status, c.notes,
              s.name AS student_name, s.phone AS student_phone, s.license_type,
              v.vehicle_number
         FROM classes c
         JOIN students s ON s.id = c.student_id
         LEFT JOIN vehicles v ON v.id = c.vehicle_id
        WHERE c.instructor_id = ? AND c.school_id = ? AND s.school_id = ?
        ORDER BY c.scheduled_at DESC`
    )
      .bind(sub, sid, sid)
      .all()

    const todayKey = new Date().toISOString().slice(0, 10)

    // The instructor's own upcoming leave
    const { results: timeoff } = await env.DB.prepare(
      'SELECT id, start_date, end_date, reason FROM instructor_time_off WHERE instructor_id = ? AND school_id = ? AND end_date >= ? ORDER BY start_date ASC'
    )
      .bind(sub, sid, todayKey)
      .all()

    // School holidays
    const { results: holidays } = await env.DB.prepare(
      'SELECT id, date, name FROM holidays WHERE school_id = ? AND date >= ? ORDER BY date ASC LIMIT 60'
    )
      .bind(sid, todayKey)
      .all()

    // RTO tests this instructor is assigned to
    const { results: assigned } = await env.DB.prepare(
      `SELECT s.id AS student_id, s.name AS student_name, s.phone AS student_phone,
              s.ll_instructor_id, s.ll_test_date, s.ll_test_time, s.ll_status,
              s.dl_instructor_id, s.dl_test_date, s.dl_test_time, s.dl_status
         FROM students s
        WHERE (s.ll_instructor_id = ? OR s.dl_instructor_id = ?) AND s.school_id = ?`
    )
      .bind(sub, sub, sid)
      .all()

    const tests = []
    for (const r of assigned || []) {
      if (r.ll_instructor_id === sub && r.ll_test_date)
        tests.push({ student_id: r.student_id, student_name: r.student_name, student_phone: r.student_phone, type: "Learner's Licence", date: r.ll_test_date, time: r.ll_test_time, status: r.ll_status })
      if (r.dl_instructor_id === sub && r.dl_test_date)
        tests.push({ student_id: r.student_id, student_name: r.student_name, student_phone: r.student_phone, type: 'Driving Test', date: r.dl_test_date, time: r.dl_test_time, status: r.dl_status })
    }
    tests.sort((a, b) => a.date.localeCompare(b.date))

    // All students of this school (regardless of assignee), with progress info
    const { results: students } = await env.DB.prepare(
      `SELECT s.id, s.name, s.phone, s.email, s.status, s.license_type,
              p.name AS package_name, p.total_classes AS total_classes,
              (SELECT COUNT(*) FROM classes c2 WHERE c2.student_id = s.id AND c2.status = 'attended' AND c2.school_id = s.school_id) AS completed_classes
         FROM students s
         LEFT JOIN packages p ON p.id = s.package_id
        WHERE s.school_id = ?
        ORDER BY s.name COLLATE NOCASE`
    )
      .bind(sid)
      .all()

    return ok({ role: user.role, instructor, classes, timeoff, holidays, tests, students })
  }

  return forbidden('Not a portal account')
}
