import { sendPush } from '../../_lib/onesignal.js'
import { ok, unauthorized, badRequest } from '../../_lib/utils.js'

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

export async function onRequestGet(context) {
  return handleCron(context)
}

export async function onRequestPost(context) {
  return handleCron(context)
}

async function handleCron(context) {
  const { env, request } = context
  const url = new URL(request.url)
  const token = url.searchParams.get('token')

  const expectedToken = env.AUTH_SECRET
  if (!expectedToken) {
    return unauthorized('AUTH_SECRET is not configured on the server')
  }

  if (token !== expectedToken) {
    return unauthorized('Invalid cron token')
  }

  const now = Date.now()
  let classesNotified = 0
  let docsNotified = 0

  // 1. Process Class Reminders for Students
  const { results: classes } = await env.DB.prepare(`
    SELECT c.id, c.school_id, c.student_id, c.scheduled_at, c.reminded_at,
           s.name AS student_name, s.pushify_sub AS student_pushify_sub
      FROM classes c
      JOIN students s ON s.id = c.student_id
     WHERE c.status = 'scheduled'
  `).all()

  for (const c of classes || []) {
    console.log(`[cron] Checking class ${c.id}: scheduled_at=${c.scheduled_at}, pushify_sub=${c.student_pushify_sub}, reminded_at=${c.reminded_at}`)
    if (!c.student_pushify_sub || c.student_pushify_sub === 'null') {
      console.log(`[cron] Skipped class ${c.id} due to missing/null pushify_sub`)
      continue
    }

    const classTime = new Date(c.scheduled_at.includes('T') ? c.scheduled_at : c.scheduled_at.replace(' ', 'T')).getTime()
    const diffMs = classTime - now
    const reminders = c.reminded_at ? c.reminded_at.split(',') : []
    console.log(`[cron] Class ${c.id} time diff: diffMs=${diffMs} ms (${(diffMs / 3600000).toFixed(2)} hours)`)

    let sendType = null // '1d' or '1h'
    let heading = 'Class Reminder'
    let message = ''

    // 1 Day Reminder: Scheduled between 1.5 hours and 26 hours, not already sent
    if (diffMs > 90 * 60 * 1000 && diffMs <= 26 * 3600 * 1000 && !reminders.includes('1d')) {
      sendType = '1d'
      const timeStr = formatClassTime(new Date(classTime))
      const isTodayClass = new Date(classTime).toDateString() === new Date(now).toDateString()
      message = `Hi ${c.student_name}, this is a reminder that you have a driving class scheduled ${isTodayClass ? 'today' : 'tomorrow'} at ${timeStr}.`
    }
    // 1 Hour Reminder: Scheduled within 90 minutes, not already sent
    else if (diffMs > 0 && diffMs <= 90 * 60 * 1000 && !reminders.includes('1h')) {
      sendType = '1h'
      const timeStr = formatClassTime(new Date(classTime))
      message = `Hi ${c.student_name}, you have a driving class scheduled in 1 hour at ${timeStr}!`
    }

    if (sendType) {
      const pushRes = await sendPush(env, {
        heading,
        message,
        subscriptionIds: [c.student_pushify_sub]
      })

      if (pushRes.sent) {
        reminders.push(sendType)
        const updatedRemindedAt = reminders.filter(Boolean).join(',')
        await env.DB.prepare('UPDATE classes SET reminded_at = ? WHERE id = ?')
          .bind(updatedRemindedAt, c.id)
          .run()
        classesNotified++
      }
    }
  }

  // 2. Process Vehicle Document Expiry Alerts for Admins
  const { results: docs } = await env.DB.prepare(`
    SELECT vd.id, vd.school_id, vd.vehicle_id, vd.doc_type, vd.expiry_date, vd.reminded_at,
           v.vehicle_number
      FROM vehicle_documents vd
      JOIN vehicles v ON v.id = vd.vehicle_id
  `).all()

  for (const doc of docs || []) {
    console.log(`[cron] Checking doc ${doc.id}: doc_type=${doc.doc_type}, expiry_date=${doc.expiry_date}, reminded_at=${doc.reminded_at}`)
    // Parse expiry date at midnight IST
    const expiryTime = new Date(doc.expiry_date + 'T00:00:00+05:30').getTime()
    const diffDays = (expiryTime - now) / (24 * 3600 * 1000)
    const reminders = doc.reminded_at ? doc.reminded_at.split(',') : []
    console.log(`[cron] Doc ${doc.id} days diff: diffDays=${diffDays.toFixed(2)}`)

    let sendType = null // '1w' or '1m'
    let label = ''

    // 1 Month Reminder: Expires between 8 and 31 days, not already sent
    if (diffDays > 8 && diffDays <= 31 && !reminders.includes('1m')) {
      sendType = '1m'
      label = '1 month'
    }
    // 1 Week Reminder: Expires within 8 days, not already sent
    else if (diffDays > 0 && diffDays <= 8 && !reminders.includes('1w')) {
      sendType = '1w'
      label = '1 week'
    }

    if (sendType) {
      // Find school admins
      const { results: admins } = await env.DB.prepare(`
        SELECT pushify_sub FROM users
         WHERE school_id = ? AND role = 'admin' AND pushify_sub IS NOT NULL
      `).bind(doc.school_id).all()

      const adminSubs = (admins || []).map(r => r.pushify_sub).filter(Boolean)

      if (adminSubs.length > 0) {
        const pushRes = await sendPush(env, {
          heading: 'Document Expiry Alert',
          message: `Document '${doc.doc_type}' for vehicle ${doc.vehicle_number} expires in ${label} on ${doc.expiry_date}.`,
          subscriptionIds: adminSubs
        })

        if (pushRes.sent) {
          reminders.push(sendType)
          const updatedRemindedAt = reminders.filter(Boolean).join(',')
          await env.DB.prepare('UPDATE vehicle_documents SET reminded_at = ? WHERE id = ?')
            .bind(updatedRemindedAt, doc.id)
            .run()
          docsNotified++
        }
      }
    }
  }

  return ok({
    success: true,
    classesNotified,
    docsNotified
  })
}
