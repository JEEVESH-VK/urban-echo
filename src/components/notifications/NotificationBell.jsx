/**
 * NotificationBell.jsx
 * Header bell icon with unread badge, dropdown panel,
 * mark-as-read, and navigation to the relevant complaint.
 */
import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, CheckCheck, X, ExternalLink, Inbox } from 'lucide-react'
import { useNotificationContext } from '../../context/NotificationContext'
import { useAuth } from '../../context/AuthContext'
import { formatRelative } from '../../lib/utils'

// Map notification type → colour ring on the dot
const TYPE_COLORS = {
  complaint_submitted:   'bg-teal-400',
  complaint_assigned:    'bg-blue-400',
  work_started:          'bg-orange-400',
  evidence_submitted:    'bg-purple-400',
  complaint_verified:    'bg-emerald-400',
  complaint_reopened:    'bg-rose-400',
  official_remark:       'bg-amber-400',
  complaint_overdue:     'bg-red-500',
  resolution_approved:   'bg-emerald-400',
  new_complaint:         'bg-blue-400',
  general:               'bg-slate-400',
}

// Derive the complaint detail URL based on the user's role
function getComplaintUrl(role, complaintId) {
  if (!complaintId) return null
  if (role === 'citizen') return `/citizen/track`
  if (['municipal_staff', 'admin'].includes(role)) return `/municipal/complaints/${complaintId}`
  if (role === 'higher_official') return `/official`
  return null
}

export default function NotificationBell() {
  const { notifications, unreadCount, markRead, markAllRead } = useNotificationContext()
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const panelRef = useRef(null)

  // Close on outside click
  useEffect(() => {
    function handleClick(e) {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  async function handleNotifClick(notif) {
    if (!notif.is_read) await markRead(notif.id)
    const url = getComplaintUrl(profile?.role, notif.complaint_id)
    if (url) navigate(url)
    setOpen(false)
  }

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell button */}
      <button
        id="notification-bell-btn"
        onClick={() => setOpen(o => !o)}
        className="relative p-2 rounded-lg hover:bg-slate-100 transition-colors focus:outline-none focus:ring-2 focus:ring-teal-400"
        aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
      >
        <Bell className="w-5 h-5 text-slate-600" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 animate-pulse">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-slate-100 z-50 animate-slide-up overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-teal-600" />
              <span className="font-semibold text-slate-800 text-sm">Notifications</span>
              {unreadCount > 0 && (
                <span className="badge bg-red-100 text-red-700 text-xs">{unreadCount} new</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className="text-xs text-teal-600 hover:text-teal-800 flex items-center gap-1 font-medium"
                  title="Mark all as read"
                >
                  <CheckCheck className="w-3.5 h-3.5" /> All read
                </button>
              )}
              <button onClick={() => setOpen(false)} className="p-1 rounded hover:bg-slate-100">
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>
          </div>

          {/* List */}
          <div className="overflow-y-auto max-h-[420px]">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center px-4">
                <Inbox className="w-10 h-10 text-slate-200 mb-3" />
                <p className="text-sm font-medium text-slate-500">No notifications yet</p>
                <p className="text-xs text-slate-400 mt-1">You'll see updates about your complaints here.</p>
              </div>
            ) : (
              notifications.map(notif => (
                <button
                  key={notif.id}
                  onClick={() => handleNotifClick(notif)}
                  className={`w-full text-left flex items-start gap-3 px-4 py-3 hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0 ${
                    !notif.is_read ? 'bg-teal-50/40' : ''
                  }`}
                >
                  {/* Colour dot */}
                  <div className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${TYPE_COLORS[notif.notification_type] || 'bg-slate-400'}`} />
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm leading-snug ${!notif.is_read ? 'font-semibold text-slate-800' : 'font-medium text-slate-600'}`}>
                      {notif.title}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{notif.message}</p>
                    <p className="text-[10px] text-slate-400 mt-1">{formatRelative(notif.created_at)}</p>
                  </div>
                  {notif.complaint_id && (
                    <ExternalLink className="w-3.5 h-3.5 text-slate-300 flex-shrink-0 mt-1" />
                  )}
                </button>
              ))
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="px-4 py-2.5 border-t border-slate-100 bg-slate-50/60 text-center">
              <p className="text-xs text-slate-400">{notifications.length} total notifications</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
