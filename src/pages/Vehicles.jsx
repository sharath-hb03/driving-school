import { useEffect, useState } from 'react'
import { Car, Pencil, Trash2, Wrench, CheckCircle2, FileText } from 'lucide-react'
import toast from 'react-hot-toast'
import { api } from '../lib/api'
import { PageHeader, Fab } from '../components/PageHeader'
import { Badge, EmptyState, SkeletonList, Spinner } from '../components/ui'
import { useConfirm } from '../components/ConfirmDialog'
import Modal from '../components/Modal'
import { TextInput, PillGroup } from '../components/Field'
import VehicleDocsModal from '../components/VehicleDocsModal'
import { DOC_TYPES, expiryStatus, currentByType, docTypeShort } from '../lib/vehicleDocs'

const LICENSE = [
  { value: '2W', label: '🏍️ 2-Wheeler' },
  { value: '4W', label: '🚗 4-Wheeler' }
]
const blank = { vehicle_number: '', model: '', license_type: '4W', status: 'available' }

export default function Vehicles() {
  const confirm = useConfirm()
  const [vehicles, setVehicles] = useState([])
  const [docsByVehicle, setDocsByVehicle] = useState({}) // vehicleId -> { docType -> currentDoc }
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(blank)
  const [busy, setBusy] = useState(false)
  const [docsFor, setDocsFor] = useState(null) // vehicle whose documents modal is open

  const loadDocs = async () => {
    try {
      const d = await api.get('/vehicle-documents')
      const grouped = {}
      for (const doc of d.documents || []) {
        ;(grouped[doc.vehicle_id] ||= []).push(doc)
      }
      const map = {}
      for (const [vid, list] of Object.entries(grouped)) map[vid] = currentByType(list)
      setDocsByVehicle(map)
    } catch {
      /* documents are best-effort on this page */
    }
  }

  const load = async () => {
    setLoading(true)
    try {
      const [d] = await Promise.all([api.get('/vehicles'), loadDocs()])
      setVehicles(d.vehicles || [])
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
  const openEdit = (v) => {
    setForm(v)
    setOpen(true)
  }

  const save = async (e) => {
    e.preventDefault()
    if (!form.vehicle_number.trim()) return toast.error('Vehicle number is required')
    setBusy(true)
    try {
      form.id ? await api.put(`/vehicles/${form.id}`, form) : await api.post('/vehicles', form)
      toast.success('Saved')
      setOpen(false)
      load()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  const toggleStatus = async (v) => {
    const status = v.status === 'available' ? 'service' : 'available'
    await api.put(`/vehicles/${v.id}`, { status })
    setVehicles((vs) => vs.map((x) => (x.id === v.id ? { ...x, status } : x)))
  }

  const remove = async (v) => {
    const ok = await confirm({ title: 'Delete vehicle?', message: `Remove ${v.vehicle_number}? Its documents are removed too.`, danger: true, confirmText: 'Delete' })
    if (!ok) return
    await api.del(`/vehicles/${v.id}`)
    load()
  }

  // Documents that need attention (expired / due soon) for a vehicle's card.
  const alertsFor = (v) => {
    const cur = docsByVehicle[v.id] || {}
    return DOC_TYPES.map((t) => ({ type: t.value, doc: cur[t.value] }))
      .filter((x) => x.doc)
      .map((x) => ({ type: x.type, ...expiryStatus(x.doc.expiry_date) }))
      .filter((x) => x.tone === 'red' || x.tone === 'amber')
  }

  return (
    <div>
      <PageHeader title="Vehicles" subtitle={`${vehicles.length} total`} />

      {loading ? (
        <SkeletonList />
      ) : vehicles.length === 0 ? (
        <EmptyState icon={Car} title="No vehicles yet" subtitle="Add the cars and bikes used for training." action={<button className="btn-primary" onClick={openNew}>Add vehicle</button>} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {vehicles.map((v) => {
            const alerts = alertsFor(v)
            return (
              <div key={v.id} className="card p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${v.status === 'available' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                      <Car className="h-5.5 w-5.5" />
                    </div>
                    <div>
                      <p className="font-bold text-slate-800">{v.vehicle_number}</p>
                      <p className="text-xs text-slate-400">{v.model || '—'}</p>
                    </div>
                  </div>
                  <Badge color={v.license_type === '2W' ? 'violet' : 'blue'}>{v.license_type}</Badge>
                </div>

                {/* Document alerts (expired / expiring soon) */}
                {alerts.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {alerts.map((a) => (
                      <Badge key={a.type} color={a.tone}>
                        {docTypeShort(a.type)}: {a.label}
                      </Badge>
                    ))}
                  </div>
                )}

                <div className="mt-3 flex items-center gap-2">
                  <button onClick={() => toggleStatus(v)} className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold ${v.status === 'available' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                    {v.status === 'available' ? <CheckCircle2 className="h-4 w-4" /> : <Wrench className="h-4 w-4" />}
                    {v.status === 'available' ? 'Available' : 'In service'}
                  </button>
                  <button onClick={() => setDocsFor(v)} className="relative rounded-lg bg-slate-50 p-2 text-slate-500" title="Documents">
                    <FileText className="h-4 w-4" />
                    {alerts.length > 0 && <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-red-500" />}
                  </button>
                  <button onClick={() => openEdit(v)} className="rounded-lg bg-slate-50 p-2 text-slate-500" title="Edit">
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button onClick={() => remove(v)} className="rounded-lg bg-red-50 p-2 text-red-500" title="Delete">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <Fab onClick={openNew} label="Add vehicle" />

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={form.id ? 'Edit vehicle' : 'Add vehicle'}
        footer={
          <div className="flex gap-3">
            <button className="btn-ghost flex-1" onClick={() => setOpen(false)} type="button">Cancel</button>
            <button className="btn-primary flex-1" onClick={save} disabled={busy}>{busy ? <Spinner className="h-5 w-5" /> : 'Save'}</button>
          </div>
        }
      >
        <form onSubmit={save}>
          <TextInput label="Vehicle number" required value={form.vehicle_number} onChange={(e) => setForm({ ...form, vehicle_number: e.target.value })} placeholder="KA-01-AB-1234" />
          <TextInput label="Model" value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} placeholder="e.g. Maruti Swift" />
          <PillGroup label="Type" value={form.license_type} onChange={(v) => setForm({ ...form, license_type: v })} options={LICENSE} />
        </form>
      </Modal>

      <VehicleDocsModal
        open={Boolean(docsFor)}
        vehicle={docsFor}
        onClose={() => setDocsFor(null)}
        onChanged={loadDocs}
      />
    </div>
  )
}
