import { useEffect, useRef, useState } from 'react'
import { Plus, Pencil, Trash2, FileUp, ExternalLink, History } from 'lucide-react'
import toast from 'react-hot-toast'
import { api, fileUrl } from '../lib/api'
import { inr, fmtDate } from '../lib/format'
import { DOC_TYPES, DOC_TYPE_MAP, expiryStatus, currentByType } from '../lib/vehicleDocs'
import Modal from './Modal'
import { Badge, Spinner } from './ui'
import { useConfirm } from './ConfirmDialog'
import { TextInput, TextArea, Field } from './Field'

const blank = (vehicle_id, doc_type = 'insurance') => ({
  vehicle_id,
  doc_type,
  provider: '',
  doc_number: '',
  amount: '',
  start_date: '',
  expiry_date: '',
  file_key: '',
  notes: ''
})

export default function VehicleDocsModal({ open, onClose, vehicle, onChanged }) {
  const confirm = useConfirm()
  const fileRef = useRef(null)
  const [docs, setDocs] = useState([])
  const [loading, setLoading] = useState(true)
  const [mode, setMode] = useState('list') // list | form
  const [form, setForm] = useState(blank(vehicle?.id))
  const [busy, setBusy] = useState(false)
  const [uploading, setUploading] = useState(false)

  const load = async () => {
    if (!vehicle?.id) return
    setLoading(true)
    try {
      const d = await api.get(`/vehicle-documents?vehicle_id=${vehicle.id}`)
      setDocs(d.documents || [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open) {
      setMode('list')
      load()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, vehicle?.id])

  const current = currentByType(docs)
  const meta = DOC_TYPE_MAP[form.doc_type] || DOC_TYPES[0]

  const openNew = (doc_type) => {
    setForm(blank(vehicle.id, doc_type))
    setMode('form')
  }
  const openEdit = (d) => {
    setForm({
      vehicle_id: d.vehicle_id,
      doc_type: d.doc_type,
      provider: d.provider || '',
      doc_number: d.doc_number || '',
      amount: d.amount ?? '',
      start_date: d.start_date || '',
      expiry_date: d.expiry_date || '',
      file_key: d.file_key || '',
      notes: d.notes || '',
      id: d.id
    })
    setMode('form')
  }

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e?.target ? e.target.value : e }))

  const onPickFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const res = await api.upload(file, 'vehicle-docs')
      setForm((f) => ({ ...f, file_key: res.url }))
      toast.success('Scan attached')
    } catch (err) {
      toast.error(err.message)
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const save = async (e) => {
    e?.preventDefault()
    if (!form.expiry_date) return toast.error('Expiry date is required')
    setBusy(true)
    try {
      const payload = { ...form, amount: form.amount === '' ? null : Number(form.amount) }
      form.id ? await api.put(`/vehicle-documents/${form.id}`, payload) : await api.post('/vehicle-documents', payload)
      toast.success('Saved')
      setMode('list')
      await load()
      onChanged?.()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  const remove = async (d) => {
    const ok = await confirm({
      title: 'Delete document?',
      message: `Remove this ${DOC_TYPE_MAP[d.doc_type]?.label || d.doc_type} record?`,
      danger: true,
      confirmText: 'Delete'
    })
    if (!ok) return
    await api.del(`/vehicle-documents/${d.id}`)
    await load()
    onChanged?.()
  }

  const title = mode === 'form' ? (form.id ? 'Edit document' : `Add ${meta.label}`) : `Documents · ${vehicle?.vehicle_number || ''}`

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="lg"
      footer={
        mode === 'form' ? (
          <div className="flex gap-3">
            <button className="btn-ghost flex-1" type="button" onClick={() => setMode('list')}>Back</button>
            <button className="btn-primary flex-1" onClick={save} disabled={busy}>{busy ? <Spinner className="h-5 w-5" /> : 'Save'}</button>
          </div>
        ) : (
          <button className="btn-ghost w-full" type="button" onClick={onClose}>Close</button>
        )
      }
    >
      {mode === 'form' ? (
        <form onSubmit={save}>
          {/* Doc type chips (only when adding fresh) */}
          {!form.id && (
            <Field label="Document type">
              <div className="flex flex-wrap gap-2">
                {DOC_TYPES.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, doc_type: t.value }))}
                    className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                      form.doc_type === t.value
                        ? 'border-brand-600 bg-brand-50 text-brand-700'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    <t.icon className="h-4 w-4" /> {t.short}
                  </button>
                ))}
              </div>
            </Field>
          )}

          <div className="grid grid-cols-2 gap-3">
            <TextInput label="Valid from" type="date" value={form.start_date} onChange={set('start_date')} />
            <TextInput label="Expiry date" required type="date" value={form.expiry_date} onChange={set('expiry_date')} />
          </div>
          <TextInput label={meta.providerLabel} value={form.provider} onChange={set('provider')} placeholder={meta.providerLabel} />
          <div className="grid grid-cols-2 gap-3">
            <TextInput label={meta.numberLabel} value={form.doc_number} onChange={set('doc_number')} placeholder={meta.numberLabel} />
            <TextInput label="Amount (₹)" type="number" inputMode="numeric" value={form.amount} onChange={set('amount')} placeholder="0" />
          </div>

          {/* Scan / PDF */}
          <Field label="Scan / PDF" hint="Image or PDF, up to 5 MB.">
            <input ref={fileRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={onPickFile} />
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => fileRef.current?.click()} className="btn-ghost flex items-center gap-1.5" disabled={uploading}>
                {uploading ? <Spinner className="h-4 w-4" /> : <FileUp className="h-4 w-4" />}
                {form.file_key ? 'Replace file' : 'Attach file'}
              </button>
              {form.file_key && (
                <>
                  <a href={fileUrl(form.file_key)} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-sm font-semibold text-brand-600">
                    <ExternalLink className="h-4 w-4" /> View
                  </a>
                  <button type="button" onClick={() => setForm((f) => ({ ...f, file_key: '' }))} className="text-sm font-semibold text-red-500">
                    Remove
                  </button>
                </>
              )}
            </div>
          </Field>

          <TextArea label="Notes" value={form.notes} onChange={set('notes')} placeholder="Optional" />
        </form>
      ) : loading ? (
        <div className="flex justify-center py-10"><Spinner className="h-6 w-6 text-slate-300" /></div>
      ) : (
        <div className="space-y-5">
          {DOC_TYPES.map((t) => {
            const cur = current[t.value]
            const history = docs.filter((d) => d.doc_type === t.value).sort((a, b) => String(b.expiry_date).localeCompare(String(a.expiry_date)))
            const past = history.filter((d) => d.id !== cur?.id)
            const st = cur ? expiryStatus(cur.expiry_date) : null
            return (
              <div key={t.value} className="rounded-2xl border border-slate-100 p-3.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
                      <t.icon className="h-4.5 w-4.5" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-800">{t.label}</p>
                      {cur ? (
                        <p className="text-xs text-slate-400">Valid till {fmtDate(cur.expiry_date)}</p>
                      ) : (
                        <p className="text-xs text-slate-400">Not on record</p>
                      )}
                    </div>
                  </div>
                  {st && <Badge color={st.tone}>{st.label}</Badge>}
                </div>

                {cur && (
                  <div className="mt-3 rounded-xl bg-slate-50 px-3.5 py-3">
                    <div className="flex items-start justify-between">
                      <div className="min-w-0 text-xs text-slate-600 space-y-1">
                        {cur.provider && <p><span className="font-semibold text-slate-400">Provider:</span> {cur.provider}</p>}
                        {cur.doc_number && <p><span className="font-semibold text-slate-400">Doc Number:</span> {cur.doc_number}</p>}
                        {cur.start_date && <p><span className="font-semibold text-slate-400">Valid From:</span> {fmtDate(cur.start_date)}</p>}
                        {cur.amount != null && <p><span className="font-semibold text-slate-400">Amount:</span> {inr(cur.amount)}</p>}
                        {cur.notes && (
                          <div className="mt-1.5 border-t border-slate-200/60 pt-1">
                            <span className="font-semibold text-slate-400">Notes:</span> <span className="text-slate-500 italic">"{cur.notes}"</span>
                          </div>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        {cur.file_key && (
                          <a href={fileUrl(cur.file_key)} target="_blank" rel="noreferrer" className="rounded-lg p-1.5 text-slate-400 hover:bg-white" title="View scan">
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        )}
                        <button onClick={() => openEdit(cur)} className="rounded-lg p-1.5 text-slate-400 hover:bg-white" title="Edit"><Pencil className="h-4 w-4" /></button>
                        <button onClick={() => remove(cur)} className="rounded-lg p-1.5 text-red-400 hover:bg-white" title="Delete"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    </div>
                  </div>
                )}

                {past.length > 0 && (
                  <details className="mt-2 group">
                    <summary className="flex cursor-pointer items-center gap-1 text-xs font-semibold text-slate-400">
                      <History className="h-3.5 w-3.5" /> {past.length} past record{past.length > 1 ? 's' : ''}
                    </summary>
                    <div className="mt-2 space-y-2">
                      {past.map((d) => (
                        <div key={d.id} className="flex items-start justify-between rounded-lg px-2.5 py-2 hover:bg-slate-50 border border-slate-100/40">
                          <div className="min-w-0 text-xs text-slate-500 space-y-0.5">
                            <p className="font-bold text-slate-700">Expired: {fmtDate(d.expiry_date)}</p>
                            {d.provider && <p><span className="font-semibold text-slate-400">Provider:</span> {d.provider}</p>}
                            {d.doc_number && <p><span className="font-semibold text-slate-400">Doc Number:</span> {d.doc_number}</p>}
                            {d.start_date && <p><span className="font-semibold text-slate-400">Valid From:</span> {fmtDate(d.start_date)}</p>}
                            {d.amount != null && <p><span className="font-semibold text-slate-400">Amount:</span> {inr(d.amount)}</p>}
                            {d.notes && <p className="italic text-slate-400/80 mt-0.5">Notes: "{d.notes}"</p>}
                          </div>
                          <div className="flex items-center gap-1">
                            {d.file_key && (
                              <a href={fileUrl(d.file_key)} target="_blank" rel="noreferrer" className="rounded p-1 text-slate-400 hover:bg-white" title="View scan"><ExternalLink className="h-3.5 w-3.5" /></a>
                            )}
                            <button onClick={() => openEdit(d)} className="rounded p-1 text-slate-400 hover:bg-white" title="Edit"><Pencil className="h-3.5 w-3.5" /></button>
                            <button onClick={() => remove(d)} className="rounded p-1 text-red-400 hover:bg-white" title="Delete"><Trash2 className="h-3.5 w-3.5" /></button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </details>
                )}

                <button onClick={() => openNew(t.value)} className="mt-2.5 flex items-center gap-1 text-xs font-semibold text-brand-600">
                  <Plus className="h-3.5 w-3.5" /> {cur ? 'Add renewal' : `Add ${t.short.toLowerCase()}`}
                </button>
              </div>
            )
          })}
        </div>
      )}
    </Modal>
  )
}
