/**
 * useNotifications.js
 * Custom hook — fetches notifications for the current user,
 * subscribes to Supabase Realtime for instant delivery,
 * and exposes mark-read helpers.
 */
import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export function useNotifications() {
  const { user } = useAuth()
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading]             = useState(true)
  const channelRef                        = useRef(null)
  // Track IDs shown as toasts this session so we never re-show them after refresh
  const shownToastsRef                    = useRef(new Set())

  // ── Fetch all notifications for the current user ─────────────
  const fetchNotifications = useCallback(async () => {
    if (!user) return
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50)
    if (data) setNotifications(data)
    setLoading(false)
  }, [user])

  // ── Mark a single notification as read ───────────────────────
  const markRead = useCallback(async (notifId) => {
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notifId)
      .eq('user_id', user.id)
    setNotifications(prev =>
      prev.map(n => n.id === notifId ? { ...n, is_read: true } : n)
    )
  }, [user])

  // ── Mark all notifications as read ───────────────────────────
  const markAllRead = useCallback(async () => {
    if (!user) return
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', user.id)
      .eq('is_read', false)
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
  }, [user])

  // ── Realtime subscription ─────────────────────────────────────
  useEffect(() => {
    if (!user) return
    fetchNotifications()

    const channel = supabase
      .channel(`notifications:${user.id}`)
      .on(
        'postgres_changes',
        {
          event:  'INSERT',
          schema: 'public',
          table:  'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const newNotif = payload.new
          setNotifications(prev => [newNotif, ...prev])
          // Expose to external handler (toast popup)
          if (window.__notifHandlers) {
            window.__notifHandlers.forEach(fn => fn(newNotif, shownToastsRef.current))
          }
        }
      )
      .subscribe()

    channelRef.current = channel

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
      }
    }
  }, [user, fetchNotifications])

  const unreadCount = notifications.filter(n => !n.is_read).length

  return {
    notifications,
    unreadCount,
    loading,
    markRead,
    markAllRead,
    shownToastsRef,
    refetch: fetchNotifications,
  }
}
