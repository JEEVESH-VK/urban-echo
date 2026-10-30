import Sidebar from './Sidebar'
import { useAuth } from '../../context/AuthContext'
import NotificationBell from '../notifications/NotificationBell'
import NotificationToastCenter from '../notifications/NotificationToastCenter'

export default function DashboardLayout({ children, title, subtitle }) {
  const { profile } = useAuth()
  const role = profile?.role

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <Sidebar role={role} />

      {/* Main content */}
      <main className="flex-1 lg:ml-64 min-h-screen flex flex-col">
        {/* Top bar */}
        <header className="bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
          <div className="ml-10 lg:ml-0">
            <h1 className="text-lg font-bold text-slate-800 leading-tight">{title}</h1>
            {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
          </div>
          <div className="flex items-center gap-3">
            {/* Notification bell — visible for all logged-in users */}
            <NotificationBell />

            {/* User avatar chip */}
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg">
              <div className="w-6 h-6 rounded-full bg-teal-500 flex items-center justify-center text-white text-xs font-bold">
                {profile?.full_name?.[0]?.toUpperCase() || 'U'}
              </div>
              <span className="text-sm font-medium text-slate-700">{profile?.full_name}</span>
            </div>
          </div>
        </header>

        {/* Page content */}
        <div className="flex-1 p-6 animate-fade-in">
          {children}
        </div>
      </main>

      {/* Bottom-right real-time toast popups */}
      <NotificationToastCenter />
    </div>
  )
}
