import { useState } from 'react'
import toast from 'react-hot-toast'
import { useApi } from '../lib/useApi'
import { api } from '../lib/api'
import { inr, fmtDateTime, fmtDate } from '../lib/format'
import { Badge, Spinner, EmptyState, StatCard } from '../components/ui'
import { CalendarDays, Wallet, CheckCircle2, GraduationCap, Phone, ShieldCheck, Car, Check, FolderOpen, ClipboardList } from 'lucide-react'
import CertificateCard from '../components/CertificateCard'
import StudentDocuments from '../components/StudentDocuments'
import LLProfileCard from '../components/LLProfileCard'

const STATUS_COLOR = { scheduled: 'blue', attended: 'green', absent: 'red', cancelled: 'gray' }

export default function StudentPortal() {
  const { data, loading, reload } = useApi('/portal/me')
  const [certBusy, setCertBusy] = useState(false)
  const [tab, setTab] = useState('progress')
  const student  = data?.student
  const payments = data?.payments  || []
  const cert     = data?.certificate
  const documents = data?.documents || []

  const stages = data?.stages || []
  let progress = {}
  try {
    progress = student?.stage_progress
      ? (typeof student.stage_progress === 'string' ? JSON.parse(student.stage_progress || '{}') : student.stage_progress)
      : {}
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

  const now = Date.now()
  const asMs = (v) => new Date(v.includes('T') ? v : v.replace(' ', 'T')).getTime()
  const classes = data?.classes || []
  const upcoming = classes
    .filter((c) => asMs(c.scheduled_at) > now)
    .reverse()
  const recent = classes.filter((c) => asMs(c.scheduled_at) <= now)

  const generateCertificate = async () => {
    setCertBusy(true)
    try {
      await api.post('/portal/certificate')
      toast.success('Certificate ready')
      reload()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setCertBusy(false)
    }
  }

  if (loading) return <div className="flex h-[60vh] items-center justify-center"><Spinner className="h-7 w-7 text-slate-400" /></div>
  if (!student) return null

  const balance = student.balance ?? 0
  const pct = student.total_classes ? Math.min(100, Math.round((student.completed_classes / student.total_classes) * 100)) : 0

  // Licence students get tabs to keep the page short; others just see classes + certificate.
  const optLicense = !!student.opt_for_license
  const tabs = optLicense
    ? [
        { key: 'progress', label: 'Progress', icon: CheckCircle2 },
        { key: 'classes', label: 'Classes', icon: CalendarDays, count: upcoming.length },
        { key: 'licence', label: 'Licence', icon: ShieldCheck },
        { key: 'documents', label: 'Documents', icon: FolderOpen, count: documents.length },
        { key: 'profile', label: 'Profile', icon: ClipboardList },
      ]
    : []
  const activeTab = tabs.some((t) => t.key === tab) ? tab : (tabs[0]?.key || 'classes')
  const showProgress = !optLicense || activeTab === 'progress'
  const showClasses = !optLicense || activeTab === 'classes'

  return (
    <div className="page-enter space-y-5">
      {/* Progress */}
      <div className="card p-5">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-brand-50">
            <GraduationCap className="h-8 w-8 text-brand-600" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-slate-400">Package</p>
            <p className="truncate font-bold text-slate-800">{student.package_name || 'No package'}</p>
            {student.total_classes > 0 && (
              <p className="text-sm text-slate-500">{student.completed_classes} of {student.total_classes} classes done</p>
            )}
          </div>
        </div>
        {student.total_classes > 0 && (
          <div className="mt-4">
            <div className="h-2.5 rounded-full bg-slate-100">
              <div className="h-2.5 rounded-full bg-brand-500 transition-all" style={{ width: `${pct}%` }} />
            </div>
            <p className="mt-1 text-right text-xs font-bold text-brand-600">{pct}% complete</p>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard icon={CalendarDays} label="Upcoming classes" value={upcoming.length} tone="blue" />
        <StatCard icon={CheckCircle2} label="Classes attended" value={student.completed_classes || 0} tone="green" />
        <StatCard icon={Wallet}       label="Total paid"       value={inr(payments.reduce((s,p) => s + Number(p.amount), 0))} tone="violet" />
        <div className={`card flex items-center gap-3 p-4 ${balance > 0 ? 'border-amber-200 bg-amber-50' : ''}`}>
          <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${balance > 0 ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600'}`}>
            <Wallet className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xl font-extrabold">{inr(Math.max(0, balance))}</p>
            <p className="text-xs text-slate-400">{balance > 0 ? 'Balance due' : 'No dues ✓'}</p>
          </div>
        </div>
      </div>

      {/* Tab bar (licence students) */}
      {tabs.length > 0 && (
        <div className="flex gap-1 overflow-x-auto rounded-2xl bg-slate-100 p-1">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex shrink-0 items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-semibold transition ${
                activeTab === t.key ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <t.icon className="h-4 w-4" /> {t.label}
              {t.count != null && (
                <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${activeTab === t.key ? 'bg-brand-100 text-brand-700' : 'bg-slate-200 text-slate-500'}`}>
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Student Progress Pipeline */}
      {showProgress && !!student.opt_for_license && stages.length > 0 && (
        <div className="card p-5">
          <h2 className="mb-4 font-bold text-slate-800 flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-brand-600" />
            Your Progress Stages
          </h2>
          
          {/* Desktop/Tablet Horizontal Stepper */}
          <div className="hidden md:flex items-start justify-between relative w-full px-2 py-4">
            {/* Background line behind steps */}
            <div className="absolute top-[28px] left-[5%] right-[5%] h-0.5 bg-slate-100 -z-10" />
            
            {stages.map((stage, idx) => {
              const sp = progress[stage.id] || {}
              const isCompleted = !!sp.completed
              const isActive = currentStageId === stage.id
              
              return (
                <div key={stage.id} className="flex-1 flex flex-col items-center text-center px-1 relative">
                  {/* Step Connector Highlight */}
                  {idx > 0 && (
                    <div 
                      className={`absolute top-[12px] right-[50%] translate-y-[-50%] w-full h-0.5 -z-10 transition-all ${
                        isCompleted || (isActive && progress[stages[idx-1]?.id]?.completed) ? 'bg-emerald-500' : 'bg-slate-100'
                      }`}
                      style={{ right: '50%', width: '100%' }}
                    />
                  )}

                  {/* Step circle */}
                  <div className={`flex h-8 w-8 items-center justify-center rounded-full border-2 transition-all ${
                    isCompleted 
                      ? 'border-emerald-500 bg-emerald-500 text-white' 
                      : isActive 
                        ? 'border-brand-500 bg-brand-50 text-brand-600 font-bold ring-4 ring-brand-100'
                        : 'border-slate-200 bg-white text-slate-400'
                  }`}>
                    {isCompleted ? (
                      <Check className="h-4 w-4 stroke-[3]" />
                    ) : (
                      <span className="text-xs">{idx + 1}</span>
                    )}
                  </div>

                  {/* Text */}
                  <div className="mt-3">
                    <p className={`text-xs font-bold leading-tight ${
                      isCompleted ? 'text-slate-800' : isActive ? 'text-brand-600' : 'text-slate-400'
                    }`}>
                      {stage.name}
                    </p>
                    {isCompleted && sp.date && (
                      <p className="mt-1 text-[10px] text-slate-400 font-medium">
                        {fmtDate(sp.date)}
                      </p>
                    )}
                    {isCompleted && sp.notes && (
                      <p className="mt-1 text-[10px] text-slate-500 bg-slate-50 rounded px-1.5 py-0.5 inline-block max-w-[120px] truncate" title={sp.notes}>
                        {sp.notes}
                      </p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Mobile Vertical Stepper */}
          <div className="md:hidden space-y-4 pl-2 relative">
            {/* Vertical timeline line */}
            <div className="absolute left-[15px] top-2 bottom-2 w-0.5 bg-slate-100" />

            {stages.map((stage, idx) => {
              const sp = progress[stage.id] || {}
              const isCompleted = !!sp.completed
              const isActive = currentStageId === stage.id

              return (
                <div key={stage.id} className="relative flex items-start gap-4">
                  {/* Circle */}
                  <div className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 transition-all ${
                    isCompleted 
                      ? 'border-emerald-500 bg-emerald-500 text-white' 
                      : isActive 
                        ? 'border-brand-500 bg-brand-50 text-brand-600 font-bold ring-4 ring-brand-100'
                        : 'border-slate-200 bg-white text-slate-400'
                  }`}>
                    {isCompleted ? (
                      <Check className="h-4 w-4 stroke-[3]" />
                    ) : (
                      <span className="text-xs">{idx + 1}</span>
                    )}
                  </div>

                  {/* Content */}
                  <div className="min-w-0 flex-1 pt-1">
                    <p className={`text-sm font-bold ${
                      isCompleted ? 'text-slate-800' : isActive ? 'text-brand-600' : 'text-slate-500'
                    }`}>
                      {stage.name}
                    </p>
                    {isCompleted && (
                      <div className="mt-0.5 space-y-0.5">
                        <p className="text-xs text-slate-400">
                          Completed {fmtDate(sp.date)}
                        </p>
                        {sp.notes && (
                          <p className="text-xs text-slate-600 bg-slate-50 rounded-lg py-1 px-2.5 inline-block max-w-full whitespace-pre-wrap">
                            {sp.notes}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Licence & RTO Tests */}
      {activeTab === 'licence' && !!student.opt_for_license && (
        <div className="card p-5">
          <h2 className="mb-4 font-bold text-slate-800 flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-brand-600" />
            Licence &amp; RTO Tests
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Learner's Licence (LL) Section */}
            <div className="rounded-xl border border-slate-100 p-4 space-y-3 bg-slate-50/50">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4 text-violet-500" />
                  Learner's Licence (LL)
                </span>
                <Badge color={student.ll_status === 'passed' ? 'green' : student.ll_status === 'failed' ? 'red' : student.ll_status === 'pending' ? 'blue' : 'gray'}>
                  {student.ll_status ? (student.ll_status === 'pending' ? 'Scheduled' : student.ll_status) : 'Pending'}
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-y-2.5 gap-x-2 text-xs text-slate-600 pt-1">
                <div>
                  <p className="text-slate-400">Licence Number</p>
                  <p className="font-semibold text-slate-800 mt-0.5">{student.ll_number || 'Not issued'}</p>
                </div>
                <div>
                  <p className="text-slate-400">Expiry Date</p>
                  <p className="font-semibold text-slate-800 mt-0.5">{student.ll_expiry ? fmtDate(student.ll_expiry) : '-'}</p>
                </div>
                <div>
                  <p className="text-slate-400">Test Date</p>
                  <p className="font-semibold text-slate-800 mt-0.5">
                    {student.ll_test_date ? fmtDate(student.ll_test_date) : 'Not scheduled'}
                  </p>
                </div>
                <div>
                  <p className="text-slate-400">Test Time</p>
                  <p className="font-semibold text-slate-800 mt-0.5">
                    {student.ll_test_time || '-'}
                  </p>
                </div>
                {student.ll_instructor_name && (
                  <div className="col-span-2 pt-1 border-t border-slate-100">
                    <p className="text-slate-400">Assigned Examiner</p>
                    <p className="font-semibold text-slate-800 mt-0.5">{student.ll_instructor_name}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Driving Licence (DL) Section */}
            <div className="rounded-xl border border-slate-100 p-4 space-y-3 bg-slate-50/50">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                  <Car className="h-4 w-4 text-cyan-500" />
                  Driving Licence (DL)
                </span>
                <Badge color={student.dl_status === 'passed' ? 'green' : student.dl_status === 'failed' ? 'red' : student.dl_status === 'pending' ? 'blue' : 'gray'}>
                  {student.dl_status ? (student.dl_status === 'pending' ? 'Scheduled' : student.dl_status) : 'Pending'}
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-y-2.5 gap-x-2 text-xs text-slate-600 pt-1">
                <div>
                  <p className="text-slate-400">Licence Number</p>
                  <p className="font-semibold text-slate-800 mt-0.5">{student.dl_number || 'Not issued'}</p>
                </div>
                <div>
                  <p className="text-slate-400">Expiry Date</p>
                  <p className="font-semibold text-slate-800 mt-0.5">{student.dl_expiry ? fmtDate(student.dl_expiry) : '-'}</p>
                </div>
                <div>
                  <p className="text-slate-400">Test Date</p>
                  <p className="font-semibold text-slate-800 mt-0.5">
                    {student.dl_test_date ? fmtDate(student.dl_test_date) : 'Not scheduled'}
                  </p>
                </div>
                <div>
                  <p className="text-slate-400">Test Time</p>
                  <p className="font-semibold text-slate-800 mt-0.5">
                    {student.dl_test_time || '-'}
                  </p>
                </div>
                {student.dl_instructor_name && (
                  <div className="col-span-2 pt-1 border-t border-slate-100">
                    <p className="text-slate-400">Assigned Examiner</p>
                    <p className="font-semibold text-slate-800 mt-0.5">{student.dl_instructor_name}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* My Documents */}
      {activeTab === 'documents' && !!student.opt_for_license && (
        <div className="card p-5">
          <h2 className="mb-1 flex items-center gap-2 font-bold text-slate-800">
            <FolderOpen className="h-5 w-5 text-brand-600" />
            My Documents
          </h2>
          <p className="mb-4 text-sm text-slate-400">
            Upload the documents needed for your licence. Images or PDF, up to 10 MB each.
          </p>
          <StudentDocuments documents={documents} editable onReload={reload} />
        </div>
      )}

      {/* Profile details */}
      {activeTab === 'profile' && !!student.opt_for_license && (
        <LLProfileCard profile={student.ll_profile} editable onReload={reload} />
      )}

      {/* Certificate of Completion */}
      {showProgress && (
        <CertificateCard
          certificate={cert}
          eligible={student.status === 'completed'}
          canGenerate={student.status === 'completed'}
          busy={certBusy}
          onGenerate={generateCertificate}
        />
      )}

      {/* Upcoming classes */}
      {showClasses && (
      <div>
        <h2 className="mb-3 font-bold text-slate-800">Upcoming Classes</h2>
        {upcoming.length === 0 ? (
          <EmptyState icon={CalendarDays} title="No upcoming classes" subtitle="Your next class will appear here once booked." />
        ) : (
          <div className="space-y-3">
            {upcoming.map(c => (
              <div key={c.id} className="card p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-slate-800">{fmtDateTime(c.scheduled_at)}</p>
                    <p className="text-sm text-slate-400 truncate">
                      {c.instructor_name || 'No instructor'}
                      {c.instructor_phone ? ` (${c.instructor_phone})` : ''}
                      {` · ${c.vehicle_number || 'No vehicle'}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {c.instructor_phone && (
                      <a
                        href={`tel:${c.instructor_phone}`}
                        title="Call Instructor"
                        className="flex h-9 w-9 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-600 shadow-soft transition hover:bg-emerald-100 hover:text-emerald-700 active:scale-95"
                      >
                        <Phone className="h-4 w-4" />
                      </a>
                    )}
                    <Badge color="blue">Scheduled</Badge>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      )}

      {/* Recent history */}
      {showClasses && recent.length > 0 && (
        <div>
          <h2 className="mb-3 font-bold text-slate-800">Recent History</h2>
          <div className="space-y-2">
            {recent.slice(0, 10).map(c => (
              <div key={c.id} className="flex items-center gap-3 rounded-xl border border-slate-100 bg-white px-4 py-3">
                <div className="min-w-0 flex-1 text-sm">
                  <span className="font-medium text-slate-700">{fmtDate(c.scheduled_at)} at {c.duration_min}m</span>
                </div>
                <Badge color={STATUS_COLOR[c.status]}>{c.status}</Badge>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
