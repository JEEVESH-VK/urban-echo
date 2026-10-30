import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import DashboardLayout from '../../components/layout/DashboardLayout'
import StatCard from '../../components/ui/StatCard'
import { StatusBadge, PriorityBadge, CategoryBadge } from '../../components/ui/Badge'
import EmptyState from '../../components/ui/EmptyState'
import Modal from '../../components/ui/Modal'
import Spinner from '../../components/ui/Spinner'
import {
  AlertTriangle, Clock, Building2, FileText,
  ExternalLink, Save, CheckCircle2, AlertCircle,
  RotateCcw, Camera, MessageSquare, ThumbsUp, RefreshCw
} from 'lucide-react'
import toast from 'react-hot-toast'
import {
  formatDate, getOverdueDuration, truncate,
  STATUS_LABELS
} from '../../lib/utils'

function DeptBadge({ dept }) {
  if (!dept) return <span className="text-slate-400 text-xs">—</span>
  return <span className="badge bg-indigo-100 text-indigo-700">{dept}</span>
}

export default function OfficialDashboard() {
  const { user } = useAuth()

  // Overdue escalated complaints
  const [overdue, setOverdue]       = useState([])
  // Reopened by citizen
  const [reopened, setReopened]     = useState([])
  const [loading, setLoading]       = useState(true)
  const [deptStats, setDeptStats]   = useState([])

  // Modal state
  const [selected, setSelected]         = useState(null)
  const [modalOpen, setModalOpen]       = useState(false)
  const [activeTab, setActiveTab]       = useState('overview')   // 'overview' | 'evidence' | 'feedback'
  const [hasViewedEvidence, setHasViewedEvidence] = useState(false)
  const [remark, setRemark]             = useState('')
  const [saving, setSaving]             = useState(false)
  const [existingRemarks, setExistingRemarks] = useState([])

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    setLoading(true)
    try {
      const SELECT_FIELDS = `
        id, ref_id, category, description, status, priority,
        department, location_text, latitude, longitude,
        due_at, created_at, updated_at, action_taken, resolution_notes,
        photo_url, completion_notes, completion_photo_url,
        completion_submitted_at, citizen_feedback, citizen_verified_at,
        profiles:reporter_id(full_name, area)
      `

      // Overdue (past deadline, not terminal)
      const { data: od } = await supabase
        .from('complaints')
        .select(SELECT_FIELDS)
        .not('status', 'in', '("verified","resolved","reopened")')
        .not('due_at', 'is', null)
        .lt('due_at', new Date().toISOString())
        .order('due_at', { ascending: true })

      // Reopened by citizen
      const { data: rp } = await supabase
        .from('complaints')
        .select(SELECT_FIELDS)
        .eq('status', 'reopened')
        .order('citizen_verified_at', { ascending: false })

      if (od) {
        setOverdue(od)
        const deptMap = {}
        od.forEach(c => { const d = c.department || 'Unassigned'; deptMap[d] = (deptMap[d] || 0) + 1 })
        setDeptStats(Object.entries(deptMap).map(([dept, count]) => ({ dept, count })).sort((a, b) => b.count - a.count))
      }
      if (rp) setReopened(rp)
    } finally {
      setLoading(false)
    }
  }

  async function openComplaint(c) {
    setSelected(c)
    setRemark('')
    setActiveTab('overview')
    setHasViewedEvidence(false)
    setModalOpen(true)
    const { data } = await supabase
      .from('official_remarks')
      .select(`*, official:official_id(full_name)`)
      .eq('complaint_id', c.id)
      .order('created_at', { ascending: false })
    setExistingRemarks(data || [])
  }

  async function submitRemark() {
    if (!remark.trim()) { toast.error('Please enter a remark'); return }
    setSaving(true)
    try {
      const { error } = await supabase.from('official_remarks').insert({
        complaint_id: selected.id, official_id: user.id, remark: remark.trim(),
      })
      if (error) throw error
      toast.success('Remark saved')
      setRemark('')
      const { data } = await supabase
        .from('official_remarks')
        .select(`*, official:official_id(full_name)`)
        .eq('complaint_id', selected.id)
        .order('created_at', { ascending: false })
      setExistingRemarks(data || [])
    } catch (err) {
      toast.error(err.message || 'Failed to save remark')
    } finally {
      setSaving(false)
    }
  }

  // Official approves the resolution → mark verified
  async function handleApproveResolution() {
    if (!hasViewedEvidence) { toast.error('Please view the completion evidence before approving'); return }
    if (!remark.trim()) { toast.error('Add a remark documenting your review before approving'); return }
    setSaving(true)
    try {
      const { error: updateErr } = await supabase.from('complaints').update({
        status: 'verified', updated_at: new Date().toISOString(),
      }).eq('id', selected.id)
      if (updateErr) throw updateErr

      await supabase.from('official_remarks').insert({
        complaint_id: selected.id, official_id: user.id,
        remark: `[Official Approval] ${remark.trim()}`,
      })
      await supabase.from('complaint_status_history').insert({
        complaint_id: selected.id, old_status: selected.status,
        new_status: 'verified', changed_by: user.id,
        remark: `Official approved: ${remark.trim()}`,
      })
      toast.success('Resolution approved — complaint verified.')
      setModalOpen(false)
      fetchData()
    } catch (err) {
      toast.error(err.message || 'Failed to approve')
    } finally {
      setSaving(false)
    }
  }

  // Official sends back to staff for rework
  async function handleRequestEvidence() {
    if (!remark.trim()) { toast.error('Please provide instructions for the staff'); return }
    setSaving(true)
    try {
      const { error: updateErr } = await supabase.from('complaints').update({
        status: 'in_progress', updated_at: new Date().toISOString(),
      }).eq('id', selected.id)
      if (updateErr) throw updateErr

      await supabase.from('official_remarks').insert({
        complaint_id: selected.id, official_id: user.id,
        remark: `[Request Additional Evidence] ${remark.trim()}`,
      })
      await supabase.from('complaint_status_history').insert({
        complaint_id: selected.id, old_status: selected.status,
        new_status: 'in_progress', changed_by: user.id,
        remark: `Official requested re-work: ${remark.trim()}`,
      })
      toast.success('Complaint sent back to municipal staff for rework.')
      setModalOpen(false)
      fetchData()
    } catch (err) {
      toast.error(err.message || 'Failed')
    } finally {
      setSaving(false)
    }
  }

  const isReopenedComplaint = selected?.status === 'reopened'
  const isOverdueComplaint  = selected && !isReopenedComplaint

  return (
    <DashboardLayout
      title="Higher Officials Dashboard"
      subtitle="Review escalated, overdue and citizen-reopened complaints"
    >
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Overdue / Escalated" value={overdue.length} icon={AlertTriangle} color="red" sub="Past SLA deadline" />
        <StatCard label="Reopened by Citizens" value={reopened.length} icon={RotateCcw} color="purple" sub="Awaiting review" />
        <StatCard label="Departments Affected" value={deptStats.length} icon={Building2} color="amber" />
        <StatCard label="Critical Priority" value={[...overdue, ...reopened].filter(c => c.priority === 'critical').length} icon={AlertCircle} color="red" />
      </div>

      {/* ── REOPENED BY CITIZENS (primary action queue) ── */}
      <div className="card mb-6">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
          <RotateCcw className="w-4 h-4 text-rose-500" />
          <h2 className="font-semibold text-slate-800">Complaints Reopened by Citizens</h2>
          <span className="ml-auto badge badge-reopened">{reopened.length} reopened</span>
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Spinner size="lg" color="teal" /></div>
        ) : reopened.length === 0 ? (
          <EmptyState icon={CheckCircle2} title="No reopened complaints" description="No citizens have rejected a resolution." />
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Ref ID</th>
                  <th>Category</th>
                  <th>Department</th>
                  <th>Citizen Feedback</th>
                  <th>Reopened</th>
                  <th>Priority</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {reopened.map(c => (
                  <tr key={c.id} className="bg-rose-50/30 hover:bg-rose-50/60">
                    <td><span className="font-mono text-xs font-bold text-rose-700">{c.ref_id}</span></td>
                    <td><CategoryBadge category={c.category} /></td>
                    <td><DeptBadge dept={c.department} /></td>
                    <td className="max-w-xs text-xs text-slate-600">{truncate(c.citizen_feedback || '—', 60)}</td>
                    <td className="text-xs text-slate-500">{formatDate(c.citizen_verified_at)}</td>
                    <td><PriorityBadge priority={c.priority} /></td>
                    <td>
                      <button onClick={() => openComplaint(c)} className="btn btn-sm bg-rose-100 text-rose-700 hover:bg-rose-200">
                        Review
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── OVERDUE ESCALATED (existing section) ── */}
      {deptStats.length > 0 && (
        <div className="card p-5 mb-6">
          <h2 className="font-semibold text-slate-800 mb-4 text-sm">Overdue Complaints by Department</h2>
          <div className="flex flex-wrap gap-3">
            {deptStats.map(({ dept, count }) => (
              <div key={dept} className="flex items-center gap-2 px-4 py-2.5 bg-red-50 border border-red-100 rounded-xl">
                <Building2 className="w-4 h-4 text-red-500" />
                <span className="text-sm font-medium text-slate-700">{dept}</span>
                <span className="text-lg font-bold text-red-600">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-500" />
          <h2 className="font-semibold text-slate-800">Escalated Overdue Complaints</h2>
          <span className="ml-auto badge badge-overdue">{overdue.length} overdue</span>
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><div className="w-8 h-8 border-2 border-red-400 border-t-transparent rounded-full animate-spin" /></div>
        ) : overdue.length === 0 ? (
          <EmptyState icon={CheckCircle2} title="No escalated complaints" description="All complaints are within their SLA deadlines." />
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Ref ID</th><th>Category</th><th>Description</th>
                  <th>Department</th><th>Deadline</th><th>Overdue By</th>
                  <th>Priority</th><th>Status</th><th></th>
                </tr>
              </thead>
              <tbody>
                {overdue.map(c => (
                  <tr key={c.id} className="bg-red-50/30 hover:bg-red-50/60">
                    <td><span className="font-mono text-xs font-bold text-red-700">{c.ref_id}</span></td>
                    <td><CategoryBadge category={c.category} /></td>
                    <td className="max-w-xs text-xs text-slate-600">{truncate(c.description, 50)}</td>
                    <td><DeptBadge dept={c.department} /></td>
                    <td className="text-xs text-red-600 font-medium">{formatDate(c.due_at)}</td>
                    <td><span className="text-xs font-bold text-red-700 bg-red-100 px-2 py-0.5 rounded-full">{getOverdueDuration(c.due_at)} overdue</span></td>
                    <td><PriorityBadge priority={c.priority} /></td>
                    <td><StatusBadge status={c.status} /></td>
                    <td>
                      <button onClick={() => openComplaint(c)} className="btn btn-ghost btn-sm text-red-600 hover:bg-red-50">Review</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── REVIEW MODAL ── */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)}
        title={selected ? `Review: ${selected.ref_id}` : ''} size="lg">
        {selected && (
          <div className="space-y-5">

            {/* Status banner */}
            {isReopenedComplaint ? (
              <div className="flex items-start gap-3 px-4 py-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700">
                <RotateCcw className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-sm">Citizen Rejected Resolution</p>
                  <p className="text-xs mt-0.5">Department: <strong>{selected.department || 'Unassigned'}</strong></p>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-red-700">
                <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-sm">OVERDUE — {getOverdueDuration(selected.due_at)} past deadline</p>
                  <p className="text-xs mt-0.5">Department: <strong>{selected.department || 'Unassigned'}</strong> • Deadline: {formatDate(selected.due_at)}</p>
                </div>
              </div>
            )}

            {/* Tabs */}
            <div className="flex border-b border-slate-200">
              {['overview', 'evidence', 'feedback'].map(tab => (
                <button key={tab}
                  onClick={() => {
                    setActiveTab(tab)
                    if (tab === 'evidence') setHasViewedEvidence(true)
                  }}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors capitalize ${
                    activeTab === tab ? 'border-teal-500 text-teal-700' : 'border-transparent text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {tab === 'evidence' ? '📸 Resolution Evidence' : tab === 'feedback' ? '💬 Citizen Feedback' : '📋 Overview'}
                </button>
              ))}
            </div>

            {/* Tab: Overview */}
            {activeTab === 'overview' && (
              <div className="grid sm:grid-cols-2 gap-4 text-sm animate-fade-in">
                <div><p className="text-xs text-slate-500 mb-0.5">Category</p><CategoryBadge category={selected.category} /></div>
                <div><p className="text-xs text-slate-500 mb-0.5">Priority</p><PriorityBadge priority={selected.priority} /></div>
                <div><p className="text-xs text-slate-500 mb-0.5">Status</p><StatusBadge status={selected.status} /></div>
                <div>
                  <p className="text-xs text-slate-500 mb-0.5">Location</p>
                  <div className="flex items-center gap-1">
                    <span className="text-slate-700">{selected.location_text || 'Not specified'}</span>
                    {selected.latitude && (
                      <a href={`https://maps.google.com/?q=${selected.latitude},${selected.longitude}`}
                        target="_blank" rel="noopener noreferrer" className="text-teal-600 hover:text-teal-700">
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                </div>
                <div className="sm:col-span-2">
                  <p className="text-xs text-slate-500 mb-1">Description</p>
                  <p className="text-slate-700 bg-slate-50 rounded-lg p-3 text-sm">{selected.description}</p>
                </div>
                {selected.photo_url && (
                  <div className="sm:col-span-2">
                    <p className="text-xs text-slate-500 mb-1">Original complaint photo</p>
                    <img src={selected.photo_url} alt="Complaint" className="w-full max-h-48 object-cover rounded-xl border border-slate-200" />
                  </div>
                )}
                {selected.action_taken && (
                  <div className="sm:col-span-2">
                    <p className="text-xs text-slate-500 mb-1">Action Taken by Staff</p>
                    <p className="text-slate-700 bg-blue-50 rounded-lg p-3 text-sm">{selected.action_taken}</p>
                  </div>
                )}
              </div>
            )}

            {/* Tab: Resolution Evidence */}
            {activeTab === 'evidence' && (
              <div className="space-y-4 animate-fade-in">
                {selected.completion_photo_url ? (
                  <>
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Completion notes from staff</p>
                      <p className="text-slate-700 bg-purple-50 rounded-lg p-3 text-sm">{selected.completion_notes || '—'}</p>
                    </div>
                    <div className="grid sm:grid-cols-2 gap-4">
                      {selected.photo_url && (
                        <div>
                          <p className="text-xs text-slate-500 mb-1 font-medium">Before (original complaint)</p>
                          <a href={selected.photo_url} target="_blank" rel="noopener noreferrer">
                            <img src={selected.photo_url} alt="Before" className="w-full h-40 object-cover rounded-xl border border-slate-200 hover:opacity-90 transition-opacity" />
                          </a>
                        </div>
                      )}
                      <div>
                        <p className="text-xs text-slate-500 mb-1 font-medium">After (completion evidence)</p>
                        <a href={selected.completion_photo_url} target="_blank" rel="noopener noreferrer">
                          <img src={selected.completion_photo_url} alt="After" className="w-full h-40 object-cover rounded-xl border border-purple-200 hover:opacity-90 transition-opacity" />
                        </a>
                      </div>
                    </div>
                    <p className="text-xs text-slate-400">Evidence submitted {formatDate(selected.completion_submitted_at)}</p>
                    <div className="flex items-center gap-2 text-xs text-emerald-600 bg-emerald-50 px-3 py-2 rounded-lg">
                      <CheckCircle2 className="w-4 h-4" />
                      Evidence reviewed — you may now approve or request rework below.
                    </div>
                  </>
                ) : (
                  <div className="text-center py-8 text-slate-400">
                    <Camera className="w-10 h-10 mx-auto mb-2 opacity-40" />
                    <p className="text-sm">No completion evidence submitted yet.</p>
                  </div>
                )}
              </div>
            )}

            {/* Tab: Citizen Feedback */}
            {activeTab === 'feedback' && (
              <div className="space-y-3 animate-fade-in">
                {selected.citizen_feedback ? (
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Citizen's rejection feedback</p>
                    <p className="text-slate-800 bg-rose-50 border border-rose-200 rounded-lg p-4 text-sm leading-relaxed">{selected.citizen_feedback}</p>
                    <p className="text-xs text-slate-400 mt-1">Submitted {formatDate(selected.citizen_verified_at)}</p>
                  </div>
                ) : (
                  <div className="text-center py-8 text-slate-400">
                    <MessageSquare className="w-10 h-10 mx-auto mb-2 opacity-40" />
                    <p className="text-sm">No citizen feedback for this complaint.</p>
                  </div>
                )}
              </div>
            )}

            {/* Existing remarks */}
            {existingRemarks.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-slate-700 mb-2">Official Remarks</h3>
                <div className="space-y-2">
                  {existingRemarks.map(r => (
                    <div key={r.id} className="bg-amber-50 border border-amber-100 rounded-lg p-3">
                      <p className="text-sm text-slate-700">{r.remark}</p>
                      <p className="text-xs text-slate-400 mt-1">{r.official?.full_name || 'Official'} • {formatDate(r.created_at)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Review remark + actions */}
            <div className="border-t border-slate-100 pt-4 space-y-3">
              <div>
                <label className="label">Review Remark <span className="text-red-500">*</span></label>
                <textarea value={remark} onChange={e => setRemark(e.target.value)} rows={3}
                  placeholder="Document your review decision and instructions for staff..."
                  className="input resize-y" />
              </div>

              {isReopenedComplaint ? (
                // Reopened — show approve / request rework buttons
                <div className="grid sm:grid-cols-2 gap-3">
                  <button
                    onClick={handleApproveResolution}
                    disabled={saving}
                    className="btn bg-emerald-500 text-white hover:bg-emerald-600 w-full"
                    id="official-approve-btn"
                  >
                    {saving ? <Spinner size="sm" color="white" /> : <><ThumbsUp className="w-4 h-4" /> Approve Resolution</>}
                  </button>
                  <button
                    onClick={handleRequestEvidence}
                    disabled={saving}
                    className="btn bg-orange-500 text-white hover:bg-orange-600 w-full"
                    id="official-rework-btn"
                  >
                    {saving ? <Spinner size="sm" color="white" /> : <><RefreshCw className="w-4 h-4" /> Send Back to Staff</>}
                  </button>
                </div>
              ) : (
                // Overdue — save remark only
                <button onClick={submitRemark} disabled={saving} className="btn btn-teal">
                  {saving ? <Spinner size="sm" color="white" /> : <><Save className="w-4 h-4" /> Submit Remark</>}
                </button>
              )}
            </div>
          </div>
        )}
      </Modal>
    </DashboardLayout>
  )
}
