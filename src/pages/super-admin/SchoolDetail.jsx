import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { ArrowLeft, Building2, Users, Wallet, CheckCircle2, XCircle, Plus, Trash2, KeyRound } from 'lucide-react'
import { useApi } from '../../lib/useApi'
import { api } from '../../lib/api'
import { inr, fmtDate } from '../../lib/format'
import { Badge, Spinner } from '../../components/ui'
import Modal from '../../components/Modal'
import { TextInput } from '../../components/Field'
import { useConfirm } from '../../components/ConfirmDialog'
import { ConfirmProvider } from '../../components/ConfirmDialog'

function AddAdminModal({ open, onClose, onSaved, schoolId }) {
  const [form, setForm] = useState({ name:'', email:'', password:'' })
  const [busy, setBusy] = useState(false)
  const set = k => v => setForm(f => ({ ...f, [k]: typeof v === 'string' ? v : v.target.value }))
  const submit = async e => {
    e.preventDefault()
    setBusy(true)
    try {
      await api.post(`/super-admin/schools/${schoolId}/admins`, form)
      toast.success('Admin account created')
      onSaved?.(); onClose()
      setForm({ name:'', email:'', password:'' })
    } catch (err) { toast.error(err.message) }
    finally { setBusy(false) }
  }
  return (
    <Modal open={open} onClose={onClose} title="Add Admin Account" size="sm"
      footer={<div className="flex gap-3">
        <button type="button" className="btn-ghost flex-1" onClick={onClose}>Cancel</button>
        <button form="add-admin" type="submit" className="btn-primary flex-1" disabled={busy}>{busy ? <Spinner className="h-4 w-4" /> : 'Add admin'}</button>
      </div>}>
      <form id="add-admin" onSubmit={submit} className="space-y-1">
        <TextInput label="Name" value={form.name} onChange={set('name')} required />
        <TextInput label="Email" value={form.email} onChange={set('email')} type="email" required />
        <TextInput label="Password" value={form.password} onChange={set('password')} type="password" required placeholder="Min 8 chars" />
      </form>
    </Modal>
  )
}

function SchoolDetailInner() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { data, loading, reload } = useApi(`/super-admin/schools/${id}`, [id])
  const [addAdminOpen, setAddAdminOpen] = useState(false)
  const confirm = useConfirm()

  const school = data?.school
  const stats  = data?.stats  || {}
  const admins = data?.admins || []

  const toggleStatus = async () => {
    const active = school.active ? 0 : 1
    const label = active ? 'activate' : 'suspend'
    const ok = await confirm({ title: `${active ? 'Activate' : 'Suspend'} school?`, message: `This will ${label} ${school.name}.`, danger: !active, confirmText: active ? 'Activate' : 'Suspend' })
    if (!ok) return
    try {
      await api.put(`/super-admin/schools/${id}/status`, { active })
      toast.success(`School ${active ? 'activated' : 'suspended'}`)
      reload()
    } catch (err) { toast.error(err.message) }
  }

  const delAdmin = async (admin) => {
    const ok = await confirm({ title: 'Remove admin?', message: `Remove ${admin.name} from this school?`, danger: true, confirmText: 'Remove' })
    if (!ok) return
    try {
      await api.del(`/super-admin/schools/${id}/admins/${admin.id}`)
      toast.success('Admin removed'); reload()
    } catch (err) { toast.error(err.message) }
  }

  const resetPassword = async (admin) => {
    const pwd = window.prompt(`New password for ${admin.name} (min 8 chars):`)
    if (!pwd) return
    if (pwd.length < 8) return toast.error('Password too short')
    try {
      await api.put(`/super-admin/schools/${id}/admins/${admin.id}`, { password: pwd })
      toast.success('Password reset')
    } catch (err) { toast.error(err.message) }
  }

  if (loading) return <div className="flex h-[60vh] items-center justify-center"><Spinner className="h-7 w-7 text-slate-400" /></div>
  if (!school) return <div className="py-20 text-center text-slate-400">School not found</div>

  return (
    <div className="page-enter">
      <button onClick={() => navigate(-1)} className="mb-4 flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-800">
        <ArrowLeft className="h-4 w-4" /> Schools
      </button>

      {/* Header */}
      <div className="card mb-4 p-5">
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-brand-100 text-brand-700">
            <Building2 className="h-7 w-7" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-extrabold text-slate-900">{school.name}</h1>
              <Badge color={school.active ? 'green' : 'red'}>{school.active ? 'Active' : 'Suspended'}</Badge>
            </div>
            <p className="mt-0.5 text-sm text-slate-400">slug: {school.slug} · created {fmtDate(school.created_at)}</p>
            <div className="mt-1 flex flex-wrap gap-3 text-xs text-slate-500">
              {school.phone && <span>📞 {school.phone}</span>}
              {school.email && <span>✉️ {school.email}</span>}
              {school.address && <span>📍 {school.address}</span>}
            </div>
          </div>
          <button onClick={toggleStatus}
            className={`shrink-0 rounded-xl px-4 py-2 text-sm font-semibold transition ${school.active ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'}`}>
            {school.active ? <><XCircle className="mr-1.5 inline h-4 w-4" />Suspend</> : <><CheckCircle2 className="mr-1.5 inline h-4 w-4" />Activate</>}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {[
          { label: 'Total students', value: stats.totalStudents ?? 0 },
          { label: 'Active students', value: stats.activeStudents ?? 0 },
          { label: 'Instructors', value: stats.instructors ?? 0 },
          { label: 'Vehicles', value: stats.vehicles ?? 0 },
          { label: 'Revenue (month)', value: inr(stats.revenueThisMonth), big: true },
          { label: 'Total revenue', value: inr(stats.totalRevenue), big: true },
        ].map(({ label, value }) => (
          <div key={label} className="card p-4">
            <p className="text-xs text-slate-400">{label}</p>
            <p className="mt-1 text-lg font-extrabold text-slate-900">{value}</p>
          </div>
        ))}
      </div>

      {/* Admin accounts */}
      <div className="card p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-bold text-slate-800"><Users className="h-5 w-5 text-brand-600" />Admin Accounts</h2>
          <button className="btn-primary px-3 py-1.5 text-xs" onClick={() => setAddAdminOpen(true)}><Plus className="h-4 w-4" /> Add admin</button>
        </div>
        {admins.length === 0 ? (
          <p className="text-sm text-slate-400">No admins yet.</p>
        ) : (
          <div className="space-y-2">
            {admins.map(a => (
              <div key={a.id} className="flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-700">
                  {a.name?.[0]?.toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-800">{a.name}</p>
                  <p className="truncate text-xs text-slate-400">{a.email}</p>
                </div>
                <Badge color={a.role === 'admin' ? 'blue' : 'gray'}>{a.role}</Badge>
                <button onClick={() => resetPassword(a)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200" title="Reset password"><KeyRound className="h-4 w-4" /></button>
                <button onClick={() => delAdmin(a)} className="rounded-lg p-1.5 text-red-400 hover:bg-red-50"><Trash2 className="h-4 w-4" /></button>
              </div>
            ))}
          </div>
        )}
      </div>

      <AddAdminModal open={addAdminOpen} onClose={() => setAddAdminOpen(false)} onSaved={reload} schoolId={id} />
    </div>
  )
}

export default function SchoolDetail() {
  return <ConfirmProvider><SchoolDetailInner /></ConfirmProvider>
}
