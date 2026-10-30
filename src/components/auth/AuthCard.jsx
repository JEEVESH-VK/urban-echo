import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Building2, Eye, EyeOff, ArrowLeft } from 'lucide-react'

export default function AuthCard({
  title,
  subtitle,
  onSubmit,
  error,
  children,
  backLink,
  backLabel = 'Back',
}) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f1c30] via-[#1e3a5f] to-[#0f2040] flex items-center justify-center p-4">
      <div className="w-full max-w-md animate-slide-up">
        {/* Logo */}
        <div className="flex items-center gap-3 mb-8 justify-center">
          <div className="w-10 h-10 bg-teal-500 rounded-xl flex items-center justify-center shadow-lg">
            <Building2 className="w-6 h-6 text-white" />
          </div>
          <div>
            <span className="text-xl font-bold text-white">Urban Echo</span>
            <div className="text-xs text-teal-400 leading-none">Civic Issue Reporting</div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-slate-800">{title}</h1>
            {subtitle && <p className="text-sm text-slate-500 mt-1">{subtitle}</p>}
          </div>

          {error && (
            <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 animate-fade-in">
              {error}
            </div>
          )}

          <form onSubmit={onSubmit} noValidate>
            {children}
          </form>

          {backLink && (
            <div className="mt-6 text-center">
              <Link
                to={backLink}
                className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-[#1e3a5f] transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                {backLabel}
              </Link>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-white/40 mt-6">
          &copy; {new Date().getFullYear()} Urban Echo. All rights reserved.
        </p>
      </div>
    </div>
  )
}

export function FormField({ label, error, children }) {
  return (
    <div className="mb-4">
      <label className="label">{label}</label>
      {children}
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  )
}

export function PasswordInput({ value, onChange, placeholder = 'Password', id, name }) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative">
      <input
        id={id}
        name={name}
        type={show ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="input pr-10"
        autoComplete="current-password"
      />
      <button
        type="button"
        onClick={() => setShow(!show)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
        tabIndex={-1}
      >
        {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  )
}
