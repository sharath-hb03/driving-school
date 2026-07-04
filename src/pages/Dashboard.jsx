import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  Users, UserCheck, CalendarDays, Wallet, Phone, ChevronRight, Car, ShieldAlert,
  GraduationCap, UserPlus, CheckCircle2, CalendarClock, TrendingUp, TrendingDown, MessageCircle,
  MessageSquare, FileText
} from 'lucide-react'
import { useApi } from '../lib/useApi'
import { inr, fmtTime, fmtDate, todayStr } from '../lib/format'
import { useAuth } from '../context/AuthContext'
import { Avatar, Badge, EmptyState, SkeletonList, StatCard } from '../components/ui'
import { docTypeShort, expiryStatus } from '../lib/vehicleDocs'

const STATUS_COLOR = { scheduled: 'blue', attended: 'green', absent: 'red', cancelled: 'gray' }

export default function Dashboard() {
  const { user } = useAuth()
  const today = todayStr()
  const { data, loading } = useApi(`/dashboard?date=${today}`)
  const stats = data?.stats
  const classes = data?.todayClasses || []
  const expiringDocs = data?.expiringDocs || []
  const recentLeads = data?.recentLeads || []

  const greeting = useMemo(() => {
    const h = new Date().getHours()
    return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
  }, [])

  const trend = useMemo(() => {
    if (!stats) return null
    const cur = stats.collectedThisMonth || 0
    const prev = stats.collectedLastMonth || 0
    if (prev === 0) return cur > 0 ? { up: true, pct: null } : null
    const pct = Math.round(((cur - prev) / prev) * 100)
    return { up: pct >= 0, pct: Math.abs(pct) }
  }, [stats])

  const leadConvRate = useMemo(() => {
    if (!stats) return null
    const total = stats.leadsThisMonth || 0
    const conv = stats.leadsConvertedThisMonth || 0
    return total > 0 ? Math.round((conv / total) * 100) : 0
  }, [stats])

  const getWhatsAppLink = (e) => {
    const schoolName = user?.school_name || 'our driving school'
    const text = `Hi ${e.name}, thank you for contacting ${schoolName}! We received your enquiry and would love to help you get started with your driving lessons. When is a good time to speak?`
    const cleanedPhone = e.phone.replace(/\D/g, '')
    const phoneWithCountry = cleanedPhone.length === 10 ? `91${cleanedPhone}` : cleanedPhone
    return `https://wa.me/${phoneWithCountry}?text=${encodeURIComponent(text)}`
  }

  return (
    <div className="page-enter pb-8">
      {/* Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <p className="text-sm text-slate-400">{greeting},</p>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">{user?.name || 'Admin'} 👋</h1>
          {user?.school_name && <p className="mt-0.5 text-xs font-semibold text-brand-600 uppercase tracking-wider">{user.school_name}</p>}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Item 1: Primary KPIs */}
        <div className="lg:col-span-3 order-1 lg:order-1">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {loading && !stats ? (
              Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton h-[76px]" />)
            ) : <>
              <StatCard 
                icon={Users} 
                label="Active Learners" 
                value={stats?.activeLearners ?? 0} 
                subtitle={`Total: ${stats?.totalStudents ?? 0}`} 
                tone="blue" 
                to="/students" 
              />
              <StatCard 
                icon={CalendarDays} 
                label="Today's Classes" 
                value={stats?.todayClasses ?? 0} 
                subtitle={`Tests: ${stats?.upcomingTests7d ?? 0} scheduled`} 
                tone="violet" 
                to="/schedule" 
              />
              <StatCard 
                icon={Wallet} 
                label="Pending Payments" 
                value={stats?.pendingPaymentsCount ?? 0} 
                subtitle={`${inr(stats?.pendingPaymentsAmount ?? 0)} due`} 
                tone="amber" 
                to="/payments" 
              />
              <StatCard 
                icon={MessageCircle} 
                label="New Enquiries" 
                value={stats?.newEnquiries ?? 0} 
                subtitle={`${stats?.leadsThisMonth ?? 0} this month`} 
                tone="rose" 
                to="/enquiries" 
              />
            </>}
          </div>
        </div>

        {/* Item 2: Business Vitals (Right Side on Desktop, 2nd Place on Mobile) */}
        <div className="lg:col-span-1 order-2 lg:order-4 space-y-4">
          <h2 className="text-lg font-bold text-slate-800 px-1">Business Vitals</h2>
          {stats && (
            <div className="space-y-3">
              <div className="card p-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-slate-400">Collected this month</p>
                  {trend && (
                    <span className={`flex items-center gap-0.5 text-[11px] font-bold ${trend.up ? 'text-emerald-600' : 'text-rose-500'}`}>
                      {trend.up ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                      {trend.pct == null ? 'new' : `${trend.pct}%`}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xl font-extrabold text-emerald-600">{inr(stats.collectedThisMonth)}</p>
                <p className="mt-0.5 text-[10px] text-slate-400">vs {inr(stats.collectedLastMonth)} last month</p>
              </div>

              <div className="card p-4">
                <p className="text-xs font-medium text-slate-400">Due to collect</p>
                <p className="mt-1 text-xl font-extrabold text-amber-600">{inr(stats.pendingPaymentsAmount)}</p>
                <p className="mt-0.5 text-[10px] text-slate-400">{stats.pendingPaymentsCount} student(s) pending</p>
              </div>

              <div className="card flex items-center gap-3 p-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
                  <Car className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-slate-700 truncate">{stats.vehiclesAvailable}/{stats.vehiclesTotal} vehicles free</p>
                  <p className="text-[11px] text-slate-400 truncate">{stats.instructorsActive} active instructor(s)</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Item 3: This Month's Performance Consolidated Card */}
        {stats && (
          <div className="lg:col-span-3 order-3 lg:order-2">
            <p className="section-title">This Month's Performance</p>
            <div className="card p-5 grid grid-cols-1 gap-6 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-slate-100">
              {/* Group 1: Learners */}
              <div className="space-y-4">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Learners</h3>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-50 text-cyan-600">
                    <UserPlus className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-base font-extrabold text-slate-800">{stats.newStudentsThisMonth}</p>
                    <p className="text-xs text-slate-400 truncate">New Admissions</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
                    <GraduationCap className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-base font-extrabold text-slate-800">{stats.attendanceRate == null ? '—' : `${stats.attendanceRate}%`}</p>
                    <p className="text-xs text-slate-400 truncate">Class Attendance</p>
                  </div>
                </div>
              </div>

              {/* Group 2: Classes */}
              <div className="space-y-4 sm:pl-6">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Classes</h3>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                    <CheckCircle2 className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-base font-extrabold text-slate-800">{stats.lessonsCompletedThisMonth}</p>
                    <p className="text-xs text-slate-400 truncate">Lessons Completed</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                    <CalendarClock className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-base font-extrabold text-slate-800">{stats.upcomingClasses7d}</p>
                    <p className="text-xs text-slate-400 truncate">Scheduled next 7 days</p>
                  </div>
                </div>
              </div>

              {/* Group 3: Leads */}
              <div className="space-y-4 sm:pl-6">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Marketing (Leads)</h3>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                    <MessageSquare className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-base font-extrabold text-slate-800">{stats.leadsThisMonth}</p>
                    <p className="text-xs text-slate-400 truncate">Leads Received</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                    <TrendingUp className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-base font-extrabold text-slate-800">{leadConvRate == null ? '—' : `${leadConvRate}%`}</p>
                    <p className="text-xs text-slate-400 truncate">Leads Converted</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Item 4: Today's Schedule (Left Side on Desktop, 4th Place on Mobile) */}
        <div className="lg:col-span-2 order-4 lg:order-3">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-800">Today's schedule</h2>
          </div>
          {loading ? <SkeletonList count={3} /> : classes.length === 0 ? (
            <EmptyState icon={CalendarDays} title="No classes today" subtitle="Enjoy the breather, or schedule a new class."
              action={<Link to="/schedule" className="btn-primary">Go to schedule</Link>} />
          ) : (
            <div className="space-y-3">
              {classes.map((c) => (
                <div key={c.id} className="card flex items-center gap-3 p-3.5">
                  <Avatar name={c.student_name} size={44} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-slate-800">{c.student_name}</p>
                    <p className="truncate text-xs text-slate-400">
                      {fmtTime(c.scheduled_at)} · {c.instructor_name || 'No instructor'}
                      {c.vehicle_number ? ` · ${c.vehicle_number}` : ''}
                    </p>
                  </div>
                  <Badge color={STATUS_COLOR[c.status]}>{c.status}</Badge>
                  {c.student_phone && (
                    <a href={`tel:${c.student_phone}`} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100">
                      <Phone className="h-4 w-4" />
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
          <div className="mt-4">
            <Link to="/schedule" className="flex items-center justify-center gap-1 text-sm font-semibold text-brand-600">
              View full calendar <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </div>

        {/* Item 5: Recent active leads (Left Side on Desktop, 5th Place on Mobile) */}
        {recentLeads.length > 0 && (
          <div className="lg:col-span-2 order-5 lg:order-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-800">Recent active leads</h2>
              <Link to="/enquiries" className="text-sm font-semibold text-brand-600">View all</Link>
            </div>
            <div className="space-y-3">
              {recentLeads.map((e) => (
                <div key={e.id} className="card flex items-center justify-between gap-3 p-3.5">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-semibold text-slate-800">{e.name}</p>
                      <Badge color={e.source === 'manual' ? 'amber' : 'rose'}>
                        {e.source === 'manual' ? 'Walk-in' : 'Web'}
                      </Badge>
                    </div>
                    <p className="truncate text-xs text-slate-400">
                      {e.phone} · {fmtDate(e.created_at)}
                    </p>
                  </div>
                  
                  <div className="flex gap-2 shrink-0">
                    <a href={`tel:${e.phone}`} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100" title="Call">
                      <Phone className="h-4 w-4" />
                    </a>
                    <a href={getWhatsAppLink(e)} target="_blank" rel="noopener noreferrer" className="rounded-lg p-2 text-emerald-500 hover:bg-emerald-50" title="WhatsApp">
                      <MessageSquare className="h-4 w-4" />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Item 6: Renewals (Right Side on Desktop, 6th Place on Mobile) */}
        {expiringDocs.length > 0 && (
          <div className="lg:col-span-1 order-6 lg:order-6">
            <div className="mb-3 flex items-center justify-between px-1">
              <h2 className="flex items-center gap-2 text-base font-bold text-slate-800">
                <ShieldAlert className="h-4.5 w-4.5 text-amber-500" /> Renewals
              </h2>
              <Link to="/vehicles" className="text-xs font-semibold text-brand-600">Manage</Link>
            </div>
            <div className="overflow-hidden rounded-2xl border border-amber-200 bg-amber-50/60">
              {expiringDocs.map((d, i) => {
                const st = expiryStatus(d.expiry_date)
                return (
                  <Link to="/vehicles" key={`${d.vehicle_number}-${d.doc_type}-${i}`}
                    className={`flex items-center gap-3 px-4 py-3 transition hover:bg-amber-100/60 ${i > 0 ? 'border-t border-amber-200/70' : ''}`}>
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-amber-600 shrink-0">
                      <Car className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-800">{d.vehicle_number}</p>
                      <p className="text-xs text-slate-500 truncate">{docTypeShort(d.doc_type)} · valid till {fmtDate(d.expiry_date)}</p>
                    </div>
                    <Badge color={st.tone}>{st.label}</Badge>
                  </Link>
                )
              })}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
