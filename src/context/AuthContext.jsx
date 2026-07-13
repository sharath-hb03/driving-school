import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { api } from '../lib/api'

const AuthContext = createContext(null)

// Updates the PWA manifest link to use the school's branded name
function applySchoolManifest(user) {
  if (!user?.school_slug) return
  // Store so index.html script picks it up on next cold open
  localStorage.setItem('dsms_school_slug', user.school_slug)
  const appName = user.school_name || 'DriveSchool'
  localStorage.setItem('dsms_school_name', appName)
  document.title = appName
  document
    .querySelector('meta[name="apple-mobile-web-app-title"]')
    ?.setAttribute('content', appName)
  // Swap the manifest link right now (affects install prompt if not yet shown)
  const link = document.querySelector('link[rel="manifest"]')
  if (link) {
    link.setAttribute('href', `/api/manifest?slug=${encodeURIComponent(user.school_slug)}`)
  }
  // Branded icons (school logo or default): home-screen icon + favicon
  const iconHref = `/api/icon?slug=${encodeURIComponent(user.school_slug)}&size=192`
  document.querySelector('link[rel="apple-touch-icon"]')?.setAttribute('href', iconHref)
  const favicon = document.querySelector('link[rel="icon"]')
  if (favicon) {
    favicon.setAttribute('href', iconHref)
    favicon.setAttribute('type', 'image/png')
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const data = await api.get('/auth/me')
      const u = data.user || null
      setUser(u)
      if (u) applySchoolManifest(u)
    } catch {
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const login = async (email, password) => {
    const data = await api.post('/auth/login', { email, password })
    setUser(data.user)
    applySchoolManifest(data.user)   // ← swap manifest immediately on login
    return data.user
  }

  const logout = async () => {
    await api.post('/auth/logout')
    localStorage.removeItem('dsms_school_slug')
    localStorage.removeItem('dsms_school_name')
    localStorage.removeItem('dsms_school_logo')
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
