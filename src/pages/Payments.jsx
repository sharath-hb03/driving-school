import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { AlertCircle, ChevronRight, Plus, Trash2, Wallet, Phone } from 'lucide-react'
import { api } from '../lib/api'
import { inr, fmtDate } from '../lib/format'
import { PageHeader } from '../components/PageHeader'
import { Avatar, Badge, EmptyState, SearchInput, Segmented, SkeletonList } from '../components/ui'
import { useConfirm } from '../components/ConfirmDialog'
import PaymentForm from '../components/PaymentForm'
import DatePicker from '../components/DatePicker'

const TABS = [
  { value: 'history', label: 'History' },
  { value: 'pending', label: 'Outstanding' },
]
const METHOD_COLOR = { cash: 'green', upi: 'blue', card: 'violet', bank: 'cyan' }

export default function Payments() {
  const [tab, setTab] = useState('history')
  const [payments, setPayments] = useState([])
  const [students, setStudents] = useState([])
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [q, setQ] = useState('')

  const weekRange = useMemo(() => {
    const today = new Date()
    const past = new Date()
    past.setDate(today.getDate() - 7)
    return {
      from: past.toISOString().slice(0, 10),
      to: today.toISOString().slice(0, 10)
    }
  }, [])

  const [fromDate, setFromDate] = useState(weekRange.from)
  const [toDate, setToDate] = useState(weekRange.to)
  const confirm = useConfirm()

  const load = async () => {
    setLoading(true)
    try {
      const pParams = new URLSearchParams()
      if (fromDate) pParams.append('from', `${fromDate}T00:00:00`)
      if (toDate) pParams.append('to', `${toDate}T23:59:59.999Z`)

      const [p, s] = await Promise.all([
        api.get(`/payments?${pParams.toString()}`),
        api.get('/students')
      ])
      setPayments(p.payments || [])
      setStudents(s.students || [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [fromDate, toDate])

  const pending = useMemo(
    () => students.filter((s) => Number(s.balance) > 0).sort((a, b) => Number(b.balance) - Number(a.balance)),
    [students]
  )
  const totalDue = useMemo(() => pending.reduce((sum, s) => sum + Number(s.balance || 0), 0), [pending])
  const totalCollected = useMemo(() => payments.reduce((sum, p) => sum + Number(p.amount || 0), 0), [payments])

  const visiblePayments = useMemo(() => {
    const term = q.trim().toLowerCase()
    if (!term) return payments
    return payments.filter((p) =>
      p.student_name?.toLowerCase().includes(term) ||
      p.student_phone?.includes(term) ||
      p.method?.toLowerCase().includes(term) ||
      p.note?.toLowerCase().includes(term)
    )
  }, [payments, q])

  const visiblePending = useMemo(() => {
    const term = q.trim().toLowerCase()
    if (!term) return pending
    return pending.filter((s) =>
      s.name?.toLowerCase().includes(term) ||
      s.phone?.includes(term) ||
      s.package_name?.toLowerCase().includes(term)
    )
  }, [pending, q])

  const totalShown = useMemo(
    () => visiblePayments.reduce((sum, p) => sum + Number(p.amount || 0), 0),
    [visiblePayments]
  )

  const del = async (p) => {
    const ok = await confirm({ title: 'Delete payment?', message: `Delete ${inr(p.amount)} payment for ${p.student_name}?`, danger: true, confirmText: 'Delete' })
    if (!ok) return
    try {
      await api.del(`/payments/${p.id}`)
      toast.success('Payment deleted')
      load()
    } catch (err) {
      toast.error(err.message)
    }
  }

  return (
    <div className="page-enter">
      <PageHeader
        title="Payments"
        action={
          <button className="btn-primary px-3 py-2 text-xs" onClick={() => setFormOpen(true)}>
            <Plus className="h-4 w-4" /> Add
          </button>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3">
        <div className="card p-4">
          <p className="text-xs font-medium text-slate-400">Total collected</p>
          <p className="mt-1 text-xl font-extrabold text-emerald-600">{inr(totalCollected)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs font-medium text-slate-400">Outstanding</p>
          <p className="mt-1 text-xl font-extrabold text-amber-600">{inr(totalDue)}</p>
        </div>
      </div>

      <div className="mb-4 space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Segmented value={tab} onChange={setTab} options={TABS} />
          <div className="sm:w-80">
            <SearchInput
              value={q}
              onChange={setQ}
              placeholder={tab === 'history' ? 'Search payments...' : 'Search outstanding...'}
            />
          </div>
        </div>
        {tab === 'history' && (
          <div className="card grid grid-cols-[1fr_1fr_auto] items-end gap-2.5 p-3">
            <div>
              <span className="block mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">From</span>
              <DatePicker
                inputClassName="py-1.5 text-xs"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
              />
            </div>
            <div>
              <span className="block mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">To</span>
              <DatePicker
                inputClassName="py-1.5 text-xs"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
              />
            </div>
            <button
              type="button"
              disabled={!fromDate && !toDate}
              onClick={() => { setFromDate(''); setToDate('') }}
              className="btn-ghost px-2.5 py-1.5 text-xs text-slate-500 hover:text-red-500 disabled:opacity-30"
            >
              Clear
            </button>
          </div>
        )}
        {tab === 'history' && visiblePayments.length > 0 && (
          <div className="rounded-xl bg-emerald-50 px-4 py-3">
            <p className="text-xs font-medium text-emerald-700">
              Total shown: <span className="text-base font-extrabold">{inr(totalShown)}</span>
            </p>
          </div>
        )}
      </div>

      {loading ? (
        <SkeletonList />
      ) : tab === 'history' ? (
        visiblePayments.length === 0 ? (
          <EmptyState icon={Wallet} title="No payments yet" subtitle={q ? 'Try a different search.' : 'Record your first payment with Add.'} />
        ) : (
          <div className="space-y-3">
            {visiblePayments.map((p) => (
              <div key={p.id} className="card flex items-center gap-3 p-3.5">
                <Avatar name={p.student_name} size={44} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-slate-800">{p.student_name}</p>
                  <p className="truncate text-xs text-slate-400">{fmtDate(p.paid_at)}{p.note ? ` - ${p.note}` : ''}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <p className="font-bold text-slate-900">{inr(p.amount)}</p>
                  <Badge color={METHOD_COLOR[p.method] || 'gray'}>{p.method}</Badge>
                </div>
                {p.student_phone && (
                  <a href={`tel:${p.student_phone}`} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100">
                    <Phone className="h-4 w-4" />
                  </a>
                )}
                <button onClick={() => del(p)} className="rounded-lg p-2 text-red-400 hover:bg-red-50">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )
      ) : visiblePending.length === 0 ? (
        <EmptyState icon={AlertCircle} title="No outstanding payments" subtitle={q ? 'Try a different search.' : 'All students are settled.'} />
      ) : (
        <div className="space-y-3">
          {visiblePending.map((s) => {
            const fee = Number(s.fee || 0) - Number(s.discount || 0)
            const paid = Math.max(0, fee - Number(s.balance || 0))
            return (
              <Link key={s.id} to={`/students/${s.id}`} className="card flex items-center gap-3 p-3.5 active:scale-[.99]">
                <Avatar name={s.name} size={44} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-slate-800">{s.name}</p>
                  <p className="truncate text-xs text-slate-400">
                    Paid {inr(paid)} of {inr(fee)}
                  </p>
                </div>
                <span className="font-bold text-amber-600">{inr(s.balance)}</span>
                {s.phone && (
                  <a href={`tel:${s.phone}`} onClick={(e) => e.stopPropagation()} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100">
                    <Phone className="h-4 w-4" />
                  </a>
                )}
                <ChevronRight className="h-4 w-4 text-slate-300" />
              </Link>
            )
          })}
        </div>
      )}

      <PaymentForm open={formOpen} onClose={() => setFormOpen(false)} onSaved={load} />
    </div>
  )
}
