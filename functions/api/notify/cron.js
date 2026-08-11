import { sendPush } from '../../_lib/onesignal.js'
import { ok, unauthorized } from '../../_lib/utils.js'

// The widest reminder window is the '1d' one (fires up to 26h ahead), so nothing
// outside now → now+26h can possibly need a class reminder. Bounding the query on
// scheduled_at is what stops this scan growing with the table: a class only leaves
// 'scheduled' when someone marks attendance, so without the bound every class ever
// left unmarked was re-read 48×/day forever.
//
// Lexical string comparison on scheduled_at is chronological because every writer
// stores `new Date(...).toISOString()` (classes POST + ClassForm). Do not relax that
// to a space-separated 'YYYY-MM-DD HH:MM' or these bounds silently stop matching.
const LOOKAHEAD_MS = 26 * 3600 * 1000
const HOUR_WINDOW_MS = 90 * 60 * 1000

// Vehicle-doc alerts fire at 1 month and 1 week out, so only docs expiring within
// ~31 days matter. Previously this read the entire table with no WHERE clause at all.
const DOC_LOOKAHEAD_DAYS = 31

// Workers Free allows 50 subrequests per invocation, and every sendPush() is one
// fetch. Recipients are grouped so one fetch covers everyone getting an identical
// message; this cap is the backstop. Hitting it defers the remainder to the next run
// (reminded_at is only written on success) rather than throwing mid-loop, which is
// what used to drop every student after the 50th with no error.
const MAX_SENDS = 40

// Constant-time string compare so the token check doesn't leak the secret via timing.
function timingSafeEqual(a, b) {
  const enc = new TextEncoder()
  const aa = enc.encode(String(a))
  const bb = enc.encode(String(b))
  if (aa.length !== bb.length) return false
  let diff = 0
  for (let i = 0; i < aa.length; i++) diff |= aa[i] ^ bb[i]
  return diff === 0
}

function formatClassTime(date) {
  return date.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  })
}

// Tolerate a legacy space-separated value even though the range filter above assumes
// ISO — a row that slipped through in the old format would be excluded by the query
// rather than misparsed here, so this only ever sees well-formed input in practice.
const parseWhen = (s) => new Date(s.includes('T') ? s : s.replace(' ', 'T')).getTime()

const ymd = (ms) => new Date(ms).toISOString().slice(0, 10)

export async function onRequestGet(context) {
  return handleCron(context)
}

export async function onRequestPost(context) {
  return handleCron(context)
}

