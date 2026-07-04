import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { api } from '../lib/api'
import { inr, toInputDateTime } from '../lib/format'
import Modal from './Modal'
import { TextInput, Select, TextArea, Field } from './Field'
import { Spinner } from './ui'

const METHOD_OPTS = [
  { value: 'cash', label: 'Cash' },
  { value: 'upi', label: 'UPI' },
  { value: 'card', label: 'Card' },
  { value: 'bank', label: 'Bank Transfer' },
]

export default function PaymentForm({ open, onClose, onSaved, student, balance }) {
  const lockedStudent = Boolean(student)
  const [students, setStudents] = useState([])
  const [studentQuery, setStudentQuery] = useState('')
  const [form, setForm] = useState({
    student_id: student?.id || '',
    amount: '',
    method: 'cash',
    paid_at: toInputDateTime(),
    note: '',
  })
  const [busy, setBusy] = useState(false)

  const set = (k) => (v) => setForm(f => ({ ...f, [k]: typeof v === 'string' ? v : v.target.value }))

  useEffect(() => {
    if (!open) return
    setForm({
      student_id: student?.id || '',
      amount: '',
      method: 'cash',
      paid_at: toInputDateTime(),
      note: '',
    })
    setStudentQuery('')
    if (!lockedStudent) api.get('/students').then((d) => setStudents(d.students || [])).catch(() => {})
  }, [open, student, lockedStudent])

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
    if (!form.amount || Number(form.amount) <= 0) return toast.error('Enter a valid amount')
    setBusy(true)
    try {
      await api.post('/payments', {
        student_id: form.student_id,
        amount: Number(form.amount),
        method: form.method,
        paid_at: new Date(form.paid_at).toISOString(),
        note: form.note || null,
      })
      toast.success('Payment recorded')
      onSaved?.()
      onClose()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={student ? `Record Payment - ${student.name}` : 'Record Payment'}
      size="sm"
      footer={
        <div className="flex gap-3">
          <button type="button" className="btn-ghost flex-1" onClick={onClose}>Cancel</button>
          <button form="pay-form" type="submit" className="btn-primary flex-1" disabled={busy}>
            {busy ? <Spinner className="h-4 w-4" /> : 'Record'}
          </button>
        </div>
      }
    >
      <form id="pay-form" onSubmit={submit} className="space-y-1">
        {lockedStudent ? (
          <div className="mb-4 rounded-xl bg-slate-50 p-3">
            <p className="text-sm font-semibold text-slate-700">{student.name}</p>
            {Number(balance) > 0 && <p className="text-xs text-amber-600">Balance due: {inr(balance)}</p>}
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
                    <div className="mt-2 max-h-52 overflow-y-auto rounded-xl border border-slate-100 bg-white">
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
        <TextInput label="Amount" value={form.amount} onChange={set('amount')} type="number" min="1" inputMode="numeric" required placeholder="e.g. 2000" />
        {lockedStudent && Number(balance) > 0 && (
          <button type="button" className="mb-4 -mt-2 text-xs font-semibold text-brand-600" onClick={() => set('amount')(String(balance))}>
            Pay full balance ({inr(balance)})
          </button>
        )}
        <Select label="Method" value={form.method} onChange={set('method')} options={METHOD_OPTS} />
        <div>
          <label className="label">Date</label>
          <input className="input" type="datetime-local" value={form.paid_at} onChange={set('paid_at')} />
        </div>
        <TextArea label="Note" value={form.note} onChange={set('note')} placeholder="Optional note" />
      </form>
    </Modal>
  )
}
