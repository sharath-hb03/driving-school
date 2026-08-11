import { useEffect, useMemo, useState } from 'react'
import {
  startOfWeek, addDays, addWeeks, format, isSameDay, parseISO, isToday, set as setDate
} from 'date-fns'
import { ChevronLeft, ChevronRight, Bell, Phone, Check, X, Pencil, Trash2, CalendarDays, Plus, Clock } from 'lucide-react'
import toast from 'react-hot-toast'
import { api } from '../lib/api'
import { fmtTime } from '../lib/format'
import { PageHeader, Fab } from '../components/PageHeader'
import { Avatar, Badge, EmptyState, Spinner } from '../components/ui'
import { useConfirm } from '../components/ConfirmDialog'
import ClassForm from '../components/ClassForm'

const STATUS_COLOR = { scheduled: 'blue', attended: 'green', absent: 'red', cancelled: 'gray' }
const asDate = (v) => parseISO(v.includes('T') ? v : v.replace(' ', 'T'))
const hourOf = (hhmm, fallback) => {
  const h = parseInt(String(hhmm || '').slice(0, 2), 10)
  return Number.isNaN(h) ? fallback : h
}
const fmtHour = (h) => {
  const d = new Date()
  d.setHours(h, 0, 0, 0)
  return format(d, 'h:mm a')
}

