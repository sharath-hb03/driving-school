// GET /api/portal/me â€” student or instructor profile + upcoming classes
import { ok, notFound } from '../../_lib/utils.js'

export async function onRequestGet(context) {
  const { env, data } = context
  const user = data.user
  const sub = user.sub || user.id

  if (user.role === 'student') {
    const student = await env.DB.prepare(`
      SELECT s.*,p.name AS package_name,p.fee,p.total_classes,
        (SELECT COUNT(*) FROM classes c WHERE c.student_id=s.id AND c.status='attended') AS completed_classes,
        (COALESCE(p.fee,0)-COALESCE(s.discount,0)-COALESCE((SELECT SUM(amount) FROM payments pm WHERE pm.student_id=s.id),0)) AS balance
      FROM students s LEFT JOIN packages p ON p.id=s.package_id WHERE s.id=?
    `).bind(sub).first()
    if (!student) return notFound('Student not found')

    const { results: upcoming } = await env.DB.prepare(`
      SELECT c.*,i.name AS instructor_name,v.vehicle_number FROM classes c
      LEFT JOIN instructors i ON i.id=c.instructor_id
      LEFT JOIN vehicles v ON v.id=c.vehicle_id
      WHERE c.student_id=? AND c.status='scheduled' AND c.scheduled_at>=datetime('now')
      ORDER BY c.scheduled_at ASC LIMIT 10
    `).bind(sub).all()

    const { results: recent } = await env.DB.prepare(`
      SELECT c.*,i.name AS instructor_name,v.vehicle_number FROM classes c
      LEFT JOIN instructors i ON i.id=c.instructor_id
      LEFT JOIN vehicles v ON v.id=c.vehicle_id
      WHERE c.student_id=? AND c.scheduled_at<datetime('now')
      ORDER BY c.scheduled_at DESC LIMIT 20
    `).bind(sub).all()

    const { results: payments } = await env.DB.prepare(
      'SELECT * FROM payments WHERE student_id=? ORDER BY paid_at DESC LIMIT 10'
    ).bind(sub).all()

    const cert = await env.DB.prepare('SELECT * FROM certificates WHERE student_id=?').bind(sub).first()

    return ok({ student, upcoming, recent, payments, certificate: cert || null })
  }

  if (user.role === 'instructor') {
    const instructor = await env.DB.prepare('SELECT * FROM instructors WHERE id=?').bind(sub).first()
    if (!instructor) return notFound('Instructor not found')

    const { results: upcoming } = await env.DB.prepare(`
      SELECT c.*,s.name AS student_name,s.phone AS student_phone,v.vehicle_number FROM classes c
      JOIN students s ON s.id=c.student_id
      LEFT JOIN vehicles v ON v.id=c.vehicle_id
      WHERE c.instructor_id=? AND c.status='scheduled' AND c.scheduled_at>=datetime('now')
      ORDER BY c.scheduled_at ASC LIMIT 20
    `).bind(sub).all()

    const { results: recent } = await env.DB.prepare(`
      SELECT c.*,s.name AS student_name,s.phone AS student_phone,v.vehicle_number FROM classes c
      JOIN students s ON s.id=c.student_id LEFT JOIN vehicles v ON v.id=c.vehicle_id
      WHERE c.instructor_id=? AND c.scheduled_at<datetime('now')
      ORDER BY c.scheduled_at DESC LIMIT 30
    `).bind(sub).all()

    return ok({ instructor, upcoming, recent })
  }

  return notFound('Unknown role')
}
