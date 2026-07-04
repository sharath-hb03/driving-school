import { useEffect, useMemo, useState } from 'react'
import { startOfWeek, addDays, addWeeks, format, isSameDay, parseISO, isToday } from 'date-fns'
import { ChevronLeft, ChevronRight, CalendarDays, Plus } from 'lucide-react'
import { fmtTime } from '../lib/format'
import { Avatar, Badge, EmptyState, Spinner } from './ui'

const STATUS_COLOR = { scheduled: 'blue', attended: 'green', absent: 'red', cancelled: 'gray' }
const asDate = (v) => parseISO(String(v).includes('T') ? v : String(v).replace(' ', 'T'))

export default function WeekSchedule({ load, subtitle, renderActions, renderBadge, onBook, reloadSignal = 0, emptyTitle = 'No classes this day', emptySubtitle, onStudentClick }) {
  const [weekStart, setWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }))
  const [selected, setSelected] = useState(new Date())
  const [classes, setClasses] = useState([])
  const [loading, setLoading] = useState(true)

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart])

  useEffect(() => {
    let active = true
    setLoading(true)
    const from = addDays(weekStart, -1).toISOString()
    const to   = addDays(weekStart, 8).toISOString()
    Promise.resolve(load(from, to))
      .then((list) => active && setClasses(list || []))
      .finally(() => active && setLoading(false))
    return () => { active = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStart, reloadSignal])

  const countByDay = useMemo(() => {
    const map = {}
    for (const c of classes) {
      const key = format(asDate(c.scheduled_at), 'yyyy-MM-dd')
      map[key] = (map[key] || 0) + 1
    }
    return map
  }, [classes])

  const dayClasses = useMemo(() =>
    classes.filter(c => isSameDay(asDate(c.scheduled_at), selected))
      .sort((a, b) => asDate(a.scheduled_at) - asDate(b.scheduled_at)),
    [classes, selected])

  return (
    <div>
      <div className="card mb-4 p-3">
        <div className="mb-2 flex items-center justify-between px-1">
          <button onClick={() => setWeekStart(w => addWeeks(w, -1))} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <p className="text-sm font-bold text-slate-700">{format(weekStart, 'MMMM yyyy')}</p>
          <button onClick={() => setWeekStart(w => addWeeks(w, 1))} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
        <div className="grid grid-cols-7 gap-1">
          {days.map((d) => {
            const key = format(d, 'yyyy-MM-dd')
            const isSel = isSameDay(d, selected)
            return (
              <button key={key} onClick={() => setSelected(d)}
                className={`flex flex-col items-center rounded-xl py-2 transition ${isSel ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
                <span className={`text-[10px] font-medium ${isSel ? 'text-white/80' : 'text-slate-400'}`}>{format(d, 'EEE')}</span>
                <span className={`mt-0.5 text-sm font-bold ${isToday(d) && !isSel ? 'text-brand-600' : ''}`}>{format(d, 'd')}</span>
                <span className={`mt-1 h-1.5 w-1.5 rounded-full ${countByDay[key] ? (isSel ? 'bg-white' : 'bg-brand-400') : 'bg-transparent'}`} />
              </button>
            )
          })}
        </div>
      </div>

      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-base font-bold text-slate-800">
          {isToday(selected) ? 'Today' : format(selected, 'EEEE, dd MMM')}
        </h3>
        {onBook && (
          <button onClick={() => onBook(selected)} className="btn-primary px-3 py-1.5 text-xs">
            <Plus className="h-4 w-4" /> Book
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-10 text-slate-300"><Spinner className="h-6 w-6" /></div>
      ) : dayClasses.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title={typeof emptyTitle === 'function' ? emptyTitle(selected) : emptyTitle}
          subtitle={typeof emptySubtitle === 'function' ? emptySubtitle(selected) : emptySubtitle}
        />
      ) : (
        <div className="space-y-3">
          {dayClasses.map((c) => {
            const actions = renderActions ? renderActions(c) : null
            return (
              <div key={c.id} className="card p-3.5">
                <div className="flex items-center gap-3">
                  <div className="flex w-14 shrink-0 flex-col items-center">
                    <span className="text-sm font-bold text-brand-600">{fmtTime(c.scheduled_at)}</span>
                    {c.duration_min && <span className="text-[10px] text-slate-400">{c.duration_min}m</span>}
                  </div>
                  <Avatar name={c.student_name} size={42} />
                  <div className="min-w-0 flex-1">
                    {onStudentClick ? (
                      <button
                        onClick={() => onStudentClick(c.student_id)}
                        className="text-left font-semibold text-slate-800 hover:text-brand-600 transition"
                      >
                        {c.student_name}
                      </button>
                    ) : (
                      <p className="truncate font-semibold text-slate-800">{c.student_name}</p>
                    )}
                    <p className="truncate text-xs text-slate-400">{subtitle ? subtitle(c) : c.vehicle_number || 'No vehicle'}</p>
                  </div>
                  {renderBadge ? renderBadge(c) : <Badge color={STATUS_COLOR[c.status]}>{c.status}</Badge>}
                </div>
                {actions && <div className="mt-3 flex items-center gap-2">{actions}</div>}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
