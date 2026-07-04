// GET /api/classes/check?instructor_id=&vehicle_id=&scheduled_at=&duration_min=&exclude_id=
// Real-time conflict check — called immediately on instructor/time selection in the UI
import { ok } from '../../_lib/utils.js'
import { findBookingConflicts } from '../../_lib/schedule.js'

export async function onRequestGet(context) {
  const { env, request, data } = context
  const sid = data.schoolId
  const url = new URL(request.url)

  const instructor_id = url.searchParams.get('instructor_id') || null
  const vehicle_id    = url.searchParams.get('vehicle_id')    || null
  const scheduled_at  = url.searchParams.get('scheduled_at')  || null
  const duration_min  = Number(url.searchParams.get('duration_min')) || 45
  const exclude_id    = url.searchParams.get('exclude_id')    || null

  if (!scheduled_at || (!instructor_id && !vehicle_id)) {
    return ok({ conflicts: [] })
  }

  const conflicts = await findBookingConflicts(env.DB, {
    school_id: sid,
    instructor_id,
    vehicle_id,
    duration_min,
    slots: [scheduled_at],
    exclude_id,
  })

  return ok({ conflicts, free: conflicts.length === 0 })
}