async function handleCron(context) {
  const { env, request } = context

  // Cron auth: dedicated CRON_SECRET, sent as a header only so the secret never lands
  // in URLs/logs. (The legacy AUTH_SECRET + ?token= query path has been removed.)
  const expected = env.CRON_SECRET
  if (!expected) {
    return unauthorized('CRON_SECRET is not configured on the server')
  }

  const provided =
    request.headers.get('X-Cron-Secret') ||
    (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '')

  if (!provided || !timingSafeEqual(provided, expected)) {
    return unauthorized('Invalid cron token')
  }

  const now = Date.now()
  let sends = 0
  let classesNotified = 0
  let docsNotified = 0
  let deferred = 0
  const updates = []

  // ── 1. Class reminders for students & instructors (24h & 1h prior) ──
  // pushify_sub is filtered in SQL rather than skipped in JS so unsubscribed
  // students/instructors never reach the grouping pass.
  const { results: classes } = await env.DB.prepare(`
    SELECT c.id, c.scheduled_at, c.reminded_at,
           s.name AS student_name, s.pushify_sub AS student_pushify_sub,
           i.name AS instructor_name, i.pushify_sub AS instructor_pushify_sub
      FROM classes c
      JOIN students s ON s.id = c.student_id
      LEFT JOIN instructors i ON i.id = c.instructor_id
     WHERE c.status = 'scheduled'
       AND c.scheduled_at >  ?
       AND c.scheduled_at <= ?
       AND (
         (s.pushify_sub IS NOT NULL AND s.pushify_sub <> 'null')
         OR
         (i.pushify_sub IS NOT NULL AND i.pushify_sub <> 'null')
       )
  `).bind(new Date(now).toISOString(), new Date(now + LOOKAHEAD_MS).toISOString()).all()

  // One OneSignal notification carries a single body, so recipients are keyed by the
  // exact text they should receive.
  const groups = new Map()

  for (const c of classes || []) {
    const classTime = parseWhen(c.scheduled_at)
    const diffMs = classTime - now
    const reminders = c.reminded_at ? c.reminded_at.split(',').filter(Boolean) : []

    let sendType = null
    if (diffMs > HOUR_WINDOW_MS && diffMs <= LOOKAHEAD_MS && !reminders.includes('1d')) {
      sendType = '1d'
    } else if (diffMs > 0 && diffMs <= HOUR_WINDOW_MS && !reminders.includes('1h')) {
      sendType = '1h'
    }
    if (!sendType) continue

    const timeStr = formatClassTime(new Date(classTime))
    const isTodayClass = new Date(classTime).toDateString() === new Date(now).toDateString()
    const heading = sendType === '1d' ? '24h Class Reminder' : '1h Class Reminder'

    // 1a. Student Notification
    if (c.student_pushify_sub && c.student_pushify_sub !== 'null') {
      const studentMsg = sendType === '1h'
        ? `Reminder: You have a driving class scheduled in 1 hour at ${timeStr}.`
        : `Reminder: You have a driving class scheduled ${isTodayClass ? 'today' : 'tomorrow'} at ${timeStr}.`

      const key = `${heading}|${studentMsg}`
      let g = groups.get(key)
      if (!g) {
        g = { heading, sendType, message: studentMsg, subs: new Set(), classes: [] }
        groups.set(key, g)
      }
      g.subs.add(c.student_pushify_sub)
      if (!g.classes.some((item) => item.id === c.id)) {
        g.classes.push({ id: c.id, reminders: [...reminders] })
      }
    }

    // 1b. Instructor Notification
    if (c.instructor_pushify_sub && c.instructor_pushify_sub !== 'null') {
      const instructorMsg = sendType === '1h'
        ? `Reminder: Class with ${c.student_name} is in 1 hour at ${timeStr}.`
        : `Reminder: Class with ${c.student_name} is scheduled ${isTodayClass ? 'today' : 'tomorrow'} at ${timeStr}.`

      const key = `${heading}|${instructorMsg}`
      let g = groups.get(key)
      if (!g) {
        g = { heading, sendType, message: instructorMsg, subs: new Set(), classes: [] }
        groups.set(key, g)
      }
      g.subs.add(c.instructor_pushify_sub)
      if (!g.classes.some((item) => item.id === c.id)) {
        g.classes.push({ id: c.id, reminders: [...reminders] })
      }
    }
  }

  for (const g of groups.values()) {
    if (sends >= MAX_SENDS) { deferred += g.classes.length; continue }

    const pushRes = await sendPush(env, {
      heading: g.heading,
      message: g.message,
      subscriptionIds: [...g.subs]
    })
    sends++

    if (pushRes.sent) {
      for (const c of g.classes) {
        if (!c.reminders.includes(g.sendType)) {
          c.reminders.push(g.sendType)
          const next = c.reminders.join(',')
          updates.push(env.DB.prepare('UPDATE classes SET reminded_at = ? WHERE id = ?').bind(next, c.id))
        }
      }
      classesNotified += g.classes.length
    }
  }

  // ── 2. Vehicle document expiry alerts for admins ─────────────────────
  const { results: docs } = await env.DB.prepare(`
    SELECT vd.id, vd.school_id, vd.doc_type, vd.expiry_date, vd.reminded_at,
           v.vehicle_number
      FROM vehicle_documents vd
      JOIN vehicles v ON v.id = vd.vehicle_id
     WHERE vd.expiry_date >= ?
       AND vd.expiry_date <= ?
  `).bind(ymd(now), ymd(now + DOC_LOOKAHEAD_DAYS * 86400000)).all()

  const due = []
  for (const doc of docs || []) {
    // Parse expiry date at midnight IST
    const expiryTime = new Date(doc.expiry_date + 'T00:00:00+05:30').getTime()
    const diffDays = (expiryTime - now) / (24 * 3600 * 1000)
    const reminders = doc.reminded_at ? doc.reminded_at.split(',').filter(Boolean) : []

    let sendType = null
    let label = ''
    if (diffDays > 8 && diffDays <= 31 && !reminders.includes('1m')) {
      sendType = '1m'
      label = '1 month'
    } else if (diffDays > 0 && diffDays <= 8 && !reminders.includes('1w')) {
      sendType = '1w'
      label = '1 week'
    }
    if (sendType) due.push({ doc, reminders, sendType, label })
  }

  if (due.length) {
    // One lookup covering every school with a due document, instead of a query per
    // document — that per-doc query was the other way this route could run out of
    // its 50-queries-per-invocation budget.
    const schoolIds = [...new Set(due.map((d) => d.doc.school_id))]
    const ph = schoolIds.map(() => '?').join(',')
    const { results: admins } = await env.DB.prepare(`
      SELECT school_id, pushify_sub FROM users
       WHERE school_id IN (${ph}) AND role = 'admin' AND pushify_sub IS NOT NULL
    `).bind(...schoolIds).all()

    const subsBySchool = new Map()
    for (const a of admins || []) {
      if (!a.pushify_sub || a.pushify_sub === 'null') continue
      if (!subsBySchool.has(a.school_id)) subsBySchool.set(a.school_id, [])
      subsBySchool.get(a.school_id).push(a.pushify_sub)
    }

    for (const { doc, reminders, sendType, label } of due) {
      const adminSubs = subsBySchool.get(doc.school_id)
      if (!adminSubs || !adminSubs.length) continue
      if (sends >= MAX_SENDS) { deferred++; continue }

      const pushRes = await sendPush(env, {
        heading: 'Document Expiry Alert',
        message: `Document '${doc.doc_type}' for vehicle ${doc.vehicle_number} expires in ${label} on ${doc.expiry_date}.`,
        subscriptionIds: adminSubs
      })
      sends++

      if (pushRes.sent) {
        const next = [...reminders, sendType].join(',')
        updates.push(env.DB.prepare('UPDATE vehicle_documents SET reminded_at = ? WHERE id = ?').bind(next, doc.id))
        docsNotified++
      }
    }
  }

  // Every reminded_at write goes out as one batch — a statement per notified row would
  // otherwise reintroduce the per-invocation query ceiling this route just escaped.
  if (updates.length) await env.DB.batch(updates)

  return ok({
    success: true,
    classesNotified,
    docsNotified,
    sends,
    // Non-zero means MAX_SENDS was reached and this many rows roll to the next run.
    deferred
  })
}
