import { useCallback, useEffect, useState } from 'react'
import { format } from 'date-fns'
import { Check, X, Pencil, Trash2, ShieldCheck, Car, CheckCircle2, XCircle, Clock, Phone } from 'lucide-react'
import toast from 'react-hot-toast'
import { api } from '../lib/api'
import { fmtDateTime } from '../lib/format'
import Modal from './Modal'
import WeekSchedule from './WeekSchedule'
import ClassForm from './ClassForm'
import InstructorAvailability from './InstructorAvailability'
import { Badge } from './ui'
import { useConfirm } from './ConfirmDialog'

const STATUS_COLOR = { scheduled: 'blue', attended: 'green', absent: 'red', cancelled: 'gray' }
const asMs = (v) => new Date(v.includes('T') ? v : v.replace(' ', 'T')).getTime()
const TABS = [
  { value: 'calendar', label: 'Calendar' },
  { value: 'availability', label: 'Availability' },
  { value: 'tests', label: 'Tests' },
  { value: 'history', label: 'History' }
]

const TEST_STATUS_COLOR = { passed: 'green', failed: 'red', pending: 'blue' }
const TEST_STATUS_LABEL = { passed: 'Passed', failed: 'Failed', pending: 'Scheduled' }
const TEST_STATUS_ICON  = { passed: CheckCircle2, failed: XCircle, pending: Clock }

const TYPE_COLOR = { LL: 'violet', DL: 'cyan' }
const TYPE_ICON  = { LL: ShieldCheck, DL: Car }

