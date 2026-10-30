import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'

// Pages
import LandingPage from './pages/Landing'
import UserManual from './pages/UserManual'
import CitizenLogin from './pages/auth/CitizenLogin'
import CitizenRegister from './pages/auth/CitizenRegister'
import MunicipalLogin from './pages/auth/MunicipalLogin'
import OfficialLogin from './pages/auth/OfficialLogin'

// Citizen pages
import CitizenDashboard from './pages/citizen/Dashboard'
import CitizenSubmit from './pages/citizen/SubmitComplaint'
import CitizenTrack from './pages/citizen/TrackComplaints'

// Municipal pages
import MunicipalDashboard from './pages/municipal/Dashboard'
import MunicipalComplaints from './pages/municipal/Complaints'
import MunicipalComplaintDetail from './pages/municipal/ComplaintDetail'

// Official pages
import OfficialDashboard from './pages/official/Dashboard'

// Route guards
import ProtectedRoute from './components/auth/ProtectedRoute'
import LoadingScreen from './components/ui/LoadingScreen'

export default function App() {
  const { loading } = useAuth()

  if (loading) return <LoadingScreen />

  return (
    <Routes>
      {/* Public routes */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/manual" element={<UserManual />} />
      <Route path="/citizen/login" element={<CitizenLogin />} />
      <Route path="/citizen/register" element={<CitizenRegister />} />
      <Route path="/municipal/login" element={<MunicipalLogin />} />
      <Route path="/official/login" element={<OfficialLogin />} />

      {/* Citizen routes */}
      <Route path="/citizen" element={
        <ProtectedRoute allowedRoles={['citizen']}>
          <CitizenDashboard />
        </ProtectedRoute>
      } />
      <Route path="/citizen/submit" element={
        <ProtectedRoute allowedRoles={['citizen']}>
          <CitizenSubmit />
        </ProtectedRoute>
      } />
      <Route path="/citizen/track" element={
        <ProtectedRoute allowedRoles={['citizen']}>
          <CitizenTrack />
        </ProtectedRoute>
      } />

      {/* Municipal routes */}
      <Route path="/municipal" element={
        <ProtectedRoute allowedRoles={['municipal_staff', 'admin']}>
          <MunicipalDashboard />
        </ProtectedRoute>
      } />
      <Route path="/municipal/complaints" element={
        <ProtectedRoute allowedRoles={['municipal_staff', 'admin']}>
          <MunicipalComplaints />
        </ProtectedRoute>
      } />
      <Route path="/municipal/complaints/:id" element={
        <ProtectedRoute allowedRoles={['municipal_staff', 'admin']}>
          <MunicipalComplaintDetail />
        </ProtectedRoute>
      } />

      {/* Higher official routes */}
      <Route path="/official" element={
        <ProtectedRoute allowedRoles={['higher_official', 'admin']}>
          <OfficialDashboard />
        </ProtectedRoute>
      } />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
