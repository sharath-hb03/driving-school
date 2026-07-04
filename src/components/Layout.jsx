import { useEffect, useState } from 'react'
import { NavLink, useNavigate, Link } from 'react-router-dom'
import {
  LayoutDashboard, MessageCircle, Users, CalendarDays, Wallet,
  Car, GraduationCap, CalendarOff, Settings, MoreHorizontal, LogOut, X, Building2, ClipboardList
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { Avatar } from './ui'
import InstallButton from './InstallButton'
import { isConfigured, promptNotifications, getSubscriptionId, getSubscriptionState } from '../lib/onesignal'
import { api } from '../lib/api'

const NAV = [
  { to: '/',           label: 'Dashboard',  icon: LayoutDashboard, end: true },
  { to: '/enquiries',  label: 'Enquiries',  icon: MessageCircle },
  { to: '/students',   label: 'Students',   icon: Users },
  { to: '/schedule',   label: 'Schedule',   icon: CalendarDays },
  { to: '/tests',      label: 'Tests',      icon: ClipboardList },
  { to: '/payments',   label: 'Payments',   icon: Wallet },
  { to: '/vehicles',   label: 'Vehicles',   icon: Car },
  { to: '/instructors',label: 'Instructors',icon: GraduationCap },
  { to: '/holidays',   label: 'Holidays',   icon: CalendarOff },
  { to: '/settings',   label: 'Settings',   icon: Settings },
]

const BOTTOM = NAV.slice(0, 4)
const MORE = NAV.slice(4)

export default function Layout({ children }) {
  const { user, logout } = useAuth()
  const [moreOpen, setMoreOpen] = useState(false)
  const navigate = useNavigate()

  const doLogout = async () => { await logout(); navigate('/login') }

  useEffect(() => {
    if (!isConfigured()) return
    getSubscriptionState().then(async (state) => {
      if (state.optedIn && state.id) {
        await api.post('/notify/subscribe', { subscription_id: state.id }).catch(() => {})
      } else {
        const perm = await promptNotifications()
        if (perm === 'granted' || perm === true) {
          const subId = await getSubscriptionId()
          if (subId) await api.post('/notify/subscribe', { subscription_id: subId }).catch(() => {})
        }
      }
    }).catch(() => {})
  }, [])

  return (
    <div className="min-h-screen lg:flex">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-slate-200 bg-white px-4 py-5 lg:flex">
        <div className="mb-6 flex items-center gap-2.5 px-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600">
            <Building2 className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="text-sm font-extrabold leading-tight text-slate-800">{user?.school_name || 'DriveSchool'}</p>
            <p className="text-xs text-slate-400">Manager</p>
          </div>
        </div>
        <nav className="flex-1 space-y-1">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end}
              className={({ isActive }) => `nav-link ${isActive ? 'nav-link-active' : ''}`}>
              <Icon className="h-5 w-5" />{label}
            </NavLink>
          ))}
        </nav>
        {/* Install button — desktop sidebar */}
        <div className="px-2 pb-2">
          <InstallButton className="w-full justify-center" />
        </div>
        <div className="mt-2 flex items-center gap-3 rounded-xl bg-slate-50 p-3">
          <Avatar name={user?.name} size={38} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-slate-700">{user?.name}</p>
            <p className="truncate text-xs text-slate-400 capitalize">{user?.role}</p>
          </div>
          <button onClick={doLogout} className="rounded-lg p-2 text-slate-400 hover:bg-slate-200" title="Sign out">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </aside>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-28 pt-4 lg:max-w-4xl lg:px-8 lg:pb-10 lg:pt-8"
          style={{ paddingTop: 'max(1rem, var(--safe-top))' }}>
          {children}
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 backdrop-blur lg:hidden"
        style={{ paddingBottom: 'var(--safe-bottom)' }}>
        <div className="mx-auto flex max-w-md items-stretch justify-around px-2">
          {BOTTOM.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end}
              className={({ isActive }) => `flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium ${isActive ? 'text-brand-600' : 'text-slate-400'}`}>
              <Icon className="h-[22px] w-[22px]" />{label}
            </NavLink>
          ))}
          <button onClick={() => setMoreOpen(true)}
            className="flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium text-slate-400">
            <MoreHorizontal className="h-[22px] w-[22px]" />More
          </button>
        </div>
      </nav>

      {/* More sheet */}
      {moreOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setMoreOpen(false)} />
          <div className="absolute inset-x-0 bottom-0 rounded-t-3xl bg-white p-5"
            style={{ paddingBottom: 'calc(1.25rem + var(--safe-bottom))' }}>
            <div className="mb-3 flex items-center justify-between">
              <p className="text-base font-bold text-slate-800">More</p>
              <button onClick={() => setMoreOpen(false)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {MORE.map(({ to, label, icon: Icon }) => (
                <Link key={to} to={to} onClick={() => setMoreOpen(false)}
                  className="flex flex-col items-center gap-2 rounded-2xl bg-slate-50 p-4 text-center text-xs font-semibold text-slate-600">
                  <Icon className="h-6 w-6 text-brand-600" />{label}
                </Link>
              ))}
              <button onClick={doLogout}
                className="flex flex-col items-center gap-2 rounded-2xl bg-red-50 p-4 text-center text-xs font-semibold text-red-600">
                <LogOut className="h-6 w-6" />Sign out
              </button>
              {/* Install button in More sheet */}
              <InstallButton className="col-span-3 justify-center" />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
