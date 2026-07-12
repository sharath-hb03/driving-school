import { useEffect, useState } from 'react'
import { Bell, BellRing, X, Lock, RefreshCw } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { isConfigured, promptNotifications, getSubscriptionId, getSubscriptionState } from '../lib/onesignal'
import { api } from '../lib/api'

// Students and instructors save their subscription via the portal endpoint;
// admins and staff via the staff endpoint.
const endpointFor = (role) =>
  role === 'student' || role === 'instructor' ? '/portal/push-subscribe' : '/notify/subscribe'

const isDenied = () =>
  typeof Notification !== 'undefined' && Notification.permission === 'denied'

// Step-by-step guide for re-allowing notifications when the browser has them
// blocked — sites cannot re-show the permission prompt after a deny.
function UnblockModal({ onClose }) {
  const ua = navigator.userAgent
  const isIOS = /iphone|ipad|ipod/i.test(ua)
  const isAndroid = /android/i.test(ua)

  const steps = isIOS
    ? [
        ['Open iPhone Settings', 'Scroll down and find this app in the list'],
        ['Tap Notifications', 'Turn on "Allow Notifications"'],
        ['Come back and tap Enable Alerts again', ''],
      ]
    : isAndroid
    ? [
        ['Tap the lock icon 🔒', 'It’s next to the website address at the top'],
        ['Tap Permissions → Notifications', 'Switch it to "Allow"'],
        ['Come back and tap Enable Alerts again', ''],
      ]
    : [
        ['Click the lock icon 🔒 in the address bar', 'To the left of the website address'],
        ['Set Notifications to "Allow"', ''],
        ['Reload the page', 'Then click Enable Alerts again'],
      ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm"
         onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl"
           onClick={(e) => e.stopPropagation()}>
        <div className="mb-1 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-base font-bold text-slate-800">
            <Lock className="h-4 w-4 text-brand-600" /> Allow Notifications
          </h3>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="mb-4 text-xs text-slate-500">
          Your browser is currently blocking notifications for this site. It takes 10 seconds to fix:
        </p>

        <div className="space-y-4">
          {steps.map(([title, hint], i) => (
            <div key={i} className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-700">{i + 1}</div>
              <div>
                <p className="text-sm font-medium text-slate-800">{title}</p>
                {hint && <p className="text-xs text-slate-400">{hint}</p>}
              </div>
            </div>
          ))}
        </div>

        <button onClick={() => window.location.reload()} className="btn-primary mt-5 flex w-full items-center justify-center gap-2">
          <RefreshCw className="h-4 w-4" /> I did it — Reload
        </button>
      </div>
    </div>
  )
}

// The button renders in two places per layout (desktop + mobile), so the
// on-mount sync/auto-prompt runs once per endpoint and instances share it.
const autoSync = {}
function runAutoSync(endpoint) {
  if (!autoSync[endpoint]) {
    autoSync[endpoint] = (async () => {
      const state = await getSubscriptionState()
      if (state.optedIn && state.id) {
        await api.post(endpoint, { subscription_id: state.id }).catch(() => {})
        return 'on'
      }
      // Auto-prompt works in Chrome/Edge. Safari and iOS ignore permission
      // requests without a user gesture — for them the button is the way in.
      const perm = await promptNotifications()
      if (perm === true || perm === 'granted') {
        const subId = await getSubscriptionId()
        if (subId) {
          await api.post(endpoint, { subscription_id: subId }).catch(() => {})
          return 'on'
        }
      }
      return 'off'
    })().catch(() => 'off')
  }
  return autoSync[endpoint]
}

export default function NotifyButton({ className = '' }) {
  const { user } = useAuth()
  // checking | off | working | on
  const [status, setStatus] = useState('checking')
  const [showUnblock, setShowUnblock] = useState(false)

  useEffect(() => {
    if (!isConfigured() || !user) return
    let mounted = true
    // Safety net: if OneSignal never initialises (e.g. the SDK is blocked or
    // stalls inside an installed PWA's service-worker scope), don't leave the
    // button stuck hidden — fall back to showing "Enable Alerts".
    const timer = setTimeout(() => {
      if (mounted) setStatus((s) => (s === 'checking' ? 'off' : s))
    }, 6000)
    runAutoSync(endpointFor(user.role)).then((s) => { if (mounted) setStatus(s) })
    return () => { mounted = false; clearTimeout(timer) }
  }, [user])

  // Nothing to do: not configured or still checking
  if (!isConfigured() || !user) return null
  if (status === 'checking') return null

  const enable = async () => {
    // The permission prompt can't be re-shown once denied — guide the user instead.
    if (isDenied()) {
      setShowUnblock(true)
      return
    }
    setStatus('working')
    const perm = await promptNotifications()
    if (perm === true || perm === 'granted') {
      const subId = await getSubscriptionId()
      if (subId) {
        await api.post(endpointFor(user.role), { subscription_id: subId }).catch(() => {})
        setStatus('on')
        return
      }
    }
    setStatus('off')
    if (isDenied()) setShowUnblock(true)
  }

  if (status === 'on') {
    return (
      <span className={`flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200 ${className}`}>
        <BellRing className="h-3.5 w-3.5" /> Notifications On
      </span>
    )
  }

  return (
    <>
      <button
        onClick={enable}
        disabled={status === 'working'}
        title="Get notified about new enquiries, classes and reminders"
        className={`flex items-center gap-2 rounded-xl bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-700 ring-1 ring-brand-200 transition hover:bg-brand-100 active:scale-95 ${className}`}
      >
        <Bell className="h-3.5 w-3.5" />
        {status === 'working' ? 'Enabling…' : 'Enable Alerts'}
      </button>
      {showUnblock && <UnblockModal onClose={() => setShowUnblock(false)} />}
    </>
  )
}
