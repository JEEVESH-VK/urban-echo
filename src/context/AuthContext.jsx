import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

// Roles that are allowed through each portal's login page.
// Used by signInForPortal to enforce portal-specific access.
export const PORTAL_ROLES = {
  citizen:  ['citizen'],
  municipal: ['municipal_staff', 'admin'],
  official:  ['higher_official', 'admin'],
}

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id)
      else setLoading(false)
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setUser(session?.user ?? null)
        if (session?.user) {
          await fetchProfile(session.user.id)
        } else {
          setProfile(null)
          setLoading(false)
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  async function fetchProfile(userId) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (error) {
        // Profile might not exist yet (just registered), retry once
        if (error.code === 'PGRST116') {
          setTimeout(async () => {
            const retry = await supabase
              .from('profiles')
              .select('*')
              .eq('id', userId)
              .single()
            if (!retry.error) setProfile(retry.data)
            setLoading(false)
          }, 1500)
        } else {
          console.error('Profile fetch error:', error)
          setLoading(false)
        }
      } else {
        setProfile(data)
        setLoading(false)
      }
    } catch (err) {
      console.error('Profile fetch error:', err)
      setLoading(false)
    }
  }

  async function signUp({ email, password, fullName, phone, area }) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
      },
    })
    if (error) throw error

    // Profile is auto-created by the DB trigger (handle_new_user) with role='citizen'.
    // We upsert here to fill in phone and area which the trigger does not know.
    // Role is ALWAYS 'citizen' — the RLS policy and DB trigger both enforce this.
    if (data.user) {
      const { error: profileError } = await supabase.from('profiles').upsert({
        id: data.user.id,
        full_name: fullName,
        email,
        phone,
        area,
        role: 'citizen', // hardcoded — RLS blocks any other value from the frontend
      })
      if (profileError) console.error('Profile creation error:', profileError)
    }

    return data
  }

  // Standard sign-in — does NOT enforce portal role.
  // Use signInForPortal on login pages that need portal-specific role checks.
  async function signIn({ email, password }) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    return data
  }

  // Portal-aware sign-in used by MunicipalLogin and OfficialLogin.
  // Signs the user in and immediately verifies their role matches the portal.
  // If the role does not match, the session is signed out and an error is thrown.
  // allowedRoles: array of role strings that this portal accepts (e.g. ['municipal_staff','admin'])
  async function signInForPortal({ email, password, allowedRoles, portalName }) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error

    // Fetch the user's profile to verify their role
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('role, full_name')
      .eq('id', data.user.id)
      .single()

    if (profileError || !profileData) {
      await supabase.auth.signOut()
      throw new Error('Unable to verify account permissions. Please try again.')
    }

    if (!allowedRoles.includes(profileData.role)) {
      // Sign out immediately — do not leave a valid session for the wrong portal
      await supabase.auth.signOut()
      throw new Error(
        `Access denied. This portal is for ${portalName} accounts only. ` +
        `Your account (${profileData.role}) does not have permission here.`
      )
    }

    return data
  }

  async function signOut() {
    await supabase.auth.signOut()
    setUser(null)
    setProfile(null)
  }

  async function refreshProfile() {
    if (user) await fetchProfile(user.id)
  }

  const value = {
    user,
    profile,
    loading,
    role: profile?.role || null,
    isAuthenticated: !!user,
    signUp,
    signIn,
    signInForPortal,
    signOut,
    refreshProfile,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
