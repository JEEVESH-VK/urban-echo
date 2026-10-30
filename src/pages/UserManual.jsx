import { Link } from 'react-router-dom'
import {
  Building2, ArrowLeft, UserPlus, LogIn, Camera, MapPin,
  Search, CheckCircle2, Bell, RotateCcw, ChevronRight
} from 'lucide-react'

const steps = [
  {
    number: '01',
    icon: UserPlus,
    title: 'Register and Log In',
    color: 'bg-teal-50 text-teal-600 border-teal-200',
    dot: 'bg-teal-500',
    content: [
      'Open Urban Echo and click the Citizen Portal card on the home page.',
      'Click Register to create a free account. Enter your full name, email address, mobile number, area and a secure password.',
      'Check your inbox for a verification email and click the confirmation link. Your account will not be active until you verify.',
      'Once verified, return to the Citizen Portal and click Login. Enter your email and password to access your dashboard.',
    ],
    tip: 'Keep your verification email handy. If it does not arrive within 5 minutes, check your spam folder.',
  },
  {
    number: '02',
    icon: Camera,
    title: 'Report a Civic Issue',
    color: 'bg-blue-50 text-blue-600 border-blue-200',
    dot: 'bg-blue-500',
    content: [
      'From your dashboard, click "Report New Issue" or go to the Report Issue page in the sidebar.',
      'Select the issue category (e.g. Pothole, Garbage, Drainage, Streetlight).',
      'Write a clear description of the problem — at least 10 characters, more detail helps faster resolution.',
      'Optionally attach a photograph of the issue (JPG or PNG, maximum 5 MB). A photo significantly speeds up resolution.',
      'Enter the location address or click the GPS button to auto-detect your coordinates.',
      'Click Submit Complaint. You will receive a unique Reference ID — save it for tracking.',
    ],
    tip: 'Good photographs make a big difference. Take the photo in daylight and ensure the problem is clearly visible.',
  },
  {
    number: '03',
    icon: Search,
    title: 'Track Your Complaints',
    color: 'bg-purple-50 text-purple-600 border-purple-200',
    dot: 'bg-purple-500',
    content: [
      'Click "My Complaints" in the sidebar to see all complaints you have submitted.',
      'Each complaint shows its current status. The statuses in order are: Submitted → Under Review → Assigned → In Progress → Awaiting Verification → Verified.',
      'Click View on any complaint to see the full details, the assigned department, the resolution deadline and the status history timeline.',
      'If a complaint is overdue (past its deadline), it is automatically escalated to higher officials and highlighted in red.',
    ],
    statuses: [
      { label: 'Submitted', color: 'bg-slate-100 text-slate-700' },
      { label: 'Under Review', color: 'bg-yellow-100 text-yellow-700' },
      { label: 'In Progress', color: 'bg-orange-100 text-orange-700' },
      { label: 'Awaiting Verification', color: 'bg-purple-100 text-purple-700' },
      { label: 'Verified ✓', color: 'bg-emerald-100 text-emerald-700' },
      { label: 'Reopened', color: 'bg-rose-100 text-rose-700' },
    ],
  },
  {
    number: '04',
    icon: CheckCircle2,
    title: 'Verify Completed Work',
    color: 'bg-emerald-50 text-emerald-600 border-emerald-200',
    dot: 'bg-emerald-500',
    content: [
      'When municipal staff completes the work, they upload an after-work photograph and completion notes.',
      'Your complaint status changes to "Awaiting Verification" and you will receive a notification.',
      'Open the complaint in My Complaints and click Verify. You will see both the original complaint photo and the staff\'s after-work photo side by side.',
      'Read the staff\'s completion notes carefully.',
      'If the work looks complete and satisfactory, click "Work Completed". The complaint is marked Verified and closed.',
      'If the problem is not fixed or the work is incomplete, click "Work Not Completed", describe what is still wrong, and submit. The complaint is automatically Reopened for further action.',
    ],
    tip: 'Compare both photos carefully before deciding. Your verification directly determines whether the complaint is closed or escalated.',
  },
  {
    number: '05',
    icon: Bell,
    title: 'Understanding Notifications',
    color: 'bg-amber-50 text-amber-600 border-amber-200',
    dot: 'bg-amber-500',
    content: [
      'Urban Echo notifies you automatically at every important step. Look for the bell icon (🔔) in the top-right corner of your dashboard.',
      'A red badge on the bell shows how many unread notifications you have.',
      'Click the bell to open the notification panel. Each notification is colour-coded by type.',
      'Click any notification to go directly to the related complaint.',
      'Use "All Read" to mark all notifications as read at once.',
      'New notifications also appear as a pop-up in the bottom-right corner of the screen and dismiss automatically after 6 seconds.',
    ],
    notifTypes: [
      { label: 'Complaint submitted', color: 'bg-teal-400' },
      { label: 'Complaint assigned', color: 'bg-blue-400' },
      { label: 'Work started', color: 'bg-orange-400' },
      { label: 'Please verify completion', color: 'bg-purple-400' },
      { label: 'Complaint verified', color: 'bg-emerald-400' },
      { label: 'Complaint reopened', color: 'bg-rose-400' },
      { label: 'Official review added', color: 'bg-amber-400' },
    ],
  },
  {
    number: '06',
    icon: RotateCcw,
    title: 'Reopening Unresolved Complaints',
    color: 'bg-rose-50 text-rose-600 border-rose-200',
    dot: 'bg-rose-500',
    content: [
      'If you click "Work Not Completed" during verification, the complaint status changes to Reopened.',
      'Your feedback is sent directly to the municipal staff who submitted the evidence and to higher officials for review.',
      'A higher official can approve the original resolution, request additional evidence or send the complaint back to staff for rework.',
      'If sent back for rework, the status returns to In Progress and the cycle begins again.',
      'You will receive notifications at each stage so you always know what is happening.',
      'There is no limit on how many times a complaint can be reopened until you are satisfied with the outcome.',
    ],
    tip: 'Always describe the problem clearly when reopening. Specific feedback (e.g. "The pothole was filled but the patch has already crumbled") leads to faster and better resolution.',
  },
]

