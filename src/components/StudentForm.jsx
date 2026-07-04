import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { api } from '../lib/api'
import Modal from './Modal'
import { TextInput, TextArea, Select, PillGroup } from './Field'
import { useApi } from '../lib/useApi'
import { Spinner } from './ui'

const LICENSE_OPTS = [{ value: '4W', label: '4 Wheeler' }, { value: '2W', label: '2 Wheeler' }]
const STATUS_OPTS  = [{ value: 'active', label: 'Active' }, { value: 'completed', label: 'Completed' }, { value: 'inactive', label: 'Inactive' }]

function getInitialForm(student) {
  return {
    name: student?.name || '',
    phone: student?.phone || '',
    email: student?.email || '',
    address: student?.address || '',
    license_type: student?.license_type || '4W',
    joining_date: student?.joining_date || new Date().toISOString().slice(0, 10),
    package_id: student?.package_id || '',
    status: student?.status || 'active',
    discount: student?.discount || '',
    notes: student?.notes || '',
    password: '',
    opt_for_license: student?.opt_for_license !== undefined ? !!student.opt_for_license : true,
  }
}

export default function StudentForm({ open, onClose, onSaved, student }) {
  const { data: pkgData } = useApi('/packages')
  const packages = (pkgData?.packages || []).filter(p => p.active)

  const [form, setForm] = useState(() => getInitialForm(student))
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (open) setForm(getInitialForm(student))
  }, [open, student])

  const set = (k) => (v) => setForm(f => ({ ...f, [k]: typeof v === 'string' ? v : v.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) return toast.error('Name is required')
    setBusy(true)
    try {
      const payload = {
        ...form,
        package_id: form.package_id || null,
        discount: Number(form.discount) || 0,
        opt_for_license: form.opt_for_license ? 1 : 0
      }
      if (!payload.password) delete payload.password
      if (student) {
        await api.put(`/students/${student.id}`, payload)
        toast.success('Student updated')
      } else {
        await api.post('/students', payload)
        toast.success('Student added')
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
    <Modal open={open} onClose={onClose} title={student ? 'Edit Student' : 'Add Student'} size="lg"
      footer={
        <div className="flex gap-3">
          <button type="button" className="btn-ghost flex-1" onClick={onClose}>Cancel</button>
          <button form="student-form" type="submit" className="btn-primary flex-1" disabled={busy}>
            {busy ? <Spinner className="h-4 w-4" /> : student ? 'Save changes' : 'Add student'}
          </button>
        </div>
      }>
      <form id="student-form" onSubmit={submit} className="space-y-1">
        <TextInput label="Full name" value={form.name} onChange={set('name')} required placeholder="e.g. Ravi Kumar" />
        <TextInput label="Phone" value={form.phone} onChange={set('phone')} placeholder="10-digit mobile" type="tel" />
        <TextInput label="Email" value={form.email} onChange={set('email')} placeholder="For portal login (optional)" type="email" />
        {form.email && <TextInput label="Portal password" value={form.password} onChange={set('password')} type="password" placeholder={student ? 'Leave blank to keep unchanged' : 'Min 8 chars'} />}
        <TextInput label="Address" value={form.address} onChange={set('address')} placeholder="Home address" />
        <PillGroup label="License type" value={form.license_type} onChange={set('license_type')} options={LICENSE_OPTS} />
        <div className="flex items-center gap-2 py-1 ml-1">
          <input
            id="opt_for_license"
            type="checkbox"
            checked={!!form.opt_for_license}
            onChange={(e) => setForm(f => ({ ...f, opt_for_license: e.target.checked }))}
            className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
          />
          <label htmlFor="opt_for_license" className="text-xs font-semibold text-slate-700 select-none cursor-pointer">
            Opted for Driving Licence
          </label>
        </div>
        <TextInput label="Joining date" value={form.joining_date} onChange={set('joining_date')} type="date" />
        <Select label="Package" value={form.package_id} onChange={set('package_id')} placeholder="— No package —"
          options={packages.map(p => ({ value: p.id, label: `${p.name} (${p.license_type}) — ₹${p.fee}` }))} />
        <TextInput label="Discount (₹)" value={form.discount} onChange={set('discount')} type="number" min="0" placeholder="0" />
        <Select label="Status" value={form.status} onChange={set('status')} options={STATUS_OPTS} />

        <TextArea label="Notes" value={form.notes} onChange={set('notes')} placeholder="Any additional notes…" />
      </form>
    </Modal>
  )
}
