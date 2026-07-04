import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import { ConfirmProvider } from './components/ConfirmDialog'
import Layout from './components/Layout'
import PortalLayout from './components/PortalLayout'
import SuperAdminLayout from './components/SuperAdminLayout'
import { PageLoader } from './components/ui'

import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Students from './pages/Students'
import StudentDetail from './pages/StudentDetail'
import Schedule from './pages/Schedule'
import TestSchedule from './pages/TestSchedule'
import Payments from './pages/Payments'
import Vehicles from './pages/Vehicles'
import Instructors from './pages/Instructors'
import Holidays from './pages/Holidays'
import Enquiries from './pages/Enquiries'
import SettingsPage from './pages/Settings'
import StudentPortal from './pages/StudentPortal'
import InstructorPortal from './pages/InstructorPortal'
import SuperAdminDashboard from './pages/super-admin/SuperAdminDashboard'
import Schools from './pages/super-admin/Schools'
import SchoolDetail from './pages/super-admin/SchoolDetail'

const isPortalRole = (role) => role === 'student' || role === 'instructor'
const homeFor = (user) => {
  if (!user) return '/login'
  if (user.role === 'super_admin') return '/super-admin'
  if (isPortalRole(user.role)) return '/portal'
  return '/'
}

function Protected({ children }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return <PageLoader />
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />
  if (user.role === 'super_admin') return <Navigate to="/super-admin" replace />
  if (isPortalRole(user.role)) return <Navigate to="/portal" replace />
  return <ConfirmProvider><Layout>{children}</Layout></ConfirmProvider>
}

function PortalProtected() {
  const { user, loading } = useAuth()
  if (loading) return <PageLoader />
  if (!user) return <Navigate to="/login" replace />
  if (!isPortalRole(user.role)) return <Navigate to="/" replace />
  return (
    <ConfirmProvider>
      <PortalLayout>
        {user.role === 'student' ? <StudentPortal /> : <InstructorPortal />}
      </PortalLayout>
    </ConfirmProvider>
  )
}

function SuperAdminProtected({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <PageLoader />
  if (!user) return <Navigate to="/login" replace />
  if (user.role !== 'super_admin') return <Navigate to="/" replace />
  return <SuperAdminLayout>{children}</SuperAdminLayout>
}

export default function App() {
  const { user, loading } = useAuth()

  return (
    <Routes>
      <Route
        path="/login"
        element={loading ? <PageLoader /> : user ? <Navigate to={homeFor(user)} replace /> : <Login />}
      />

      {/* Super Admin routes */}
      <Route path="/super-admin" element={<SuperAdminProtected><SuperAdminDashboard /></SuperAdminProtected>} />
      <Route path="/super-admin/schools" element={<SuperAdminProtected><Schools /></SuperAdminProtected>} />
      <Route path="/super-admin/schools/:id" element={<SuperAdminProtected><SchoolDetail /></SuperAdminProtected>} />

      {/* Portal (student / instructor) */}
      <Route path="/portal" element={<PortalProtected />} />

      {/* School admin / staff routes */}
      <Route path="/" element={<Protected><Dashboard /></Protected>} />
      <Route path="/students" element={<Protected><Students /></Protected>} />
      <Route path="/students/:id" element={<Protected><StudentDetail /></Protected>} />
      <Route path="/schedule" element={<Protected><Schedule /></Protected>} />
      <Route path="/tests"    element={<Protected><TestSchedule /></Protected>} />
      <Route path="/payments" element={<Protected><Payments /></Protected>} />
      <Route path="/vehicles" element={<Protected><Vehicles /></Protected>} />
      <Route path="/instructors" element={<Protected><Instructors /></Protected>} />
      <Route path="/holidays" element={<Protected><Holidays /></Protected>} />
      <Route path="/enquiries" element={<Protected><Enquiries /></Protected>} />
      <Route path="/settings" element={<Protected><SettingsPage /></Protected>} />

      <Route path="*" element={loading ? <PageLoader /> : <Navigate to={homeFor(user)} replace />} />
    </Routes>
  )
}
