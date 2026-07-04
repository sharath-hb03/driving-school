import { useState, useEffect } from 'react'
import { differenceInCalendarDays, parseISO } from 'date-fns'
import {
  ShieldCheck, Car, CircleDot, CheckCircle2, XCircle, Clock,
  ChevronDown, Plus, Pencil
} from 'lucide-react'
import toast from 'react-hot-toast'
import { api } from '../lib/api'
import { fmtDate, fmtClock } from '../lib/format'
import { Badge, Spinner } from './ui'
import Modal from './Modal'
import { Select, TextInput } from './Field'
import { useApi } from '../lib/useApi'

/* ── status meta ───────────────────────────────────────────────────────── */
const STATUS_META = {
  passed:  { label: 'Passed',    color: 'green', Icon: CheckCircle2 },
  failed:  { label: 'Failed',    color: 'red',   Icon: XCircle      },
  pending: { label: 'Scheduled', color: 'blue',  Icon: Clock        },
}
const statusInfo  = (v) => STATUS_META[v] || { label: 'Not started', color: 'gray', Icon: CircleDot }
const STATUS_OPTS = [
  { value: '',        label: 'Not started' },
  { value: 'pending', label: 'Scheduled'   },
  { value: 'passed',  label: 'Passed'      },
  { value: 'failed',  label: 'Failed'      },
]

function expiryChip(dateStr) {
  if (!dateStr) return null
  const days = differenceInCalendarDays(parseISO(dateStr), new Date())
  if (days < 0)   return <Badge color="red">Expired</Badge>
  if (days <= 30) return <Badge color="amber">{days}d left</Badge>
  return <Badge color="green">Valid</Badge>
}

/* ── one detail row ────────────────────────────────────────────────────── */
function Row({ label, value, trailing }) {
  if (!value && !trailing) return null
  return (
    <div className="flex items-center justify-between py-1.5 text-sm">
      <span className="text-slate-400">{label}</span>
      <span className="flex items-center gap-2 font-medium text-slate-700">
        {value || '—'} {trailing}
      </span>
    </div>
  )
}

