import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Settings, Users, Pencil, Plus, Trash2, KeyRound, Package, ArrowUp, ArrowDown, Milestone } from 'lucide-react'
import { useApi } from '../lib/useApi'
import { api } from '../lib/api'
import { inr } from '../lib/format'
import { useAuth } from '../context/AuthContext'
import { PageHeader } from '../components/PageHeader'
import { Spinner, Badge } from '../components/ui'
import { TextInput, TextArea, Select, PillGroup } from '../components/Field'
import Modal from '../components/Modal'
import { useConfirm } from '../components/ConfirmDialog'

const LICENSE_OPTS = [
  { value: '2W', label: '2-Wheeler' },
  { value: '4W', label: '4-Wheeler' },
  { value: 'both', label: 'Both' },
]
const blankPkg = { name: '', license_type: 'both', fee: '', total_classes: 10 }

function StaffModal({ open, onClose, onSaved, staffMember }) {
  const isEdit = !!staffMember
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'staff',
  })
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    setForm({
      name: staffMember?.name || '',
      email: staffMember?.email || '',
      password: '',
      role: staffMember?.role || 'staff',
    })
  }, [open, staffMember])

  const set = (k) => (v) => setForm(f => ({ ...f, [k]: typeof v === 'string' ? v : v.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    if (!form.name.trim() || !form.email.trim()) return toast.error('Name and email required')
    if (!isEdit && form.password.length < 8) return toast.error('Password must be at least 8 characters')
    setBusy(true)
    try {
      if (isEdit) {
        if (form.password) {
          await api.put(`/staff/${staffMember.id}/password`, { password: form.password })
          toast.success('Password updated')
        } else {
          toast('Nothing changed')
        }
      } else {
        await api.post('/auth/register', {
          name: form.name.trim(),
          email: form.email.trim().toLowerCase(),
          password: form.password,
          role: form.role,
        })
        toast.success(`${form.role === 'admin' ? 'Admin' : 'Staff'} account created`)
      }
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
      title={isEdit ? `Reset Password - ${staffMember.name}` : 'Add Staff Account'}
      size="sm"
      footer={
        <div className="flex gap-3">
          <button type="button" className="btn-ghost flex-1" onClick={onClose}>Cancel</button>
          <button form="staff-modal-form" type="submit" className="btn-primary flex-1" disabled={busy}>
            {busy ? <Spinner className="h-4 w-4" /> : isEdit ? 'Update password' : 'Add account'}
          </button>
        </div>
      }
    >
      <form id="staff-modal-form" onSubmit={submit} className="space-y-1">
        {!isEdit && (
          <>
            <TextInput label="Full name" value={form.name} onChange={set('name')} required placeholder="e.g. Priya Sharma" />
            <TextInput label="Email" value={form.email} onChange={set('email')} required type="email" placeholder="priya@school.com" />
            <Select
              label="Role"
              value={form.role}
              onChange={set('role')}
              options={[{ value: 'staff', label: 'Staff (limited access)' }, { value: 'admin', label: 'Admin (full access)' }]}
            />
          </>
        )}
        <TextInput
          label={isEdit ? 'New password' : 'Password'}
          value={form.password}
          onChange={set('password')}
          type="password"
          required={!isEdit}
          placeholder="Min 8 characters"
        />
      </form>
    </Modal>
  )
}

function PackageModal({ open, onClose, onSaved, pkg }) {
  const [form, setForm] = useState(blankPkg)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    setForm(pkg ? {
      ...blankPkg,
      ...pkg,
      fee: pkg.fee ?? '',
      total_classes: pkg.total_classes ?? 10,
    } : blankPkg)
  }, [open, pkg])

  const set = (k) => (v) => setForm(f => ({ ...f, [k]: typeof v === 'string' ? v : v.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) return toast.error('Package name required')
    if (Number(form.fee) < 0) return toast.error('Fee cannot be negative')
    setBusy(true)
    try {
      const payload = {
        name: form.name.trim(),
        license_type: form.license_type || 'both',
        fee: Number(form.fee) || 0,
        total_classes: Number(form.total_classes) || 0,
      }
      if (pkg?.id) await api.put(`/packages/${pkg.id}`, payload)
      else await api.post('/packages', payload)
      toast.success('Package saved')
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
      title={pkg?.id ? 'Edit Package' : 'Add Package'}
      size="sm"
      footer={
        <div className="flex gap-3">
          <button type="button" className="btn-ghost flex-1" onClick={onClose}>Cancel</button>
          <button form="package-modal-form" type="submit" className="btn-primary flex-1" disabled={busy}>
            {busy ? <Spinner className="h-4 w-4" /> : 'Save'}
          </button>
        </div>
      }
    >
      <form id="package-modal-form" onSubmit={submit} className="space-y-1">
        <TextInput label="Package name" value={form.name} onChange={set('name')} required placeholder="e.g. 4-Wheeler Basic" />
        <div className="grid grid-cols-2 gap-3">
          <TextInput label="Fee" value={form.fee} onChange={set('fee')} type="number" min="0" inputMode="numeric" required placeholder="0" />
          <TextInput label="Classes" value={form.total_classes} onChange={set('total_classes')} type="number" min="0" inputMode="numeric" placeholder="10" />
        </div>
        <PillGroup label="License type" value={form.license_type} onChange={(v) => setForm(f => ({ ...f, license_type: v }))} options={LICENSE_OPTS} />
      </form>
    </Modal>
  )
}

export default function SettingsPage() {
  const { user } = useAuth()
  const { data, loading, reload } = useApi('/settings')
  const { data: pkgData, loading: pkgLoading, reload: reloadPackages } = useApi('/packages')
  const confirm = useConfirm()
  const isAdmin = user?.role === 'admin'

  const school = data?.school
  const staff = data?.staff || []
  const packages = pkgData?.packages || []

  const [form, setForm] = useState(null)
  const [busy, setBusy] = useState(false)
  const [staffModal, setStaffModal] = useState({ open: false, member: null })
  const [pkgModal, setPkgModal] = useState({ open: false, pkg: null })
  const [localStages, setLocalStages] = useState([])
  const [stagesBusy, setStagesBusy] = useState(false)

  useEffect(() => {
    if (school?.stages) {
      setLocalStages(school.stages)
    } else {
      setLocalStages([])
    }
  }, [school])

  const handleStageChange = (idx, val) => {
    setLocalStages(prev => {
      const copy = [...prev]
      copy[idx] = { ...copy[idx], name: val }
      return copy
    })
  }

  const addStage = () => {
    setLocalStages(prev => [
      ...prev,
      { id: `stage_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`, name: '' }
    ])
  }

  const removeStage = async (idx) => {
    const stage = localStages[idx]
    const ok = await confirm({
      title: 'Remove stage?',
      message: `Delete stage "${stage.name || 'Untitled'}"? Existing student progress for this stage will be hidden.`,
      danger: true,
      confirmText: 'Remove'
    })
    if (!ok) return
    setLocalStages(prev => prev.filter((_, i) => i !== idx))
  }

  const moveStage = (idx, dir) => {
    setLocalStages(prev => {
      const copy = [...prev]
      const temp = copy[idx]
      copy[idx] = copy[idx + dir]
      copy[idx + dir] = temp
      return copy
    })
  }

  const saveStages = async () => {
    if (localStages.some(s => !s.name.trim())) {
      return toast.error('Stage names cannot be empty')
    }
    setStagesBusy(true)
    try {
      await api.put('/settings', { stages: localStages })
      toast.success('Workflow stages updated')
      reload()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setStagesBusy(false)
    }
  }

  const set = (k) => (v) => setForm(f => ({ ...f, [k]: typeof v === 'string' ? v : v.target.value }))

  const startEdit = () => setForm({ name: school?.name || '', phone: school?.phone || '', email: school?.email || '', address: school?.address || '' })
  const cancelEdit = () => setForm(null)

  const saveSchool = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      await api.put('/settings', form)
      toast.success('Settings saved')
      reload()
      setForm(null)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  const removePackage = async (p) => {
    const ok = await confirm({ title: 'Delete package?', message: `Remove "${p.name}"? Students keep their record but lose the package link.`, danger: true, confirmText: 'Delete' })
    if (!ok) return
    try {
      await api.del(`/packages/${p.id}`)
      toast.success('Package deleted')
      reloadPackages()
    } catch (err) {
      toast.error(err.message)
    }
  }

  const removeStaff = async (s) => {
    if (s.id === user?.id) return toast.error("You can't remove your own account")
    const ok = await confirm({ title: 'Remove staff?', message: `Remove ${s.name} from this school?`, danger: true, confirmText: 'Remove' })
    if (!ok) return
    try {
      await api.del(`/staff/${s.id}`)
      toast.success('Staff removed')
      reload()
    } catch (err) {
      toast.error(err.message)
    }
  }

  if (loading) return <div className="flex h-40 items-center justify-center text-slate-400"><Spinner className="h-6 w-6" /></div>

  return (
    <div className="page-enter">
      <PageHeader title="Settings" />

      <section className="card mb-5 p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-bold text-slate-800">
            <Settings className="h-5 w-5 text-brand-600" /> School Profile
          </h2>
          {!form && isAdmin && (
            <button className="btn-ghost px-3 py-1.5 text-xs" onClick={startEdit}>
              <Pencil className="h-3.5 w-3.5" /> Edit
            </button>
          )}
        </div>

        {form ? (
          <form onSubmit={saveSchool} className="space-y-1">
            <TextInput label="School name" value={form.name} onChange={set('name')} required />
            <TextInput label="Phone" value={form.phone} onChange={set('phone')} type="tel" />
            <TextInput label="Email" value={form.email} onChange={set('email')} type="email" />
            <TextArea label="Address" value={form.address} onChange={set('address')} />
            <div className="flex gap-3 pt-2">
              <button type="button" className="btn-ghost flex-1" onClick={cancelEdit}>Cancel</button>
              <button type="submit" className="btn-primary flex-1" disabled={busy}>
                {busy ? <Spinner className="h-4 w-4" /> : 'Save changes'}
              </button>
            </div>
          </form>
        ) : (
          <dl className="space-y-2 text-sm">
            {[
              ['Name', school?.name],
              ['Phone', school?.phone],
              ['Email', school?.email],
              ['Address', school?.address],
            ].map(([k, v]) => (
              <div key={k} className="flex gap-2">
                <dt className="w-20 shrink-0 text-slate-400">{k}</dt>
                <dd className="font-medium text-slate-700">{v || '-'}</dd>
              </div>
            ))}
          </dl>
        )}
      </section>

      {/* Workflow Stages Card */}
      <section className="card mb-5 p-5">
        <h2 className="mb-2 font-bold text-slate-800 flex items-center gap-2">
          <Milestone className="h-5 w-5 text-brand-600" /> Workflow Stages
        </h2>
        <p className="text-xs text-slate-400 mb-4">
          Customize the progress stages students go through from enrollment to completion.
        </p>

        <div className="space-y-3">
          {localStages.map((stage, idx) => (
            <div key={stage.id} className="flex items-center gap-2">
              <span className="text-slate-400 text-xs font-semibold w-5 shrink-0">{idx + 1}.</span>
              <input
                type="text"
                value={stage.name}
                onChange={(e) => handleStageChange(idx, e.target.value)}
                disabled={!isAdmin}
                className="input py-1 px-3 text-sm flex-1"
                placeholder="Stage name (e.g. Learner's Licence)"
              />
              {isAdmin && (
                <div className="flex items-center">
                  <button
                    type="button"
                    onClick={() => moveStage(idx, -1)}
                    disabled={idx === 0}
                    className="p-1.5 text-slate-400 hover:text-slate-700 disabled:opacity-30"
                    title="Move Up"
                  >
                    <ArrowUp className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveStage(idx, 1)}
                    disabled={idx === localStages.length - 1}
                    className="p-1.5 text-slate-400 hover:text-slate-700 disabled:opacity-30"
                    title="Move Down"
                  >
                    <ArrowDown className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeStage(idx)}
                    className="p-1.5 text-red-500 hover:bg-red-50 hover:text-red-600 rounded-lg ml-1"
                    title="Delete Stage"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          ))}

          {localStages.length === 0 && (
            <p className="text-xs text-slate-400 italic">No stages configured. Click below to add one.</p>
          )}

          {isAdmin && (
            <div className="flex gap-3 pt-3">
              <button
                type="button"
                onClick={addStage}
                className="btn-ghost text-xs px-3 py-1.5 flex items-center gap-1"
              >
                <Plus className="h-3.5 w-3.5" /> Add Stage
              </button>
              <div className="flex-1" />
              <button
                type="button"
                onClick={saveStages}
                disabled={stagesBusy}
                className="btn-primary text-xs px-4 py-1.5"
              >
                {stagesBusy ? <Spinner className="h-3.5 w-3.5" /> : 'Save Stages'}
              </button>
            </div>
          )}
        </div>
      </section>

      <section className="card mb-5 p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-bold text-slate-800">
            <Package className="h-5 w-5 text-brand-600" /> Packages
          </h2>
          {isAdmin && (
            <button className="btn-primary px-3 py-1.5 text-xs" onClick={() => setPkgModal({ open: true, pkg: null })}>
              <Plus className="h-4 w-4" /> Add package
            </button>
          )}
        </div>

        {pkgLoading ? (
          <div className="flex h-20 items-center justify-center text-slate-400"><Spinner className="h-5 w-5" /></div>
        ) : packages.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 py-8 text-center text-sm text-slate-400">
            No packages yet.
          </div>
        ) : (
          <div className="space-y-2">
            {packages.map((p) => (
              <div key={p.id} className="flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-2.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-100 text-brand-700">
                  <Package className="h-4.5 w-4.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-800">{p.name}</p>
                  <p className="truncate text-xs text-slate-400">{inr(p.fee)} - {p.total_classes} classes - {p.license_type}</p>
                </div>
                <Badge color={p.active ? 'green' : 'gray'}>{p.active ? 'active' : 'inactive'}</Badge>
                {isAdmin && (
                  <div className="flex gap-1">
                    <button
                      onClick={() => setPkgModal({ open: true, pkg: p })}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200"
                      title="Edit package"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => removePackage(p)}
                      className="rounded-lg p-1.5 text-red-400 hover:bg-red-50"
                      title="Delete package"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="card p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-bold text-slate-800">
            <Users className="h-5 w-5 text-brand-600" /> Staff Accounts
          </h2>
          {isAdmin && (
            <button className="btn-primary px-3 py-1.5 text-xs" onClick={() => setStaffModal({ open: true, member: null })}>
              <Plus className="h-4 w-4" /> Add staff
            </button>
          )}
        </div>

        {staff.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 py-8 text-center text-sm text-slate-400">
            No staff accounts yet.
          </div>
        ) : (
          <div className="space-y-2">
            {staff.map((s) => {
              const isSelf = s.id === user?.id
              return (
                <div key={s.id} className="flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-2.5">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-700">
                    {s.name?.[0]?.toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-800">
                      {s.name} {isSelf && <span className="text-xs font-normal text-slate-400">(you)</span>}
                    </p>
                    <p className="truncate text-xs text-slate-400">{s.email}</p>
                  </div>
                  <Badge color={s.role === 'admin' ? 'blue' : 'gray'}>{s.role}</Badge>
                  {isAdmin && (
                    <div className="flex gap-1">
                      <button
                        onClick={() => setStaffModal({ open: true, member: s })}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200"
                        title="Reset password"
                      >
                        <KeyRound className="h-4 w-4" />
                      </button>
                      {!isSelf && (
                        <button
                          onClick={() => removeStaff(s)}
                          className="rounded-lg p-1.5 text-red-400 hover:bg-red-50"
                          title="Remove staff"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </section>

      <PackageModal
        open={pkgModal.open}
        pkg={pkgModal.pkg}
        onClose={() => setPkgModal({ open: false, pkg: null })}
        onSaved={reloadPackages}
      />
      <StaffModal
        open={staffModal.open}
        staffMember={staffModal.member}
        onClose={() => setStaffModal({ open: false, member: null })}
        onSaved={reload}
      />
    </div>
  )
}
