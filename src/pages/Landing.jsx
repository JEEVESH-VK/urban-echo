import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  Building2, MapPin, AlertTriangle, BarChart3, Shield,
  Users, CheckCircle2, ArrowRight, ChevronRight,
  MessageSquare, Clock, Zap, Globe
} from 'lucide-react'

const features = [
  {
    icon: MapPin,
    title: 'GPS-Enabled Reporting',
    description: 'Pinpoint exact complaint locations with automatic GPS detection and manual address fallback.',
    color: 'bg-teal-50 text-teal-600',
  },
  {
    icon: BarChart3,
    title: 'Real-Time Tracking',
    description: 'Monitor complaint status through a visual timeline from submission to resolution.',
    color: 'bg-blue-50 text-blue-600',
  },
  {
    icon: AlertTriangle,
    title: 'Automatic Escalation',
    description: 'Overdue complaints are automatically flagged and escalated to higher officials.',
    color: 'bg-amber-50 text-amber-600',
  },
  {
    icon: Shield,
    title: 'Secure & Role-Based',
    description: 'Row-level security ensures citizens see only their data; staff see all complaints.',
    color: 'bg-purple-50 text-purple-600',
  },
  {
    icon: Users,
    title: 'Department Assignment',
    description: 'Complaints are routed to the correct municipal department with SLA deadlines.',
    color: 'bg-green-50 text-green-600',
  },
  {
    icon: MessageSquare,
    title: 'Anonymous Reporting',
    description: 'Report issues anonymously when preferred, protecting citizen identity.',
    color: 'bg-rose-50 text-rose-600',
  },
]

const stats = [
  { value: '24/7',    label: 'Complaint Submission' },
  { value: '3 Levels', label: 'Role-Based Access' },
  { value: 'Live',    label: 'Status Tracking' },
  { value: 'Photo',   label: 'Resolution Evidence' },
]

