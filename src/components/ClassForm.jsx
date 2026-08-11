import { useCallback, useEffect, useMemo, useState } from 'react'
import { format, parseISO, eachDayOfInterval } from 'date-fns'
import { AlertTriangle, Check, Plus, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { api } from '../lib/api'
import { toInputDateTime, fmtDateTime } from '../lib/format'
import Modal from './Modal'
import { Spinner } from './ui'
import { Select, TextArea, Field } from './Field'
import DateTimePicker from './DateTimePicker'

const MAX_SLOTS = 30

// Human-readable reason for a booking conflict (double-book / holiday / leave).
function conflictReason(c) {
  if (c.type === 'holiday') return `Holiday — ${c.label}`
  if (c.type === 'leave') return `Instructor on leave${c.label && c.label !== 'On leave' ? ` · ${c.label}` : ''}`
  const what = c.type === 'instructor' ? 'Instructor' : 'Vehicle'
  return `${what} already booked with ${c.with?.student_name || 'someone'}`
}

// Small status line shown under each slot row.
function SlotStatus({ tone, label }) {
  const color =
    tone === 'good' ? 'text-emerald-600' : tone === 'bad' ? 'text-red-500' : tone === 'muted' ? 'text-slate-400' : 'text-amber-600'
  const Icon = tone === 'good' ? Check : tone === 'muted' ? null : AlertTriangle
  return (
    <p className={`mt-1 flex items-center gap-1 pl-1 text-xs font-medium ${color}`}>
      {Icon && <Icon className="h-3.5 w-3.5 shrink-0" />}
      {label}
    </p>
  )
}

export default function ClassForm({ open, onClose, onSaved, student, klass, initialDate, instructorId }) {
  const editing = Boolean(klass)
  const [students, setStudents] = useState([])
  const [instructors, setInstructors] = useState([])
  const [vehicles, setVehicles] = useState([])
  const [busy, setBusy] = useState(false)
  const [studentQuery, setStudentQuery] = useState('')

  // Multi-class booking: one row per class + clash detection
  const [slotValues, setSlotValues] = useState([])
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
      setSlotValues([])
      setForm({
        student_id: klass.student_id,
        instructor_id: klass.instructor_id || '',
        vehicle_id: klass.vehicle_id || '',
        scheduled_at: toInputDateTime(new Date(klass.scheduled_at.replace(' ', 'T'))),
        duration_min: klass.duration_min || 60,
        notes: klass.notes || ''
      })
    } else {
      const base = initialDate
        ? (initialDate.includes('T') ? new Date(initialDate) : new Date(`${initialDate}T10:00`))
        : new Date()
      if (!initialDate) base.setMinutes(0)
      setSlotValues([toInputDateTime(base)])
      setForm({
        student_id: student?.id || '',
        instructor_id: instructorId || '',
        vehicle_id: '',
        scheduled_at: '',
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

  const holidayNames = useMemo(() => {
    const m = {}
    for (const h of holidays) m[h.date] = h.name
    return m
  }, [holidays])
  const isBlockedDay = useCallback(
    (d) => {
      const k = format(d, 'yyyy-MM-dd')
      if (holidayNames[k]) return true
      if (availability) {
        if (availability.daysOff.includes(k)) return true
        if (availability.workDays.length && !availability.workDays.includes(d.getDay())) return true
      }
      return false
    },
    [holidayNames, availability]
  )

  const parsedRows = useMemo(
    () =>
      slotValues.map((v) => {
        const d = v ? new Date(v) : null
        return d && !Number.isNaN(d.getTime()) ? d : null
      }),
    [slotValues]
  )

  // Per-row verdict before asking the server: past / holiday / off-day /
  // overlapping another row in this form — or 'ok' (a real booking candidate).
  const rowBase = useMemo(() => {
    const durMs = (Number(form.duration_min) || 60) * 60000
    const now = new Date()
    return parsedRows.map((d, i) => {
      if (!d) return { kind: 'empty' }
      if (d < now) return { kind: 'past', label: 'This time is in the past' }
      const k = format(d, 'yyyy-MM-dd')
      if (holidayNames[k]) return { kind: 'blocked', label: `Holiday — ${holidayNames[k]}` }
      if (availability) {
        if (availability.daysOff.includes(k)) return { kind: 'blocked', label: 'Instructor on leave this day' }
        if (availability.workDays.length && !availability.workDays.includes(d.getDay()))
          return { kind: 'blocked', label: 'Instructor not working this day' }
      }
      for (let j = 0; j < i; j++) {
        if (parsedRows[j] && Math.abs(d - parsedRows[j]) < durMs)
          return { kind: 'overlap', label: 'Overlaps another class above' }
      }
      return { kind: 'ok', iso: d.toISOString() }
    })
  }, [parsedRows, form.duration_min, holidayNames, availability])

  // The slots this form would actually try to book.
  const checkISO = useMemo(() => rowBase.filter((r) => r.kind === 'ok').map((r) => r.iso), [rowBase])
  const slotsISO = useMemo(() => {
    if (!editing) return checkISO
    if (!form.scheduled_at) return []
    const d = new Date(form.scheduled_at)
    return Number.isNaN(d.getTime()) ? [] : [d.toISOString()]
  }, [editing, checkISO, form.scheduled_at])

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

  const updateSlot = (idx, v) => setSlotValues((vals) => vals.map((x, i) => (i === idx ? v : x)))
  const removeSlot = (idx) => setSlotValues((vals) => vals.filter((_, i) => i !== idx))

  // Add a new row = last row shifted forward, same time of day.
  // Skips holidays / off-days / already-added times.
  const addSlot = (days) => {
    const lastVal = [...parsedRows].reverse().find(Boolean)
    const base = lastVal ? new Date(lastVal) : new Date(new Date().setMinutes(0, 0, 0))
    const d = new Date(base)
    const taken = new Set(slotValues)
    const now = new Date()
    let guard = 0
    do {
      d.setDate(d.getDate() + days)
      guard++
    } while (guard < 60 && (isBlockedDay(d) || d <= now || taken.has(toInputDateTime(d))))
    setSlotValues((vals) => [...vals, toInputDateTime(d)])
  }
  const canAdd = slotValues.length < MAX_SLOTS && parsedRows.some(Boolean)

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
    setBusy(true)
    try {
      if (editing) {
        if (!form.scheduled_at) return toast.error('Pick a date & time')
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
        if (!checkISO.length) return toast.error('Pick a valid date & time')
        const res = await api.post('/classes', {
          student_id: form.student_id,
          instructor_id: form.instructor_id || null,
          vehicle_id: form.vehicle_id || null,
          duration_min: Number(form.duration_min),
          notes: form.notes,
          slots: checkISO
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
    : freeCount === 0
    ? 'Resolve clashes'
    : freeCount === 1
    ? 'Book class'
    : `Book ${freeCount} classes`

  // Status chip for a slot row: pre-checks first, then the server's verdict.
  const rowStatus = (idx) => {
    const r = rowBase[idx]
    if (!r || r.kind === 'empty') return null
    if (r.kind === 'past') return { tone: 'bad', label: r.label }
    if (r.kind === 'blocked') return { tone: 'bad', label: r.label }
    if (r.kind === 'overlap') return { tone: 'warn', label: r.label }
    const clash = conflicts.find((c) => c.scheduled_at === r.iso)
    if (clash) return { tone: 'warn', label: conflictReason(clash) }
    if (!form.instructor_id && !form.vehicle_id) return null
    if (checking) return { tone: 'muted', label: 'Checking availability…' }
    return { tone: 'good', label: 'Available' }
  }

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

        {editing ? (
          <Field
            label="Date & time"
            required
            hint={selectedInstructor ? `${selectedInstructor.name}'s working days & hours are shown; off-days are greyed out.` : undefined}
          >
            <DateTimePicker
              value={form.scheduled_at}
              onChange={(v) => setForm((f) => ({ ...f, scheduled_at: v }))}
              disablePast={false}
              holidays={holidays}
              availability={availability}
            />
          </Field>
        ) : (
          /* Multi-class booking — one row per class, checked live. */
          <Field
            label={slotValues.length > 1 ? 'Classes' : 'Date & time'}
            required
            hint={selectedInstructor ? `${selectedInstructor.name}'s off-days are greyed out in the calendar.` : undefined}
          >
            <div className="space-y-2.5">
              {slotValues.map((v, idx) => {
                const status = rowStatus(idx)
                return (
                  <div key={idx}>
                    <div className="flex items-center gap-2">
                      <div className="min-w-0 flex-1">
                        <DateTimePicker
                          value={v}
                          onChange={(nv) => updateSlot(idx, nv)}
                          disablePast
                          holidays={holidays}
                          availability={availability}
                        />
                      </div>
                      {slotValues.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeSlot(idx)}
                          title="Remove this class"
                          className="shrink-0 rounded-lg p-1.5 text-slate-300 transition hover:bg-red-50 hover:text-red-500"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                    {status && <SlotStatus tone={status.tone} label={status.label} />}
                  </div>
                )
              })}

              <div className="flex gap-2 pt-0.5">
                <button
                  type="button"
                  onClick={() => addSlot(1)}
                  disabled={!canAdd}
                  className="inline-flex flex-1 items-center justify-center gap-1 rounded-xl border border-dashed border-slate-300 py-2 text-xs font-semibold text-slate-500 transition hover:border-brand-400 hover:bg-brand-50 hover:text-brand-600 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Plus className="h-3.5 w-3.5" /> Next day
                </button>
                <button
                  type="button"
                  onClick={() => addSlot(7)}
                  disabled={!canAdd}
                  className="inline-flex flex-1 items-center justify-center gap-1 rounded-xl border border-dashed border-slate-300 py-2 text-xs font-semibold text-slate-500 transition hover:border-brand-400 hover:bg-brand-50 hover:text-brand-600 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Plus className="h-3.5 w-3.5" /> Next week
                </button>
              </div>
              <p className="text-[11px] text-slate-400">
                Adds another class at the same time · holidays & off-days are skipped.
                {!form.instructor_id && !form.vehicle_id ? ' Pick an instructor or vehicle to check for clashes.' : ''}
              </p>
            </div>
          </Field>
        )}

        {/* Clash warning while editing — names the student already holding the slot. */}
        {editing && conflicts.length > 0 && (
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
            <p className="mt-2 text-xs text-amber-600">Pick a different time to resolve this.</p>
          </div>
        )}
        {editing && checking && <p className="mb-4 -mt-1 text-xs text-slate-400">Checking availability…</p>}

        <TextArea label="Notes" value={form.notes} onChange={set('notes')} placeholder="Optional" />
      </form>
    </Modal>
  )
}
