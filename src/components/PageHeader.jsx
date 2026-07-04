import { Plus } from 'lucide-react'

export function PageHeader({ title, subtitle, action }) {
  return (
    <div className="mb-5 flex items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-slate-400">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

export function Fab({ onClick, label = 'Add', icon: Icon = Plus }) {
  return (
    <button
      onClick={onClick}
      className="fixed bottom-24 right-5 z-30 flex h-14 items-center gap-2 rounded-full bg-brand-600 px-5 text-white shadow-soft active:scale-95 lg:bottom-8 lg:right-8"
      aria-label={label}
    >
      <Icon className="h-6 w-6" />
      <span className="pr-1 text-sm font-semibold">{label}</span>
    </button>
  )
}
