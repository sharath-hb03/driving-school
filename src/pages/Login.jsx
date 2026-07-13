import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Eye, EyeOff, Shield } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { Spinner } from '../components/ui'
import { api } from '../lib/api'
import SchoolLogo from '../components/SchoolLogo'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [schoolName, setSchoolName] = useState(() => localStorage.getItem('dsms_school_name') || 'DriveSchool Manager')
  const [schoolLogo, setSchoolLogo] = useState(() => localStorage.getItem('dsms_school_logo') || null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const slug = params.get('school') || localStorage.getItem('dsms_school_slug')
    if (slug) {
      api.get(`/public/school?slug=${encodeURIComponent(slug)}`)
        .then(data => {
          if (data?.school?.name) {
            setSchoolName(data.school.name)
            localStorage.setItem('dsms_school_name', data.school.name)
            document.title = data.school.name
            const metaTitle = document.querySelector('meta[name="apple-mobile-web-app-title"]')
            if (metaTitle) metaTitle.setAttribute('content', data.school.name)
          }
          setSchoolLogo(data?.school?.logo_url || null)
          if (data?.school?.logo_url) localStorage.setItem('dsms_school_logo', data.school.logo_url)
          else localStorage.removeItem('dsms_school_logo')
        })
        .catch(err => {
          console.error('Failed to load school branding:', err)
        })
    }
  }, [])

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      const user = await login(email, password)
      toast.success('Welcome back!')
      const nextPath =
        user.role === 'super_admin'
          ? '/super-admin'
          : user.role === 'student' || user.role === 'instructor'
            ? '/portal'
            : '/'

      if (user.school_slug) window.location.replace(nextPath)
      else navigate(nextPath, { replace: true })
    } catch (err) {
      toast.error(err.message || 'Invalid credentials')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col justify-center bg-gradient-to-br from-brand-50 via-white to-slate-50 px-5 py-10">
      <div className="mx-auto w-full max-w-sm">
        <div className="mb-8 text-center">
          <SchoolLogo src={schoolLogo} size={64} className="mx-auto mb-4 !rounded-2xl shadow-soft" />
          <h1 className="text-2xl font-extrabold text-slate-900">{schoolName}</h1>
          <p className="mt-1 text-sm text-slate-500">Sign in to your school account</p>
        </div>

        <form onSubmit={submit} className="card space-y-4 p-6">
          <div>
            <label className="label">Email</label>
            <input className="input" type="email" value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com" required autoComplete="email" />
          </div>
          <div>
            <label className="label">Password</label>
            <div className="relative">
              <input className="input pr-11" type={show ? 'text' : 'password'}
                value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••" required autoComplete="current-password" />
              <button type="button" onClick={() => setShow(s => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" tabIndex={-1}>
                {show ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </div>
          <button type="submit" className="btn-primary w-full py-3" disabled={busy}>
            {busy ? <Spinner className="h-5 w-5" /> : 'Sign in'}
          </button>
        </form>

        <p className="mt-6 flex items-center justify-center gap-1.5 text-center text-xs text-slate-400">
          <Shield className="h-3.5 w-3.5" /> Secure multi-tenant platform · Works offline
        </p>
      </div>
    </div>
  )
}
