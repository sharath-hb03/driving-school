import DatePicker from './DatePicker'
import TimePicker from './TimePicker'

export function Field({ label, children, hint, required }) {
  return (
    <div className="mb-4">
      {label && <label className="label">{label} {required && <span className="text-red-500">*</span>}</label>}
      {children}
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  )
}

export function TextInput({ label, hint, required, ...props }) {
  const { type, ...rest } = props
  let inputElement = <input className="input" type={type} {...rest} />

  if (type === 'date') {
    inputElement = <DatePicker required={required} {...rest} />
  } else if (type === 'time') {
    inputElement = <TimePicker required={required} {...rest} />
  }

  return <Field label={label} hint={hint} required={required}>{inputElement}</Field>
}

export function TextArea({ label, hint, required, ...props }) {
  return <Field label={label} hint={hint} required={required}><textarea className="input min-h-[80px] resize-y" {...props} /></Field>
}

export function Select({ label, hint, required, options = [], placeholder, ...props }) {
  return (
    <Field label={label} hint={hint} required={required}>
      <select className="input appearance-none bg-white" {...props}>
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </Field>
  )
}

export function PillGroup({ label, value, onChange, options, required }) {
  return (
    <Field label={label} required={required}>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <button key={o.value} type="button" onClick={() => onChange(o.value)}
            className={`rounded-xl border px-4 py-2.5 text-sm font-semibold transition ${
              value === o.value ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
            }`}>
            {o.label}
          </button>
        ))}
      </div>
    </Field>
  )
}
