import { useEffect, useState } from 'react'
import { Pencil, ClipboardList, Copy } from 'lucide-react'
import toast from 'react-hot-toast'
import { api } from '../lib/api'
import { fmtDate } from '../lib/format'
import { PROFILE_SECTIONS, parseProfile, emptyProfile, profileFilledCount, isRequired, missingRequired } from '../lib/studentDocs'
import Modal from './Modal'
import { Spinner } from './ui'
import { TextInput, Select } from './Field'

const toOpts = (arr) => arr.map((o) => ({ value: o, label: o }))

// Render one schema field inside the edit form.
function FormField({ field, value, onChange, required }) {
  const wrap = field.half ? '' : 'sm:col-span-2'
  if (field.type === 'select') {
    return (
      <div className={wrap}>
        <Select label={field.label} required={required} value={value || ''} placeholder="Select" options={toOpts(field.options)} onChange={(e) => onChange(e.target.value)} />
      </div>
    )
  }
  const inputMode = field.type === 'tel' || field.type === 'number' ? 'numeric' : undefined
  return (
    <div className={wrap}>
      <TextInput
        label={field.label}
        required={required}
        type={field.type === 'date' ? 'date' : field.type === 'email' ? 'email' : 'text'}
        inputMode={inputMode}
        placeholder={field.placeholder || ''}
        value={value || ''}
        onChange={(e) => onChange(e?.target ? e.target.value : e)}
      />
    </div>
  )
}

// Read-only display of a section's filled values.
function SectionView({ section, values }) {
  const filled = section.fields.filter((f) => String(values?.[f.key] ?? '').trim() !== '')
  if (filled.length === 0) {
    return (
      <div>
        <p className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-400">{section.title}</p>
        <p className="text-sm text-slate-400">Not provided</p>
      </div>
    )
  }
  return (
    <div>
      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">{section.title}</p>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 sm:grid-cols-3">
        {filled.map((f) => (
          <div key={f.key} className="min-w-0">
            <dt className="text-xs text-slate-400">{f.label}</dt>
            <dd className="truncate text-sm font-medium text-slate-700" title={String(values[f.key])}>
              {f.type === 'date' ? fmtDate(values[f.key]) : values[f.key]}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

// profile: raw ll_profile (string or object). editable: student portal.
export default function LLProfileCard({ profile, editable = false, onReload }) {
  const parsed = parseProfile(profile)
  const filledCount = profileFilledCount(profile)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(emptyProfile())
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (open) setForm(parseProfile(profile))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const set = (section, key) => (val) => setForm((f) => ({ ...f, [section]: { ...f[section], [key]: val } }))

  const copyPresentToPermanent = () => setForm((f) => ({ ...f, permanent: { ...f.present, stay_years: undefined, stay_months: undefined } }))

  const save = async () => {
    const missing = missingRequired(form)
    if (missing.length) {
      toast.error(`Please fill required field${missing.length > 1 ? 's' : ''}: ${missing.slice(0, 4).map((m) => m.label).join(', ')}${missing.length > 4 ? '…' : ''}`)
      return
    }
    setBusy(true)
    try {
      await api.put('/portal/profile', form)
      toast.success('Details saved')
      setOpen(false)
      onReload?.()
    } catch (err) {
      toast.error(err.message || 'Could not save')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-base font-bold text-slate-800">
          <ClipboardList className="h-5 w-5 text-brand-600" /> Profile Details
        </h2>
        {editable && (
          <button onClick={() => setOpen(true)} className="btn-ghost px-3 py-1.5 text-xs">
            <Pencil className="h-3.5 w-3.5" /> {filledCount ? 'Edit' : 'Add details'}
          </button>
        )}
      </div>

      {filledCount === 0 ? (
        <p className="text-sm text-slate-400">
          {editable
            ? 'Add your details to speed up your licence paperwork.'
            : 'The student hasn\'t added their profile details yet.'}
        </p>
      ) : (
        <div className="space-y-5">
          {PROFILE_SECTIONS.map((s) => (
            <SectionView key={s.key} section={s} values={parsed[s.key]} />
          ))}
        </div>
      )}

      {editable && (
        <Modal
          open={open}
          onClose={() => setOpen(false)}
          title="Profile Details"
          size="lg"
          footer={
            <div className="flex gap-3">
              <button className="btn-ghost flex-1" type="button" onClick={() => setOpen(false)}>Cancel</button>
              <button className="btn-primary flex-1" onClick={save} disabled={busy}>{busy ? <Spinner className="h-5 w-5" /> : 'Save details'}</button>
            </div>
          }
        >
          <div className="space-y-6">
            <p className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-500">
              Fields marked <span className="font-bold text-red-500">*</span> are required. The rest are optional.
            </p>
            {PROFILE_SECTIONS.map((section) => (
              <div key={section.key}>
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm font-bold text-slate-700">
                    {section.title}
                    {section.key === 'permanent' && <span className="ml-1.5 text-xs font-medium text-slate-400">(optional)</span>}
                  </p>
                  {section.key === 'permanent' && (
                    <button type="button" onClick={copyPresentToPermanent} className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:text-brand-700">
                      <Copy className="h-3.5 w-3.5" /> Same as present
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
                  {section.fields.map((f) => (
                    <FormField
                      key={f.key}
                      field={f}
                      required={isRequired(section.key, f.key)}
                      value={form[section.key]?.[f.key]}
                      onChange={set(section.key, f.key)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Modal>
      )}
    </div>
  )
}
