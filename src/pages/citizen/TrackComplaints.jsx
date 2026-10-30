import { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import DashboardLayout from '../../components/layout/DashboardLayout'
import { StatusBadge, PriorityBadge, CategoryBadge } from '../../components/ui/Badge'
import EmptyState from '../../components/ui/EmptyState'
import Modal from '../../components/ui/Modal'
import Spinner from '../../components/ui/Spinner'
import {
  Search, FileText, ChevronRight, AlertCircle, ExternalLink,
  CheckCircle2, XCircle, Camera, Bell, Clock, RotateCcw
} from 'lucide-react'
import toast from 'react-hot-toast'
import {
  formatDate, formatRelative, isOverdue, getOverdueDuration,
  truncate, STATUS_LABELS
} from '../../lib/utils'

// ── Inner detail panel shown inside the modal ──────────────────────────────
function ComplaintDetailPanel({ complaint, history, onVerified }) {
  const { user } = useAuth()
  const overdue = isOverdue(complaint.due_at, complaint.status)
  const isAwaitingVerification = complaint.status === 'awaiting_citizen_verification'
  const alreadyVerified = !!complaint.citizen_verified_at

  const [verifying, setVerifying]         = useState(false)
  const [rejecting, setRejecting]         = useState(false)
  const [showFeedback, setShowFeedback]   = useState(false)
  const [feedback, setFeedback]           = useState('')
  const [submitting, setSubmitting]       = useState(false)

  async function handleVerify() {
    setVerifying(true)
    try {
      const { error } = await supabase.from('complaints').update({
        status:               'verified',
        citizen_verified_at:  new Date().toISOString(),
        citizen_verified_by:  user.id,
        updated_at:           new Date().toISOString(),
      }).eq('id', complaint.id)
      if (error) throw error

      await supabase.from('complaint_status_history').insert({
        complaint_id: complaint.id,
        old_status:   complaint.status,
        new_status:   'verified',
        changed_by:   user.id,
        remark:       'Citizen confirmed work is completed.',
      })
      toast.success('Thank you! The complaint is now marked as verified.')
      onVerified()
    } catch (err) {
      toast.error(err.message || 'Verification failed')
    } finally {
      setVerifying(false)
    }
  }

  async function handleReject() {
    if (!feedback.trim()) { toast.error('Please describe what is still incomplete'); return }
    setSubmitting(true)
    try {
      const { error } = await supabase.from('complaints').update({
        status:               'reopened',
        citizen_feedback:     feedback.trim(),
        citizen_verified_at:  new Date().toISOString(),
        citizen_verified_by:  user.id,
        updated_at:           new Date().toISOString(),
      }).eq('id', complaint.id)
      if (error) throw error

      await supabase.from('complaint_status_history').insert({
        complaint_id: complaint.id,
        old_status:   complaint.status,
        new_status:   'reopened',
        changed_by:   user.id,
        remark:       `Citizen rejected: ${feedback.trim()}`,
      })
      toast.success('Complaint reopened. Municipal staff will be notified.')
      onVerified()
    } catch (err) {
      toast.error(err.message || 'Submission failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-5">
      {/* Overdue alert */}
      {overdue && (
        <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          This complaint is overdue by {getOverdueDuration(complaint.due_at)}. It has been escalated to higher officials.
        </div>
      )}

      {/* ── VERIFICATION ACTION PANEL ── */}
      {isAwaitingVerification && !alreadyVerified && (
        <div className="rounded-xl border-2 border-purple-300 bg-purple-50 p-5 space-y-4 animate-slide-up">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
              <Bell className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="font-semibold text-purple-900 text-sm">Municipal staff has submitted resolution evidence</p>
              <p className="text-xs text-purple-700 mt-0.5">Please review the completion photo and notes below, then confirm whether the work was done satisfactorily.</p>
            </div>
          </div>

          {/* Evidence display */}
          <div className="bg-white rounded-xl border border-purple-200 p-4 space-y-3">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Camera className="w-3.5 h-3.5" />
              <span>Submitted {formatDate(complaint.completion_submitted_at)}</span>
            </div>

            {/* Side-by-side photos */}
            <div className="grid sm:grid-cols-2 gap-3">
              {complaint.photo_url && (
                <div>
                  <p className="text-xs text-slate-500 mb-1 font-medium">Original complaint photo</p>
                  <a href={complaint.photo_url} target="_blank" rel="noopener noreferrer">
                    <img src={complaint.photo_url} alt="Original" className="w-full h-36 object-cover rounded-lg border border-slate-200 hover:opacity-90 transition-opacity" />
                  </a>
                </div>
              )}
              {complaint.completion_photo_url && (
                <div>
                  <p className="text-xs text-slate-500 mb-1 font-medium">After-work photo</p>
                  <a href={complaint.completion_photo_url} target="_blank" rel="noopener noreferrer">
                    <img src={complaint.completion_photo_url} alt="Completed work" className="w-full h-36 object-cover rounded-lg border border-purple-200 hover:opacity-90 transition-opacity" />
                  </a>
                </div>
              )}
            </div>

            {complaint.completion_notes && (
              <div>
                <p className="text-xs text-slate-500 mb-1 font-medium">Staff completion notes</p>
                <p className="text-sm text-slate-700 bg-purple-50 rounded-lg p-3 leading-relaxed">{complaint.completion_notes}</p>
              </div>
            )}
          </div>

          {/* Action buttons */}
          {!showFeedback ? (
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={handleVerify}
                disabled={verifying}
                className="btn bg-emerald-500 text-white hover:bg-emerald-600 w-full py-3"
                id="verify-completed-btn"
              >
                {verifying ? <Spinner size="sm" color="white" /> : <><CheckCircle2 className="w-4 h-4" /> Work Completed</>}
              </button>
              <button
                onClick={() => setShowFeedback(true)}
                className="btn bg-rose-500 text-white hover:bg-rose-600 w-full py-3"
                id="reject-completed-btn"
              >
                <XCircle className="w-4 h-4" /> Work Not Completed
              </button>
            </div>
          ) : (
            <div className="space-y-3 animate-slide-up">
              <div>
                <label className="label text-rose-700">What was not completed? <span className="text-red-500">*</span></label>
                <textarea
                  value={feedback}
                  onChange={e => setFeedback(e.target.value)}
                  rows={3}
                  placeholder="Describe what is still incomplete or not done properly..."
                  className="input border-rose-300 focus:ring-rose-400"
                  id="citizen-feedback-input"
                />
              </div>
              <div className="flex gap-2">
                <button onClick={() => setShowFeedback(false)} className="btn btn-ghost flex-1">Back</button>
                <button
                  onClick={handleReject}
                  disabled={submitting}
                  className="btn bg-rose-500 text-white hover:bg-rose-600 flex-1"
                  id="submit-rejection-btn"
                >
                  {submitting ? <Spinner size="sm" color="white" /> : <><RotateCcw className="w-4 h-4" /> Reopen Complaint</>}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Already verified message */}
      {complaint.status === 'verified' && (
        <div className="flex items-center gap-3 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          <div>
            <p className="font-semibold text-sm">You verified this complaint as completed ✓</p>
            <p className="text-xs mt-0.5">Verified on {formatDate(complaint.citizen_verified_at)}</p>
          </div>
        </div>
      )}

      {/* Already reopened message */}
      {complaint.status === 'reopened' && (
        <div className="flex items-start gap-3 px-4 py-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700">
          <RotateCcw className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-sm">You reopened this complaint</p>
            {complaint.citizen_feedback && (
              <p className="text-xs mt-1 bg-rose-100 rounded p-2">{complaint.citizen_feedback}</p>
            )}
            <p className="text-xs mt-1">Municipal staff and higher officials have been notified.</p>
          </div>
        </div>
      )}

      {/* Complaint details */}
      <div className="grid sm:grid-cols-2 gap-4 text-sm">
        <div><p className="text-slate-500 text-xs mb-0.5">Category</p><CategoryBadge category={complaint.category} /></div>
        <div><p className="text-slate-500 text-xs mb-0.5">Priority</p><PriorityBadge priority={complaint.priority} /></div>
        <div><p className="text-slate-500 text-xs mb-0.5">Assigned Department</p><p className="font-medium text-slate-700">{complaint.department || 'Not yet assigned'}</p></div>
        <div>
          <p className="text-slate-500 text-xs mb-0.5">Resolution Deadline</p>
          <p className={`font-medium ${overdue ? 'text-red-600' : 'text-slate-700'}`}>
            {complaint.due_at ? formatDate(complaint.due_at) : 'Not set'}
          </p>
        </div>
        <div className="sm:col-span-2">
          <p className="text-slate-500 text-xs mb-0.5">Location</p>
          <p className="font-medium text-slate-700">
            {complaint.location_text || 'Not specified'}
            {complaint.latitude && complaint.longitude && (
              <a href={`https://maps.google.com/?q=${complaint.latitude},${complaint.longitude}`}
                target="_blank" rel="noopener noreferrer"
                className="ml-2 text-teal-600 hover:text-teal-700 inline-flex items-center gap-1 text-xs">
                <ExternalLink className="w-3 h-3" /> View on Map
              </a>
            )}
          </p>
        </div>
        <div className="sm:col-span-2">
          <p className="text-slate-500 text-xs mb-0.5">Description</p>
          <p className="text-slate-700 text-sm leading-relaxed bg-slate-50 rounded-lg p-3">{complaint.description}</p>
        </div>
        {complaint.photo_url && !isAwaitingVerification && (
          <div className="sm:col-span-2">
            <p className="text-slate-500 text-xs mb-1.5">Complaint Photo</p>
            <img src={complaint.photo_url} alt="Complaint photo" className="w-full max-h-48 object-cover rounded-xl border border-slate-200" />
          </div>
        )}
        {complaint.resolution_notes && (
          <div className="sm:col-span-2">
            <p className="text-slate-500 text-xs mb-0.5">Resolution Notes</p>
            <p className="text-slate-700 text-sm bg-green-50 border border-green-100 rounded-lg p-3">{complaint.resolution_notes}</p>
          </div>
        )}
      </div>

      {/* Status History */}
      {history && history.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Status History</h3>
          <div className="space-y-2">
            {history.map(h => (
              <div key={h.id} className="flex items-start gap-3 text-sm">
                <div className="w-2 h-2 rounded-full bg-teal-400 mt-1.5 flex-shrink-0" />
                <div>
                  <span className="text-slate-700">
                    Status changed to <strong>{STATUS_LABELS[h.new_status] || h.new_status}</strong>
                  </span>
                  {h.remark && <p className="text-slate-500 text-xs mt-0.5">{h.remark}</p>}
                  <p className="text-xs text-slate-400">{formatDate(h.created_at)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main page component ────────────────────────────────────────────────────
export default function TrackComplaints() {
  const { user } = useAuth()
  const [complaints, setComplaints] = useState([])
  const [history, setHistory]       = useState({})
  const [loading, setLoading]       = useState(true)
  const [search, setSearch]         = useState('')
  const [selected, setSelected]     = useState(null)
  const [modalOpen, setModalOpen]   = useState(false)

  useEffect(() => { if (user) fetchComplaints() }, [user])

  async function fetchComplaints() {
    setLoading(true)
    // Fetch all new verification columns so the detail panel can display them
    const { data } = await supabase
      .from('complaints')
      .select(`
        id, ref_id, category, description, status, priority, department,
        location_text, latitude, longitude, photo_url, anonymous,
        due_at, resolution_notes, action_taken, created_at, updated_at,
        completion_notes, completion_photo_url, completion_submitted_at,
        citizen_feedback, citizen_verified_at
      `)
      .eq('reporter_id', user.id)
      .order('created_at', { ascending: false })
    if (data) setComplaints(data)
    setLoading(false)
  }

  async function openDetail(complaint) {
    setSelected(complaint)
    setModalOpen(true)
    if (!history[complaint.id]) {
      const { data } = await supabase
        .from('complaint_status_history')
        .select('*')
        .eq('complaint_id', complaint.id)
        .order('created_at', { ascending: false })
      setHistory(h => ({ ...h, [complaint.id]: data || [] }))
    }
  }

  function handleVerified() {
    setModalOpen(false)
    fetchComplaints()
  }

  const filtered = complaints.filter(c =>
    !search ||
    c.ref_id?.toLowerCase().includes(search.toLowerCase()) ||
    c.description?.toLowerCase().includes(search.toLowerCase()) ||
    c.category?.toLowerCase().includes(search.toLowerCase())
  )

  // Complaints needing citizen action
  const pendingVerification = complaints.filter(c => c.status === 'awaiting_citizen_verification')

  return (
    <DashboardLayout title="My Complaints" subtitle="Track the status of all your submitted complaints">

      {/* Verification notification banner */}
      {pendingVerification.length > 0 && (
        <div className="mb-5 flex items-start gap-3 px-4 py-4 bg-purple-50 border-2 border-purple-300 rounded-xl animate-slide-up">
          <div className="w-9 h-9 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
            <Bell className="w-5 h-5 text-purple-600" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-purple-900 text-sm">
              {pendingVerification.length === 1
                ? '1 complaint is awaiting your verification'
                : `${pendingVerification.length} complaints are awaiting your verification`}
            </p>
            <p className="text-xs text-purple-700 mt-0.5">
              Municipal staff has submitted resolution evidence. Click View on the highlighted row(s) to review and respond.
            </p>
          </div>
        </div>
      )}

      <div className="mb-4">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text" value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by ID, category or description..."
            className="input pl-9" id="complaint-search"
          />
        </div>
      </div>

      <div className="card">
        {loading ? (
          <div className="flex justify-center items-center py-16">
            <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={FileText}
            title={search ? 'No complaints match your search' : 'No complaints yet'}
            description={search ? 'Try a different search term.' : 'Submit your first complaint to get started.'}
          />
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Ref ID</th>
                  <th>Category</th>
                  <th>Description</th>
                  <th>Status</th>
                  <th>Priority</th>
                  <th>Submitted</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => {
                  const overdue = isOverdue(c.due_at, c.status)
                  const needsVerification = c.status === 'awaiting_citizen_verification'
                  return (
                    <tr key={c.id} className={
                      needsVerification ? 'bg-purple-50/60 hover:bg-purple-50' :
                      overdue ? 'bg-red-50/40' : ''
                    }>
                      <td>
                        <span className="font-mono text-xs font-bold text-[#1e3a5f]">{c.ref_id}</span>
                        {overdue && <span className="ml-1 badge badge-overdue text-xs">OVERDUE</span>}
                        {needsVerification && <span className="ml-1 badge badge-awaiting_citizen_verification text-xs">ACTION NEEDED</span>}
                      </td>
                      <td><CategoryBadge category={c.category} /></td>
                      <td className="max-w-xs text-xs text-slate-600">{truncate(c.description, 60)}</td>
                      <td><StatusBadge status={c.status} /></td>
                      <td><PriorityBadge priority={c.priority} /></td>
                      <td className="text-xs text-slate-500">{formatRelative(c.created_at)}</td>
                      <td>
                        <button
                          onClick={() => openDetail(c)}
                          className={`btn btn-sm ${needsVerification ? 'btn-teal' : 'btn-ghost'}`}
                        >
                          <ChevronRight className="w-4 h-4" />
                          {needsVerification ? 'Verify' : 'View'}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={selected ? `Complaint ${selected.ref_id}` : ''}
        size="lg"
      >
        {selected && (
          <ComplaintDetailPanel
            complaint={selected}
            history={history[selected.id] || []}
            onVerified={handleVerified}
          />
        )}
      </Modal>
    </DashboardLayout>
  )
}
