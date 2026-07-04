import { Search, Loader2 } from 'lucide-react'
import { initials } from '../lib/format'

export function Spinner({ className = '' }) {
  return <Loader2 className={`animate-spin ${className}`} />
}

export function PageLoader() {
  return (
    <div className="flex h-[60vh] items-center justify-center text-slate-400">
      <Spinner className="h-7 w-7" />
    </div>
  )
}

const AVATAR_COLORS = [
  'bg-blue-100 text-blue-700','bg-emerald-100 text-emerald-700','bg-amber-100 text-amber-700',
  'bg-violet-100 text-violet-700','bg-rose-100 text-rose-700','bg-cyan-100 text-cyan-700'
]
export function Avatar({ name = '', src, size = 44 }) {
  const color = AVATAR_COLORS[(name.charCodeAt(0) || 0) % AVATAR_COLORS.length]
  if (src) return <img src={src} alt={name} style={{ width: size, height: size }} className="rounded-full object-cover" />
  return (
    <div style={{ width: size, height: size }} className={`flex shrink-0 items-center justify-center rounded-full font-bold ${color}`}>
      {initials(name) || '?'}
    </div>
  )
}

const BADGE_STYLES = {
  green: 'bg-emerald-100 text-emerald-700', red: 'bg-red-100 text-red-700',
  amber: 'bg-amber-100 text-amber-700', blue: 'bg-brand-100 text-brand-700',
  gray: 'bg-slate-100 text-slate-600', violet: 'bg-violet-100 text-violet-700',
  cyan: 'bg-cyan-100 text-cyan-700', rose: 'bg-rose-100 text-rose-700',
}
export function Badge({ children, color = 'gray', className = '' }) {
  return <span className={`chip ${BADGE_STYLES[color] || BADGE_STYLES.gray} ${className}`}>{children}</span>
}

export function EmptyState({ icon: Icon, title, subtitle, action }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-14 text-center">
      {Icon && <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400"><Icon className="h-7 w-7" /></div>}
      <p className="font-semibold text-slate-700">{title}</p>
      {subtitle && <p className="mt-1 max-w-xs text-sm text-slate-400">{subtitle}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function SearchInput({ value, onChange, placeholder = 'Search…' }) {
  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="input pl-10" type="search" />
    </div>
  )
}

export function Segmented({ value, onChange, options }) {
  return (
    <div className="inline-flex rounded-xl bg-slate-100 p-1">
      {options.map((opt) => (
        <button key={opt.value} onClick={() => onChange(opt.value)}
          className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${value === opt.value ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500'}`}>
          {opt.label}
        </button>
      ))}
    </div>
  )
}

export function SkeletonCard() {
  return (
    <div className="card flex items-center gap-3 p-4">
      <div className="skeleton h-11 w-11 rounded-full" />
      <div className="flex-1 space-y-2">
        <div className="skeleton h-3.5 w-1/3" />
        <div className="skeleton h-3 w-1/2" />
      </div>
    </div>
  )
}

export function SkeletonList({ count = 5 }) {
  return <div className="space-y-3">{Array.from({ length: count }).map((_, i) => <SkeletonCard key={i} />)}</div>
}

export function StatCard({ icon: Icon, label, value, subtitle, tone, to }) {
  const Wrapper = to ? 'a' : 'div'
  const tones = {
    blue: 'bg-brand-50 text-brand-600', green: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600', violet: 'bg-violet-50 text-violet-600',
    rose: 'bg-rose-50 text-rose-600', cyan: 'bg-cyan-50 text-cyan-600',
  }
  return (
    <Wrapper href={to} className="card flex items-center gap-3 p-4 transition active:scale-[.98]">
      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${tones[tone] || tones.blue}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-2xl font-extrabold leading-none text-slate-900">{value}</p>
        <p className="mt-1 truncate text-xs font-semibold text-slate-500">{label}</p>
        {subtitle && <p className="mt-0.5 truncate text-[10px] font-medium text-slate-400">{subtitle}</p>}
      </div>
    </Wrapper>
  )
}
