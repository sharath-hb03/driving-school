import { useState, useEffect } from 'react'

export function useInstallPrompt() {
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent)
  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true

  // Read the globally captured prompt (set in index.html before React mounts)
  const [deferredPrompt, setDeferredPrompt] = useState(
    () => window.__pwaInstallPrompt || null
  )
  const [isInstalled, setIsInstalled] = useState(
    () => !!window.__pwaInstalled || isStandalone
  )

  useEffect(() => {
    // In case the event fires after React mounts
    const onReady = () => setDeferredPrompt(window.__pwaInstallPrompt)
    const onInstalled = () => { setIsInstalled(true); setDeferredPrompt(null) }

    window.addEventListener('pwaInstallReady', onReady)
    window.addEventListener('pwaInstalled', onInstalled)
    return () => {
      window.removeEventListener('pwaInstallReady', onReady)
      window.removeEventListener('pwaInstalled', onInstalled)
    }
  }, [])

  const install = async () => {
    const prompt = window.__pwaInstallPrompt
    if (!prompt) return false
    prompt.prompt()
    const { outcome } = await prompt.userChoice
    window.__pwaInstallPrompt = null
    setDeferredPrompt(null)
    return outcome === 'accepted'
  }

  return { deferredPrompt, isInstalled, isIOS, isStandalone, install }
}
