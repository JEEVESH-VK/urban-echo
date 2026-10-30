/**
 * NotificationContext.jsx
 * Provides notifications state to the entire app.
 * Wraps useNotifications and exposes it via context.
 */
import { createContext, useContext } from 'react'
import { useNotifications } from '../hooks/useNotifications'
import { useAuth } from './AuthContext'

const NotificationContext = createContext(null)

export function NotificationProvider({ children }) {
  const { user } = useAuth()
  const notif = useNotifications()

  // When user is not logged in, return sensible defaults
  if (!user) {
    return (
      <NotificationContext.Provider value={{
        notifications: [], unreadCount: 0, loading: false,
        markRead: () => {}, markAllRead: () => {}, shownToastsRef: { current: new Set() },
      }}>
        {children}
      </NotificationContext.Provider>
    )
  }

  return (
    <NotificationContext.Provider value={notif}>
      {children}
    </NotificationContext.Provider>
  )
}

export function useNotificationContext() {
  const ctx = useContext(NotificationContext)
  if (!ctx) throw new Error('useNotificationContext must be used within NotificationProvider')
  return ctx
}
