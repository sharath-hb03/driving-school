import { useEffect, useMemo, useState } from 'react'
import { format } from 'date-fns'
import { CalendarOff, Plus, Trash2, Clock, AlertTriangle, ChevronDown } from 'lucide-react'
import toast from 'react-hot-toast'
import { api } from '../lib/api'
import { fmtDate, fmtDateTime } from '../lib/format'
import { Spinner } from './ui'
import { TextInput, Field } from './Field'
import DatePicker from './DatePicker'

const DAYS = [
  { n: 1, l: 'Mon' }, { n: 2, l: 'Tue' }, { n: 3, l: 'Wed' }, { n: 4, l: 'Thu' },
  { n: 5, l: 'Fri' }, { n: 6, l: 'Sat' }, { n: 0, l: 'Sun' }
]

// Manage one instructor's working window + time-off. Lives in the schedule
// modal — separate from the profile editor.
export default function InstructorAvailability({ instructor, onSaved }) {
  const id = instructor.id
  const [hours, setHours] = useState({
    work_days: instructor.work_days || '1,2,3,4,5,6',
    work_start: instructor.work_start || '06:00',
    work_end: instructor.work_end || '20:00'
  })
  const [savingHours, setSavingHours] = useState(false)

  const [timeoff, setTimeoff] = useState([])
  const [off, setOff] = useState({ from: '', to: '', reason: '' })
  const [clashes, setClashes] = useState([])
  const [offBusy, setOffBusy] = useState(false)
  const [showPast, setShowPast] = useState(false)

  // Split leave into current/upcoming vs past so the list stays short over time.
  const todayKey = format(new Date(), 'yyyy-MM-dd')
  const upcoming = useMemo(() => timeoff.filter((t) => t.end_date >= todayKey), [timeoff, todayKey])
  const past = useMemo(() => timeoff.filter((t) => t.end_date < todayKey).reverse(), [timeoff, todayKey])

  const loadTimeoff = () =>
    api.get(`/timeoff?instructor=${id}`).then((d) => setTimeoff(d.timeoff || [])).catch(() => setTimeoff([]))
  useEffect(() => {
    loadTimeoff()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const editOff = (patch) => {
    setClashes([]) // a changed range invalidates the previous clash check
    setOff((o) => ({ ...o, ...patch }))
  }

  const dayOn = (n) => String(hours.work_days || '').split(',').filter(Boolean).map(Number).includes(n)
  const toggleDay = (n) => {
    const s = new Set(String(hours.work_days || '').split(',').filter(Boolean).map(Number))
    s.has(n) ? s.delete(n) : s.add(n)
    setHours((h) => ({ ...h, work_days: [...s].sort((a, b) => a - b).join(',') }))
  }

  const saveHours = async () => {
    setSavingHours(true)
    try {
      await api.put(`/instructors/${id}`, hours)
      toast.success('Working hours saved')
      onSaved?.()
    } catch (e) {
      toast.error(e.message)
    } finally {
      setSavingHours(false)
    }
  }

  const submitOff = async (force = false) => {
    if (!off.from) return toast.error('Pick a start date')
    setOffBusy(true)
    try {
      const res = await api.post('/timeoff', {
        instructor_id: id,
        start_date: off.from,
        end_date: off.to || off.from,
        reason: off.reason.trim() || null,
        force
      })
      setOff({ from: '', to: '', reason: '' })
      setClashes([])
      loadTimeoff()
      onSaved?.() // refresh the calendar/history (classes may have been cancelled)
      if (res.cancelled) toast.success(`Leave added · ${res.cancelled} class${res.cancelled > 1 ? 'es' : ''} cancelled`)
      else toast.success('Time off added')
    } catch (e) {
      if (e.status === 409 && e.data?.conflicts) setClashes(e.data.conflicts)
      else toast.error(e.message)
    } finally {
      setOffBusy(false)
    }
  }
  const removeOff = async (t) => {
    await api.del(`/timeoff/${t.id}`)
    loadTimeoff()
  }
  const offLabel = (t) =>
    t.start_date === t.end_date ? fmtDate(t.start_date) : `${fmtDate(t.start_date)} – ${fmtDate(t.end_date)}`

  return (
    <div className="space-y-5">
      {/* Working hours */}
      <div className="card p-4">
        <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
          <Clock className="h-3.5 w-3.5" /> Working hours
        </p>
        <Field label="Working days">
          <div className="flex flex-wrap gap-2">
            {DAYS.map(({ n, l }) => (
              <button
                key={n}
                type="button"
                onClick={() => toggleDay(n)}
                className={`rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                  dayOn(n) ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
                }`}
              >
                {l}
              </button>
            ))}
          </div>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <TextInput label="Starts" type="time" value={hours.work_start} onChange={(e) => setHours((h) => ({ ...h, work_start: e.target.value }))} />
          <TextInput label="Ends" type="time" value={hours.work_end} onChange={(e) => setHours((h) => ({ ...h, work_end: e.target.value }))} />
        </div>
        <button onClick={saveHours} disabled={savingHours} className="btn-primary mt-1 w-full">
          {savingHours ? <Spinner className="h-5 w-5" /> : 'Save working hours'}
        </button>
      </div>

      {/* Time off */}
      <div className="card p-4">
        <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
          <CalendarOff className="h-3.5 w-3.5" /> Time off
        </p>

        {/* Current & upcoming leave */}
        {upcoming.length > 0 && (
          <div className="mb-3 space-y-2">
            {upcoming.map((t) => (
              <div key={t.id} className="flex items-center gap-3 rounded-xl bg-amber-50 p-2.5">
                <CalendarOff className="h-4 w-4 shrink-0 text-amber-500" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-amber-800">{offLabel(t)}</p>
                  {t.reason && <p className="truncate text-xs text-amber-600">{t.reason}</p>}
                </div>
                <button type="button" onClick={() => removeOff(t)} className="rounded-lg p-1.5 text-amber-500 hover:bg-amber-100">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Past leave — hidden by default */}
        {past.length > 0 && (
          <div className="mb-3">
            <button
              type="button"
              onClick={() => setShowPast((v) => !v)}
              className="flex w-full items-center justify-between rounded-lg px-1 py-1.5 text-xs font-semibold text-slate-400 hover:text-slate-600"
            >
              <span>Past time off ({past.length})</span>
              <ChevronDown className={`h-4 w-4 transition ${showPast ? 'rotate-180' : ''}`} />
            </button>
            {showPast && (
              <div className="mt-1 space-y-2">
                {past.map((t) => (
                  <div key={t.id} className="flex items-center gap-3 rounded-xl bg-slate-50 p-2.5">
                    <CalendarOff className="h-4 w-4 shrink-0 text-slate-400" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-600">{offLabel(t)}</p>
                      {t.reason && <p className="truncate text-xs text-slate-400">{t.reason}</p>}
                    </div>
                    <button type="button" onClick={() => removeOff(t)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="rounded-xl border border-slate-200 p-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="From"><DatePicker value={off.from} onChange={(e) => editOff({ from: e.target.value })} /></Field>
            <Field label="To" hint="Same as From for one day"><DatePicker min={off.from || undefined} value={off.to} onChange={(e) => editOff({ to: e.target.value })} /></Field>
          </div>
          <TextInput label="Reason" value={off.reason} onChange={(e) => editOff({ reason: e.target.value })} placeholder="Optional · e.g. Vacation" />

          {/* Booked-class clash — confirm before cancelling them */}
          {clashes.length > 0 && (
            <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
              <div className="flex items-center gap-2 text-amber-700">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <p className="text-sm font-semibold">
                  {clashes.length} class{clashes.length > 1 ? 'es' : ''} booked during this leave
                </p>
              </div>
              <ul className="mt-2 space-y-1">
                {clashes.map((c) => (
                  <li key={c.id} className="text-xs text-amber-700">
                    <span className="font-semibold">{fmtDateTime(c.scheduled_at)}</span> — {c.student_name}
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-amber-600">Adding this leave will cancel these classes.</p>
            </div>
          )}

          {clashes.length > 0 ? (
            <div className="flex gap-2">
              <button type="button" onClick={() => setClashes([])} className="btn-ghost flex-1 text-sm">Back</button>
              <button type="button" onClick={() => submitOff(true)} disabled={offBusy} className="btn-danger flex-1 text-sm">
                {offBusy ? <Spinner className="h-4 w-4" /> : `Cancel ${clashes.length} & add leave`}
              </button>
            </div>
          ) : (
            <button type="button" onClick={() => submitOff(false)} disabled={!off.from || offBusy} className="btn-primary w-full text-sm disabled:opacity-50">
              {offBusy ? <Spinner className="h-4 w-4" /> : <><Plus className="h-4 w-4" /> Add time off</>}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
