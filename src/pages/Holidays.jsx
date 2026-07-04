import { useEffect, useMemo, useState } from 'react'
import {
  startOfMonth, startOfWeek, addDays, addMonths, isSameMonth, isToday, format, parseISO
} from 'date-fns'
import { ChevronLeft, ChevronRight, CalendarOff, Plus, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { api } from '../lib/api'
import { PageHeader } from '../components/PageHeader'
import { EmptyState, Spinner } from '../components/ui'
import { useConfirm } from '../components/ConfirmDialog'
import Modal from '../components/Modal'
import { TextInput } from '../components/Field'

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
const key = (d) => format(d, 'yyyy-MM-dd')

export default function Holidays() {
  const confirm = useConfirm()
  const [holidays, setHolidays] = useState([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState(startOfMonth(new Date()))
  const [addOpen, setAddOpen] = useState(false)
  const [form, setForm] = useState({ date: '', name: '' })
  const [busy, setBusy] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const d = await api.get('/holidays')
      setHolidays(d.holidays || [])
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => {
    load()
  }, [])

  const byDate = useMemo(() => {
    const m = {}
    for (const h of holidays) m[h.date] = h
    return m
  }, [holidays])

  const grid = useMemo(() => {
    const first = startOfWeek(startOfMonth(view), { weekStartsOn: 0 })
    return Array.from({ length: 42 }, (_, i) => addDays(first, i))
  }, [view])

  const upcoming = useMemo(() => {
    const todayKey = key(new Date())
    return holidays.filter((h) => h.date >= todayKey).sort((a, b) => a.date.localeCompare(b.date))
  }, [holidays])

  const openAdd = (day) => {
    setForm({ date: key(day), name: '' })
    setAddOpen(true)
  }

  const save = async (e) => {
    e.preventDefault()
    if (!form.date) return toast.error('Pick a date')
    if (!form.name.trim()) return toast.error('Give the holiday a name')
    setBusy(true)
    try {
      await api.post('/holidays', { date: form.date, name: form.name.trim() })
      toast.success('Holiday added')
      setAddOpen(false)
      load()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  const remove = async (h) => {
    const ok = await confirm({
      title: 'Remove holiday?',
      message: `${h.name} on ${format(parseISO(h.date), 'dd MMM yyyy')} will be bookable again.`,
      danger: true,
      confirmText: 'Remove'
    })
    if (!ok) return
    await api.del(`/holidays/${h.id}`)
    load()
  }

  const onDayClick = (day) => {
    const existing = byDate[key(day)]
    if (existing) remove(existing)
    else openAdd(day)
  }

  return (
    <div>
      <PageHeader title="Holidays" subtitle="Days the school is closed — these are blocked when booking" />

      {/* Calendar */}
      <div className="card mb-4 p-3">
        <div className="mb-2 flex items-center justify-between px-1">
          <button onClick={() => setView((v) => addMonths(v, -1))} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <p className="text-sm font-bold text-slate-700">{format(view, 'MMMM yyyy')}</p>
          <button onClick={() => setView((v) => addMonths(v, 1))} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
        <div className="grid grid-cols-7 text-center text-[11px] font-semibold text-slate-400">
          {WEEKDAYS.map((d) => (
            <span key={d} className="py-1">{d}</span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {grid.map((day) => {
            const h = byDate[key(day)]
            const muted = !isSameMonth(day, view)
            return (
              <button
                key={day.toISOString()}
                onClick={() => onDayClick(day)}
                title={h ? h.name : 'Add holiday'}
                className={[
                  'flex min-h-[44px] flex-col items-center justify-center rounded-xl py-1.5 text-sm transition',
                  h
                    ? 'bg-red-50 font-semibold text-red-600 ring-1 ring-inset ring-red-200'
                    : muted
                    ? 'text-slate-300 hover:bg-slate-50'
                    : 'text-slate-700 hover:bg-slate-100',
                  !h && isToday(day) ? 'font-bold text-brand-600' : ''
                ].join(' ')}
              >
                <span>{format(day, 'd')}</span>
                {h && <span className="mt-0.5 line-clamp-1 px-0.5 text-[9px] leading-tight">{h.name}</span>}
              </button>
            )
          })}
        </div>
        <p className="mt-2 text-center text-[11px] text-slate-400">Tap a day to add a holiday · tap a red day to remove it</p>
      </div>

      {/* Upcoming list */}
      <h2 className="mb-3 px-1 text-lg font-bold text-slate-800">Upcoming</h2>
      {loading ? (
        <div className="flex justify-center py-8 text-slate-300">
          <Spinner className="h-6 w-6" />
        </div>
      ) : upcoming.length === 0 ? (
        <EmptyState icon={CalendarOff} title="No upcoming holidays" subtitle="Tap any day above to mark the school closed." />
      ) : (
        <div className="space-y-2">
          {upcoming.map((h) => (
            <div key={h.id} className="card flex items-center gap-3 p-3.5">
              <div className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-xl bg-red-50 text-red-600">
                <span className="text-sm font-extrabold leading-none">{format(parseISO(h.date), 'd')}</span>
                <span className="text-[9px] font-semibold uppercase">{format(parseISO(h.date), 'MMM')}</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-slate-800">{h.name}</p>
                <p className="text-xs text-slate-400">{format(parseISO(h.date), 'EEEE, dd MMM yyyy')}</p>
              </div>
              <button onClick={() => remove(h)} className="rounded-lg p-2 text-red-400 hover:bg-red-50">
                <Trash2 className="h-4.5 w-4.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Add holiday"
        footer={
          <div className="flex gap-3">
            <button className="btn-ghost flex-1" onClick={() => setAddOpen(false)} type="button">Cancel</button>
            <button className="btn-primary flex-1" onClick={save} disabled={busy}>
              {busy ? <Spinner className="h-5 w-5" /> : <><Plus className="h-4 w-4" /> Add</>}
            </button>
          </div>
        }
      >
        <form onSubmit={save}>
          <TextInput label="Date" type="date" required value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
          <TextInput label="Holiday name" required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Republic Day" />
        </form>
      </Modal>
    </div>
  )
}
