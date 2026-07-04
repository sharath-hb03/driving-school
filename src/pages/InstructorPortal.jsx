import { useCallback, useState, useEffect } from 'react'
import { format } from 'date-fns'
import { Check, X, CalendarDays, Clock, CalendarOff, Award, Download, Phone, ShieldCheck, Car, CheckCircle2, XCircle, Search, Wallet } from 'lucide-react'
import toast from 'react-hot-toast'
import { useApi } from '../lib/useApi'
import { api } from '../lib/api'
import { fmtDate, fmtClock, formatWorkDays, inr } from '../lib/format'
import { PageLoader, EmptyState, Badge, Spinner } from '../components/ui'
import WeekSchedule from '../components/WeekSchedule'
import Modal from '../components/Modal'

const TABS = [
  { value: 'calendar', label: 'Calendar' },
  { value: 'tests', label: 'Tests' },
  { value: 'students', label: 'Students' }
]
const STUDENT_STATUS_COLOR = { completed: 'blue', active: 'green', inactive: 'gray' }
const asMs = (v) => new Date(v.includes('T') ? v : v.replace(' ', 'T')).getTime()
const offLabel = (t) =>
  t.start_date === t.end_date ? fmtDate(t.start_date, 'd MMM') : `${fmtDate(t.start_date, 'd MMM')} – ${fmtDate(t.end_date, 'd MMM')}`

const TEST_STATUS_COLOR = { passed: 'green', failed: 'red', pending: 'blue' }
const TEST_STATUS_LABEL = { passed: 'Passed', failed: 'Failed', pending: 'Scheduled' }
const TEST_STATUS_ICON  = { passed: CheckCircle2, failed: XCircle, pending: Clock }

const TYPE_COLOR = { LL: 'violet', DL: 'cyan' }
const TYPE_ICON  = { LL: ShieldCheck, DL: Car }

