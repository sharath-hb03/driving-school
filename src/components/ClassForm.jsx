import { useCallback, useEffect, useMemo, useState } from 'react'
import { format, parseISO, eachDayOfInterval } from 'date-fns'
import { AlertTriangle, CalendarClock } from 'lucide-react'
import toast from 'react-hot-toast'
import { api } from '../lib/api'
import { toInputDateTime, fmtDateTime } from '../lib/format'
import Modal from './Modal'
import { Spinner } from './ui'
import { Select, TextInput, TextArea, Field } from './Field'
import DateTimePicker from './DateTimePicker'

const REPEAT_OPTIONS = [
  { value: 'none', label: 'Does not repeat' },
  { value: 'daily', label: 'Every day' },
  { value: 'mon-sat', label: 'Mon–Sat (skip Sun)' },
  { value: 'weekly', label: 'Weekly (same day)' }
]

// Human-readable reason for a booking conflict (double-book / holiday / leave).
function conflictReason(c) {
  if (c.type === 'holiday') return `Holiday — ${c.label}`
  if (c.type === 'leave') return `Instructor on leave${c.label && c.label !== 'On leave' ? ` · ${c.label}` : ''}`
  const what = c.type === 'instructor' ? 'Instructor' : 'Vehicle'
  return `${what} already booked with ${c.with?.student_name || 'someone'}`
}

// Expand a start datetime into a list of class slots (Date objects),
// skipping any day the `blocked` predicate rejects (holidays / instructor off).
function buildSlots(localValue, repeat, count, blocked) {
  if (!localValue) return []
  const base = new Date(localValue)
  if (Number.isNaN(base.getTime())) return []
  if (repeat === 'none') return [base]
  const n = Math.max(1, Math.min(60, Number(count) || 1))
  const out = []
  const cur = new Date(base)
  let guard = 0
  while (out.length < n && guard < 400) {
    guard++
    const isSunday = cur.getDay() === 0
    const skip = (repeat === 'mon-sat' && isSunday) || (blocked && blocked(cur))
    if (!skip) out.push(new Date(cur))
    cur.setDate(cur.getDate() + (repeat === 'weekly' ? 7 : 1))
  }
  return out
}

