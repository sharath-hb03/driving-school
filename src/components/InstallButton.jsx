import { useState } from 'react'
import { Download, Share, X, Smartphone, Monitor } from 'lucide-react'
import { useInstallPrompt } from '../hooks/useInstallPrompt'
import { useAuth } from '../context/AuthContext'

// iOS "Add to Home Screen" instructions modal
function IOSModal({ onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 px-4 pb-6 backdrop-blur-sm"
         onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl"
           onClick={e => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-800">Install App</h3>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-700">1</div>
            <div>
              <p className="text-sm font-medium text-slate-800">Tap the Share button</p>
              <p className="text-xs text-slate-400">At the bottom of your Safari browser</p>
              <div className="mt-1.5 inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-1 text-xs text-slate-600">
                <Share className="h-3.5 w-3.5" /> Share
              </div>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-700">2</div>
            <div>
              <p className="text-sm font-medium text-slate-800">Scroll down and tap</p>
              <div className="mt-1.5 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm font-medium text-slate-700 shadow-sm">
                <Smartphone className="h-4 w-4 text-brand-600" /> Add to Home Screen
              </div>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-700">3</div>
            <div>
              <p className="text-sm font-medium text-slate-800">Tap <strong>Add</strong> in the top right</p>
              <p className="text-xs text-slate-400">The app will appear on your home screen</p>
            </div>
          </div>
        </div>

        <button
          onClick={onClose}
          className="btn-primary mt-5 w-full"
        >
          Got it!
        </button>
      </div>

      {/* Arrow pointing down to Safari bar */}
      <div className="pointer-events-none absolute bottom-1 left-1/2 -translate-x-1/2">
        <div className="h-0 w-0 border-l-8 border-r-8 border-t-8 border-l-transparent border-r-transparent border-t-white" />
      </div>
    </div>
  )
}

// Android and Desktop instructions modal
function BrowserModal({ appName, onClose }) {
  const isAndroid = /android/i.test(navigator.userAgent)
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm"
         onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl"
           onClick={e => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-800">Install App</h3>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4">
          <p className="text-xs text-slate-500">
            Add <strong>{appName}</strong> to your home screen or desktop to run it as a standalone app with offline support.
          </p>

          {isAndroid ? (
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-700">1</div>
                <div>
                  <p className="text-sm font-medium text-slate-800">Open Browser Menu</p>
                  <p className="text-xs text-slate-400">Tap the three-dots (<strong>⋮</strong>) in the top-right corner of Chrome/Firefox.</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-700">2</div>
                <div>
                  <p className="text-sm font-medium text-slate-800">Tap "Add to Home Screen"</p>
                  <p className="text-xs text-slate-400">Or look for <strong>Install app</strong> in the menu options.</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-700">1</div>
                <div>
                  <p className="text-sm font-medium text-slate-800">For Chrome / Edge (Desktop)</p>
                  <p className="text-xs text-slate-400">Click the **Install icon** (monitor with arrow) in the right side of the address bar.</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-700">2</div>
                <div>
                  <p className="text-sm font-medium text-slate-800">For Safari (macOS)</p>
                  <p className="text-xs text-slate-400">Click **Share** → **Add to Dock** or go to **File** → **Add to Dock...**</p>
                </div>
              </div>
            </div>
          )}
        </div>

        <button
          onClick={onClose}
          className="btn-primary mt-6 w-full"
        >
          Got it!
        </button>
      </div>
    </div>
  )
}

export default function InstallButton({ className = '' }) {
  const { deferredPrompt, isInstalled, isIOS, isStandalone, install } = useInstallPrompt()
  const { user } = useAuth()
  const [showIOSModal, setShowIOSModal] = useState(false)
  const [showBrowserModal, setShowBrowserModal] = useState(false)
  const [installing, setInstalling] = useState(false)

  // Already installed as PWA — don't show the button
  if (isInstalled || isStandalone) return null

  // Resolve current school name for instructions
  const schoolName = user?.school_name || localStorage.getItem('instrukt_school_name') || 'Instrukt'

  const handleClick = async () => {
    // Prefer the live captured prompt over possibly-stale React state so a
    // one-tap native install fires whenever the browser actually supports it.
    const prompt = window.__pwaInstallPrompt || deferredPrompt
    if (prompt) {
      setInstalling(true)
      await install()
      setInstalling(false)
      return
    }
    // No programmatic install available on this browser (iOS Safari, Firefox,
    // desktop Safari, or criteria not yet met) — fall back to instructions.
    if (isIOS) setShowIOSModal(true)
    else setShowBrowserModal(true)
  }

  return (
    <>
      <button
        onClick={handleClick}
        disabled={installing}
        title="Install app"
        className={`flex items-center gap-2 rounded-xl bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-700 ring-1 ring-brand-200 transition hover:bg-brand-100 active:scale-95 ${className}`}
      >
        <Download className="h-3.5 w-3.5" />
        {installing ? 'Installing…' : 'Install App'}
      </button>

      {showIOSModal && <IOSModal onClose={() => setShowIOSModal(false)} />}
      {showBrowserModal && <BrowserModal appName={schoolName} onClose={() => setShowBrowserModal(false)} />}
    </>
  )
}
