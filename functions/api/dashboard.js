// GET /api/dashboard?date=YYYY-MM-DD  (school-scoped)
import { ok } from '../_lib/utils.js'

const CACHE_TTL = 30

export async function onRequestGet(context) {
  const { env, request, data, waitUntil } = context
  const schoolId = data.schoolId
  const url = new URL(request.url)
  const today = url.searchParams.get('date') || new Date().toISOString().slice(0, 10)
  const monthPrefix = today.slice(0, 7)
  const shiftMonth = (ymd, d) => {
    const [y, m] = ymd.slice(0,7).split('-').map(Number)
    const dt = new Date(Date.UTC(y, m - 1 + d, 1))
    return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth()+1).padStart(2,'0')}`
  }
  const lastMonth = shiftMonth(today, -1)
  const DB = env.DB

  const [
    totalStudents, activeLearners, todayCount, pending, collected,
    vehicles, instructors, docsExpiring, newStudents, lessonsDone,
    attendance, upcoming7, collectedLast, newEnquiries,
    leadsThisMonth, leadsConvertedThisMonth, leadsLastMonth, upcomingTests7d
  ] = await Promise.all([
    DB.prepare('SELECT COUNT(*) AS n FROM students WHERE school_id=?').bind(schoolId).first(),
    DB.prepare("SELECT COUNT(*) AS n FROM students WHERE school_id=? AND status='active'").bind(schoolId).first(),
    DB.prepare('SELECT COUNT(*) AS n FROM classes WHERE school_id=? AND substr(scheduled_at,1,10)=?').bind(schoolId,today).first(),
    DB.prepare(`SELECT COUNT(*) AS n, COALESCE(SUM(bal),0) AS amount FROM (
      SELECT (COALESCE(p.fee,0)-COALESCE(s.discount,0)-COALESCE((SELECT SUM(amount) FROM payments pm WHERE pm.student_id=s.id),0)) AS bal
      FROM students s LEFT JOIN packages p ON p.id=s.package_id WHERE s.school_id=?) WHERE bal>0`).bind(schoolId).first(),
    DB.prepare("SELECT COALESCE(SUM(amount),0) AS amount FROM payments WHERE school_id=? AND substr(paid_at,1,7)=?").bind(schoolId,monthPrefix).first(),
    DB.prepare("SELECT COUNT(*) AS total, COALESCE(SUM(CASE WHEN status='available' THEN 1 ELSE 0 END),0) AS available FROM vehicles WHERE school_id=?").bind(schoolId).first(),
    DB.prepare("SELECT COUNT(*) AS n FROM instructors WHERE school_id=? AND active=1").bind(schoolId).first(),
    DB.prepare(`SELECT COUNT(*) AS n FROM vehicle_documents d JOIN vehicles v ON v.id=d.vehicle_id
      WHERE v.school_id=? AND d.expiry_date=(SELECT MAX(expiry_date) FROM vehicle_documents WHERE vehicle_id=d.vehicle_id AND doc_type=d.doc_type)
      AND date(d.expiry_date)<=date(?,'+ 30 days')`).bind(schoolId,today).first(),
    DB.prepare("SELECT COUNT(*) AS n FROM students WHERE school_id=? AND substr(joining_date,1,7)=?").bind(schoolId,monthPrefix).first(),
    DB.prepare("SELECT COUNT(*) AS n FROM classes WHERE school_id=? AND status='attended' AND substr(scheduled_at,1,7)=?").bind(schoolId,monthPrefix).first(),
    DB.prepare(`SELECT COALESCE(SUM(CASE WHEN status='attended' THEN 1 ELSE 0 END),0) AS attended,
      COALESCE(SUM(CASE WHEN status!='cancelled' THEN 1 ELSE 0 END),0) AS held
      FROM classes WHERE school_id=? AND substr(scheduled_at,1,7)=? AND substr(scheduled_at,1,10)<?`).bind(schoolId,monthPrefix,today).first(),
    DB.prepare("SELECT COUNT(*) AS n FROM classes WHERE school_id=? AND status='scheduled' AND substr(scheduled_at,1,10)>? AND substr(scheduled_at,1,10)<=date(?,'+ 7 days')").bind(schoolId,today,today).first(),
    DB.prepare("SELECT COALESCE(SUM(amount),0) AS amount FROM payments WHERE school_id=? AND substr(paid_at,1,7)=?").bind(schoolId,lastMonth).first(),
    DB.prepare("SELECT COUNT(*) AS n FROM enquiries WHERE school_id=? AND status='new'").bind(schoolId).first(),
    
    // New CRM Leads and Licensing Tests queries
    DB.prepare("SELECT COUNT(*) AS n FROM enquiries WHERE school_id=? AND substr(created_at,1,7)=?").bind(schoolId, monthPrefix).first(),
    DB.prepare("SELECT COUNT(*) AS n FROM enquiries WHERE school_id=? AND status='converted' AND substr(created_at,1,7)=?").bind(schoolId, monthPrefix).first(),
    DB.prepare("SELECT COUNT(*) AS n FROM enquiries WHERE school_id=? AND substr(created_at,1,7)=?").bind(schoolId, lastMonth).first(),
    DB.prepare("SELECT COUNT(*) AS n FROM student_tests WHERE school_id=? AND status='pending' AND date(test_date)>=date(?) AND date(test_date)<=date(?,'+7 days')").bind(schoolId, today, today).first(),
  ])

  const [todayClassesRes, expiringRes, recentLeadsRes] = await Promise.all([
    DB.prepare(`SELECT c.id,c.scheduled_at,c.duration_min,c.status,
      s.name AS student_name,s.phone AS student_phone,
      i.name AS instructor_name,v.vehicle_number
      FROM classes c JOIN students s ON s.id=c.student_id
      LEFT JOIN instructors i ON i.id=c.instructor_id
      LEFT JOIN vehicles v ON v.id=c.vehicle_id
      WHERE c.school_id=? AND substr(c.scheduled_at,1,10)=? ORDER BY c.scheduled_at ASC`).bind(schoolId,today).all(),
    DB.prepare(`SELECT v.vehicle_number,d.doc_type,d.expiry_date FROM vehicle_documents d
      JOIN vehicles v ON v.id=d.vehicle_id WHERE v.school_id=?
      AND d.expiry_date=(SELECT MAX(expiry_date) FROM vehicle_documents WHERE vehicle_id=d.vehicle_id AND doc_type=d.doc_type)
      AND date(d.expiry_date)<=date(?,'+ 30 days') ORDER BY d.expiry_date ASC LIMIT 12`).bind(schoolId,today).all(),
    DB.prepare("SELECT * FROM enquiries WHERE school_id=? AND status IN ('new','contacted') ORDER BY created_at DESC LIMIT 3").bind(schoolId).all(),
  ])

  return ok({
    stats: {
      totalStudents: totalStudents.n, activeLearners: activeLearners.n,
      todayClasses: todayCount.n, pendingPaymentsCount: pending.n,
      pendingPaymentsAmount: pending.amount, collectedThisMonth: collected.amount,
      collectedLastMonth: collectedLast.amount, vehiclesAvailable: vehicles.available,
      vehiclesTotal: vehicles.total, instructorsActive: instructors.n,
      docsExpiringSoon: docsExpiring.n, newStudentsThisMonth: newStudents.n,
      lessonsCompletedThisMonth: lessonsDone.n, upcomingClasses7d: upcoming7.n,
      attendanceRate: attendance.held > 0 ? Math.round((attendance.attended/attendance.held)*100) : null,
      newEnquiries: newEnquiries.n,
      
      // Additional stats
      leadsThisMonth: leadsThisMonth.n,
      leadsConvertedThisMonth: leadsConvertedThisMonth.n,
      leadsLastMonth: leadsLastMonth.n,
      upcomingTests7d: upcomingTests7d.n,
    },
    expiringDocs: expiringRes.results,
    todayClasses: todayClassesRes.results,
    recentLeads: recentLeadsRes.results,
  })
}