export default function LandingPage() {
  const { user, profile } = useAuth()

  function getDashboardLink() {
    if (!user || !profile) return null
    const map = {
      citizen: '/citizen',
      municipal_staff: '/municipal',
      admin: '/municipal',
      higher_official: '/official',
    }
    return map[profile.role]
  }

  const dashboardLink = getDashboardLink()

  return (
    <div className="min-h-screen bg-white font-sans">
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#1e3a5f]/95 backdrop-blur-sm border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-teal-500 rounded-lg flex items-center justify-center">
              <Building2 className="w-4.5 h-4.5 text-white" />
            </div>
            <span className="text-white font-bold text-lg">Urban Echo</span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to="/manual"
              className="text-sm text-white/80 hover:text-white font-medium transition-colors px-3 py-1.5 rounded-lg hover:bg-white/10"
            >
              User Manual
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero section */}
      <section className="relative min-h-screen bg-gradient-to-br from-[#0f1c30] via-[#1e3a5f] to-[#0f2a40] flex items-center">
        {/* Background pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-teal-400 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-blue-400 rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 pt-24 pb-16 grid lg:grid-cols-2 gap-12 items-center">
          <div className="animate-slide-up">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-teal-500/20 border border-teal-500/30 rounded-full text-teal-300 text-xs font-medium mb-6">
              <Zap className="w-3 h-3" />
              Smart City Civic Platform
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white leading-tight mb-6">
              Your City.{' '}
              <span className="text-teal-400">Your Voice.</span>
              <br />
              Better Communities.
            </h1>
            <p className="text-lg text-white/70 mb-10 leading-relaxed max-w-lg">
              Urban Echo connects citizens with municipal authorities to resolve
              public infrastructure issues faster — potholes, garbage, drainage,
              streetlights and more.
            </p>

            {/* Stats row */}
            <div className="grid grid-cols-4 gap-4 pt-8 border-t border-white/10">
              {stats.map(s => (
                <div key={s.label}>
                  <div className="text-2xl font-bold text-teal-400">{s.value}</div>
                  <div className="text-xs text-white/50 mt-0.5">{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Portal cards */}
          <div className="flex flex-col gap-5 animate-slide-in-right">
            {/* Citizen card */}
            <div className="bg-white/10 backdrop-blur border border-white/20 rounded-2xl p-6 hover:bg-white/15 transition-all duration-300">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-teal-500 rounded-xl flex items-center justify-center">
                  <Users className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-white font-bold text-lg">Citizen Portal</h2>
                  <p className="text-white/60 text-xs">Report and track your complaints</p>
                </div>
              </div>
              <ul className="space-y-2 mb-5">
                {['Submit complaints with photos & GPS', 'Track status in real-time', 'Anonymous reporting option'].map(f => (
                  <li key={f} className="flex items-center gap-2 text-sm text-white/70">
                    <CheckCircle2 className="w-4 h-4 text-teal-400 flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <div className="flex gap-3">
                <Link to="/citizen/login" className="flex-1 btn btn-teal justify-center">
                  Login <ChevronRight className="w-4 h-4" />
                </Link>
                <Link to="/citizen/register" className="flex-1 btn border border-white/30 text-white hover:bg-white/10 justify-center">
                  Register
                </Link>
              </div>
            </div>

            {/* Official card */}
            <div className="bg-white/10 backdrop-blur border border-white/20 rounded-2xl p-6 hover:bg-white/15 transition-all duration-300">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-[#1e5f9f] rounded-xl flex items-center justify-center">
                  <Shield className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-white font-bold text-lg">Municipality Portal</h2>
                  <p className="text-white/60 text-xs">Manage and resolve complaints</p>
                </div>
              </div>
              <ul className="space-y-2 mb-5">
                {['Assign complaints to departments', 'Set SLA deadlines', 'Escalation dashboard'].map(f => (
                  <li key={f} className="flex items-center gap-2 text-sm text-white/70">
                    <CheckCircle2 className="w-4 h-4 text-blue-400 flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <div className="flex gap-3">
                <Link to="/municipal/login" className="flex-1 btn btn-primary justify-center">
                  Staff Login <ChevronRight className="w-4 h-4" />
                </Link>
                <Link to="/official/login" className="flex-1 btn border border-white/30 text-white hover:bg-white/10 justify-center text-xs">
                  Higher Official
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features section */}
      <section className="py-20 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-slate-800 mb-3">Everything your city needs</h2>
            <p className="text-slate-500 max-w-xl mx-auto text-sm">
              A complete civic issue management platform built for efficiency, transparency and accountability.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map(f => (
              <div key={f.title} className="card card-hover p-6">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 ${f.color}`}>
                  <f.icon className="w-5 h-5" />
                </div>
                <h3 className="font-semibold text-slate-800 mb-2">{f.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Workflow section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-slate-800 mb-3">How it works</h2>
            <p className="text-slate-500 text-sm">From citizen to resolution in four simple steps</p>
          </div>
          <div className="grid sm:grid-cols-4 gap-6">
            {[
              { step: '01', title: 'Report Issue', desc: 'Citizen submits complaint with photo, GPS and description', icon: MapPin },
              { step: '02', title: 'Department Assigned', desc: 'Municipal staff assigns to the right department with SLA', icon: Users },
              { step: '03', title: 'Resolution Work', desc: 'Department resolves the issue and updates status', icon: Clock },
              { step: '04', title: 'Citizen Notified', desc: 'Citizen tracks resolution and sees final notes', icon: CheckCircle2 },
            ].map((s, i) => (
              <div key={s.step} className="text-center">
                <div className="w-14 h-14 bg-[#1e3a5f] rounded-2xl flex items-center justify-center mx-auto mb-4 text-white">
                  <s.icon className="w-6 h-6" />
                </div>
                <div className="text-xs text-teal-500 font-bold mb-1">{s.step}</div>
                <h3 className="font-semibold text-slate-800 mb-1 text-sm">{s.title}</h3>
                <p className="text-xs text-slate-500 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA section */}
      <section className="py-16 bg-[#1e3a5f]">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <Globe className="w-10 h-10 text-teal-400 mx-auto mb-4" />
          <h2 className="text-3xl font-bold text-white mb-3">Ready to improve your city?</h2>
          <p className="text-white/70 text-sm mb-8">Join thousands of citizens already using Urban Echo to create better communities.</p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Link to="/citizen/register" className="btn btn-teal btn-lg">
              Register as Citizen
              <ArrowRight className="w-5 h-5" />
            </Link>
            <Link to="/citizen/login" className="btn border-2 border-white/30 text-white hover:bg-white hover:text-[#1e3a5f] btn-lg">
              I Already Have an Account
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#0f1c30] py-8">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-3">
            <div className="w-7 h-7 bg-teal-500 rounded-lg flex items-center justify-center">
              <Building2 className="w-4 h-4 text-white" />
            </div>
            <span className="text-white font-bold">Urban Echo</span>
          </div>
          <p className="text-white/40 text-xs">
            Crowdsourced Civic Issue Reporting and Resolution System &mdash; &copy; {new Date().getFullYear()}
          </p>
          <div className="flex justify-center gap-6 mt-4">
            <Link to="/citizen/login" className="text-xs text-white/40 hover:text-white/70">Citizen Portal</Link>
            <Link to="/municipal/login" className="text-xs text-white/40 hover:text-white/70">Municipality Portal</Link>
            <Link to="/official/login" className="text-xs text-white/40 hover:text-white/70">Higher Officials</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