// Staff view of one instructor — one focused tab at a time.
export default function InstructorScheduleModal({ instructor, open, onClose, onUpdated }) {
  const confirm = useConfirm()
  const id = instructor?.id
  const [tab, setTab] = useState('calendar')
  const [signal, setSignal] = useState(0)
  const [editing, setEditing] = useState(null)
  const [bookingDate, setBookingDate] = useState(null)
  const [formOpen, setFormOpen] = useState(false)
  const [history, setHistory] = useState([])
  const [holidays, setHolidays] = useState([])
  const [timeoff, setTimeoff] = useState([])

  const reload = () => setSignal((s) => s + 1)

  // Land on the calendar each time it opens.
  useEffect(() => {
    if (open) setTab('calendar')
  }, [open, id])

  useEffect(() => {
    if (!open || !id) return
    Promise.all([
      api.get('/holidays').catch(() => ({ holidays: [] })),
      api.get(`/timeoff?instructor=${id}`).catch(() => ({ timeoff: [] }))
    ]).then(([h, t]) => {
      setHolidays(h.holidays || [])
      setTimeoff(t.timeoff || [])
    })
  }, [open, id, signal])

  const load = useCallback(
    (from, to) =>
      api
        .get(`/classes?instructor=${id}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`)
        .then((d) => d.classes || []),
    [id]
  )

  const loadTests = useCallback(
    (from, to) =>
      api
        .get(`/tests?instructor=${id}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`)
        .then((d) => d.tests || []),
    [id]
  )

  // Past lessons for the History tab (refreshes when the calendar changes).
  useEffect(() => {
    if (!open || !id) return
    let active = true
    api.get(`/classes?instructor=${id}`).then((d) => {
      if (!active) return
      const past = (d.classes || [])
        .filter((c) => c.status !== 'scheduled')
        .sort((a, b) => asMs(b.scheduled_at) - asMs(a.scheduled_at))
      setHistory(past)
    }).catch(() => {})
    return () => {
      active = false
    }
  }, [open, id, signal])

  const openBooking = (day) => {
    setEditing(null)
    setBookingDate(format(day, 'yyyy-MM-dd'))
    setFormOpen(true)
  }

  const mark = async (c, status) => {
    try {
      await api.put(`/classes/${c.id}`, { status })
      toast.success(status === 'attended' ? 'Present' : status === 'absent' ? 'Absent' : 'Updated')
      reload()
    } catch (e) {
      toast.error(e.message)
    }
  }

  const remove = async (c) => {
    const ok = await confirm({ title: 'Delete class?', message: 'This class will be removed.', danger: true, confirmText: 'Delete' })
    if (!ok) return
    await api.del(`/classes/${c.id}`)
    reload()
  }

  const renderActions = (c) => (
    <>
      {c.status === 'scheduled' ? (
        <>
          <button onClick={() => mark(c, 'attended')} className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-emerald-50 py-2 text-xs font-semibold text-emerald-700">
            <Check className="h-4 w-4" /> Present
          </button>
          <button onClick={() => mark(c, 'absent')} className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-red-50 py-2 text-xs font-semibold text-red-700">
            <X className="h-4 w-4" /> Absent
          </button>
        </>
      ) : (
        <button onClick={() => mark(c, 'scheduled')} className="flex-1 rounded-lg bg-slate-50 py-2 text-xs font-semibold text-slate-500">
          Reset to scheduled
        </button>
      )}
      <button onClick={() => { setEditing(c); setFormOpen(true) }} className="rounded-lg bg-slate-50 p-2 text-slate-500">
        <Pencil className="h-4 w-4" />
      </button>
      <button onClick={() => remove(c)} className="rounded-lg bg-red-50 p-2 text-red-500">
        <Trash2 className="h-4 w-4" />
      </button>
    </>
  )

  const getEmptyTitle = (date) => {
    const key = format(date, 'yyyy-MM-dd')
    const hol = holidays.find((h) => h.date === key)
    if (hol) return 'Holiday'
    const off = timeoff.find((t) => key >= t.start_date && key <= t.end_date)
    if (off) return 'On Leave'
    const workDays = String(instructor?.work_days || '1,2,3,4,5,6').split(',').map(Number)
    if (workDays.length && !workDays.includes(date.getDay())) return 'Off Duty'
    return 'No classes this day'
  }

  const getEmptySubtitle = (date) => {
    const key = format(date, 'yyyy-MM-dd')
    const hol = holidays.find((h) => h.date === key)
    if (hol) return `School Holiday: ${hol.name}`
    const off = timeoff.find((t) => key >= t.start_date && key <= t.end_date)
    if (off) return `Instructor is on leave${off.reason ? ` · ${off.reason}` : ''}`
    const workDays = String(instructor?.work_days || '1,2,3,4,5,6').split(',').map(Number)
    if (workDays.length && !workDays.includes(date.getDay())) return 'This instructor is not scheduled to work today.'
    return 'This instructor is free.'
  }

  return (
    <Modal open={open} onClose={onClose} title={instructor ? instructor.name : 'Instructor'} size="lg">
      {instructor && (
        <>
          <div className="mb-4 flex rounded-xl bg-slate-100 p-1">
            {TABS.map((t) => (
              <button
                key={t.value}
                onClick={() => setTab(t.value)}
                className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-semibold transition ${
                  tab === t.value ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab === 'calendar' && (
            <>
              <WeekSchedule
                key={id}
                load={load}
                reloadSignal={signal}
                subtitle={(c) => c.vehicle_number || 'No vehicle'}
                renderActions={renderActions}
                onBook={openBooking}
                emptyTitle={getEmptyTitle}
                emptySubtitle={getEmptySubtitle}
              />
              <ClassForm
                open={formOpen}
                onClose={() => { setFormOpen(false); setEditing(null); setBookingDate(null) }}
                klass={editing}
                instructorId={id}
                initialDate={bookingDate}
                onSaved={reload}
              />
            </>
          )}

          {tab === 'availability' && <InstructorAvailability key={id} instructor={instructor} onSaved={() => { reload(); onUpdated?.() }} />}

          {tab === 'tests' && (
            <WeekSchedule
              key={`tests-${id}`}
              load={loadTests}
              reloadSignal={signal}
              emptyTitle="No tests this day"
              emptySubtitle="No LL or DL tests scheduled for this instructor."
              subtitle={(t) => t.licence_number || ''}
              renderBadge={(t) => {
                const TypeIcon   = TYPE_ICON[t.type]   || ShieldCheck
                const StatusIcon = TEST_STATUS_ICON[t.status] || Clock
                return (
                  <div className="flex items-center gap-1.5">
                    <Badge color={TYPE_COLOR[t.type] || 'gray'}>
                      <TypeIcon className="h-3 w-3" /> {t.type}
                    </Badge>
                    <Badge color={TEST_STATUS_COLOR[t.status] || 'gray'}>
                      <StatusIcon className="h-3 w-3" />
                      {TEST_STATUS_LABEL[t.status] || t.status || 'Unknown'}
                    </Badge>
                  </div>
                )
              }}
              renderActions={(t) => (
                <>
                  <a
                    href={`/students/${t.student_id}`}
                    className="btn-ghost flex flex-1 items-center justify-center py-1.5 text-xs font-semibold"
                  >
                    View student
                  </a>
                  {t.student_phone && (
                    <a
                      href={`tel:${t.student_phone}`}
                      className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-blue-50 py-1.5 text-xs font-semibold text-blue-700"
                    >
                      <Phone className="h-4 w-4" /> Call
                    </a>
                  )}
                </>
              )}
            />
          )}

          {tab === 'history' && (
            history.length === 0 ? (
              <p className="py-10 text-center text-sm text-slate-400">No past lessons yet.</p>
            ) : (
              <div className="space-y-2">
                {history.map((c) => (
                  <div key={c.id} className="flex items-center justify-between gap-2 rounded-xl border border-slate-100 p-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-700">{c.student_name}</p>
                      <p className="text-xs text-slate-400">{fmtDateTime(c.scheduled_at)}{c.vehicle_number ? ` · ${c.vehicle_number}` : ''}</p>
                    </div>
                    <Badge color={STATUS_COLOR[c.status]}>{c.status}</Badge>
                  </div>
                ))}
              </div>
            )
          )}
        </>
      )}
    </Modal>
  )
}