export default function InstructorPortal() {
  const { data, loading, reload } = useApi('/portal/me')
  const [signal, setSignal] = useState(0)
  const [tab, setTab] = useState('calendar')
  const [certBusyId, setCertBusyId] = useState(null)
  const [selectedStudentId, setSelectedStudentId] = useState(null)
  const [studentModalOpen, setStudentModalOpen] = useState(false)
  const [search, setSearch] = useState('')

  const openStudentDetails = (studentId) => {
    setSelectedStudentId(studentId)
    setStudentModalOpen(true)
  }

  // The week calendar pulls fresh data each time so marks reflect instantly.
  const loadWeek = useCallback(
    (from, to) =>
      api.get('/portal/me').then((d) => {
        const lo = new Date(from).getTime()
        const hi = new Date(to).getTime()
        return (d.classes || []).filter((c) => asMs(c.scheduled_at) >= lo && asMs(c.scheduled_at) <= hi)
      }),
    []
  )

  const loadTests = useCallback(
    (from, to) => {
      if (!data?.tests) return Promise.resolve([])
      const lo = new Date(from.slice(0, 10)).getTime()
      const hi = new Date(to.slice(0, 10)).getTime()
      const list = (data.tests || [])
        .map((r) => ({
          ...r,
          scheduled_at: `${r.date}T${r.time || '09:00'}`
        }))
        .filter((r) => {
          const testTime = new Date(r.date).getTime()
          return testTime >= lo && testTime <= hi
        })
      return Promise.resolve(list.sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at)))
    },
    [data?.tests]
  )

  const mark = async (cls, status) => {
    try {
      await api.put(`/portal/classes/${cls.id}`, { status })
      toast.success(status === 'attended' ? 'Marked present' : 'Marked absent')
      setSignal((s) => s + 1)
    } catch (err) {
      toast.error(err.message)
    }
  }

  const issueCert = async (studentId) => {
    setCertBusyId(studentId)
    try {
      await api.post('/portal/certificate', { student_id: studentId })
      toast.success('Certificate ready')
      reload()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setCertBusyId(null)
    }
  }

  if (loading) return <PageLoader />
  if (!data?.instructor) return <EmptyState title="Account not found" subtitle="Ask the office to check your login." />

  const inst = data.instructor
  const classes = data.classes || []
  const todayKey = format(new Date(), 'yyyy-MM-dd')
  const todayCount = classes.filter((c) => c.status === 'scheduled' && String(c.scheduled_at).slice(0, 10) === todayKey).length
  const timeoff = data.timeoff || []
  const holidays = data.holidays || []
  const students = data.students || []
  const getDayOffInfo = (date) => {
    const dateStr = format(date, 'yyyy-MM-dd')
    
    const holiday = holidays.find(h => h.date === dateStr)
    if (holiday) {
      return { isOff: true, title: 'School Holiday', subtitle: `${holiday.name} — school is closed today.` }
    }

    const leave = timeoff.find(t => {
      const start = t.start_date
      const end = t.end_date
      return dateStr >= start && dateStr <= end
    })
    if (leave) {
      return { isOff: true, title: 'Your Leave/Time-off', subtitle: leave.reason ? `Off-duty: ${leave.reason}` : 'You have taken time off today.' }
    }

    const dayOfWeekNum = date.getDay() === 0 ? 7 : date.getDay()
    const isWorkingDay = inst.work_days.split(',').map(Number).includes(dayOfWeekNum)
    if (!isWorkingDay) {
      return { isOff: true, title: 'Off Duty Day', subtitle: 'This is your scheduled day off.' }
    }

    return { isOff: false }
  }

  const filteredStudents = students.filter(st => {
    const q = search.toLowerCase()
    return (st.name || '').toLowerCase().includes(q) ||
           (st.phone || '').toLowerCase().includes(q) ||
           (st.email || '').toLowerCase().includes(q)
  })

  const calActions = (c) => {
    const hasPhone = !!c.student_phone
    const isScheduled = c.status === 'scheduled'
    if (!hasPhone && !isScheduled) return null
    return (
      <>
        {hasPhone && (
          <a href={`tel:${c.student_phone}`} className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-blue-50 py-2 text-xs font-semibold text-blue-700">
            <Phone className="h-4 w-4" /> Call
          </a>
        )}
        {isScheduled && (
          <>
            <button onClick={() => mark(c, 'attended')} className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-emerald-50 py-2 text-xs font-semibold text-emerald-700">
              <Check className="h-4 w-4" /> Present
            </button>
            <button onClick={() => mark(c, 'absent')} className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-red-50 py-2 text-xs font-semibold text-red-700">
              <X className="h-4 w-4" /> Absent
            </button>
          </>
        )}
      </>
    )
  }

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="card p-5">
        <h1 className="text-xl font-extrabold text-slate-900">{inst.name}</h1>
        <p className="mt-1 flex items-center gap-2 text-sm text-slate-500">
          <CalendarDays className="h-4 w-4 text-slate-400" />
          {todayCount} {todayCount === 1 ? 'lesson' : 'lessons'} today
        </p>
      </div>

      {/* Tabs */}
      <div className="flex rounded-xl bg-slate-100 p-1">
        {TABS.map((t) => (
          <button
            key={t.value}
            onClick={() => setTab(t.value)}
            className={`flex-1 rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
              tab === t.value ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'calendar' && (
        <div className="lg:grid lg:grid-cols-[1fr_320px] lg:items-start lg:gap-6">
          <div className="min-w-0">
            <WeekSchedule
              load={loadWeek}
              reloadSignal={signal}
              subtitle={(c) => c.vehicle_number || 'No vehicle'}
              renderActions={calActions}
              onStudentClick={openStudentDetails}
              emptyTitle={(date) => {
                const offInfo = getDayOffInfo(date)
                return offInfo.isOff ? offInfo.title : 'No classes this day'
              }}
              emptySubtitle={(date) => {
                const offInfo = getDayOffInfo(date)
                return offInfo.isOff ? offInfo.subtitle : 'Nothing scheduled — enjoy the break.'
              }}
            />
          </div>

          <aside className="mt-4 lg:mt-0">
            {/* Availability — read-only; the office manages this */}
            <div className="card space-y-4 p-5">
              <h2 className="font-bold text-slate-800">Availability</h2>

              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                  <Clock className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-800">{formatWorkDays(inst.work_days)}</p>
                  <p className="text-xs text-slate-400">{fmtClock(inst.work_start || '06:00')} – {fmtClock(inst.work_end || '20:00')}</p>
                </div>
              </div>

              <div>
                <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  <CalendarOff className="h-3.5 w-3.5" /> Your time off
                </p>
                {timeoff.length === 0 ? (
                  <p className="text-xs text-slate-400">No leave scheduled. Ask the office to add any.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {timeoff.map((t) => (
                      <span key={t.id} className="chip bg-amber-100 text-amber-700">
                        {offLabel(t)}{t.reason ? ` · ${t.reason}` : ''}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {holidays.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Upcoming holidays</p>
                  <div className="flex flex-wrap gap-2">
                    {holidays.map((h) => (
                      <span key={h.id} className="chip bg-red-100 text-red-700">{fmtDate(h.date, 'd MMM')} · {h.name}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </aside>
        </div>
      )}

      {tab === 'tests' && (
        <WeekSchedule
          load={loadTests}
          reloadSignal={signal}
          emptyTitle="No tests this day"
          emptySubtitle="No LL or DL tests scheduled for you."
          subtitle={(t) => t.licence_number || ''}
          onStudentClick={openStudentDetails}
          renderBadge={(t) => {
            const TypeIcon   = TYPE_ICON[t.type]   || ShieldCheck
            const StatusIcon = TEST_STATUS_ICON[t.status] || Clock
            return (
              <div className="flex items-center gap-1.5">
                <Badge color={TYPE_COLOR[t.type] || 'gray'}>
                  <TypeIcon className="h-3 w-3" /> {t.type}
                </Badge>
                <Badge color={TEST_STATUS_COLOR[t.status] || 'gray'}>
                  <StatusIcon className="h-3 w-3" />
                  {TEST_STATUS_LABEL[t.status] || t.status || 'Unknown'}
                </Badge>
              </div>
            )
          }}
          renderActions={(t) => t.student_phone && (
            <a href={`tel:${t.student_phone}`} className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-blue-50 py-2 text-xs font-semibold text-blue-700">
              <Phone className="h-4 w-4" /> Call
            </a>
          )}
        />
      )}

      {tab === 'students' && (
        <div className="card p-5">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="font-bold text-slate-800">Students</h2>
            <div className="relative flex-1 max-w-sm">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                <Search className="h-4 w-4" />
              </span>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search students..."
                className="w-full rounded-xl border border-slate-200 py-1.5 pl-9 pr-4 text-sm focus:border-brand-500 focus:outline-none"
              />
            </div>
          </div>
          {filteredStudents.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400">
              {search ? 'No students match your search.' : 'No students assigned to you yet.'}
            </p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {filteredStudents.map((st) => (
                <button
                  key={st.id}
                  onClick={() => openStudentDetails(st.id)}
                  className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-100 bg-white p-3.5 text-left hover:border-brand-200 hover:shadow-sm transition"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-850 hover:text-brand-600 transition">{st.name}</p>
                    <div className="mt-1 flex items-center gap-2 text-xs text-slate-400">
                      <Badge color={STUDENT_STATUS_COLOR[st.status] || 'gray'}>{st.status}</Badge>
                      {st.total_classes > 0 && <span>{st.completed_classes}/{st.total_classes} lessons</span>}
                      {st.phone && <span>· {st.phone}</span>}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Student Details Modal */}
      <StudentDetailModal
        open={studentModalOpen}
        onClose={() => setStudentModalOpen(false)}
        studentId={selectedStudentId}
      />
    </div>
  )
}

function StudentDetailModal({ open, onClose, studentId }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!open || !studentId) {
      setData(null)
      return
    }
    let active = true
    setLoading(true)
    setError(null)
    api.get(`/portal/students/${studentId}`)
      .then((res) => {
        if (active) setData(res)
      })
      .catch((err) => {
        if (active) setError(err.message)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [open, studentId])

  if (!open) return null

  const student = data?.student
  const payments = data?.payments || []
  const classes = data?.classes || []

  return (
    <Modal open={open} onClose={onClose} title="Student Details" size="lg"
      footer={<button onClick={onClose} className="btn-ghost w-full">Close</button>}>
      {loading ? (
        <div className="flex h-48 items-center justify-center text-slate-400">
          <Spinner className="h-7 w-7" />
        </div>
      ) : error ? (
        <p className="text-center text-sm text-red-500 py-6">{error}</p>
      ) : !student ? (
        <p className="text-center text-sm text-slate-400 py-6">No data found</p>
      ) : (
        <div className="space-y-4">
          {/* Header Profile */}
          <div className="flex items-center gap-4 border-b border-slate-100 pb-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-600 text-lg font-bold">
              {student.name ? student.name[0].toUpperCase() : ''}
            </div>
            <div>
              <h4 className="text-lg font-extrabold text-slate-900">{student.name}</h4>
              <div className="mt-1 flex flex-wrap gap-1.5">
                <Badge color={student.license_type === '2W' ? 'violet' : 'blue'}>{student.license_type}</Badge>
                <Badge color={student.status === 'active' ? 'green' : student.status === 'completed' ? 'cyan' : 'gray'}>{student.status}</Badge>
              </div>
            </div>
          </div>

          {/* Quick Info Grid */}
          <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-xs text-slate-400">Phone</dt>
              <dd className="font-semibold text-slate-700">
                {student.phone ? (
                  <a href={`tel:${student.phone}`} className="text-brand-600 hover:underline">{student.phone}</a>
                ) : '-'}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-400">Email</dt>
              <dd className="font-medium text-slate-700 truncate">{student.email || '-'}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-400">Joined</dt>
              <dd className="font-medium text-slate-700">
                {student.joining_date ? fmtDate(student.joining_date) : '-'}
              </dd>
            </div>
            <div className="col-span-2 sm:col-span-3">
              <dt className="text-xs text-slate-400">Address</dt>
              <dd className="font-medium text-slate-700">{student.address || '-'}</dd>
            </div>
          </dl>

          {/* Progress Section */}
          <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3">
            <h5 className="text-xs font-bold uppercase tracking-wider text-slate-400">Package Progress</h5>
            <p className="mt-1 text-sm font-semibold text-slate-700">{student.package_name || 'No package'}</p>
            {student.total_classes > 0 && (
              <div className="mt-2">
                <div className="flex justify-between text-xs text-slate-500 mb-1">
                  <span>{student.completed_classes} of {student.total_classes} classes done</span>
                  <span className="font-bold text-brand-600">
                    {Math.round((student.completed_classes / student.total_classes) * 100)}%
                  </span>
                </div>
                <div className="h-2 rounded-full bg-slate-200">
                  <div className="h-2 rounded-full bg-brand-500 transition-all" style={{ width: `${Math.min(100, (student.completed_classes / student.total_classes) * 100)}%` }} />
                </div>
              </div>
            )}
          </div>

          {/* Licence / RTO tests */}
          <div className="rounded-xl border border-slate-100 p-3 space-y-3">
            <h5 className="text-xs font-bold uppercase tracking-wider text-slate-400">Licence / RTO Tests</h5>
            
            {/* LL */}
            <div className="border-b border-slate-100 pb-2">
              <p className="text-xs font-semibold text-slate-650">Learner's Licence (LL)</p>
              <div className="mt-1 grid grid-cols-2 gap-1.5 text-xs text-slate-600">
                <p>Status: <span className="font-bold uppercase text-slate-700">{student.ll_status || 'Pending'}</span></p>
                <p>No: <span className="font-medium text-slate-700">{student.ll_number || '-'}</span></p>
                {student.ll_test_date && <p>Test: {fmtDate(student.ll_test_date)} {student.ll_test_time || ''}</p>}
                {student.ll_expiry && <p>Expiry: {fmtDate(student.ll_expiry)}</p>}
                {student.ll_instructor_name && <p className="col-span-2">Examiner: {student.ll_instructor_name}</p>}
              </div>
            </div>

            {/* DL */}
            <div>
              <p className="text-xs font-semibold text-slate-650">Driving Licence (DL)</p>
              <div className="mt-1 grid grid-cols-2 gap-1.5 text-xs text-slate-600">
                <p>Status: <span className="font-bold uppercase text-slate-700">{student.dl_status || 'Pending'}</span></p>
                <p>No: <span className="font-medium text-slate-700">{student.dl_number || '-'}</span></p>
                {student.dl_test_date && <p>Test: {fmtDate(student.dl_test_date)} {student.dl_test_time || ''}</p>}
                {student.dl_expiry && <p>Expiry: {fmtDate(student.dl_expiry)}</p>}
                {student.dl_instructor_name && <p className="col-span-2">Examiner: {student.dl_instructor_name}</p>}
              </div>
            </div>
          </div>

          {/* Fees summary */}
          <div className="rounded-xl border border-slate-100 p-3">
            <h5 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Fees Status</h5>
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="rounded-lg bg-slate-50 p-2">
                <p className="text-slate-400">Total Fee</p>
                <p className="font-bold text-slate-700">{student.package_fee ? inr(student.net_fee) : '-'}</p>
              </div>
              <div className="rounded-lg bg-emerald-50 p-2">
                <p className="text-emerald-600">Paid</p>
                <p className="font-bold text-emerald-700">{inr(student.paid || 0)}</p>
              </div>
              <div className={`rounded-lg p-2 ${student.balance > 0 ? 'bg-amber-50' : 'bg-slate-50'}`}>
                <p className={student.balance > 0 ? 'text-amber-600' : 'text-slate-400'}>Balance</p>
                <p className={`font-bold ${student.balance > 0 ? 'text-amber-700' : 'text-slate-700'}`}>{inr(student.balance || 0)}</p>
              </div>
            </div>
          </div>

          {/* Recent/Past classes list */}
          <div>
            <h5 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Class History</h5>
            {classes.length === 0 ? (
              <p className="text-center text-xs text-slate-400 py-3">No classes booked yet.</p>
            ) : (
              <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                {classes.map((c) => (
                  <div key={c.id} className="flex items-center justify-between gap-2 rounded-lg bg-slate-50/70 p-2 text-xs">
                    <div>
                      <p className="font-semibold text-slate-700">{fmtDate(c.scheduled_at)} ({c.duration_min}m)</p>
                      <p className="text-slate-400">{c.instructor_name} · {c.vehicle_number}</p>
                    </div>
                    <Badge color={c.status === 'attended' ? 'green' : c.status === 'absent' ? 'red' : c.status === 'cancelled' ? 'gray' : 'blue'}>
                      {c.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </Modal>
  )
}
