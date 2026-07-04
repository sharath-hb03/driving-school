// GET /api/portal/students/:id — instructor view of a student's profile, package, licence, and classes
import { ok, forbidden, badRequest } from '../../../_lib/utils.js'

export async function onRequestGet(context) {
  const { env, data, params } = context
  const user = data.user
  const instructorId = user.sub || user.id
  const studentId = params.id
  const sid = data.schoolId

  if (user.role !== 'instructor') {
    return forbidden('Instructor portal only')
  }


  // Fetch student details
  const student = await env.DB.prepare(`
    SELECT s.id, s.name, s.phone, s.email, s.address, s.license_type, s.joining_date,
           s.status, s.photo_key, s.discount,
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
  `).bind(studentId, sid).first()

  if (!student) {
    return badRequest('Student not found')
  }

  // Fetch payments list
  const { results: payments } = await env.DB.prepare(
    'SELECT id, amount, method, paid_at, note FROM payments WHERE student_id = ? AND school_id = ? ORDER BY paid_at DESC'
  )
    .bind(studentId, sid)
    .all()

  // Fetch classes history
  const { results: classes } = await env.DB.prepare(
    `SELECT c.id, c.scheduled_at, c.duration_min, c.status,
            i.name AS instructor_name, i.phone AS instructor_phone, v.vehicle_number
       FROM classes c
       LEFT JOIN instructors i ON i.id = c.instructor_id
       LEFT JOIN vehicles v ON v.id = c.vehicle_id
      WHERE c.student_id = ? AND c.school_id = ?
      ORDER BY c.scheduled_at DESC`
  )
    .bind(studentId, sid)
    .all()

  return ok({ student, payments, classes })
}