export default function UserManual() {
  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      {/* Header */}
      <header className="bg-[#1e3a5f] text-white sticky top-0 z-40 shadow-lg">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-teal-500 rounded-lg flex items-center justify-center flex-shrink-0">
              <Building2 className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="font-bold text-sm leading-tight">Urban Echo</p>
              <p className="text-teal-300 text-xs">Citizen User Manual</p>
            </div>
          </div>
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-sm text-white/80 hover:text-white font-medium transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Home
          </Link>
        </div>
      </header>

      {/* Intro */}
      <div className="bg-gradient-to-br from-[#1e3a5f] to-[#0f2a40] text-white py-12">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <h1 className="text-3xl sm:text-4xl font-extrabold mb-3">
            How to Use <span className="text-teal-400">Urban Echo</span>
          </h1>
          <p className="text-white/70 text-base max-w-xl mx-auto leading-relaxed">
            A step-by-step guide for citizens — from registering your account to
            verifying completed work and reopening unresolved complaints.
          </p>
          {/* Quick nav pills */}
          <div className="flex flex-wrap justify-center gap-2 mt-6">
            {steps.map(s => (
              <a
                key={s.number}
                href={`#step-${s.number}`}
                className="text-xs px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-full text-white/80 hover:text-white transition-colors"
              >
                {s.number}. {s.title}
              </a>
            ))}
          </div>
        </div>
      </div>

      {/* Steps */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-12 space-y-8">
        {steps.map((step, idx) => {
          const Icon = step.icon
          return (
            <div
              key={step.number}
              id={`step-${step.number}`}
              className={`bg-white rounded-2xl border shadow-sm overflow-hidden scroll-mt-20 ${step.color.split(' ')[2]}`}
            >
              {/* Step header */}
              <div className={`flex items-center gap-4 px-6 py-5 border-b ${step.color.split(' ')[2]}`}>
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${step.color}`}>
                  <Icon className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${step.color}`}>
                      STEP {step.number}
                    </span>
                  </div>
                  <h2 className="text-lg font-bold text-slate-800">{step.title}</h2>
                </div>
              </div>

              {/* Step content */}
              <div className="px-6 py-5 space-y-4">
                <ol className="space-y-3">
                  {step.content.map((line, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <div className={`mt-1 w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0 ${step.dot}`}>
                        {i + 1}
                      </div>
                      <p className="text-sm text-slate-700 leading-relaxed">{line}</p>
                    </li>
                  ))}
                </ol>

                {/* Status pills for Track step */}
                {step.statuses && (
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Complaint statuses</p>
                    <div className="flex flex-wrap gap-2">
                      {step.statuses.map(s => (
                        <span key={s.label} className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${s.color}`}>
                          {s.label}
                        </span>
                      ))}
                    </div>
                    <div className="flex items-center gap-1.5 mt-2 text-xs text-slate-400">
                      {step.statuses.slice(0, -2).map((s, i) => (
                        <span key={s.label} className="flex items-center gap-1.5">
                          <span className={`inline-block w-1.5 h-1.5 rounded-full ${step.dot}`} />
                          <span className="text-slate-500 text-[11px]">{s.label}</span>
                          {i < step.statuses.length - 3 && <ChevronRight className="w-3 h-3 text-slate-300" />}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Notification type dots */}
                {step.notifTypes && (
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Notification colour guide</p>
                    <div className="grid sm:grid-cols-2 gap-2">
                      {step.notifTypes.map(n => (
                        <div key={n.label} className="flex items-center gap-2 text-sm text-slate-600">
                          <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${n.color}`} />
                          {n.label}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Tip box */}
                {step.tip && (
                  <div className={`flex items-start gap-3 px-4 py-3 rounded-xl border text-sm ${step.color}`}>
                    <span className="font-bold flex-shrink-0">💡 Tip:</span>
                    <span>{step.tip}</span>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </main>

      {/* Footer CTA */}
      <div className="bg-[#1e3a5f] text-white py-10 mt-4">
        <div className="max-w-xl mx-auto px-4 text-center">
          <CheckCircle2 className="w-10 h-10 text-teal-400 mx-auto mb-3" />
          <h2 className="text-xl font-bold mb-2">Ready to get started?</h2>
          <p className="text-white/70 text-sm mb-6">
            Join Urban Echo and help make your city better — one complaint at a time.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link to="/citizen/register" className="btn btn-teal">
              <UserPlus className="w-4 h-4" /> Register Now
            </Link>
            <Link to="/" className="btn border border-white/30 text-white hover:bg-white/10">
              <ArrowLeft className="w-4 h-4" /> Back to Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
