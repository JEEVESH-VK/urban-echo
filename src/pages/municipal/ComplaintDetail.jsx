import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import DashboardLayout from '../../components/layout/DashboardLayout'
import { StatusBadge, PriorityBadge, CategoryBadge } from '../../components/ui/Badge'
import Spinner from '../../components/ui/Spinner'
import {
  ArrowLeft, MapPin, ExternalLink, Save, AlertCircle,
  Clock, CheckCircle2, Image, Upload, Camera, Lock, RotateCcw
} from 'lucide-react'
import toast from 'react-hot-toast'
import {
  formatDate, formatRelative, isOverdue, getOverdueDuration,
  STATUS_LABELS, STATUSES, PRIORITIES, DEPARTMENTS, uploadPhoto
} from '../../lib/utils'

// Statuses where the standard update form is locked
const LOCKED_STATUSES = ['awaiting_citizen_verification', 'verified', 'reopened', 'resolved']

export default function ComplaintDetail() {
  const { id } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()

  const [complaint, setComplaint] = useState(null)
  const [history, setHistory]     = useState([])
  const [loading, setLoading]     = useState(true)
  const [saving, setSaving]       = useState(false)

  // Standard update form
  const [form, setForm] = useState({
    status: '', priority: '', department: '',
    due_at: '', action_taken: '', resolution_notes: '',
  })

  // Resolution evidence panel
  const [showEvidencePanel, setShowEvidencePanel] = useState(false)
  const [evidenceForm, setEvidenceForm] = useState({ notes: '', photo: null })
  const [evidencePreview, setEvidencePreview] = useState(null)
  const [submittingEvidence, setSubmittingEvidence] = useState(false)
  const fileInputRef = useRef(null)

  useEffect(() => { fetchComplaint() }, [id])

  async function fetchComplaint() {
    setLoading(true)
    const { data } = await supabase
      .from('complaints')
      .select(`*, profiles:reporter_id(full_name, email, phone, area)`)
      .eq('id', id)
      .single()

    const { data: hist } = await supabase
      .from('complaint_status_history')
      .select(`*, changer:changed_by(full_name)`)
      .eq('complaint_id', id)
      .order('created_at', { ascending: false })

    if (data) {
      setComplaint(data)
      setForm({
        status:           data.status || '',
        priority:         data.priority || 'medium',
        department:       data.department || '',
        due_at:           data.due_at ? data.due_at.slice(0, 16) : '',
        action_taken:     data.action_taken || '',
        resolution_notes: data.resolution_notes || '',
      })
    }
    if (hist) setHistory(hist)
    setLoading(false)
  }

  // ── Standard save (status/priority/department/deadline/notes) ──────────────
  async function handleSave() {
    setSaving(true)
    try {
      const oldStatus = complaint.status
      const updatePayload = {
        status:           form.status,
        priority:         form.priority,
        department:       form.department || null,
        due_at:           form.due_at ? new Date(form.due_at).toISOString() : null,
        action_taken:     form.action_taken || null,
        resolution_notes: form.resolution_notes || null,
        updated_at:       new Date().toISOString(),
      }
      const { error } = await supabase.from('complaints').update(updatePayload).eq('id', id)
      if (error) throw error

      if (form.status !== oldStatus) {
        await supabase.from('complaint_status_history').insert({
          complaint_id: id, old_status: oldStatus,
          new_status: form.status, changed_by: user.id,
          remark: form.resolution_notes || form.action_taken || null,
        })
      }
      toast.success('Complaint updated successfully!')
      fetchComplaint()
    } catch (err) {
      toast.error(err.message || 'Update failed')
    } finally {
      setSaving(false)
    }
  }

  // ── Resolution evidence submission ─────────────────────────────────────────
  function handlePhotoChange(e) {
    const file = e.target.files[0]
    if (!file) return
    if (!file.type.startsWith('image/')) { toast.error('Please select an image file'); return }
    if (file.size > 5 * 1024 * 1024) { toast.error('Image must be under 5 MB'); return }
    setEvidenceForm(f => ({ ...f, photo: file }))
    setEvidencePreview(URL.createObjectURL(file))
  }

  async function handleSubmitEvidence() {
    if (!evidenceForm.notes.trim()) { toast.error('Completion notes are required'); return }
    if (!evidenceForm.photo) { toast.error('After-work photograph is required'); return }

    setSubmittingEvidence(true)
    try {
      // Upload photo to Storage under completion/ prefix
      const ext      = evidenceForm.photo.name.split('.').pop()
      const fileName = `completion/${id}-${Date.now()}.${ext}`
      const { data: uploadData, error: uploadErr } = await supabase.storage
        .from('complaint-photos')
        .upload(fileName, evidenceForm.photo, { upsert: false })
      if (uploadErr) throw uploadErr

      const { data: urlData } = supabase.storage
        .from('complaint-photos')
        .getPublicUrl(uploadData.path)
      const photoUrl = urlData.publicUrl

      // Update complaint
      const { error: updateErr } = await supabase.from('complaints').update({
        status:                       'awaiting_citizen_verification',
        completion_notes:             evidenceForm.notes.trim(),
        completion_photo_url:         photoUrl,
        completion_submitted_at:      new Date().toISOString(),
        completion_submitted_by:      user.id,
        updated_at:                   new Date().toISOString(),
      }).eq('id', id)
      if (updateErr) throw updateErr

      // Log status change
      await supabase.from('complaint_status_history').insert({
        complaint_id: id,
        old_status:   complaint.status,
        new_status:   'awaiting_citizen_verification',
        changed_by:   user.id,
        remark:       `Resolution submitted: ${evidenceForm.notes.trim()}`,
      })

      toast.success('Resolution evidence submitted! Awaiting citizen verification.')
      setShowEvidencePanel(false)
      setEvidenceForm({ notes: '', photo: null })
      setEvidencePreview(null)
      fetchComplaint()
    } catch (err) {
      toast.error(err.message || 'Evidence submission failed')
    } finally {
      setSubmittingEvidence(false)
    }
  }

  const set = key => e => setForm(f => ({ ...f, [key]: e.target.value }))

  if (loading) return (
    <DashboardLayout title="Complaint Detail" subtitle="Loading...">
      <div className="flex justify-center items-center py-24"><Spinner size="lg" color="teal" /></div>
    </DashboardLayout>
  )

  if (!complaint) return (
    <DashboardLayout title="Complaint Not Found" subtitle="">
      <div className="text-center py-12">
        <p className="text-slate-500 mb-4">Complaint not found.</p>
        <Link to="/municipal/complaints" className="btn btn-outline">Back to Complaints</Link>
      </div>
    </DashboardLayout>
  )

  const overdue  = isOverdue(complaint.due_at, complaint.status)
  const isLocked = LOCKED_STATUSES.includes(complaint.status)
  const canSubmitEvidence = complaint.status === 'in_progress'
  const isReopened = complaint.status === 'reopened'

  return (
    <DashboardLayout
      title={`Complaint ${complaint.ref_id}`}
      subtitle={`Submitted ${formatRelative(complaint.created_at)}`}
    >
      <div className="mb-5">
        <Link to="/municipal/complaints" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700">
          <ArrowLeft className="w-4 h-4" /> Back to All Complaints
        </Link>
      </div>

      {/* Overdue banner */}
      {overdue && (
        <div className="flex items-center gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-xl mb-5 text-red-700">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <div>
            <p className="font-semibold text-sm">OVERDUE — Escalated to Higher Officials</p>
            <p className="text-xs mt-0.5">This complaint is {getOverdueDuration(complaint.due_at)} overdue. Deadline was {formatDate(complaint.due_at)}.</p>
          </div>
        </div>
      )}

      {/* Awaiting verification banner */}
      {complaint.status === 'awaiting_citizen_verification' && (
        <div className="flex items-center gap-3 px-4 py-3 bg-purple-50 border border-purple-200 rounded-xl mb-5 text-purple-700">
          <Clock className="w-5 h-5 flex-shrink-0" />
          <div>
            <p className="font-semibold text-sm">Resolution Submitted — Awaiting Citizen Verification</p>
            <p className="text-xs mt-0.5">Submitted {formatDate(complaint.completion_submitted_at)}. The citizen will review and confirm completion.</p>
          </div>
        </div>
      )}

      {/* Verified banner */}
      {complaint.status === 'verified' && (
        <div className="flex items-center gap-3 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-xl mb-5 text-emerald-700">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          <div>
            <p className="font-semibold text-sm">Citizen Verified — Work Completed ✓</p>
            <p className="text-xs mt-0.5">Verified on {formatDate(complaint.citizen_verified_at)}. This complaint is now closed.</p>
          </div>
        </div>
      )}

      {/* Reopened banner */}
      {isReopened && (
        <div className="flex items-start gap-3 px-4 py-3 bg-rose-50 border border-rose-200 rounded-xl mb-5 text-rose-700">
          <RotateCcw className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-sm">Citizen Rejected Resolution — Complaint Reopened</p>
            {complaint.citizen_feedback && (
              <p className="text-xs mt-1 bg-rose-100 rounded p-2 text-rose-800">
                <span className="font-semibold">Citizen feedback:</span> {complaint.citizen_feedback}
              </p>
            )}
            <p className="text-xs mt-1 text-rose-600">Please review the feedback and take further action.</p>
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left: Complaint info */}
        <div className="lg:col-span-2 space-y-5">
          {/* Details card */}
          <div className="card p-5">
            <h2 className="font-semibold text-slate-800 mb-4 text-sm">Complaint Details</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <div><p className="text-xs text-slate-500 mb-1">Reference ID</p><p className="font-mono font-bold text-[#1e3a5f]">{complaint.ref_id}</p></div>
              <div><p className="text-xs text-slate-500 mb-1">Category</p><CategoryBadge category={complaint.category} /></div>
              <div><p className="text-xs text-slate-500 mb-1">Current Status</p><StatusBadge status={complaint.status} /></div>
              <div><p className="text-xs text-slate-500 mb-1">Priority</p><PriorityBadge priority={complaint.priority} /></div>
              <div className="sm:col-span-2">
                <p className="text-xs text-slate-500 mb-1">Location</p>
                <div className="flex items-center gap-2">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-sm text-slate-700">{complaint.location_text || 'Not specified'}</span>
                  {complaint.latitude && complaint.longitude && (
                    <a href={`https://maps.google.com/?q=${complaint.latitude},${complaint.longitude}`} target="_blank" rel="noopener noreferrer" className="text-xs text-teal-600 hover:text-teal-700 flex items-center gap-0.5">
                      <ExternalLink className="w-3 h-3" /> Map
                    </a>
                  )}
                </div>
              </div>
              <div className="sm:col-span-2">
                <p className="text-xs text-slate-500 mb-1">Description</p>
                <p className="text-sm text-slate-700 bg-slate-50 rounded-lg p-3 leading-relaxed">{complaint.description}</p>
              </div>
              {complaint.photo_url && (
                <div className="sm:col-span-2">
                  <p className="text-xs text-slate-500 mb-1.5 flex items-center gap-1"><Image className="w-3.5 h-3.5" /> Original Complaint Photo</p>
                  <a href={complaint.photo_url} target="_blank" rel="noopener noreferrer">
                    <img src={complaint.photo_url} alt="Complaint" className="w-full max-h-56 object-cover rounded-xl border border-slate-200 hover:opacity-90 transition-opacity" />
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* Resolution evidence (shown when submitted) */}
          {complaint.completion_photo_url && (
            <div className="card p-5 border-l-4 border-l-purple-400">
              <h2 className="font-semibold text-slate-800 mb-3 text-sm flex items-center gap-2">
                <Camera className="w-4 h-4 text-purple-500" /> Municipal Resolution Evidence
              </h2>
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-slate-500 mb-1">Completion Notes</p>
                  <p className="text-sm text-slate-700 bg-purple-50 rounded-lg p-3">{complaint.completion_notes}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-1.5 flex items-center gap-1"><Image className="w-3.5 h-3.5" /> After-Work Photograph</p>
                  <a href={complaint.completion_photo_url} target="_blank" rel="noopener noreferrer">
                    <img src={complaint.completion_photo_url} alt="Completion evidence" className="w-full max-h-56 object-cover rounded-xl border border-purple-200 hover:opacity-90 transition-opacity" />
                  </a>
                </div>
                <p className="text-xs text-slate-400">Submitted {formatDate(complaint.completion_submitted_at)}</p>
              </div>
            </div>
          )}

          {/* Reporter info */}
          <div className="card p-5">
            <h2 className="font-semibold text-slate-800 mb-3 text-sm">Reporter Information</h2>
            {complaint.anonymous ? (
              <p className="text-sm text-slate-400 italic">This complaint was submitted anonymously.</p>
            ) : (
              <div className="grid sm:grid-cols-2 gap-3 text-sm">
                <div><p className="text-xs text-slate-500">Name</p><p className="font-medium">{complaint.profiles?.full_name || '—'}</p></div>
                <div><p className="text-xs text-slate-500">Email</p><p>{complaint.profiles?.email || '—'}</p></div>
                <div><p className="text-xs text-slate-500">Phone</p><p>{complaint.profiles?.phone || '—'}</p></div>
                <div><p className="text-xs text-slate-500">Area</p><p>{complaint.profiles?.area || '—'}</p></div>
              </div>
            )}
          </div>

          {/* Status history */}
          <div className="card p-5">
            <h2 className="font-semibold text-slate-800 mb-3 text-sm">Status History</h2>
            {history.length === 0 ? (
              <p className="text-sm text-slate-400">No status changes yet.</p>
            ) : (
              <div className="space-y-3">
                {history.map(h => (
                  <div key={h.id} className="flex items-start gap-3 text-sm border-b border-slate-50 pb-3">
                    <div className="w-2 h-2 rounded-full bg-teal-400 mt-1.5 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-slate-700">
                        <span className="text-slate-400">{STATUS_LABELS[h.old_status] || h.old_status}</span>
                        {' → '}
                        <strong>{STATUS_LABELS[h.new_status] || h.new_status}</strong>
                      </p>
                      {h.remark && <p className="text-xs text-slate-500 mt-0.5">{h.remark}</p>}
                      <p className="text-xs text-slate-400">{h.changer?.full_name || 'Staff'} • {formatDate(h.created_at)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: Management panel */}
        <div className="space-y-5">

          {/* ── SUBMIT RESOLUTION EVIDENCE (only when in_progress) ── */}
          {canSubmitEvidence && (
            <div className="card p-5 border-2 border-teal-200 bg-teal-50/40">
              <h2 className="font-semibold text-teal-800 mb-2 text-sm flex items-center gap-2">
                <Camera className="w-4 h-4" /> Submit Resolution Evidence
              </h2>
              <p className="text-xs text-teal-700 mb-4">
                Upload completion proof to send this complaint for citizen verification.
                You cannot mark it directly as resolved — the citizen must verify.
              </p>

              {!showEvidencePanel ? (
                <button
                  onClick={() => setShowEvidencePanel(true)}
                  className="btn btn-teal w-full"
                  id="open-evidence-panel-btn"
                >
                  <Upload className="w-4 h-4" /> Upload Completion Evidence
                </button>
              ) : (
                <div className="space-y-4 animate-slide-up">
                  <div>
                    <label className="label">Completion Notes <span className="text-red-500">*</span></label>
                    <textarea
                      value={evidenceForm.notes}
                      onChange={e => setEvidenceForm(f => ({ ...f, notes: e.target.value }))}
                      rows={3}
                      placeholder="Describe the work completed in detail..."
                      className="input resize-y"
                      id="completion-notes"
                    />
                  </div>
                  <div>
                    <label className="label">After-Work Photograph <span className="text-red-500">*</span></label>
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="border-2 border-dashed border-teal-300 rounded-xl p-4 text-center cursor-pointer hover:border-teal-500 hover:bg-teal-50 transition-colors"
                    >
                      {evidencePreview ? (
                        <img src={evidencePreview} alt="Preview" className="w-full max-h-40 object-cover rounded-lg" />
                      ) : (
                        <div className="flex flex-col items-center gap-2 text-slate-400">
                          <Camera className="w-8 h-8" />
                          <p className="text-sm">Click to select photo</p>
                          <p className="text-xs">JPG, PNG, WebP — max 5 MB</p>
                        </div>
                      )}
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handlePhotoChange}
                      id="completion-photo-input"
                    />
                    {evidencePreview && (
                      <button onClick={() => { setEvidenceForm(f => ({ ...f, photo: null })); setEvidencePreview(null) }}
                        className="mt-1 text-xs text-slate-400 hover:text-red-500">
                        Remove photo
                      </button>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => { setShowEvidencePanel(false); setEvidenceForm({ notes: '', photo: null }); setEvidencePreview(null) }}
                      className="btn btn-ghost flex-1">Cancel</button>
                    <button
                      onClick={handleSubmitEvidence}
                      disabled={submittingEvidence}
                      className="btn btn-teal flex-1"
                      id="submit-evidence-btn"
                    >
                      {submittingEvidence ? <Spinner size="sm" color="white" /> : <><Upload className="w-4 h-4" /> Submit</>}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── LOCKED STATE banners ── */}
          {complaint.status === 'awaiting_citizen_verification' && (
            <div className="card p-5 bg-purple-50 border border-purple-200 flex items-start gap-3">
              <Lock className="w-5 h-5 text-purple-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-purple-800">Update form locked</p>
                <p className="text-xs text-purple-600 mt-1">Waiting for citizen to verify the completed work. You will be notified if they reopen it.</p>
              </div>
            </div>
          )}

          {complaint.status === 'verified' && (
            <div className="card p-5 bg-emerald-50 border border-emerald-200 flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-emerald-800">Complaint Closed</p>
                <p className="text-xs text-emerald-600 mt-1">The citizen verified that work was completed successfully.</p>
              </div>
            </div>
          )}

          {/* ── STANDARD UPDATE FORM (not locked, not in_progress evidence mode) ── */}
          {!isLocked && !canSubmitEvidence && (
            <div className="card p-5">
              <h2 className="font-semibold text-slate-800 mb-4 text-sm">Update Complaint</h2>
              <div className="space-y-4">
                <div>
                  <label className="label">Status</label>
                  <select value={form.status} onChange={set('status')} className="input">
                    {/* STATUSES array no longer contains 'resolved' — see utils.js */}
                    {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Priority</label>
                  <select value={form.priority} onChange={set('priority')} className="input">
                    {PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Assign Department</label>
                  <select value={form.department} onChange={set('department')} className="input">
                    <option value="">Select department...</option>
                    {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Resolution Deadline</label>
                  <input type="datetime-local" value={form.due_at} onChange={set('due_at')} className="input" id="due-at" />
                </div>
                <div>
                  <label className="label">Action Taken</label>
                  <textarea value={form.action_taken} onChange={set('action_taken')} rows={2}
                    placeholder="Describe action taken..." className="input resize-y" />
                </div>
                <div>
                  <label className="label">Notes</label>
                  <textarea value={form.resolution_notes} onChange={set('resolution_notes')} rows={3}
                    placeholder="Internal notes..." className="input resize-y" />
                </div>
                <button onClick={handleSave} disabled={saving} className="btn btn-teal w-full" id="save-complaint-btn">
                  {saving ? <Spinner size="sm" color="white" /> : <><Save className="w-4 h-4" /> Save Changes</>}
                </button>
              </div>
            </div>
          )}

          {/* Reopened — show update form so staff can re-work */}
          {isReopened && (
            <div className="card p-5">
              <h2 className="font-semibold text-rose-800 mb-2 text-sm flex items-center gap-2">
                <RotateCcw className="w-4 h-4" /> Reopen Action Required
              </h2>
              <p className="text-xs text-rose-600 mb-4">Address the citizen's feedback and set status back to In Progress when ready to rework.</p>
              <div className="space-y-4">
                <div>
                  <label className="label">Status</label>
                  <select value={form.status} onChange={set('status')} className="input">
                    {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Action Plan / Notes</label>
                  <textarea value={form.action_taken} onChange={set('action_taken')} rows={3}
                    placeholder="Describe your action plan to address the citizen's concern..." className="input resize-y" />
                </div>
                <button onClick={handleSave} disabled={saving} className="btn btn-primary w-full">
                  {saving ? <Spinner size="sm" color="white" /> : <><Save className="w-4 h-4" /> Update & Re-assign</>}
                </button>
              </div>
            </div>
          )}

          {/* Timeline meta */}
          <div className="card p-5">
            <h2 className="font-semibold text-slate-800 mb-3 text-sm">Timeline</h2>
            <div className="space-y-2 text-xs text-slate-600">
              <div className="flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span>Submitted {formatDate(complaint.created_at)}</span>
              </div>
              {complaint.due_at && (
                <div className={`flex items-center gap-2 ${overdue ? 'text-red-600 font-semibold' : ''}`}>
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>Deadline: {formatDate(complaint.due_at)}</span>
                </div>
              )}
              {complaint.completion_submitted_at && (
                <div className="flex items-center gap-2 text-purple-600">
                  <Camera className="w-3.5 h-3.5" />
                  <span>Evidence submitted {formatDate(complaint.completion_submitted_at)}</span>
                </div>
              )}
              {complaint.citizen_verified_at && (
                <div className={`flex items-center gap-2 ${complaint.status === 'verified' ? 'text-emerald-600' : 'text-rose-600'}`}>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Citizen responded {formatDate(complaint.citizen_verified_at)}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