/* ── collapsible past attempts ─────────────────────────────────────────── */
function PastAttempts({ tests }) {
  const [open, setOpen] = useState(false)
  if (!tests.length) return null
  return (
    <div className="mt-1">
      <button onClick={() => setOpen(v => !v)}
        className="flex w-full items-center justify-between py-2 text-xs font-medium text-slate-400 hover:text-slate-600">
        <span>Previous attempts ({tests.length})</span>
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="space-y-1.5 pb-1">
          {tests.map((t, i) => {
            const info = statusInfo(t.status)
            return (
              <div key={t.id || i}
                className="flex items-center justify-between rounded-xl border border-slate-100 bg-white px-3 py-2">
                <div>
                  <p className="text-xs font-semibold text-slate-600">
                    {fmtDate(t.test_date)}{t.test_time ? ` · ${fmtClock(t.test_time)}` : ''}
                  </p>
                  {t.notes && <p className="mt-0.5 text-xs text-slate-400">{t.notes}</p>}
                </div>
                <Badge color={info.color}>{info.label}</Badge>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

/* ── Edit modal ────────────────────────────────────────────────────────── */
function EditModal({ open, onClose, student, prefix, onSaved }) {
  if (!prefix) return null
  const title = prefix === 'll' ? "Learner's Licence" : "Driving Licence"
  const [form, setForm] = useState({})
  const [busy, setBusy] = useState(false)
  const { data: insData } = useApi('/instructors?active=1')
  const instructorOpts = (insData?.instructors || []).map(i => ({ value: i.id, label: i.name }))

  useEffect(() => {
    if (!open || !student) return
    setForm({
      [`${prefix}_test_date`]:     student[`${prefix}_test_date`]     || '',
      [`${prefix}_test_time`]:     student[`${prefix}_test_time`]     || '',
      [`${prefix}_status`]:        student[`${prefix}_status`]        || '',
      [`${prefix}_number`]:        student[`${prefix}_number`]        || '',
      [`${prefix}_expiry`]:        student[`${prefix}_expiry`]        || '',
      [`${prefix}_instructor_id`]: student[`${prefix}_instructor_id`] || '',
    })
  }, [open, prefix, student])

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }))

  const save = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      const payload = {}
      for (const [k, v] of Object.entries(form)) payload[k] = v || null
      await api.put(`/students/${student.id}`, payload)
      toast.success(`${prefix.toUpperCase()} details saved`)
      onSaved?.(); onClose()
    } catch (err) { toast.error(err.message) }
    finally { setBusy(false) }
  }

  return (
    <Modal open={open} onClose={onClose} title={`Edit ${title}`}
      footer={
        <div className="flex gap-3">
          <button type="button" className="btn-ghost flex-1" onClick={onClose}>Cancel</button>
          <button form="edit-stage-form" type="submit" className="btn-primary flex-1" disabled={busy}>
            {busy ? <Spinner className="h-4 w-4" /> : 'Save'}
          </button>
        </div>
      }>
      <form id="edit-stage-form" onSubmit={save} className="space-y-3">
        <Select label="Status"
          value={form[`${prefix}_status`] || ''} onChange={set(`${prefix}_status`)}
          options={STATUS_OPTS} />
        <div className="grid grid-cols-2 gap-3">
          <TextInput label="Test date" type="date"
            value={form[`${prefix}_test_date`] || ''} onChange={set(`${prefix}_test_date`)} />
          <TextInput label="Test time" type="time" hint="Optional"
            value={form[`${prefix}_test_time`] || ''} onChange={set(`${prefix}_test_time`)} />
        </div>
        <Select label="Test instructor" placeholder="Unassigned"
          value={form[`${prefix}_instructor_id`] || ''} onChange={set(`${prefix}_instructor_id`)}
          options={instructorOpts} />
        <TextInput label={`${prefix.toUpperCase()} number`}
          value={form[`${prefix}_number`] || ''} onChange={set(`${prefix}_number`)}
          placeholder={prefix === 'll' ? 'e.g. KA0120260012345' : 'e.g. KA0120260067890'} />
        <TextInput label="Valid till" type="date"
          value={form[`${prefix}_expiry`] || ''} onChange={set(`${prefix}_expiry`)} />
      </form>
    </Modal>
  )
}

/* ── Add attempt modal ─────────────────────────────────────────────────── */
function AddAttemptModal({ open, onClose, studentId, type, onSaved }) {
  if (!type) return null
  const [form, setForm] = useState({ test_date: '', test_time: '', status: 'pending', notes: '' })
  const [busy, setBusy] = useState(false)
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }))

  const save = async (e) => {
    e.preventDefault()
    if (!form.test_date) return toast.error('Test date required')
    setBusy(true)
    try {
      await api.post(`/students/${studentId}/tests`, { ...form, type })
      toast.success('Test attempt added')
      setForm({ test_date: '', test_time: '', status: 'pending', notes: '' })
      onSaved?.(); onClose()
    } catch (err) { toast.error(err.message) }
    finally { setBusy(false) }
  }

  return (
    <Modal open={open} onClose={onClose}
      title={`Add ${type === 'll' ? 'LL' : 'DL'} Test Attempt`}
      footer={
        <div className="flex gap-3">
          <button type="button" className="btn-ghost flex-1" onClick={onClose}>Cancel</button>
          <button form="attempt-form" type="submit" className="btn-primary flex-1" disabled={busy}>
            {busy ? <Spinner className="h-4 w-4" /> : 'Add attempt'}
          </button>
        </div>
      }>
      <form id="attempt-form" onSubmit={save} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <TextInput label="Test date" type="date" required
            value={form.test_date} onChange={set('test_date')} />
          <TextInput label="Test time" type="time" hint="Optional"
            value={form.test_time} onChange={set('test_time')} />
        </div>
        <Select label="Result" value={form.status} onChange={set('status')}
          options={[
            { value: 'pending', label: 'Scheduled' },
            { value: 'passed',  label: 'Passed'    },
            { value: 'failed',  label: 'Failed'    },
          ]} />
        <TextInput label="Notes" value={form.notes} onChange={set('notes')}
          placeholder="e.g. Failed — parallel parking" />
      </form>
    </Modal>
  )
}

