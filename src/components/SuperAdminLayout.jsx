import { useState } from 'react'
import { NavLink, useNavigate, Link } from 'react-router-dom'
import { LayoutDashboard, Building2, LogOut, ChevronRight, Shield } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const NAV = [
  { to: '/super-admin',         label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/super-admin/schools', label: 'Schools',   icon: Building2 },
]

export default function SuperAdminLayout({ children }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const doLogout = async () => { await logout(); navigate('/login') }

  return (
    <div className="min-h-screen lg:flex">
      {/* Sidebar */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col bg-gradient-to-b from-brand-900 to-brand-800 px-4 py-6 lg:flex">
        <div className="mb-8 flex items-center gap-3 px-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20">
            <Shield className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="text-sm font-extrabold text-white">Super Admin</p>
            <p className="text-xs text-brand-300">Platform Control</p>
          </div>
        </div>
        <nav className="flex-1 space-y-1">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${isActive ? 'bg-white/20 text-white' : 'text-brand-200 hover:bg-white/10 hover:text-white'}`}>
              <Icon className="h-5 w-5" />{label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-4 flex items-center gap-3 rounded-xl bg-white/10 p-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/20 text-sm font-bold text-white">
            {user?.name?.[0]?.toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-white">{user?.name}</p>
            <p className="truncate text-xs text-brand-300">Super Admin</p>
          </div>
          <button onClick={doLogout} className="rounded-lg p-2 text-brand-300 hover:bg-white/10" title="Sign out">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </aside>

      {/* Mobile header */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 lg:hidden">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-brand-600" />
            <span className="font-bold text-slate-800">Super Admin</span>
          </div>
          <div className="flex items-center gap-2">
            {NAV.map(({ to, label, end }) => (
              <NavLink key={to} to={to} end={end}
                className={({ isActive }) => `rounded-lg px-3 py-1.5 text-sm font-medium ${isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-500'}`}>
                {label}
              </NavLink>
            ))}
            <button onClick={doLogout} className="rounded-lg p-2 text-slate-400">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 lg:px-8">{children}</main>
      </div>
    </div>
  )
}
