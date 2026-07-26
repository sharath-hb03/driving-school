// GET /api/dashboard?date=YYYY-MM-DD  (school-scoped)

// 21 queries, so the cost of each one matters. Every date filter here is expressed as a
// half-open range (col >= lo AND col < hi) rather than substr(col,1,7)='YYYY-MM' or
// date(col)=…: wrapping the column in a function makes it unindexable, so those filters
// used to scan the school's entire class/payment/enquiry history on every load.
//
// Ranges work across the mixed formats in these columns — classes.scheduled_at and
// payments.paid_at are full ISO ('2026-07-13T01:30:00.000Z'), enquiries.created_at is
// SQLite's 'YYYY-MM-DD HH:MM:SS', joining_date and test_date are bare 'YYYY-MM-DD' —
// because every bound falls on a date boundary, and all three formats share the same
// leading 'YYYY-MM-DD'. Bounds with a time component would NOT be format-agnostic.
//
// Needs the composite indexes from migration 0009 to actually pay off.
const CACHE_TTL = 30

// Edge Cache API rather than the CACHE KV binding: KV's free tier allows 1,000 writes
// per day, and a 30s TTL needs ~2,880 writes/day for a single school. The Cache API has
// no write quota. It is per-colo, and a no-op on *.pages.dev — serving from a custom
// domain is required for it to actually store anything.
//
// The request URL is identical for every tenant, so it can't be the key — that would
// serve one school's dashboard to another. Key on school + date instead.
const cacheKeyFor = (schoolId, date) =>
  new Request(`https://dashboard.cache/${encodeURIComponent(schoolId)}/${date}`)

// The stored copy carries max-age so the edge expires it; the copy sent to the browser
// carries no-store, so per-school data never lingers in a shared or browser cache.
function respond(body, state) {
  return new Response(body, {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-cache': state
    }
  })
}

