import { useState, useEffect, useMemo } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { ShieldCheck, Car, CheckCircle2, XCircle, Clock, ChevronRight, ArrowRight } from 'lucide-react'
import toast from 'react-hot-toast'
import { api } from '../lib/api'
import { PageHeader } from '../components/PageHeader'
import { fmtDate, fmtClock } from '../lib/format'
import WeekSchedule from '../components/WeekSchedule'
import { Badge, Spinner, Avatar, Segmented, SearchInput } from '../components/ui'
import DatePicker from '../components/DatePicker'

const STATUS_COLOR = { passed: 'green', failed: 'red', pending: 'blue' }
const STATUS_LABEL = { passed: 'Passed', failed: 'Failed', pending: 'Scheduled' }
const STATUS_ICON  = { passed: CheckCircle2, failed: XCircle, pending: Clock }

const TYPE_COLOR = { LL: 'violet', DL: 'cyan' }
const TYPE_ICON  = { LL: ShieldCheck, DL: Car }

export default function TestSchedule() {
  const navigate = useNavigate()
  const [viewMode, setViewMode] = useState('schedule') // 'schedule' | 'stages'
  const [students, setStudents] = useState([])
  const [stages, setStages] = useState([])
  const [loadingStages, setLoadingStages] = useState(false)
  const [activeStageId, setActiveStageId] = useState('')
  const [stagesQuery, setStagesQuery] = useState('')

  const monthRange = useMemo(() => {
    const today = new Date()
    const past = new Date()
    past.setDate(today.getDate() - 30)
    return {
      from: past.toISOString().slice(0, 10),
      to: today.toISOString().slice(0, 10)
    }
  }, [])

  const [fromDate, setFromDate] = useState(monthRange.from)
  const [toDate, setToDate] = useState(monthRange.to)

  const loadTests = (from, to) =>
    api.get(`/tests?from=${from}&to=${to}`).then(d => d.tests || [])

  const loadStagesData = async () => {
    setLoadingStages(true)
    try {
      const d = await api.get('/students')
      setStudents(d.students || [])
      setStages(d.stages || [])
    } catch (e) {
      toast.error('Failed to load stages data')
    } finally {
      setLoadingStages(false)
    }
  }

  useEffect(() => {
    if (viewMode === 'stages' && stages.length === 0) {
      loadStagesData()
    }
  }, [viewMode])

  useEffect(() => {
    if (stages.length > 0 && !activeStageId) {
      setActiveStageId(stages[0].id)
    }
  }, [stages, activeStageId])

  const getStageEntryDate = (student, stageId, stagesList) => {
    let progress = {}
    try {
      progress = typeof student.stage_progress === 'string'
        ? JSON.parse(student.stage_progress || '{}')
        : (student.stage_progress || {})
    } catch (e) {
      progress = {}
    }

    if (stageId === 'completed') {
      const lastStage = stagesList[stagesList.length - 1]
      return lastStage ? (progress[lastStage.id]?.date || null) : null
    }

    const idx = stagesList.findIndex(st => st.id === stageId)
    if (idx <= 0) {
      return student.joining_date || null
    }

    const prevStage = stagesList[idx - 1]
    return progress[prevStage.id]?.date || null
  }

  // Resolve LL stage ID dynamically based on name if default ID doesn't exist
  const llStageId = useMemo(() => {
    if (stages.some(st => st.id === 'stage_ll')) return 'stage_ll'
    const matched = stages.find(st => {
      const name = String(st.name || '').toLowerCase()
      return name.includes('ll') || name.includes('learner')
    })
    return matched ? matched.id : 'stage_ll'
  }, [stages])

  // Resolve DL stage ID dynamically based on name if default ID doesn't exist
  const dlStageId = useMemo(() => {
    if (stages.some(st => st.id === 'stage_dl')) return 'stage_dl'
    const matched = stages.find(st => {
      const name = String(st.name || '').toLowerCase()
      return name.includes('dl') || name.includes('driving') || name.includes('licence') || name.includes('license')
    })
    return matched ? matched.id : 'stage_dl'
  }, [stages])

  const getScheduledTestText = (s, stageId) => {
    if (stageId === llStageId && s.ll_status === 'pending' && s.ll_test_date) {
      return `Scheduled: ${fmtDate(s.ll_test_date)} ${s.ll_test_time ? `at ${fmtClock(s.ll_test_time)}` : ''}`
    }
    if (stageId === dlStageId && s.dl_status === 'pending' && s.dl_test_date) {
      return `Scheduled: ${fmtDate(s.dl_test_date)} ${s.dl_test_time ? `at ${fmtClock(s.dl_test_time)}` : ''}`
    }
    return null
  }

  const stageCounts = useMemo(() => {
    const map = {}
    stages.forEach(st => { map[st.id] = 0 })
    map['completed'] = 0

    const query = stagesQuery.trim().toLowerCase()
    students.forEach(s => {
      if (s.status !== 'active' || !s.opt_for_license) return

      // Search query filter
      if (query) {
        const matchesQuery =
          s.name?.toLowerCase().includes(query) ||
          s.phone?.toLowerCase().includes(query) ||
          s.email?.toLowerCase().includes(query)
        if (!matchesQuery) return
      }

      let progress = {}
      try {
        progress = typeof s.stage_progress === 'string'
          ? JSON.parse(s.stage_progress || '{}')
          : (s.stage_progress || {})
      } catch (e) {
        progress = {}
      }

      let currentStageId = 'completed'
      for (const stage of stages) {
        const sp = progress[stage.id]
        if (!sp || !sp.completed) {
          currentStageId = stage.id
          break
        }
      }

      // Apply fromDate/toDate filter based on stage entry date
      const dateToCheck = getStageEntryDate(s, currentStageId, stages)

      let matchesDate = true
      if (dateToCheck) {
        const datePart = dateToCheck.slice(0, 10)
        if (fromDate && datePart < fromDate) matchesDate = false
        if (toDate && datePart > toDate) matchesDate = false
      } else {
        if (fromDate || toDate) matchesDate = false
      }

      if (matchesDate) {
        map[currentStageId] = (map[currentStageId] || 0) + 1
      }
    })

    return map
  }, [students, stages, fromDate, toDate, stagesQuery])

  const filteredStudentsForStage = useMemo(() => {
    const query = stagesQuery.trim().toLowerCase()
    return students.filter(s => {
      if (s.status !== 'active' || !s.opt_for_license) return false

      // Search query filter
      if (query) {
        const matchesQuery =
          s.name?.toLowerCase().includes(query) ||
          s.phone?.toLowerCase().includes(query) ||
          s.email?.toLowerCase().includes(query)
        if (!matchesQuery) return false
      }

      let progress = {}
      try {
        progress = typeof s.stage_progress === 'string'
          ? JSON.parse(s.stage_progress || '{}')
          : (s.stage_progress || {})
      } catch (e) {
        progress = {}
      }

      let currentStageId = 'completed'
      for (const stage of stages) {
        const sp = progress[stage.id]
        if (!sp || !sp.completed) {
          currentStageId = stage.id
          break
        }
      }

      if (currentStageId !== activeStageId) return false

      // Apply fromDate/toDate filter based on stage entry date
      const dateToCheck = getStageEntryDate(s, activeStageId, stages)

      let matchesDate = true
      if (dateToCheck) {
        const datePart = dateToCheck.slice(0, 10)
        if (fromDate && datePart < fromDate) matchesDate = false
        if (toDate && datePart > toDate) matchesDate = false
      } else {
        if (fromDate || toDate) matchesDate = false
      }

      return matchesDate
    })
  }, [students, stages, activeStageId, fromDate, toDate, stagesQuery])

  const moveStudentToNextStage = async (s, currentStageId) => {
    let progress = {}
    try {
      progress = typeof s.stage_progress === 'string'
        ? JSON.parse(s.stage_progress || '{}')
        : (s.stage_progress || {})
    } catch (e) {
      progress = {}
    }

    const newProgress = { ...progress }
    newProgress[currentStageId] = {
      completed: true,
      date: new Date().toISOString().slice(0, 10),
      notes: 'Moved via Stages Pipeline'
    }

    try {
      await api.put(`/students/${s.id}`, { stage_progress: newProgress })
      toast.success(`Moved ${s.name} to next stage!`)
      loadStagesData()
    } catch (err) {
      toast.error(err.message || 'Failed to move stage')
    }
  }

  const renderStagesHub = () => {
    if (loadingStages) {
      return (
        <div className="flex h-60 items-center justify-center text-slate-400">
          <Spinner className="h-7 w-7" />
        </div>
      )
    }

    const allTabs = [
      ...stages,
      { id: 'completed', name: 'Completed' }
    ]

    return (
      <div className="space-y-4">
        {/* Responsive, stacked filter bar */}
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm space-y-3.5">
          {/* Stages pill navigation */}
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar py-0.5 w-full shrink-0">
            {allTabs.map((tab) => {
              const isActive = activeStageId === tab.id
              const count = stageCounts[tab.id] || 0
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveStageId(tab.id)}
                  className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition whitespace-nowrap shrink-0 ${
                    isActive
                      ? 'bg-brand-600 text-white shadow-sm'
                      : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {tab.name} {count > 0 && <span className={`ml-1 px-1.5 py-0.5 text-[9px] font-black rounded-full ${isActive ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-600'}`}>{count}</span>}
                </button>
              )
            })}
          </div>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pt-1">
            <div className="w-full sm:w-72">
              <SearchInput
                value={stagesQuery}
                onChange={setStagesQuery}
                placeholder="Search students in stage…"
              />
            </div>
            {/* Date range filters */}
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">From</span>
                <DatePicker
                  inputClassName="py-1.5 px-3 text-xs w-38 bg-slate-50 border-slate-200 rounded-xl"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">To</span>
                <DatePicker
                  inputClassName="py-1.5 px-3 text-xs w-38 bg-slate-50 border-slate-200 rounded-xl"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                />
              </div>
              <button
                type="button"
                disabled={!fromDate && !toDate}
                onClick={() => { setFromDate(''); setToDate('') }}
                className="rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 disabled:opacity-40 px-3.5 py-1.5 text-xs font-semibold transition active:scale-[.98]"
              >
                Clear
              </button>
            </div>
          </div>
        </div>

        {/* List of students for active stage */}
        <div className="space-y-2">
          {filteredStudentsForStage.length === 0 ? (
            <div className="card py-12 text-center text-sm text-slate-400 bg-white">
              {stagesQuery ? 'No students match the search query.' : 'No students in this stage for the selected timeframe.'}
            </div>
          ) : (
            filteredStudentsForStage.map((s) => {
              const nextStage = stages.find((st, index) => {
                const currIdx = stages.findIndex(item => item.id === activeStageId)
                return index === currIdx + 1
              })
              const nextStageName = nextStage ? nextStage.name : 'Completed'
              const scheduledText = getScheduledTestText(s, activeStageId)

              return (
                <div
                  key={s.id}
                  className="card flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 hover:border-slate-200 transition bg-white"
                >
                  {/* Link to Student profile */}
                  <Link
                    to={`/students/${s.id}`}
                    className="flex items-center gap-3 min-w-0 flex-1 hover:opacity-90 active:scale-[.99] transition"
                  >
                    <Avatar name={s.name} size={38} />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-xs text-slate-800 truncate">{s.name}</p>
                      <p className="text-[10px] text-slate-400 truncate mt-0.5">
                        {s.package_name || 'No package'} · {s.phone || 'No phone'}
                      </p>
                      {scheduledText && (
                        <div className="inline-flex items-center gap-1 mt-1 text-[9px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-100/70 w-fit">
                          <Clock className="h-3 w-3" /> {scheduledText}
                        </div>
                      )}
                    </div>
                    <ChevronRight className="h-4 w-4 text-slate-300 sm:hidden shrink-0" />
                  </Link>

                  {/* Move to next stage button */}
                  {activeStageId !== 'completed' && (
                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                      <button
                        onClick={() => moveStudentToNextStage(s, activeStageId)}
                        className="btn bg-brand-50 hover:bg-brand-100 text-brand-700 border border-brand-200/50 px-3 py-1.5 text-[10px] font-black rounded-xl flex items-center gap-1 shadow-sm active:scale-95 transition"
                      >
                        Move to: {nextStageName} <ArrowRight className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="page-enter">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
        <PageHeader
          title="Test &amp; Progress"
          subtitle="Test schedule &amp; student stages pipeline"
          className="mb-0"
        />
        <div className="shrink-0">
          <Segmented
            value={viewMode}
            onChange={setViewMode}
            options={[
              { value: 'schedule', label: 'Test Schedule' },
              { value: 'stages', label: 'Student Stages' }
            ]}
          />
        </div>
      </div>

      {viewMode === 'schedule' ? (
        <WeekSchedule
          load={loadTests}
          emptyTitle="No tests this day"
          emptySubtitle="No LL or DL tests scheduled"
          subtitle={(t) => {
            const parts = []
            if (t.instructor_name) parts.push(t.instructor_name)
            if (t.licence_number)  parts.push(t.licence_number)
            return parts.join(' · ') || 'No instructor assigned'
          }}
          renderBadge={(t) => {
            const TypeIcon   = TYPE_ICON[t.type]   || ShieldCheck
            const StatusIcon = STATUS_ICON[t.status] || Clock
            return (
              <div className="flex items-center gap-1.5">
                <Badge color={TYPE_COLOR[t.type] || 'gray'}>
                  <TypeIcon className="h-3 w-3" /> {t.type}
                </Badge>
                <Badge color={STATUS_COLOR[t.status] || 'gray'}>
                  <StatusIcon className="h-3 w-3" />
                  {STATUS_LABEL[t.status] || t.status || 'Unknown'}
                </Badge>
              </div>
            )
          }}
          renderActions={(t) => (
            <button
              onClick={() => navigate(`/students/${t.student_id}`)}
              className="btn-ghost flex-1 py-1.5 text-xs">
              View student
            </button>
          )}
        />
      ) : (
        renderStagesHub()
      )}
    </div>
  )
}
