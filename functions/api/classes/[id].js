// GET / PUT / DELETE  /api/classes/:id
import { ok, notFound, badRequest, readJson } from '../../_lib/utils.js'
import { findBookingConflicts } from '../../_lib/schedule.js'
import { maybeCompleteAndCertify } from '../../_lib/certificate.js'
import { sendPush } from '../../_lib/pushify.js'

const ALLOWED = ['instructor_id', 'vehicle_id', 'scheduled_at', 'duration_min', 'status', 'notes']

const SELECT = `
  SELECT c.*, s.name AS student_name, s.phone AS student_phone,
         i.name AS instructor_name, v.vehicle_number
    FROM classes c
    JOIN students s ON s.id = c.student_id
    LEFT JOIN instructors i ON i.id = c.instructor_id
    LEFT JOIN vehicles v ON v.id = c.vehicle_id`

export async function onRequestGet(context) {
  const { env, params, data } = context
  const row = await env.DB.prepare(`${SELECT} WHERE c.id=? AND c.school_id=?`).bind(params.id, data.schoolId).first()
  if (!row) return notFound('Class not found')
  return ok({ class: row })
}

export async function onRequestPut(context) {
  const { env, params, data, request } = context
  const sid  = data.schoolId
  const body = await readJson(request)
  if (!body) return badRequest('Invalid JSON')

  // Only update allowed fields that are actually present in the body
  const fields = {}
  for (const k of ALLOWED) { if (k in body) fields[k] = body[k] }
  if (!Object.keys(fields).length) return badRequest('Nothing to update')

  let timeChanged = false
  let originalTime = null

  // ── Conflict check when rescheduling or reassigning ─────────────────
  const touchesSchedule = ['scheduled_at', 'instructor_id', 'vehicle_id', 'duration_min'].some((k) => k in fields)
  if (touchesSchedule) {
    const current = await env.DB.prepare('SELECT * FROM classes WHERE id=? AND school_id=?').bind(params.id, sid).first()
    if (!current) return notFound('Class not found')

    originalTime = current.scheduled_at
    timeChanged = 'scheduled_at' in fields && fields.scheduled_at !== current.scheduled_at

    const merged = { ...current, ...fields }
    // Only check if the class isn't being cancelled
    if ((merged.status || 'scheduled') !== 'cancelled') {
      const conflicts = await findBookingConflicts(env.DB, {
        school_id:     sid,
        instructor_id: merged.instructor_id || null,
        vehicle_id:    merged.vehicle_id    || null,
        duration_min:  merged.duration_min  || 45,
        slots:         [merged.scheduled_at],
        exclude_id:    params.id,            // exclude self from conflict check
      })
      if (conflicts.length) {
        const c   = conflicts[0]
        const msg = c.type === 'instructor'
          ? `Instructor already booked at this time (with ${c.with?.student_name})`
          : c.type === 'vehicle'
          ? `Vehicle already in use at this time`
          : c.type === 'holiday'
          ? `School holiday: ${c.label}`
          : `Instructor on leave: ${c.label}`
        return new Response(JSON.stringify({ ok: false, error: msg, conflicts }), {
          status: 409, headers: { 'Content-Type': 'application/json' }
        })
      }
    }
  }

  // Apply update
  const sets = Object.keys(fields).map((k) => `${k}=?`)
  const vals = [...Object.values(fields), params.id, sid]
  await env.DB.prepare(`UPDATE classes SET ${sets.join(',')} WHERE id=? AND school_id=?`).bind(...vals).run()

  const row = await env.DB.prepare(`${SELECT} WHERE c.id=? AND c.school_id=?`).bind(params.id, sid).first()
  if (!row) return notFound('Class not found')

  // Auto-complete & auto-certify when attendance is marked
  if (fields.status === 'attended' && row.student_id) {
    await maybeCompleteAndCertify(env, row.student_id, sid, { issuedBy: `system` }).catch(() => {})
  }

  // Notify student and instructor about rescheduling
  if (touchesSchedule && timeChanged && originalTime) {
    try {
      const student = await env.DB.prepare('SELECT pushify_sub FROM students WHERE id = ?').bind(row.student_id).first()
      let instructor = null
      if (row.instructor_id) {
        instructor = await env.DB.prepare('SELECT pushify_sub FROM instructors WHERE id = ?').bind(row.instructor_id).first()
      }

      const newTimeStr = new Date(row.scheduled_at.includes('T') ? row.scheduled_at : row.scheduled_at.replace(' ', 'T')).toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      })

      const oldTimeStr = new Date(originalTime.includes('T') ? originalTime : originalTime.replace(' ', 'T')).toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      })

      if (student && student.pushify_sub && student.pushify_sub !== 'null') {
        await sendPush(env, {
          heading: 'Class Rescheduled',
          message: `Your class on ${oldTimeStr} has been rescheduled to ${newTimeStr}${row.instructor_name ? ` with instructor ${row.instructor_name}` : ''}.`,
          subscriptionIds: [student.pushify_sub]
        })
      }

      if (instructor && instructor.pushify_sub && instructor.pushify_sub !== 'null') {
        await sendPush(env, {
          heading: 'Class Rescheduled',
          message: `Your class with student ${row.student_name} has been rescheduled from ${oldTimeStr} to ${newTimeStr}.`,
          subscriptionIds: [instructor.pushify_sub]
        })
      }
    } catch (err) {
      console.error('[notify] Error sending reschedule notification:', err)
    }
  }

  return ok({ class: row })
}

export async function onRequestDelete(context) {
  const { env, params, data } = context
  await env.DB.prepare('DELETE FROM classes WHERE id=? AND school_id=?').bind(params.id, data.schoolId).run()
  return ok({ deleted: true })
}
