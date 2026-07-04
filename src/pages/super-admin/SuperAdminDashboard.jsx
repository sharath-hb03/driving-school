import { Link } from 'react-router-dom'
import { Building2, Users, Wallet, CalendarDays, TrendingUp, Plus } from 'lucide-react'
import { useApi } from '../../lib/useApi'
import { inr, fmtDate } from '../../lib/format'
import { Badge, Spinner, StatCard } from '../../components/ui'

export default function SuperAdminDashboard() {
  const { data, loading } = useApi('/super-admin/dashboard')
  const stats   = data?.stats
  const schools = data?.schools || []

  if (loading) return (
    <div className="flex h-[60vh] items-center justify-center"><Spinner className="h-7 w-7 text-slate-400" /></div>
  )

  return (
    <div className="page-enter">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Platform Overview</h1>
        <p className="mt-0.5 text-sm text-slate-400">All schools · {fmtDate(new Date())}</p>
      </div>

      {/* Top stats */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard icon={Building2}    label="Total schools"      value={stats?.totalSchools ?? 0}      tone="blue" />
        <StatCard icon={Building2}    label="Active schools"     value={stats?.activeSchools ?? 0}     tone="green" />
        <StatCard icon={Building2}    label="Suspended"          value={stats?.suspendedSchools ?? 0}  tone="rose" />
        <StatCard icon={Users}        label="Total students"     value={stats?.totalStudents ?? 0}      tone="violet" />
        <StatCard icon={CalendarDays} label="Classes today"      value={stats?.classesToday ?? 0}       tone="cyan" />
        <StatCard icon={Wallet}       label="Revenue this month" value={inr(stats?.revenueThisMonth)}  tone="amber" />
      </div>

      {/* Schools table */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-bold text-slate-800">Schools</h2>
        <Link to="/super-admin/schools" className="btn-primary px-3 py-1.5 text-xs">
          <Plus className="h-4 w-4" /> Add school
        </Link>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                <th className="px-4 py-3">School</th>
                <th className="px-4 py-3 text-right">Students</th>
                <th className="px-4 py-3 text-right">Instructors</th>
                <th className="px-4 py-3 text-right">Revenue</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {schools.map(s => (
                <tr key={s.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <p className="font-semibold text-slate-800">{s.name}</p>
                    <p className="text-xs text-slate-400">{s.admin_email || s.email || s.slug}</p>
                  </td>
                  <td className="px-4 py-3 text-right font-medium">{s.student_count}</td>
                  <td className="px-4 py-3 text-right font-medium">{s.instructor_count}</td>
                  <td className="px-4 py-3 text-right font-medium text-emerald-600">{inr(s.revenue_this_month)}</td>
                  <td className="px-4 py-3">
                    <Badge color={s.active ? 'green' : 'red'}>{s.active ? 'Active' : 'Suspended'}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Link to={`/super-admin/schools/${s.id}`} className="text-xs font-semibold text-brand-600 hover:underline">Manage →</Link>
                  </td>
                </tr>
              ))}
              {schools.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-slate-400">No schools yet — add the first one!</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