export default function ClassForm({ open, onClose, onSaved, student, klass, initialDate, instructorId }) {
  const editing = Boolean(klass)
  const [students, setStudents] = useState([])
  const [instructors, setInstructors] = useState([])
  const [vehicles, setVehicles] = useState([])
  const [busy, setBusy] = useState(false)
  const [studentQuery, setStudentQuery] = useState('')

  // Multi-class booking + clash detection
  const [repeat, setRepeat] = useState('none')
  const [count, setCount] = useState(5)
  const [conflicts, setConflicts] = useState([])
  const [checking, setChecking] = useState(false)

  // Holidays + the selected instructor's availability (working days / day-offs)
  const [holidays, setHolidays] = useState([])
  const [timeoff, setTimeoff] = useState([])

  const [form, setForm] = useState({
    student_id: '',
    instructor_id: '',
    vehicle_id: '',
    scheduled_at: '',
    duration_min: 60,
    notes: ''
  })

  useEffect(() => {
    if (!open) return
    setStudentQuery('')
    setConflicts([])
    setRepeat('none')
    setCount(5)
    Promise.all([
      student ? Promise.resolve({ students: [student] }) : api.get('/students'),
      api.get('/instructors'),
      api.get('/vehicles'),
      api.get('/holidays').catch(() => ({ holidays: [] }))
    ]).then(([s, i, v, h]) => {
      setStudents(s.students || [])
      setInstructors((i.instructors || []).filter((x) => x.active))
      setVehicles((v.vehicles || []).filter((x) => x.status === 'available'))
      setHolidays(h.holidays || [])
    })

    if (editing) {
      setForm({
        student_id: klass.student_id,
        instructor_id: klass.instructor_id || '',
        vehicle_id: klass.vehicle_id || '',
        scheduled_at: toInputDateTime(new Date(klass.scheduled_at.replace(' ', 'T'))),
        duration_min: klass.duration_min || 60,
        notes: klass.notes || ''
      })
    } else {
      const base = initialDate ? new Date(`${initialDate}T10:00`) : new Date()
      if (!initialDate) base.setMinutes(0)
      setForm({
        student_id: student?.id || '',
        instructor_id: instructorId || '',
        vehicle_id: '',
        scheduled_at: toInputDateTime(base),
        duration_min: 60,
        notes: ''
      })
    }
  }, [open, student, klass, editing, initialDate, instructorId])

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  // Pull the chosen instructor's day-offs so we can grey them out.
  useEffect(() => {
    if (!open || !form.instructor_id) {
      setTimeoff([])
      return
    }
    let active = true
    api.get(`/timeoff?instructor=${form.instructor_id}`).then((d) => active && setTimeoff(d.timeoff || [])).catch(() => {})
    return () => {
      active = false
    }
  }, [open, form.instructor_id])

  const selectedInstructor = instructors.find((i) => i.id === form.instructor_id)
  const availability = useMemo(() => {
    if (!selectedInstructor) return null
    const workDays = String(selectedInstructor.work_days || '1,2,3,4,5,6')
      .split(',')
      .map((n) => parseInt(n, 10))
      .filter((n) => !Number.isNaN(n))
    // Expand each leave range into the individual blocked dates.
    const daysOff = []
    for (const t of timeoff) {
      try {
        const start = parseISO(t.start_date)
        const end = parseISO(t.end_date || t.start_date)
        if (end < start) continue
        for (const d of eachDayOfInterval({ start, end })) daysOff.push(format(d, 'yyyy-MM-dd'))
      } catch {
        /* skip malformed */
      }
    }
    return {
      workDays,
      workStart: selectedInstructor.work_start || '06:00',
      workEnd: selectedInstructor.work_end || '20:00',
      daysOff
    }
  }, [selectedInstructor, timeoff])

  const holidaySet = useMemo(() => new Set(holidays.map((h) => h.date)), [holidays])
  const isBlockedDay = useCallback(
    (d) => {
      const k = format(d, 'yyyy-MM-dd')
      if (holidaySet.has(k)) return true
      if (availability) {
        if (availability.daysOff.includes(k)) return true
        if (availability.workDays.length && !availability.workDays.includes(d.getDay())) return true
      }
      return false
    },
    [holidaySet, availability]
  )

  // The concrete slots this form would book (single class when editing).
  const slots = useMemo(
    () => buildSlots(form.scheduled_at, editing ? 'none' : repeat, count, isBlockedDay),
    [form.scheduled_at, repeat, count, editing, isBlockedDay]
  )
  const slotsISO = useMemo(() => slots.map((d) => d.toISOString()), [slots])
  const clashedSlots = useMemo(() => new Set(conflicts.map((c) => c.scheduled_at)), [conflicts])
  const freeCount = useMemo(() => slotsISO.filter((s) => !clashedSlots.has(s)).length, [slotsISO, clashedSlots])

  // Live clash check — only meaningful once an instructor/vehicle is chosen.
  useEffect(() => {
    if (!open) return
    if (!slotsISO.length || (!form.instructor_id && !form.vehicle_id)) {
      setConflicts([])
      return
    }
    const handle = setTimeout(async () => {
      setChecking(true)
      try {
        const res = await api.post('/classes', {
          dryRun: true,
          instructor_id: form.instructor_id || null,
          vehicle_id: form.vehicle_id || null,
          duration_min: Number(form.duration_min),
          slots: slotsISO,
          exclude_id: editing ? klass.id : null
        })
        setConflicts(res.conflicts || [])
      } catch {
        setConflicts([])
      } finally {
        setChecking(false)
      }
    }, 350)
    return () => clearTimeout(handle)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, slotsISO, form.instructor_id, form.vehicle_id, form.duration_min])

  const selectedStudent = students.find((s) => s.id === form.student_id)
  const term = studentQuery.trim().toLowerCase()
  const studentMatches = (
    term
      ? students.filter(
          (s) =>
            s.name?.toLowerCase().includes(term) ||
            s.phone?.toLowerCase().includes(term) ||
            s.email?.toLowerCase().includes(term)
        )
      : students
  ).slice(0, 8)

  const contactLine = (s) => [s.phone, s.email].filter(Boolean).join(' · ')

  const submit = async (e) => {
    e.preventDefault()
    if (!form.student_id) return toast.error('Choose a student')
    if (!form.scheduled_at) return toast.error('Pick a date & time')
    if (!editing && new Date(form.scheduled_at) < new Date()) return toast.error('Pick a time in the future')
    setBusy(true)
    try {
      if (editing) {
        const payload = {
          instructor_id: form.instructor_id || null,
          vehicle_id: form.vehicle_id || null,
          scheduled_at: new Date(form.scheduled_at).toISOString(),
          duration_min: Number(form.duration_min),
          notes: form.notes
        }
        const res = await api.put(`/classes/${klass.id}`, payload)
        toast.success('Class updated')
        onSaved?.(res.class)
        onClose()
      } else {
        const res = await api.post('/classes', {
          student_id: form.student_id,
          instructor_id: form.instructor_id || null,
          vehicle_id: form.vehicle_id || null,
          duration_min: Number(form.duration_min),
          notes: form.notes,
          slots: slotsISO
        })
        const made = res.classes?.length || 0
        const skipped = res.skipped?.length || 0
        if (made === 0) {
          setConflicts(res.skipped || [])
          toast.error('All selected times clash — nothing booked')
          return // keep the dialog open so the user can adjust
        }
        toast.success(`${made} class${made > 1 ? 'es' : ''} booked${skipped ? ` · ${skipped} skipped (clash)` : ''}`)
        onSaved?.(res.classes)
        onClose()
      }
    } catch (err) {
      toast.error(err.status === 409 ? 'That time clashes with another class' : err.message)
    } finally {
      setBusy(false)
    }
  }

  const blocked = editing ? conflicts.length > 0 : freeCount === 0
  const submitLabel = editing
    ? 'Save'
    : slotsISO.length <= 1
    ? 'Book class'
    : freeCount === 0
    ? 'Resolve clashes'
    : `Book ${freeCount} class${freeCount > 1 ? 'es' : ''}`

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? 'Edit class' : 'Book a class'}
      footer={
        <div className="flex gap-3">
          <button className="btn-ghost flex-1" onClick={onClose} type="button">
            Cancel
          </button>
          <button className="btn-primary flex-1" onClick={submit} disabled={busy || blocked}>
            {busy ? <Spinner className="h-5 w-5" /> : submitLabel}
          </button>
        </div>
      }
    >
      <form onSubmit={submit}>
        {student ? (
          <div className="mb-4 rounded-xl bg-slate-50 p-3">
            <p className="text-sm font-semibold text-slate-700">{student.name}</p>
          </div>
        ) : (
          <Field label="Student" required>
            {selectedStudent ? (
              <div className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-700">{selectedStudent.name}</p>
                  <p className="truncate text-xs text-slate-400">{contactLine(selectedStudent) || 'No contact info'}</p>
                </div>
                <button
                  type="button"
                  className="shrink-0 text-xs font-semibold text-brand-600"
                  onClick={() => {
                    setForm((f) => ({ ...f, student_id: '' }))
                    setStudentQuery('')
                  }}
                >
                  Change
                </button>
              </div>
            ) : (
              <>
                <input
                  className="input"
                  value={studentQuery}
                  onChange={(e) => setStudentQuery(e.target.value)}
                  placeholder="Search by name, phone, or email…"
                />
                {term && (
                  studentMatches.length > 0 ? (
                    <div className="mt-2 max-h-52 overflow-y-auto rounded-xl border border-slate-100">
                      {studentMatches.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => {
                            setForm((f) => ({ ...f, student_id: s.id }))
                            setStudentQuery('')
                          }}
                          className="block w-full border-b border-slate-50 px-3 py-2.5 text-left last:border-0 hover:bg-slate-50"
                        >
                          <p className="truncate text-sm font-medium text-slate-700">{s.name}</p>
                          {contactLine(s) && <p className="truncate text-xs text-slate-400">{contactLine(s)}</p>}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-2 text-xs text-slate-400">No students match “{studentQuery}”.</p>
                  )
                )}
              </>
            )}
          </Field>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Select
            label="Instructor"
            value={form.instructor_id}
            onChange={set('instructor_id')}
            placeholder="Unassigned"
            options={instructors.map((i) => ({ value: i.id, label: i.name }))}
          />
          <Select
            label="Vehicle"
            value={form.vehicle_id}
            onChange={set('vehicle_id')}
            placeholder="None"
            options={vehicles.map((v) => ({ value: v.id, label: `${v.vehicle_number}${v.model ? ' · ' + v.model : ''}` }))}
          />
        </div>
        <Field
          label={editing ? 'Date & time' : 'First class'}
          required
          hint={selectedInstructor ? `${selectedInstructor.name}'s working days & hours are shown; off-days are greyed out.` : undefined}
        >
          <DateTimePicker
            value={form.scheduled_at}
            onChange={(v) => setForm((f) => ({ ...f, scheduled_at: v }))}
            disablePast={!editing}
            holidays={holidays}
            availability={availability}
          />
        </Field>
        {/* Multi-class booking — book a batch of lessons in one go. */}
        {!editing && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Select label="Repeat" value={repeat} onChange={(e) => setRepeat(e.target.value)} options={REPEAT_OPTIONS} />
              {repeat !== 'none' && (
                <TextInput
                  label="No. of classes"
                  type="number"
                  min={2}
                  max={30}
                  value={count}
                  onChange={(e) => setCount(e.target.value)}
                />
              )}
            </div>
            {repeat !== 'none' && slots.length > 0 && (
              <div className="-mt-1 mb-4 flex items-start gap-2 rounded-xl bg-slate-50 p-3 text-xs text-slate-500">
                <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" />
                <p>
                  <span className="font-semibold text-slate-700">{slots.length} classes</span> ·{' '}
                  {slots.map((d) => format(d, 'EEE d MMM')).join(', ')}
                  {(holidays.length > 0 || availability) && (
                    <span className="mt-0.5 block text-slate-400">Holidays & off-days are skipped automatically.</span>
                  )}
                </p>
              </div>
            )}
          </>
        )}

        {/* Clash warning — names the student already holding the slot. */}
        {conflicts.length > 0 && (
          <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3">
            <div className="flex items-center gap-2 text-amber-700">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <p className="text-sm font-semibold">
                {conflicts.length} schedule clash{conflicts.length > 1 ? 'es' : ''}
              </p>
            </div>
            <ul className="mt-2 space-y-1">
              {conflicts.map((c, i) => (
                <li key={i} className="text-xs text-amber-700">
                  <span className="font-semibold">{fmtDateTime(c.scheduled_at)}</span> — {conflictReason(c)}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-amber-600">
              {editing
                ? 'Pick a different time to resolve this.'
                : freeCount > 0
                ? `Clashing slots are skipped — ${freeCount} class${freeCount > 1 ? 'es' : ''} will be booked.`
                : 'Every selected time clashes. Pick another time or instructor.'}
            </p>
          </div>
        )}
        {checking && <p className="mb-4 -mt-1 text-xs text-slate-400">Checking availability…</p>}

        <TextArea label="Notes" value={form.notes} onChange={set('notes')} placeholder="Optional" />
      </form>
    </Modal>
  )
}
