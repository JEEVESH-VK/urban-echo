import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import {
  Building2, LayoutDashboard, FileText, Plus, Search,
  LogOut, ChevronRight, Menu, X, Bell, AlertTriangle
} from 'lucide-react'
import toast from 'react-hot-toast'

const CitizenNav = [
  { to: '/citizen',        icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/citizen/submit', icon: Plus,            label: 'Report Issue' },
  { to: '/citizen/track',  icon: Search,          label: 'My Complaints' },
]

const MunicipalNav = [
  { to: '/municipal',             icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/municipal/complaints',  icon: FileText,        label: 'All Complaints' },
]

const OfficialNav = [
  { to: '/official', icon: AlertTriangle, label: 'Escalated Complaints' },
]

function getRoleNav(role) {
  if (role === 'citizen') return CitizenNav
  if (['municipal_staff', 'admin'].includes(role)) return MunicipalNav
  if (['higher_official'].includes(role)) return OfficialNav
  return []
}

function getRoleLabel(role) {
  const labels = {
    citizen: 'Citizen',
    municipal_staff: 'Municipal Staff',
    admin: 'Administrator',
    higher_official: 'Higher Official',
  }
  return labels[role] || role
}

export default function Sidebar({ role }) {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const navItems = getRoleNav(role)

  async function handleLogout() {
    await signOut()
    toast.success('Signed out successfully')
    navigate('/')
  }

  return (
    <>
      {/* Mobile toggle */}
      <button
        className="fixed top-4 left-4 z-50 lg:hidden p-2 rounded-lg bg-[#1e3a5f] text-white shadow-lg"
        onClick={() => setOpen(!open)}
        aria-label="Toggle menu"
      >
        {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`sidebar transition-transform duration-300 ease-in-out
          ${open ? 'translate-x-0' : '-translate-x-full'}
          lg:translate-x-0`}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-5 py-5 border-b border-white/10">
          <div className="w-9 h-9 bg-teal-500 rounded-xl flex items-center justify-center flex-shrink-0">
            <Building2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="text-white font-bold text-sm leading-tight">Urban Echo</div>
            <div className="text-teal-400 text-xs">{getRoleLabel(role)}</div>
          </div>
        </div>

        {/* Nav items */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to.split('/').length <= 2}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `nav-item ${isActive ? 'nav-item-active' : 'nav-item-inactive'}`
              }
            >
              <Icon className="w-4.5 h-4.5 flex-shrink-0" />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        {/* User info + logout */}
        <div className="border-t border-white/10 p-4">
          <div className="flex items-center gap-3 mb-3 px-2">
            <div className="w-8 h-8 rounded-full bg-teal-500 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
              {profile?.full_name?.[0]?.toUpperCase() || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-white text-sm font-medium truncate">{profile?.full_name || 'User'}</div>
              <div className="text-white/50 text-xs truncate">{profile?.email}</div>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="nav-item nav-item-inactive w-full text-red-300 hover:bg-red-900/30 hover:text-red-200"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>
    </>
  )
}
