import { useNavigate } from 'react-router-dom'
import { LogOut } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { Avatar } from './ui'
import InstallButton from './InstallButton'
import NotifyButton from './NotifyButton'

export default function PortalLayout({ children }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const doLogout = async () => { await logout(); navigate('/login') }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur"
        style={{ paddingTop: 'var(--safe-top)' }}>
        <div className="mx-auto w-full max-w-5xl px-4 py-3">
          <div className="flex items-center gap-3">
            <Avatar name={user?.name} size={40} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-slate-800">{user?.name}</p>
              <p className="truncate text-xs capitalize text-slate-400">{user?.school_name || user?.role}</p>
            </div>
            <div className="hidden items-center gap-2 sm:flex">
              <NotifyButton className="shrink-0" />
              <InstallButton className="shrink-0" />
            </div>
            <button onClick={doLogout}
              className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-slate-500 hover:bg-slate-100">
              <LogOut className="h-4 w-4" /> Sign out
            </button>
          </div>
          <div className="mt-3 flex flex-col gap-2 sm:hidden">
            <InstallButton className="w-full justify-center" />
            <NotifyButton className="w-full justify-center" />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl px-4 pb-16 pt-4"
        style={{ paddingBottom: 'calc(4rem + var(--safe-bottom))' }}>
        {children}
      </main>
    </div>
  )
}
