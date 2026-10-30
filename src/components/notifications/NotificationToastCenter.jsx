/**
 * NotificationToastCenter.jsx
 * Bottom-right toast popup for incoming real-time notifications.
 *
 * - Listens for new notifications via window.__notifHandlers
 * - Shows a toast for each new notification that hasn't been shown this session
 * - Auto-dismisses after 6 seconds
 * - Stacks neatly without overlap (newest on top)
 * - Has a "View" button that navigates to the complaint
 */
import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, X, ExternalLink } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useNotificationContext } from '../../context/NotificationContext'

const TYPE_BG = {
  complaint_submitted:   'bg-teal-600',
  complaint_assigned:    'bg-blue-600',
  work_started:          'bg-orange-500',
  evidence_submitted:    'bg-purple-600',
  complaint_verified:    'bg-emerald-600',
  complaint_reopened:    'bg-rose-600',
  official_remark:       'bg-amber-600',
  complaint_overdue:     'bg-red-600',
  resolution_approved:   'bg-emerald-600',
  new_complaint:         'bg-blue-600',
  general:               'bg-slate-600',
}

function getComplaintUrl(role, complaintId) {
  if (!complaintId) return null
  if (role === 'citizen') return `/citizen/track`
  if (['municipal_staff', 'admin'].includes(role)) return `/municipal/complaints/${complaintId}`
  if (role === 'higher_official') return `/official`
  return null
}

let _addToast = null

export function showNotifToast(notif) {
  if (_addToast) _addToast(notif)
}

export default function NotificationToastCenter() {
  const { profile } = useAuth()
  const { shownToastsRef, notifications } = useNotificationContext()
  const navigate = useNavigate()
  const [toasts, setToasts] = useState([])

  // Register global toast adder
  const addToast = useCallback((notif, shownSet) => {
    if (!notif || !notif.id) return
    // Already shown this session — skip
    if (shownSet && shownSet.has(notif.id)) return
    if (shownToastsRef.current.has(notif.id)) return
    shownToastsRef.current.add(notif.id)
    setToasts(prev => [...prev, { ...notif, _toastId: notif.id }])
    // Auto-dismiss after 6 seconds
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t._toastId !== notif.id))
    }, 6000)
  }, [shownToastsRef])

  useEffect(() => {
    _addToast = addToast
    // Register on global handler array so useNotifications can call it
    if (!window.__notifHandlers) window.__notifHandlers = []
    const handler = (notif, shownSet) => addToast(notif, shownSet)
    window.__notifHandlers.push(handler)

    return () => {
      window.__notifHandlers = window.__notifHandlers.filter(h => h !== handler)
    }
  }, [addToast])

  // On initial load: show toast for the most recent unread notification
  // (only once — tracked by shownToastsRef so refresh doesn't repeat)
  useEffect(() => {
    if (!notifications || notifications.length === 0) return
    const latest = notifications.find(n => !n.is_read)
    if (latest && !shownToastsRef.current.has(latest.id)) {
      addToast(latest, shownToastsRef.current)
    }
  }, [notifications]) // eslint-disable-line react-hooks/exhaustive-deps

  function dismiss(toastId) {
    setToasts(prev => prev.filter(t => t._toastId !== toastId))
  }

  function handleView(toast) {
    const url = getComplaintUrl(profile?.role, toast.complaint_id)
    dismiss(toast._toastId)
    if (url) navigate(url)
  }

  if (toasts.length === 0) return null

  return (
    <div
      className="fixed bottom-4 right-4 z-[100] flex flex-col gap-3 items-end pointer-events-none"
      aria-live="polite"
    >
      {toasts.map(toast => {
        const bg = TYPE_BG[toast.notification_type] || 'bg-slate-600'
        return (
          <div
            key={toast._toastId}
            className="pointer-events-auto w-80 bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden animate-slide-up"
            role="alert"
          >
            {/* Colour top bar */}
            <div className={`h-1 ${bg}`} />
            <div className="flex items-start gap-3 p-4">
              <div className={`w-9 h-9 ${bg} rounded-xl flex items-center justify-center flex-shrink-0`}>
                <Bell className="w-4 h-4 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800 leading-snug">{toast.title}</p>
                <p className="text-xs text-slate-500 mt-1 line-clamp-2">{toast.message}</p>
                {toast.complaint_id && (
                  <button
                    onClick={() => handleView(toast)}
                    className="mt-2 text-xs text-teal-600 hover:text-teal-800 font-semibold flex items-center gap-1"
                  >
                    <ExternalLink className="w-3 h-3" /> View Details
                  </button>
                )}
              </div>
              <button
                onClick={() => dismiss(toast._toastId)}
                className="p-1 rounded-lg hover:bg-slate-100 flex-shrink-0 transition-colors"
                aria-label="Dismiss notification"
              >
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
