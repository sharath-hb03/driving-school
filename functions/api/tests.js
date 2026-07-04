// GET /api/tests?from=<ISO>&to=<ISO>&instructor=<id>
// Returns LL and DL tests from students table within the date range, optionally filtered by instructor
import { ok } from '../_lib/utils.js'

export async function onRequestGet(context) {
  const { env, data, request } = context
  const sid = data.schoolId
  const url  = new URL(request.url)
  const from = url.searchParams.get('from') || ''
  const to   = url.searchParams.get('to')   || ''
  const instructorId = url.searchParams.get('instructor') || ''

  // Trim to date-only for comparison (test_date is stored as YYYY-MM-DD)
  const fromDate = from ? from.slice(0, 10) : '0000-01-01'
  const toDate   = to   ? to.slice(0, 10)   : '9999-12-31'

  // LL tests
  let llSql = `
    SELECT
      'LL-' || s.id                      AS id,
      s.id                               AS student_id,
      s.name                             AS student_name,
      s.phone                            AS student_phone,
      'LL'                               AS type,
      s.ll_test_date                     AS test_date,
      COALESCE(s.ll_test_time, '09:00')  AS test_time,
      s.ll_status                        AS status,
      s.ll_number                        AS licence_number,
      s.ll_expiry                        AS expiry,
      lli.name                           AS instructor_name
    FROM students s
    LEFT JOIN instructors lli ON s.ll_instructor_id = lli.id
    WHERE s.school_id = ?
      AND s.ll_test_date IS NOT NULL
      AND s.ll_test_date >= ?
      AND s.ll_test_date <= ?
  `
  const llParams = [sid, fromDate, toDate]
  if (instructorId) {
    llSql += ' AND s.ll_instructor_id = ?'
    llParams.push(instructorId)
  }
  const llRows = await env.DB.prepare(llSql).bind(...llParams).all()

  // DL tests
  let dlSql = `
    SELECT
      'DL-' || s.id                      AS id,
      s.id                               AS student_id,
      s.name                             AS student_name,
      s.phone                            AS student_phone,
      'DL'                               AS type,
      s.dl_test_date                     AS test_date,
      COALESCE(s.dl_test_time, '09:00')  AS test_time,
      s.dl_status                        AS status,
      s.dl_number                        AS licence_number,
      s.dl_expiry                        AS expiry,
      dli.name                           AS instructor_name
    FROM students s
    LEFT JOIN instructors dli ON s.dl_instructor_id = dli.id
    WHERE s.school_id = ?
      AND s.dl_test_date IS NOT NULL
      AND s.dl_test_date >= ?
      AND s.dl_test_date <= ?
  `
  const dlParams = [sid, fromDate, toDate]
  if (instructorId) {
    dlSql += ' AND s.dl_instructor_id = ?'
    dlParams.push(instructorId)
  }
  const dlRows = await env.DB.prepare(dlSql).bind(...dlParams).all()

  // Merge and add scheduled_at (datetime string) so WeekSchedule can group by date
  const toScheduled = (row) => ({
    ...row,
    scheduled_at: `${row.test_date}T${row.test_time}`,
  })

  const tests = [
    ...(llRows.results || []).map(toScheduled),
    ...(dlRows.results || []).map(toScheduled),
  ].sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at))

  return ok({ tests })
}
