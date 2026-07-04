import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { LogOut } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { Avatar } from './ui'
import InstallButton from './InstallButton'
import { isConfigured, promptNotifications, getSubscriptionId, getSubscriptionState } from '../lib/onesignal'
import { api } from '../lib/api'

export default function PortalLayout({ children }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const doLogout = async () => { await logout(); navigate('/login') }

  useEffect(() => {
    if (!isConfigured()) return
    getSubscriptionState().then(async (state) => {
      if (state.optedIn && state.id) {
        await api.post('/portal/push-subscribe', { subscription_id: state.id }).catch(() => {})
      } else {
        const perm = await promptNotifications()
        if (perm === 'granted' || perm === true) {
          const subId = await getSubscriptionId()
          if (subId) await api.post('/portal/push-subscribe', { subscription_id: subId }).catch(() => {})
        }
      }
    }).catch(() => {})
  }, [])

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
            <div className="hidden sm:block">
              <InstallButton className="shrink-0" />
            </div>
            <button onClick={doLogout}
              className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-slate-500 hover:bg-slate-100">
              <LogOut className="h-4 w-4" /> Sign out
            </button>
          </div>
          <InstallButton className="mt-3 w-full justify-center sm:hidden" />
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl px-4 pb-16 pt-4"
        style={{ paddingBottom: 'calc(4rem + var(--safe-bottom))' }}>
        {children}
      </main>
    </div>
  )
}
