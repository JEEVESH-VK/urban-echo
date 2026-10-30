import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import LoadingScreen from '../ui/LoadingScreen'

// Maps each protected path prefix to the correct login page.
// Used to redirect unauthenticated users to the right login portal.
const LOGIN_REDIRECT = {
  '/municipal': '/municipal/login',
  '/official':  '/official/login',
  '/citizen':   '/citizen/login',
}

function getLoginPath(pathname) {
  for (const [prefix, loginPath] of Object.entries(LOGIN_REDIRECT)) {
    if (pathname.startsWith(prefix)) return loginPath
  }
  return '/citizen/login'
}

export default function ProtectedRoute({ children, allowedRoles = [] }) {
  const { user, profile, loading } = useAuth()
  const location = useLocation()

  // Still loading session or profile — hold on
  if (loading) return <LoadingScreen />

  // Not authenticated — send to the matching login portal
  if (!user) {
    return <Navigate to={getLoginPath(location.pathname)} replace />
  }

  // Authenticated but profile not yet loaded (very brief race on first load)
  if (!profile) return <LoadingScreen />

  // Authenticated but wrong role — redirect to their own correct dashboard
  if (allowedRoles.length > 0 && !allowedRoles.includes(profile.role)) {
    const dashboardMap = {
      citizen:         '/citizen',
      municipal_staff: '/municipal',
      admin:           '/municipal',
      higher_official: '/official',
    }
    const redirect = dashboardMap[profile.role] || '/'
    return <Navigate to={redirect} replace />
  }

  return children
}
