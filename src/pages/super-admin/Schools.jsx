import { useState } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Building2, Plus, Search } from 'lucide-react'
import { useApi } from '../../lib/useApi'
import { api } from '../../lib/api'
import { inr, fmtDate } from '../../lib/format'
import { Badge, EmptyState, Spinner } from '../../components/ui'
import Modal from '../../components/Modal'
import { TextInput } from '../../components/Field'

function AddSchoolModal({ open, onClose, onSaved }) {
  const [form, setForm] = useState({ name:'', slug:'', phone:'', email:'', adminName:'', adminEmail:'', adminPassword:'' })
  const [busy, setBusy] = useState(false)
  const set = k => v => setForm(f => ({ ...f, [k]: typeof v === 'string' ? v : v.target.value }))

  // Auto-generate slug from name
  const onNameChange = e => {
    const name = e.target.value
    setForm(f => ({ ...f, name, slug: f.slug || name.toLowerCase().trim().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'') }))
  }

  const submit = async e => {
    e.preventDefault()
    if (!form.name.trim()) return toast.error('Name required')
    setBusy(true)
    try {
      await api.post('/super-admin/schools', form)
      toast.success('School created!')
      onSaved?.()
      onClose()
      setForm({ name:'', slug:'', phone:'', email:'', adminName:'', adminEmail:'', adminPassword:'' })
    } catch (err) { toast.error(err.message) }
    finally { setBusy(false) }
  }

  return (
    <Modal open={open} onClose={onClose} title="Create School" size="lg"
      footer={<div className="flex gap-3">
        <button type="button" className="btn-ghost flex-1" onClick={onClose}>Cancel</button>
        <button form="add-school" type="submit" className="btn-primary flex-1" disabled={busy}>
          {busy ? <Spinner className="h-4 w-4" /> : 'Create school'}
        </button>
      </div>}>
      <form id="add-school" onSubmit={submit} className="space-y-1">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">School Info</p>
        <TextInput label="School name" value={form.name} onChange={onNameChange} required placeholder="e.g. Ravi Driving School" />
        <TextInput label="URL slug" value={form.slug} onChange={set('slug')} placeholder="e.g. ravi-driving" hint="Used in the public URL: /schools/ravi-driving" />
        <TextInput label="Phone" value={form.phone} onChange={set('phone')} type="tel" />
        <TextInput label="Email" value={form.email} onChange={set('email')} type="email" />
        <p className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wide text-slate-400">Admin Account (Optional)</p>
        <TextInput label="Admin name" value={form.adminName} onChange={set('adminName')} placeholder="School admin's name" />
        <TextInput label="Admin email" value={form.adminEmail} onChange={set('adminEmail')} type="email" placeholder="admin@school.com" />
        {form.adminEmail && <TextInput label="Admin password" value={form.adminPassword} onChange={set('adminPassword')} type="password" placeholder="Min 8 characters" />}
      </form>
    </Modal>
  )
}

export default function Schools() {
  const { data, loading, reload } = useApi('/super-admin/schools?limit=100')
  const schools = data?.schools || []
  const [q, setQ] = useState('')
  const [addOpen, setAddOpen] = useState(false)

  const visible = schools.filter(s => !q || s.name.toLowerCase().includes(q.toLowerCase()) || s.slug.includes(q.toLowerCase()))

  return (
    <div className="page-enter">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">Schools</h1>
          <p className="text-sm text-slate-400">{schools.length} registered</p>
        </div>
        <button className="btn-primary" onClick={() => setAddOpen(true)}><Plus className="h-4 w-4" /> Add school</button>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input className="input pl-10" placeholder="Search schools…" value={q} onChange={e => setQ(e.target.value)} />
      </div>

      {loading ? <div className="flex justify-center py-16"><Spinner className="h-7 w-7 text-slate-400" /></div>
      : visible.length === 0 ? (
        <EmptyState icon={Building2} title="No schools yet" subtitle="Create the first school to get started."
          action={<button className="btn-primary" onClick={() => setAddOpen(true)}>Add school</button>} />
      ) : (
        <div className="space-y-3">
          {visible.map(s => (
            <Link key={s.id} to={`/super-admin/schools/${s.id}`}
              className="card flex items-center gap-4 p-4 transition hover:border-brand-200 hover:shadow-soft active:scale-[.99]">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
                <Building2 className="h-6 w-6" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-bold text-slate-800">{s.name}</p>
                  <Badge color={s.active ? 'green' : 'red'}>{s.active ? 'Active' : 'Suspended'}</Badge>
                </div>
                <p className="truncate text-xs text-slate-400">
                  {s.admin_email || s.email || '—'} · slug: {s.slug} · since {fmtDate(s.created_at)}
                </p>
              </div>
              <div className="hidden shrink-0 text-right sm:block">
                <p className="text-sm font-bold text-slate-700">{s.student_count} students</p>
                <p className="text-xs text-emerald-600">{inr(s.revenue_this_month)} this month</p>
              </div>
            </Link>
          ))}
        </div>
      )}

      <AddSchoolModal open={addOpen} onClose={() => setAddOpen(false)} onSaved={reload} />
    </div>
  )
}
