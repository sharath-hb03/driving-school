// OneSignal Web SDK (v16) loader + helpers.
const APP_ID = import.meta.env.VITE_ONESIGNAL_APP_ID

let initPromise = null

export function isConfigured() {
  return Boolean(APP_ID)
}

// Loads and initialises OneSignal exactly once.
export function initOneSignal() {
  if (!APP_ID) return Promise.resolve(false)
  if (initPromise) return initPromise

  initPromise = new Promise((resolve) => {
    window.OneSignalDeferred = window.OneSignalDeferred || []
    const script = document.createElement('script')
    script.src = 'https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js'
    script.defer = true
    document.head.appendChild(script)

    window.OneSignalDeferred.push(async (OneSignal) => {
      try {
        await OneSignal.init({
          appId: APP_ID,
          allowLocalhostAsSecureOrigin: true,
          serviceWorkerPath: 'OneSignalSDKWorker.js'
        })
        resolve(true)
      } catch (e) {
        console.warn('OneSignal init failed', e)
        resolve(false)
      }
    })
  })
  return initPromise
}

// Ask the user to enable notifications.
export async function promptNotifications() {
  if (!APP_ID) return false
  await initOneSignal()
  return new Promise((resolve) => {
    window.OneSignalDeferred.push(async (OneSignal) => {
      try {
        await OneSignal.Notifications.requestPermission()
        resolve(OneSignal.Notifications.permission)
      } catch {
        resolve(false)
      }
    })
  })
}

export async function getSubscriptionState() {
  if (!APP_ID) return { configured: false, subscribed: false }
  await initOneSignal()
  return new Promise((resolve) => {
    window.OneSignalDeferred.push((OneSignal) => {
      resolve({
        configured: true,
        subscribed: Boolean(OneSignal.Notifications.permission),
        optedIn: OneSignal.User?.PushSubscription?.optedIn ?? false,
        id: OneSignal.User?.PushSubscription?.id ?? null
      })
    })
  })
}

export async function getSubscriptionId() {
  if (!APP_ID) return null
  await initOneSignal()
  return new Promise((resolve) => {
    window.OneSignalDeferred.push((OneSignal) => {
      resolve(OneSignal.User?.PushSubscription?.id ?? null)
    })
  })
}
