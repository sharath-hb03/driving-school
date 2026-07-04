import { useEffect, useState } from 'react'
import { GraduationCap, Phone, Pencil, Trash2, Users, CalendarDays } from 'lucide-react'
import toast from 'react-hot-toast'
import { api } from '../lib/api'
import { PageHeader, Fab } from '../components/PageHeader'
import { Avatar, Badge, EmptyState, SkeletonList, Spinner } from '../components/ui'
import { useConfirm } from '../components/ConfirmDialog'
import Modal from '../components/Modal'
import { TextInput, TextArea, PillGroup } from '../components/Field'
import InstructorScheduleModal from '../components/InstructorScheduleModal'

const LICENSE = [
  { value: '2W', label: '🏍️ 2W' },
  { value: '4W', label: '🚗 4W' },
  { value: 'both', label: 'Both' }
]
const blank = {
  name: '', phone: '', license_type: 'both', notes: '', active: 1, email: '', password: '',
  work_days: '1,2,3,4,5,6', work_start: '06:00', work_end: '20:00'
}

export default function Instructors() {
  const confirm = useConfirm()
  const [instructors, setInstructors] = useState([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(blank)
  const [busy, setBusy] = useState(false)
  const [scheduleFor, setScheduleFor] = useState(null)

  const load = async () => {
    setLoading(true)
    try {
      const d = await api.get('/instructors')
      setInstructors(d.instructors || [])
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => {
    load()
  }, [])

  const openNew = () => {
    setForm(blank)
    setOpen(true)
  }
  const openEdit = (i) => {
    setForm({ ...blank, ...i, password: '' })
    setOpen(true)
  }

  const save = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) return toast.error('Name is required')
    setBusy(true)
    try {
      const payload = { ...form, email: form.email.trim() }
      form.id ? await api.put(`/instructors/${form.id}`, payload) : await api.post('/instructors', payload)
      toast.success('Saved')
      setOpen(false)
      load()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  const remove = async (i) => {
    const ok = await confirm({ title: 'Delete instructor?', message: `Remove ${i.name}?`, danger: true, confirmText: 'Delete' })
    if (!ok) return
    await api.del(`/instructors/${i.id}`)
    load()
  }

  return (
    <div>
      <PageHeader title="Instructors" subtitle={`${instructors.length} on staff`} />

      {loading ? (
        <SkeletonList />
      ) : instructors.length === 0 ? (
        <EmptyState icon={GraduationCap} title="No instructors yet" subtitle="Add your trainers to assign them to classes." action={<button className="btn-primary" onClick={openNew}>Add instructor</button>} />
      ) : (
        <div className="space-y-3">
          {instructors.map((i) => (
            <div key={i.id} className="card flex items-center gap-3 p-3.5">
              <Avatar name={i.name} size={46} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate font-semibold text-slate-800">{i.name}</p>
                  <Badge color={i.license_type === '2W' ? 'violet' : i.license_type === '4W' ? 'blue' : 'gray'}>
                    {i.license_type === 'both' ? '2W+4W' : i.license_type}
                  </Badge>
                </div>
                <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-400">
                  <Users className="h-3.5 w-3.5" /> {i.assigned_students || 0} active · {i.phone || 'No phone'}
                </p>
              </div>
              {i.phone && (
                <a href={`tel:${i.phone}`} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100">
                  <Phone className="h-4.5 w-4.5" />
                </a>
              )}
              <button onClick={() => setScheduleFor(i)} title="Schedule & availability" className="rounded-lg p-2 text-slate-400 hover:bg-slate-100">
                <CalendarDays className="h-4.5 w-4.5" />
              </button>
              <button onClick={() => openEdit(i)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100">
                <Pencil className="h-4.5 w-4.5" />
              </button>
              <button onClick={() => remove(i)} className="rounded-lg p-2 text-red-400 hover:bg-red-50">
                <Trash2 className="h-4.5 w-4.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      <Fab onClick={openNew} label="Add instructor" />

      <InstructorScheduleModal
        instructor={scheduleFor}
        open={!!scheduleFor}
        onClose={() => setScheduleFor(null)}
        onUpdated={load}
      />

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={form.id ? 'Edit instructor' : 'Add instructor'}
        footer={
          <div className="flex gap-3">
            <button className="btn-ghost flex-1" onClick={() => setOpen(false)} type="button">Cancel</button>
            <button className="btn-primary flex-1" onClick={save} disabled={busy}>{busy ? <Spinner className="h-5 w-5" /> : 'Save'}</button>
          </div>
        }
      >
        <form onSubmit={save}>
          <TextInput label="Name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Ramesh Kumar" />
          <TextInput label="Phone" type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="10-digit mobile" />
          <PillGroup label="Can teach" value={form.license_type} onChange={(v) => setForm({ ...form, license_type: v })} options={LICENSE} />
          <TextArea label="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Optional" />

          {form.id && (
            <p className="-mt-1 mb-4 text-xs text-slate-400">
              Set working hours & time off from the schedule view (the calendar icon).
            </p>
          )}

          <div className="mt-2 border-t border-slate-100 pt-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Login access {form.has_login && <span className="text-emerald-500">· enabled</span>}
            </p>
            <TextInput
              label="Email (login username)"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="instructor@example.com"
              hint="The instructor signs in to their portal with this email."
            />
            <TextInput
              label={form.has_login ? 'New password' : 'Password'}
              type="password"
              autoComplete="new-password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder={form.has_login ? 'Leave blank to keep current' : 'Min. 6 characters'}
              hint={form.has_login ? 'Enter a new password only to change it.' : 'Set an email + password to let this instructor log in.'}
            />
          </div>
        </form>
      </Modal>
    </div>
  )
}
