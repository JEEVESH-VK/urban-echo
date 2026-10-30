import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import AuthCard, { FormField, PasswordInput } from '../../components/auth/AuthCard'
import Spinner from '../../components/ui/Spinner'
import toast from 'react-hot-toast'

export default function CitizenRegister() {
  const { signUp, user, profile } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({
    fullName: '', email: '', phone: '', area: '', password: '', confirmPassword: ''
  })
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)
  const [authError, setAuthError] = useState('')

  useEffect(() => {
    if (user && profile?.role === 'citizen') navigate('/citizen', { replace: true })
  }, [user, profile, navigate])

  function validate() {
    const e = {}
    if (!form.fullName.trim()) e.fullName = 'Full name is required'
    if (!form.email) e.email = 'Email is required'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Invalid email format'
    if (!form.phone.trim()) e.phone = 'Mobile number is required'
    if (!form.area.trim()) e.area = 'Area/Locality is required'
    if (!form.password) e.password = 'Password is required'
    else if (form.password.length < 6) e.password = 'Password must be at least 6 characters'
    if (!form.confirmPassword) e.confirmPassword = 'Please confirm your password'
    else if (form.password !== form.confirmPassword) e.confirmPassword = 'Passwords do not match'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setAuthError('')
    if (!validate()) return
    setLoading(true)
    try {
      const data = await signUp({
        email: form.email,
        password: form.password,
        fullName: form.fullName,
        phone: form.phone,
        area: form.area,
      })
      if (data.user && !data.session) {
        toast.success('Registration successful! Please check your email to confirm your account.')
      } else {
        toast.success('Account created successfully!')
        navigate('/citizen', { replace: true })
      }
    } catch (err) {
      setAuthError(err.message || 'Registration failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const set = key => e => setForm(f => ({ ...f, [key]: e.target.value }))

  return (
    <AuthCard
      title="Create Citizen Account"
      subtitle="Join Urban Echo and start reporting civic issues"
      onSubmit={handleSubmit}
      error={authError}
      backLink="/citizen/login"
      backLabel="Already have an account? Sign in"
    >
      <div className="grid grid-cols-2 gap-x-4">
        <div className="col-span-2">
          <FormField label="Full Name" error={errors.fullName}>
            <input id="fullName" type="text" value={form.fullName} onChange={set('fullName')}
              placeholder="Rajesh Kumar" className={`input ${errors.fullName ? 'input-error' : ''}`} />
          </FormField>
        </div>
        <div className="col-span-2">
          <FormField label="Email Address" error={errors.email}>
            <input id="email" type="email" value={form.email} onChange={set('email')}
              placeholder="you@example.com" className={`input ${errors.email ? 'input-error' : ''}`} autoComplete="email" />
          </FormField>
        </div>
        <FormField label="Mobile Number" error={errors.phone}>
          <input id="phone" type="tel" value={form.phone} onChange={set('phone')}
            placeholder="9876543210" className={`input ${errors.phone ? 'input-error' : ''}`} />
        </FormField>
        <FormField label="Area / Locality" error={errors.area}>
          <input id="area" type="text" value={form.area} onChange={set('area')}
            placeholder="Koramangala, Bengaluru" className={`input ${errors.area ? 'input-error' : ''}`} />
        </FormField>
        <FormField label="Password" error={errors.password}>
          <PasswordInput id="password" value={form.password} onChange={set('password')} placeholder="Min 6 characters" />
        </FormField>
        <FormField label="Confirm Password" error={errors.confirmPassword}>
          <PasswordInput id="confirmPassword" value={form.confirmPassword} onChange={set('confirmPassword')} placeholder="Repeat password" />
        </FormField>
      </div>

      <button type="submit" disabled={loading} className="btn btn-teal w-full py-3 mt-2 text-base" id="register-btn">
        {loading ? <Spinner size="sm" color="white" /> : 'Create Account'}
      </button>
    </AuthCard>
  )
}
