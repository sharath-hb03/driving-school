import { useRef, useState } from 'react'
import { FileText, Upload, Eye, Download, Trash2, RefreshCw, CheckCircle2, FileClock } from 'lucide-react'
import toast from 'react-hot-toast'
import { api, fileUrl } from '../lib/api'
import { fmtDate } from '../lib/format'
import { DOC_TYPES, DOC_TYPE_MAP, isPdf, downloadUrl } from '../lib/studentDocs'
import { Badge, Spinner, EmptyState } from './ui'
import { useConfirm } from './ConfirmDialog'

// A single document type card. `editable` toggles upload / replace / remove controls.
function DocCard({ type, doc, editable, onUpload, onNumberSave, onRemove, busy }) {
  const fileRef = useRef(null)
  const [num, setNum] = useState(doc?.doc_number || '')
  const uploaded = !!doc
  const pdf = uploaded && isPdf(doc)

  const pickFile = (e) => {
    const file = e.target.files?.[0]
    if (file) onUpload(type, file, num) // carry any number typed before the file was chosen
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <div className={`rounded-2xl border p-3.5 transition ${uploaded ? 'border-slate-100 bg-white' : editable ? 'border-dashed border-slate-200 bg-slate-50/50' : 'border-slate-100 bg-slate-50/40'}`}>
      <div className="flex items-start gap-3">
        {/* Preview / icon */}
        <div className="relative h-12 w-12 shrink-0">
          {uploaded && !pdf ? (
            <a href={fileUrl(doc.file_key)} target="_blank" rel="noreferrer" className="block h-12 w-12 overflow-hidden rounded-xl border border-slate-200">
              <img src={fileUrl(doc.file_key)} alt={type.label} className="h-full w-full object-cover" />
            </a>
          ) : (
            <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${uploaded ? 'bg-brand-50 text-brand-600' : 'bg-slate-100 text-slate-400'}`}>
              {uploaded ? <FileText className="h-5 w-5" /> : <type.icon className="h-5 w-5" />}
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="text-sm font-bold text-slate-800">{type.label}</p>
            {type.required && <Badge color="amber">Required</Badge>}
            {uploaded ? (
              <Badge color="green"><CheckCircle2 className="mr-0.5 inline h-3 w-3" />Uploaded</Badge>
            ) : type.required ? (
              <Badge color="gray">Pending</Badge>
            ) : null}
          </div>

          {uploaded ? (
            <p className="mt-0.5 text-xs text-slate-400">
              {pdf ? 'PDF' : 'Image'} · {fmtDate(doc.created_at)}
              {doc.uploaded_by === 'staff' ? ' · by staff' : ''}
            </p>
          ) : (
            <p className="mt-0.5 text-xs text-slate-400">{editable ? type.hint : 'Not uploaded'}</p>
          )}

          {/* Document number */}
          {type.hasNumber && (uploaded || editable) && (
            editable ? (
              <input
                className="input mt-2 h-9 py-1 text-sm"
                placeholder={type.numberLabel}
                value={num}
                onChange={(e) => setNum(e.target.value)}
                onBlur={() => { if ((num || '') !== (doc?.doc_number || '')) onNumberSave(type, num) }}
              />
            ) : doc?.doc_number ? (
              <p className="mt-1 text-xs text-slate-600"><span className="text-slate-400">{type.numberLabel}:</span> <span className="font-semibold">{doc.doc_number}</span></p>
            ) : null
          )}

          {/* Actions */}
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            {uploaded && (
              <>
                <a href={fileUrl(doc.file_key)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:text-brand-700">
                  <Eye className="h-3.5 w-3.5" /> View
                </a>
                <a href={downloadUrl(doc.file_key)} download className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-700">
                  <Download className="h-3.5 w-3.5" /> Download
                </a>
              </>
            )}
            {editable && (
              <>
                <input ref={fileRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={pickFile} />
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => fileRef.current?.click()}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:border-slate-300 disabled:opacity-50"
                >
                  {busy ? <Spinner className="h-3.5 w-3.5" /> : uploaded ? <RefreshCw className="h-3.5 w-3.5" /> : <Upload className="h-3.5 w-3.5" />}
                  {uploaded ? 'Replace' : 'Upload'}
                </button>
                {uploaded && (
                  <button type="button" onClick={() => onRemove(doc)} className="inline-flex items-center gap-1 text-xs font-semibold text-red-500 hover:text-red-600">
                    <Trash2 className="h-3.5 w-3.5" /> Remove
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// documents: array of rows from the API. editable: student portal (true) vs staff view (false).
export default function StudentDocuments({ documents = [], editable = false, onReload }) {
  const confirm = useConfirm()
  const [busyType, setBusyType] = useState(null)
  const byType = Object.fromEntries((documents || []).map((d) => [d.doc_type, d]))

  const saveDoc = async (type, { file_key, file_format, doc_number }) => {
    await api.post('/portal/documents', { doc_type: type.value, file_key, file_format, doc_number: doc_number ?? byType[type.value]?.doc_number ?? '' })
  }

  const onUpload = async (type, file, docNumber) => {
    setBusyType(type.value)
    try {
      const res = await api.portalUpload(file, 'student-docs')
      await saveDoc(type, { file_key: res.url, file_format: res.format, doc_number: docNumber })
      toast.success(`${type.short} uploaded`)
      onReload?.()
    } catch (err) {
      toast.error(err.message || 'Upload failed')
    } finally {
      setBusyType(null)
    }
  }

  const onNumberSave = async (type, number) => {
    const doc = byType[type.value]
    if (!doc) return // number is saved together with the file once one is uploaded
    try {
      await saveDoc(type, { file_key: doc.file_key, file_format: doc.file_format, doc_number: number })
      onReload?.()
    } catch (err) {
      toast.error(err.message)
    }
  }

  const onRemove = async (doc) => {
    const label = DOC_TYPE_MAP[doc.doc_type]?.label || 'document'
    const ok = await confirm({ title: 'Remove document?', message: `Delete your ${label}?`, danger: true, confirmText: 'Remove' })
    if (!ok) return
    try {
      await api.del(`/portal/documents/${doc.id}`)
      toast.success('Removed')
      onReload?.()
    } catch (err) {
      toast.error(err.message)
    }
  }

  // Staff, read-only, with nothing uploaded yet.
  if (!editable && documents.length === 0) {
    return <EmptyState icon={FileClock} title="No documents uploaded" subtitle="The student hasn't uploaded any documents yet." />
  }

  // Staff view only lists the types that actually have an upload; the portal shows the full checklist.
  const rows = editable ? DOC_TYPES : DOC_TYPES.filter((t) => byType[t.value])

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {rows.map((t) => (
        <DocCard
          key={t.value}
          type={t}
          doc={byType[t.value]}
          editable={editable}
          busy={busyType === t.value}
          onUpload={onUpload}
          onNumberSave={onNumberSave}
          onRemove={onRemove}
        />
      ))}
    </div>
  )
}
