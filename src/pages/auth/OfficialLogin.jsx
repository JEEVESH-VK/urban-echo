import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import AuthCard, { FormField, PasswordInput } from '../../components/auth/AuthCard'
import Spinner from '../../components/ui/Spinner'
import { BadgeCheck } from 'lucide-react'

export default function OfficialLogin() {
  const { signInForPortal, user, profile } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: '', password: '' })
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)
  const [authError, setAuthError] = useState('')

  // Redirect already-authenticated officials
  useEffect(() => {
    if (user && profile) {
      if (['higher_official', 'admin'].includes(profile.role)) {
        navigate('/official', { replace: true })
      }
    }
  }, [user, profile, navigate])

  function validate() {
    const e = {}
    if (!form.email) e.email = 'Email is required'
    if (!form.password) e.password = 'Password is required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setAuthError('')
    if (!validate()) return
    setLoading(true)
    try {
      // signInForPortal verifies the role server-side and revokes the session
      // immediately if the account role does not match higher_official or admin.
      await signInForPortal({
        email: form.email,
        password: form.password,
        allowedRoles: ['higher_official', 'admin'],
        portalName: 'Higher Official',
      })
      // Navigation handled by useEffect after profile loads
    } catch (err) {
      setAuthError(err.message || 'Login failed. Please check your credentials.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthCard
      title="Higher Official Login"
      subtitle="Executive oversight portal — Urban Echo"
      onSubmit={handleSubmit}
      error={authError}
      backLink="/"
      backLabel="Back to Home"
    >
      {/* Restricted access notice */}
      <div className="flex items-start gap-2.5 mb-5 px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg">
        <BadgeCheck className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <div className="text-xs text-amber-700 space-y-1">
          <p className="font-semibold">Restricted Access</p>
          <p>
            Reserved for designated higher officials with escalation review authority.
            Accounts are provisioned by an administrator — there is no public registration.
          </p>
        </div>
      </div>

      <FormField label="Official Email" error={errors.email}>
        <input
          id="official-email"
          type="email"
          value={form.email}
          onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
          placeholder="commissioner@municipality.gov.in"
          className={`input ${errors.email ? 'input-error' : ''}`}
          autoComplete="email"
        />
      </FormField>

      <FormField label="Password" error={errors.password}>
        <PasswordInput
          id="official-password"
          value={form.password}
          onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
          placeholder="Your password"
        />
      </FormField>

      <button
        type="submit"
        disabled={loading}
        className="btn w-full py-3 mt-2 text-base bg-amber-500 text-white hover:bg-amber-600 transition-colors"
        id="official-login-btn"
      >
        {loading ? <Spinner size="sm" color="white" /> : 'Sign In — Official Portal'}
      </button>

      <p className="mt-4 text-center text-xs text-slate-400">
        Need access? Contact your municipality administrator.
      </p>
    </AuthCard>
  )
}
