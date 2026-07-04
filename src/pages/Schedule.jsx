import { useEffect, useMemo, useState } from 'react'
import {
  startOfWeek, addDays, addWeeks, format, isSameDay, parseISO, isToday
} from 'date-fns'
import { ChevronLeft, ChevronRight, Bell, Phone, Check, X, Pencil, Trash2, CalendarDays } from 'lucide-react'
import toast from 'react-hot-toast'
import { api } from '../lib/api'
import { fmtTime } from '../lib/format'
import { PageHeader, Fab } from '../components/PageHeader'
import { Avatar, Badge, EmptyState, Spinner } from '../components/ui'
import { useConfirm } from '../components/ConfirmDialog'
import ClassForm from '../components/ClassForm'

const STATUS_COLOR = { scheduled: 'blue', attended: 'green', absent: 'red', cancelled: 'gray' }
const asDate = (v) => parseISO(v.includes('T') ? v : v.replace(' ', 'T'))

export default function Schedule() {
  const confirm = useConfirm()
  const [weekStart, setWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }))
  const [selected, setSelected] = useState(new Date())
  const [classes, setClasses] = useState([])
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState(null)

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

  const countByDay = useMemo(() => {
    const map = {}
    for (const c of classes) {
      const key = format(asDate(c.scheduled_at), 'yyyy-MM-dd')
      map[key] = (map[key] || 0) + 1
    }
    return map
  }, [classes])

  const dayClasses = useMemo(
    () =>
      classes
        .filter((c) => isSameDay(asDate(c.scheduled_at), selected))
        .sort((a, b) => asDate(a.scheduled_at) - asDate(b.scheduled_at)),
    [classes, selected]
  )

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

      {loading ? (
        <div className="flex justify-center py-10 text-slate-300">
          <Spinner className="h-6 w-6" />
        </div>
      ) : dayClasses.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title="No classes this day"
          subtitle="Book a class with the button below."
        />
      ) : (
        <div className="space-y-3">
          {dayClasses.map((c) => (
            <div key={c.id} className="card p-3.5">
              <div className="flex items-center gap-3">
                <div className="flex w-14 shrink-0 flex-col items-center">
                  <span className="text-sm font-bold text-brand-600">{fmtTime(c.scheduled_at)}</span>
                  <span className="text-[10px] text-slate-400">{c.duration_min}m</span>
                </div>
                <Avatar name={c.student_name} size={42} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-slate-800">{c.student_name}</p>
                  <p className="truncate text-xs text-slate-400">
                    {c.instructor_name || 'No instructor'}
                    {c.vehicle_number ? ` · ${c.vehicle_number}` : ''}
                  </p>
                </div>
                <Badge color={STATUS_COLOR[c.status]}>{c.status}</Badge>
              </div>

              <div className="mt-3 flex items-center gap-2">
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
                {c.student_phone && (
                  <a href={`tel:${c.student_phone}`} className="rounded-lg bg-slate-50 p-2 text-slate-500">
                    <Phone className="h-4 w-4" />
                  </a>
                )}
                <button onClick={() => { setEditing(c); setFormOpen(true) }} className="rounded-lg bg-slate-50 p-2 text-slate-500">
                  <Pencil className="h-4 w-4" />
                </button>
                <button onClick={() => remove(c)} className="rounded-lg bg-red-50 p-2 text-red-500">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Fab onClick={() => { setEditing(null); setFormOpen(true) }} label="Book class" />
      <ClassForm
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditing(null) }}
        klass={editing}
        initialDate={format(selected, 'yyyy-MM-dd')}
        onSaved={loadWeek}
      />
    </div>
  )
}