/* ── one stage card ────────────────────────────────────────────────────── */
function StageCard({ student, prefix, Icon, title, tests, onEdit, onAddAttempt }) {
  const status      = student[`${prefix}_status`]
  const date        = student[`${prefix}_test_date`]
  const time        = student[`${prefix}_test_time`]
  const num         = student[`${prefix}_number`]
  const expiry      = student[`${prefix}_expiry`]
  const instName    = student[`${prefix}_instructor_name`]
  const info        = statusInfo(status)
  const { Icon: S } = info
  const failed      = status === 'failed'

  const dotCls = status === 'passed'  ? 'bg-emerald-100 text-emerald-600'
               : status === 'failed'  ? 'bg-red-100 text-red-600'
               : status === 'pending' ? 'bg-brand-100 text-brand-600'
               : 'bg-slate-100 text-slate-400'

  const chipCls = info.color === 'green' ? 'chip bg-emerald-100 text-emerald-700'
                : info.color === 'red'   ? 'chip bg-red-100 text-red-700'
                : info.color === 'blue'  ? 'chip bg-brand-100 text-brand-700'
                : 'chip bg-slate-100 text-slate-500'

  const hasDetails = date || num || expiry || instName

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-100 bg-slate-50">
      {/* Card header */}
      <div className="flex items-center gap-3 px-4 py-3">
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${dotCls}`}>
          <Icon className="h-4 w-4" />
        </div>
        <p className="flex-1 text-sm font-bold text-slate-800">{title}</p>
        <span className={chipCls}>
          <S className="h-3 w-3" /> {info.label}
        </span>
      </div>

      {/* Details */}
      {hasDetails && (
        <div className="border-t border-slate-100 bg-white px-4 py-1">
          {date && (
            <Row label="Test date"
              value={fmtDate(date) + (time ? ` · ${fmtClock(time)}` : '')} />
          )}
          {instName && <Row label="Instructor" value={instName} />}
          {num      && <Row label={`${prefix.toUpperCase()} number`} value={num} />}
          {expiry   && (
            <Row label="Valid till"
              value={fmtDate(expiry)}
              trailing={expiryChip(expiry)} />
          )}
          <PastAttempts tests={tests} />
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-4 border-t border-slate-100 bg-white px-4 py-3">
        <button onClick={onEdit}
          className="flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800">
          <Pencil className="h-3.5 w-3.5" /> Edit
        </button>
        <span className="h-4 w-px bg-slate-200" />
        <button onClick={onAddAttempt}
          className="flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:text-brand-800">
          <Plus className="h-4 w-4" />
          {failed ? 'Add next attempt' : 'Add test'}
        </button>
      </div>
    </div>
  )
}

/* ── main component ────────────────────────────────────────────────────── */
export default function LicenseCard({ student, onSaved }) {
  const s = student

  const [editModal,    setEditModal]    = useState(null)  // 'll' | 'dl' | null
  const [attemptModal, setAttemptModal] = useState(null)  // 'll' | 'dl' | null

  const { data: testData, reload: reloadTests } = useApi(s?.id ? `/students/${s.id}/tests` : null)
  const allTests = testData?.tests || []
  const llTests  = allTests.filter(t => t.type === 'll').sort((a, b) => b.test_date.localeCompare(a.test_date))
  const dlTests  = allTests.filter(t => t.type === 'dl').sort((a, b) => b.test_date.localeCompare(a.test_date))

  const handleSaved = () => { reloadTests?.(); onSaved?.() }

  const hasAny = s.ll_test_date || s.ll_status || s.ll_number ||
                 s.dl_test_date || s.dl_status || s.dl_number

  return (
    <div className="card mt-4 p-5">
      <h2 className="mb-4 font-bold text-slate-800">Licence &amp; Tests</h2>

      {!hasAny ? (
        <button onClick={() => setEditModal('ll')}
          className="w-full rounded-2xl border border-dashed border-slate-200 py-8 text-center text-sm text-slate-400 hover:border-brand-300 hover:text-brand-500">
          + Add learner's licence &amp; test details
        </button>
      ) : (
        <div className="space-y-3">
          <StageCard student={s} prefix="ll" Icon={ShieldCheck} title="Learner's Licence"
            tests={llTests}
            onEdit={() => setEditModal('ll')}
            onAddAttempt={() => setAttemptModal('ll')} />
          <StageCard student={s} prefix="dl" Icon={Car} title="Driving Licence"
            tests={dlTests}
            onEdit={() => setEditModal('dl')}
            onAddAttempt={() => setAttemptModal('dl')} />
        </div>
      )}

      <EditModal
        open={!!editModal} onClose={() => setEditModal(null)}
        student={s} prefix={editModal} onSaved={handleSaved} />

      <AddAttemptModal
        open={!!attemptModal} onClose={() => setAttemptModal(null)}
        studentId={s.id} type={attemptModal} onSaved={handleSaved} />
    </div>
  )
}
