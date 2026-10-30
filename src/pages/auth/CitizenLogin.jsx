import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import AuthCard, { FormField, PasswordInput } from '../../components/auth/AuthCard'
import Spinner from '../../components/ui/Spinner'
import { MailCheck } from 'lucide-react'

export default function CitizenLogin() {
  const { signIn, signOut, user, profile } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: '', password: '' })
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)
  const [authError, setAuthError] = useState('')
  const [needsVerification, setNeedsVerification] = useState(false)

  // Redirect already-authenticated citizens
  useEffect(() => {
    if (user && profile) {
      if (profile.role === 'citizen') navigate('/citizen', { replace: true })
    }
  }, [user, profile, navigate])

  function validate() {
    const e = {}
    if (!form.email) e.email = 'Email is required'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Invalid email format'
    if (!form.password) e.password = 'Password is required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setAuthError('')
    setNeedsVerification(false)
    if (!validate()) return
    setLoading(true)
    try {
      const data = await signIn({ email: form.email, password: form.password })

      // Enforce email verification for citizens
      // email_confirmed_at is null when the user has not verified their email yet
      if (!data.user?.email_confirmed_at) {
        // Sign out immediately — do not grant dashboard access to unverified accounts
        await signOut()
        setNeedsVerification(true)
        return
      }

      // Navigation to /citizen is handled by the useEffect above after profile loads
    } catch (err) {
      setAuthError(err.message || 'Login failed. Please check your credentials.')
    } finally {
      setLoading(false)
    }
  }

  // Unverified email prompt
  if (needsVerification) {
    return (
      <AuthCard
        title="Verify Your Email"
        subtitle="One step remaining before you can log in"
        onSubmit={e => e.preventDefault()}
        backLink="/citizen/login"
        backLabel="Back to Login"
      >
        <div className="flex flex-col items-center gap-4 py-4 text-center">
          <div className="w-16 h-16 bg-teal-100 rounded-full flex items-center justify-center">
            <MailCheck className="w-8 h-8 text-teal-600" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-slate-800 mb-1">Email not verified</h3>
            <p className="text-sm text-slate-500">
              We sent a verification link to <strong>{form.email}</strong>.<br />
              Please open that email and click the link, then return here to log in.
            </p>
          </div>
          <div className="w-full px-4 py-3 bg-teal-50 border border-teal-200 rounded-lg text-xs text-teal-700 text-left">
            <p className="font-semibold mb-1">Didn't receive the email?</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Check your spam / junk folder</li>
              <li>Make sure you registered with <strong>{form.email}</strong></li>
              <li>The link expires after 24 hours — register again if it has expired</li>
            </ul>
          </div>
          <button
            onClick={() => { setNeedsVerification(false); setForm({ email: '', password: '' }) }}
            className="btn btn-teal w-full py-3"
          >
            Back to Login
          </button>
        </div>
      </AuthCard>
    )
  }

  return (
    <AuthCard
      title="Citizen Login"
      subtitle="Access your Urban Echo citizen portal"
      onSubmit={handleSubmit}
      error={authError}
      backLink="/"
      backLabel="Back to Home"
    >
      <FormField label="Email Address" error={errors.email}>
        <input
          id="email"
          type="email"
          value={form.email}
          onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
          placeholder="you@example.com"
          className={`input ${errors.email ? 'input-error' : ''}`}
          autoComplete="email"
        />
      </FormField>

      <FormField label="Password" error={errors.password}>
        <PasswordInput
          id="citizen-password"
          value={form.password}
          onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
          placeholder="Your password"
        />
      </FormField>

      <button
        type="submit"
        disabled={loading}
        className="btn btn-teal w-full py-3 mt-2 text-base"
        id="citizen-login-btn"
      >
        {loading ? <Spinner size="sm" color="white" /> : 'Sign In'}
      </button>

      <div className="mt-5 text-center text-sm text-slate-500">
        Don&apos;t have an account?{' '}
        <Link to="/citizen/register" className="text-teal-600 font-semibold hover:text-teal-700">
          Register here
        </Link>
      </div>
    </AuthCard>
  )
}
