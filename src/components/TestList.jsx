import { useMemo, useState } from 'react'
import { format } from 'date-fns'
import { ChevronDown, Phone } from 'lucide-react'
import { fmtDate, fmtClock } from '../lib/format'
import { Badge, Avatar } from './ui'

const TEST_STATUS = { passed: 'green', failed: 'red', pending: 'blue' }
const TYPE_MAP = {
  "Learner's Licence": { color: 'violet', label: 'LL' },
  "Driving Test": { color: 'cyan', label: 'DL' }
}

function Row({ t, muted }) {
  const typeInfo = TYPE_MAP[t.type] || { color: 'gray', label: t.type }
  return (
    <div className={`card flex items-center gap-3 p-3.5 ${muted ? 'bg-slate-50/50' : ''}`}>
      <Avatar name={t.student_name} size={46} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className={`min-w-0 truncate font-semibold ${muted ? 'text-slate-600' : 'text-slate-800'}`}>{t.student_name}</p>
          <Badge color={typeInfo.color} className="shrink-0">{typeInfo.label}</Badge>
        </div>
        <p className="mt-0.5 text-xs text-slate-400">
          {fmtDate(t.date)}{t.time ? ` · ${fmtClock(t.time)}` : ''}
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {t.status && <Badge color={TEST_STATUS[t.status] || 'gray'}>{t.status}</Badge>}
        {t.student_phone && (
          <a href={`tel:${t.student_phone}`} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100">
            <Phone className="h-4.5 w-4.5" />
          </a>
        )}
      </div>
    </div>
  )
}

// Renders assigned RTO tests: upcoming by default, past behind a toggle.
export default function TestList({ tests = [], emptyText = 'No tests assigned.' }) {
  const [showPast, setShowPast] = useState(false)
  const todayKey = format(new Date(), 'yyyy-MM-dd')
  const upcoming = useMemo(() => tests.filter((t) => t.date >= todayKey), [tests, todayKey])
  const past = useMemo(() => tests.filter((t) => t.date < todayKey).reverse(), [tests, todayKey]) // recent first

  if (tests.length === 0) return <p className="py-10 text-center text-sm text-slate-400">{emptyText}</p>

  return (
    <div className="space-y-2">
      {upcoming.length > 0 ? (
        upcoming.map((t, i) => <Row key={`u${i}`} t={t} />)
      ) : (
        <p className="py-4 text-center text-sm text-slate-400">No upcoming tests.</p>
      )}

      {past.length > 0 && (
        <div>
          <button
            onClick={() => setShowPast((v) => !v)}
            className="flex w-full items-center justify-between rounded-lg px-1 py-1.5 text-xs font-semibold text-slate-400 hover:text-slate-600"
          >
            <span>Past tests ({past.length})</span>
            <ChevronDown className={`h-4 w-4 transition ${showPast ? 'rotate-180' : ''}`} />
          </button>
          {showPast && <div className="mt-1 space-y-2">{past.map((t, i) => <Row key={`p${i}`} t={t} muted />)}</div>}
        </div>
      )}
    </div>
  )
}