export async function onRequestGet(context) {
  const { env, request, data, waitUntil } = context
  const schoolId = data.schoolId
  const url = new URL(request.url)
  const today = url.searchParams.get('date') || new Date().toISOString().slice(0, 10)

  const cache = caches.default
  const cacheKey = cacheKeyFor(schoolId, today)
  const hit = await cache.match(cacheKey)
  if (hit) return respond(await hit.text(), 'HIT')

  const monthPrefix = today.slice(0, 7)
  const shiftMonth = (ymd, d) => {
    const [y, m] = ymd.slice(0,7).split('-').map(Number)
    const dt = new Date(Date.UTC(y, m - 1 + d, 1))
    return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth()+1).padStart(2,'0')}`
  }
  const addDays = (ymd, n) => {
    const dt = new Date(`${ymd}T00:00:00Z`)
    dt.setUTCDate(dt.getUTCDate() + n)
    return dt.toISOString().slice(0, 10)
  }
  const lastMonth = shiftMonth(today, -1)

  // Half-open bounds: lo inclusive, hi exclusive.
  const tomorrow       = addDays(today, 1)
  const day8           = addDays(today, 8)   // covers "next 7 days" inclusive
  const day30          = addDays(today, 30)
  const monthStart     = `${monthPrefix}-01`
  const nextMonthStart = `${shiftMonth(today, 1)}-01`
  const lastMonthStart = `${lastMonth}-01`

  const DB = env.DB

  const [
    totalStudents, activeLearners, todayCount, pending, collected,
    vehicles, instructors, docsExpiring, newStudents, lessonsDone,
    attendance, upcoming7, collectedLast, newEnquiries,
    leadsThisMonth, leadsConvertedThisMonth, leadsLastMonth, upcomingTests7d
  ] = await Promise.all([
    DB.prepare('SELECT COUNT(*) AS n FROM students WHERE school_id=?').bind(schoolId).first(),
    DB.prepare("SELECT COUNT(*) AS n FROM students WHERE school_id=? AND status='active'").bind(schoolId).first(),
    DB.prepare('SELECT COUNT(*) AS n FROM classes WHERE school_id=? AND scheduled_at>=? AND scheduled_at<?').bind(schoolId,today,tomorrow).first(),
    // The per-student payment total was a correlated subquery — one scan of payments per
    // student. Grouping it once and joining turns O(students × payments) into one pass.
    DB.prepare(`SELECT COUNT(*) AS n, COALESCE(SUM(bal),0) AS amount FROM (
      SELECT (COALESCE(p.fee,0)-COALESCE(s.discount,0)-COALESCE(pm.paid,0)) AS bal
      FROM students s
      LEFT JOIN packages p ON p.id=s.package_id
      LEFT JOIN (SELECT student_id, SUM(amount) AS paid FROM payments WHERE school_id=? GROUP BY student_id) pm
             ON pm.student_id=s.id
      WHERE s.school_id=?) WHERE bal>0`).bind(schoolId,schoolId).first(),
    DB.prepare("SELECT COALESCE(SUM(amount),0) AS amount FROM payments WHERE school_id=? AND paid_at>=? AND paid_at<?").bind(schoolId,monthStart,nextMonthStart).first(),
    DB.prepare("SELECT COUNT(*) AS total, COALESCE(SUM(CASE WHEN status='available' THEN 1 ELSE 0 END),0) AS available FROM vehicles WHERE school_id=?").bind(schoolId).first(),
    DB.prepare("SELECT COUNT(*) AS n FROM instructors WHERE school_id=? AND active=1").bind(schoolId).first(),
    // No lower bound: already-expired documents intentionally still count as "expiring
    // soon" so overdue paperwork stays visible. Dropping the date() wrapper is what makes
    // idx_vehdocs_expiry usable for the upper bound.
    DB.prepare(`SELECT COUNT(*) AS n FROM vehicle_documents d JOIN vehicles v ON v.id=d.vehicle_id
      WHERE v.school_id=? AND d.expiry_date<=?
      AND d.expiry_date=(SELECT MAX(expiry_date) FROM vehicle_documents WHERE vehicle_id=d.vehicle_id AND doc_type=d.doc_type)`).bind(schoolId,day30).first(),
    DB.prepare("SELECT COUNT(*) AS n FROM students WHERE school_id=? AND joining_date>=? AND joining_date<?").bind(schoolId,monthStart,nextMonthStart).first(),
    DB.prepare("SELECT COUNT(*) AS n FROM classes WHERE school_id=? AND status='attended' AND scheduled_at>=? AND scheduled_at<?").bind(schoolId,monthStart,nextMonthStart).first(),
    DB.prepare(`SELECT COALESCE(SUM(CASE WHEN status='attended' THEN 1 ELSE 0 END),0) AS attended,
      COALESCE(SUM(CASE WHEN status!='cancelled' THEN 1 ELSE 0 END),0) AS held
      FROM classes WHERE school_id=? AND scheduled_at>=? AND scheduled_at<?`).bind(schoolId,monthStart,today).first(),
    DB.prepare("SELECT COUNT(*) AS n FROM classes WHERE school_id=? AND status='scheduled' AND scheduled_at>=? AND scheduled_at<?").bind(schoolId,tomorrow,day8).first(),
    DB.prepare("SELECT COALESCE(SUM(amount),0) AS amount FROM payments WHERE school_id=? AND paid_at>=? AND paid_at<?").bind(schoolId,lastMonthStart,monthStart).first(),
    DB.prepare("SELECT COUNT(*) AS n FROM enquiries WHERE school_id=? AND status='new'").bind(schoolId).first(),

    // New CRM Leads and Licensing Tests queries
    DB.prepare("SELECT COUNT(*) AS n FROM enquiries WHERE school_id=? AND created_at>=? AND created_at<?").bind(schoolId, monthStart, nextMonthStart).first(),
    DB.prepare("SELECT COUNT(*) AS n FROM enquiries WHERE school_id=? AND status='converted' AND created_at>=? AND created_at<?").bind(schoolId, monthStart, nextMonthStart).first(),
    DB.prepare("SELECT COUNT(*) AS n FROM enquiries WHERE school_id=? AND created_at>=? AND created_at<?").bind(schoolId, lastMonthStart, monthStart).first(),
    DB.prepare("SELECT COUNT(*) AS n FROM student_tests WHERE school_id=? AND status='pending' AND test_date>=? AND test_date<?").bind(schoolId, today, day8).first(),
  ])

  const [todayClassesRes, expiringRes, recentLeadsRes] = await Promise.all([
    DB.prepare(`SELECT c.id,c.scheduled_at,c.duration_min,c.status,
      s.name AS student_name,s.phone AS student_phone,
      i.name AS instructor_name,v.vehicle_number
      FROM classes c JOIN students s ON s.id=c.student_id
      LEFT JOIN instructors i ON i.id=c.instructor_id
      LEFT JOIN vehicles v ON v.id=c.vehicle_id
      WHERE c.school_id=? AND c.scheduled_at>=? AND c.scheduled_at<? ORDER BY c.scheduled_at ASC`).bind(schoolId,today,tomorrow).all(),
    DB.prepare(`SELECT v.vehicle_number,d.doc_type,d.expiry_date FROM vehicle_documents d
      JOIN vehicles v ON v.id=d.vehicle_id WHERE v.school_id=? AND d.expiry_date<=?
      AND d.expiry_date=(SELECT MAX(expiry_date) FROM vehicle_documents WHERE vehicle_id=d.vehicle_id AND doc_type=d.doc_type)
      ORDER BY d.expiry_date ASC LIMIT 12`).bind(schoolId,day30).all(),
    DB.prepare("SELECT * FROM enquiries WHERE school_id=? AND status IN ('new','contacted') ORDER BY created_at DESC LIMIT 3").bind(schoolId).all(),
  ])

  const body = JSON.stringify({
    ok: true,
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

  waitUntil(cache.put(cacheKey, new Response(body, {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': `max-age=${CACHE_TTL}`
    }
  })))

  return respond(body, 'MISS')
}