export default function Schedule() {
  const confirm = useConfirm()
  const [weekStart, setWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }))
  const [selected, setSelected] = useState(new Date())
  const [classes, setClasses] = useState([])
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [instructors, setInstructors] = useState([])
  const [instructorFilter, setInstructorFilter] = useState('')
  const [bookingSlotHour, setBookingSlotHour] = useState(null)

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart])

  const loadWeek = async () => {
    setLoading(true)
    try {
      const from = addDays(weekStart, -1).toISOString()
      const to = addDays(weekStart, 8).toISOString()
      const d = await api.get(`/classes?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`)
      setClasses(d.classes || [])
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => {
    loadWeek()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStart])

  useEffect(() => {
    api.get('/instructors?active=1').then((d) => setInstructors(d.instructors || [])).catch(() => {})
  }, [])

  const filtered = useMemo(
    () => (instructorFilter ? classes.filter((c) => c.instructor_id === instructorFilter) : classes),
    [classes, instructorFilter]
  )

  const countByDay = useMemo(() => {
    const map = {}
    for (const c of filtered) {
      const key = format(asDate(c.scheduled_at), 'yyyy-MM-dd')
      map[key] = (map[key] || 0) + 1
    }
    return map
  }, [filtered])

  const dayClasses = useMemo(
    () =>
      filtered
        .filter((c) => isSameDay(asDate(c.scheduled_at), selected))
        .sort((a, b) => asDate(a.scheduled_at) - asDate(b.scheduled_at)),
    [filtered, selected]
  )

  // Determine work hours range for timeline
  const selectedInstructor = useMemo(
    () => (instructorFilter ? instructors.find((i) => i.id === instructorFilter) : null),
    [instructorFilter, instructors]
  )
  const startH = hourOf(selectedInstructor?.work_start, 6)
  const endH = hourOf(selectedInstructor?.work_end, 20)
  const timelineHours = useMemo(() => {
    const out = []
    for (let h = startH; h < endH; h++) out.push(h)
    return out
  }, [startH, endH])

  // Group booked classes by their hour
  const classesByHour = useMemo(() => {
    const map = {}
    for (const c of dayClasses) {
      const d = asDate(c.scheduled_at)
      const h = d.getHours()
      if (!map[h]) map[h] = []
      map[h].push(c)
    }
    return map
  }, [dayClasses])

  // Compute availability info per hour slot
  const slotAvailability = useMemo(() => {
    const dayOfWeek = selected.getDay()
    const targetInstructors = instructorFilter
      ? instructors.filter((i) => i.id === instructorFilter)
      : instructors

    const result = {}

    for (const h of timelineHours) {
      const booked = classesByHour[h] || []
      const bookedInstIds = new Set(booked.map((c) => c.instructor_id).filter(Boolean))

      // Working instructors during this hour
      const working = targetInstructors.filter((inst) => {
        const days = String(inst.work_days || '0,1,2,3,4,5,6').split(',').map(Number)
        if (!days.includes(dayOfWeek)) return false
        const s = hourOf(inst.work_start, 6)
        const e = hourOf(inst.work_end, 20)
        return h >= s && h < e
      })

      const freeInsts = working.filter((inst) => !bookedInstIds.has(inst.id))

      let availableCount = 0
      let freeNamesText = ''

      if (instructors.length === 0) {
        availableCount = booked.length > 0 ? 0 : 1
      } else {
        availableCount = Math.max(0, working.length - booked.length)
        if (freeInsts.length > 0) {
          freeNamesText = freeInsts.map((i) => i.name).join(', ')
        } else if (availableCount > 0) {
          freeNamesText = `${availableCount} instructor${availableCount > 1 ? 's' : ''}`
        }
      }

      result[h] = {
        booked,
        availableCount,
        freeNamesText
      }
    }

    return result
  }, [selected, instructorFilter, instructors, timelineHours, classesByHour])

  // Overall Stats
  const totalSlots = timelineHours.length
  const bookedSlots = useMemo(() => {
    const hours = new Set()
    for (const c of dayClasses) hours.add(asDate(c.scheduled_at).getHours())
    return hours.size
  }, [dayClasses])
  const availableSlots = totalSlots - bookedSlots

  const mark = async (cls, status) => {
    try {
      await api.put(`/classes/${cls.id}`, { status })
      setClasses((cs) => cs.map((c) => (c.id === cls.id ? { ...c, status } : c)))
      toast.success(status === 'attended' ? 'Present' : status === 'absent' ? 'Absent' : 'Updated')
    } catch (e) {
      toast.error(e.message)
    }
  }

  const remove = async (cls) => {
    const ok = await confirm({ title: 'Delete class?', message: 'This class will be removed.', danger: true, confirmText: 'Delete' })
    if (!ok) return
    await api.del(`/classes/${cls.id}`)
    setClasses((cs) => cs.filter((c) => c.id !== cls.id))
  }

  const sendReminder = async () => {
    const date = format(selected, 'yyyy-MM-dd')
    const t = toast.loading('Sending…')
    try {
      const res = await api.post('/notify/class-reminder', { date })
      toast.dismiss(t)
      res.sent ? toast.success(`Sent for ${res.count} class(es)`) : toast(res.message || res.reason || 'Nothing to send', { icon: 'ℹ️' })
    } catch (e) {
      toast.dismiss(t)
      toast.error(e.message)
    }
  }

  const openBookAtHour = (hour) => {
    setBookingSlotHour(hour)
    setEditing(null)
    setFormOpen(true)
  }

  const classFormInitialDate = useMemo(() => {
    if (bookingSlotHour !== null) {
      const d = setDate(selected, { hours: bookingSlotHour, minutes: 0, seconds: 0, milliseconds: 0 })
      const pad = (n) => String(n).padStart(2, '0')
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
    }
    return format(selected, 'yyyy-MM-dd')
  }, [selected, bookingSlotHour])

  return (
    <div>
      <PageHeader title="Schedule" subtitle="Tap a day to view classes" />

      {/* Week navigator */}
      <div className="card mb-4 p-3">
        <div className="mb-2 flex items-center justify-between px-1">
          <button onClick={() => setWeekStart((w) => addWeeks(w, -1))} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <p className="text-sm font-bold text-slate-700">{format(weekStart, 'MMMM yyyy')}</p>
          <button onClick={() => setWeekStart((w) => addWeeks(w, 1))} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
        <div className="grid grid-cols-7 gap-1">
          {days.map((d) => {
            const key = format(d, 'yyyy-MM-dd')
            const isSel = isSameDay(d, selected)
            return (
              <button
                key={key}
                onClick={() => setSelected(d)}
                className={`flex flex-col items-center rounded-xl py-2 transition ${
                  isSel ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <span className={`text-[10px] font-medium ${isSel ? 'text-white/80' : 'text-slate-400'}`}>
                  {format(d, 'EEE')}
                </span>
                <span className={`mt-0.5 text-sm font-bold ${isToday(d) && !isSel ? 'text-brand-600' : ''}`}>
                  {format(d, 'd')}
                </span>
                <span className={`mt-1 h-1.5 w-1.5 rounded-full ${countByDay[key] ? (isSel ? 'bg-white' : 'bg-brand-400') : 'bg-transparent'}`} />
              </button>
            )
          })}
        </div>
      </div>

      {instructors.length > 0 && (
        <div className="scrollbar-none -mx-1 mb-3 flex gap-2 overflow-x-auto px-1 pb-1">
          <button
            onClick={() => setInstructorFilter('')}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
              !instructorFilter ? 'bg-brand-600 text-white' : 'bg-white text-slate-600 shadow-sm hover:bg-slate-50'
            }`}
          >
            All instructors
          </button>
          {instructors.map((i) => (
            <button
              key={i.id}
              onClick={() => setInstructorFilter((f) => (f === i.id ? '' : i.id))}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                instructorFilter === i.id ? 'bg-brand-600 text-white' : 'bg-white text-slate-600 shadow-sm hover:bg-slate-50'
              }`}
            >
              {i.name}
            </button>
          ))}
        </div>
      )}

      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-bold text-slate-800">
          {isToday(selected) ? 'Today' : format(selected, 'EEEE, dd MMM')}
        </h2>
        {dayClasses.length > 0 && (
          <button onClick={sendReminder} className="btn-ghost px-3 py-1.5 text-xs">
            <Bell className="h-4 w-4" /> Remind
          </button>
        )}
      </div>

      {/* Slot summary bar */}
      {!loading && (
        <div className="mb-3 flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-2">
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <Clock className="h-3.5 w-3.5" />
            <span className="font-semibold">{totalSlots} time slots</span>
            <span className="text-slate-300">·</span>
            <span className="font-semibold text-brand-600">{bookedSlots} booked</span>
            <span className="text-slate-300">·</span>
            <span className="font-semibold text-emerald-600">{availableSlots} open</span>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-10 text-slate-300">
          <Spinner className="h-6 w-6" />
        </div>
      ) : (
        <div className="space-y-3">
          {timelineHours.map((hour) => {
            const { booked, availableCount, freeNamesText } = slotAvailability[hour] || { booked: [], availableCount: 0, freeNamesText: '' }

            return (
              <div key={hour} className="flex items-start gap-3 border-b border-slate-100 pb-3.5 last:border-b-0 last:pb-0">
                {/* Hour Label */}
                <div className="flex w-14 shrink-0 flex-col items-center pt-2.5 select-none">
                  <span className={`text-sm font-bold ${booked.length > 0 ? 'text-brand-600' : 'text-slate-400'}`}>
                    {fmtHour(hour)}
                  </span>
                  <span className="text-[10px] text-slate-400">1h</span>
                </div>

                {/* Hour Slot Contents */}
                <div className="flex-1 space-y-2">
                  {booked.map((c) => (
                    <div key={c.id} className="card p-3.5">
                      <div className="flex items-center gap-3">
                        <Avatar name={c.student_name} size={42} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-semibold text-slate-800">{c.student_name}</p>
                          <p className="truncate text-xs text-slate-400">
                            <span className="font-semibold text-slate-600">{c.instructor_name || 'No instructor'}</span>
                            {c.vehicle_number ? ` · ${c.vehicle_number}` : ''}
                          </p>
                        </div>
                        <Badge color={STATUS_COLOR[c.status]}>{c.status}</Badge>
                      </div>

                      <div className="mt-3 flex items-center gap-2">
                        {c.status === 'scheduled' ? (
                          <>
                            <button onClick={() => mark(c, 'attended')} className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-emerald-50 py-2 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100">
                              <Check className="h-4 w-4" /> Present
                            </button>
                            <button onClick={() => mark(c, 'absent')} className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-red-50 py-2 text-xs font-semibold text-red-700 transition hover:bg-red-100">
                              <X className="h-4 w-4" /> Absent
                            </button>
                          </>
                        ) : (
                          <button onClick={() => mark(c, 'scheduled')} className="flex-1 rounded-lg bg-slate-50 py-2 text-xs font-semibold text-slate-500 transition hover:bg-slate-100">
                            Reset to scheduled
                          </button>
                        )}
                        {c.student_phone && (
                          <a href={`tel:${c.student_phone}`} className="rounded-lg bg-slate-50 p-2 text-slate-500 transition hover:bg-slate-100">
                            <Phone className="h-4 w-4" />
                          </a>
                        )}
                        <button onClick={() => { setEditing(c); setBookingSlotHour(null); setFormOpen(true) }} className="rounded-lg bg-slate-50 p-2 text-slate-500 transition hover:bg-slate-100">
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button onClick={() => remove(c)} className="rounded-lg bg-red-50 p-2 text-red-500 transition hover:bg-red-100">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}

                  {/* Open / Available Slot Action */}
                  {availableCount > 0 && (
                    <button
                      onClick={() => openBookAtHour(hour)}
                      className="flex w-full items-center gap-3 rounded-xl border border-dashed border-slate-200 bg-white/70 px-3.5 py-2.5 text-left transition hover:border-brand-300 hover:bg-brand-50/50 group"
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-400 group-hover:bg-brand-100 group-hover:text-brand-600">
                        <Plus className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-slate-600 group-hover:text-brand-600">
                          {booked.length > 0
                            ? `+ Book another class ${freeNamesText ? `(${freeNamesText} free)` : ''}`
                            : 'Available — tap to book'}
                        </p>
                        {booked.length === 0 && freeNamesText && (
                          <p className="text-[11px] text-slate-400 group-hover:text-brand-500">
                            {freeNamesText} free
                          </p>
                        )}
                      </div>
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <Fab onClick={() => { setEditing(null); setBookingSlotHour(null); setFormOpen(true) }} label="Book class" />
      <ClassForm
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditing(null); setBookingSlotHour(null) }}
        klass={editing}
        initialDate={classFormInitialDate}
        onSaved={loadWeek}
      />
    </div>
  )
}
