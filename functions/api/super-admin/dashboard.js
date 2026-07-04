// GET /api/super-admin/dashboard
import { ok } from '../../_lib/utils.js'

export async function onRequestGet(context) {
  const { env } = context
  const DB = env.DB
  const today = new Date().toISOString().slice(0, 10)
  const monthPrefix = today.slice(0, 7)

  const [totalSchools, activeSchools, totalStudents, revenueMonth, classesToday] = await Promise.all([
    DB.prepare('SELECT COUNT(*) AS n FROM schools').first(),
    DB.prepare('SELECT COUNT(*) AS n FROM schools WHERE active=1').first(),
    DB.prepare('SELECT COUNT(*) AS n FROM students').first(),
    DB.prepare("SELECT COALESCE(SUM(amount),0) AS amount FROM payments WHERE substr(paid_at,1,7)=?").bind(monthPrefix).first(),
    DB.prepare("SELECT COUNT(*) AS n FROM classes WHERE substr(scheduled_at,1,10)=?").bind(today).first(),
  ])

  const { results: schools } = await DB.prepare(`
    SELECT s.id, s.name, s.slug, s.email, s.phone, s.active, s.created_at,
      (SELECT COUNT(*) FROM students st WHERE st.school_id=s.id) AS student_count,
      (SELECT COUNT(*) FROM instructors i WHERE i.school_id=s.id AND i.active=1) AS instructor_count,
      (SELECT COALESCE(SUM(p.amount),0) FROM payments p WHERE p.school_id=s.id AND substr(p.paid_at,1,7)=?) AS revenue_this_month,
      (SELECT u.email FROM users u WHERE u.school_id=s.id AND u.role='admin' LIMIT 1) AS admin_email
    FROM schools s ORDER BY s.created_at DESC
  `).bind(monthPrefix).all()

  return ok({
    stats: {
      totalSchools: totalSchools.n,
      activeSchools: activeSchools.n,
      suspendedSchools: totalSchools.n - activeSchools.n,
      totalStudents: totalStudents.n,
      revenueThisMonth: revenueMonth.amount,
      classesToday: classesToday.n,
    },
    schools
  })
}
