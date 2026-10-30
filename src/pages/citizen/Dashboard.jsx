import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import DashboardLayout from '../../components/layout/DashboardLayout'
import StatCard from '../../components/ui/StatCard'
import { StatusBadge, CategoryBadge } from '../../components/ui/Badge'
import EmptyState from '../../components/ui/EmptyState'
import {
  FileText, Clock, Loader2, CheckCircle2,
  Plus, Eye, AlertTriangle
} from 'lucide-react'
import { formatRelative, truncate } from '../../lib/utils'

export default function CitizenDashboard() {
  const { user, profile } = useAuth()
  const [stats, setStats] = useState({ total: 0, pending: 0, inProgress: 0, resolved: 0 })
  const [recent, setRecent] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (user) fetchData()
  }, [user])

  async function fetchData() {
    setLoading(true)
    try {
      const { data } = await supabase
        .from('complaints')
        .select('id, ref_id, category, description, status, priority, created_at, location_text')
        .eq('reporter_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50)

      if (data) {
        setRecent(data.slice(0, 6))
        const total = data.length
        const pending = data.filter(c => c.status === 'submitted' || c.status === 'under_review').length
        const inProgress = data.filter(c => ['assigned', 'in_progress'].includes(c.status)).length
        const resolved = data.filter(c => c.status === 'resolved').length
        setStats({ total, pending, inProgress, resolved })
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <DashboardLayout
      title={`Welcome back, ${profile?.full_name?.split(' ')[0] || 'Citizen'}`}
      subtitle="Track and manage your civic complaints"
    >
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Total Complaints" value={stats.total} icon={FileText} color="navy" />
        <StatCard label="Pending" value={stats.pending} icon={Clock} color="amber" sub="Submitted / Under Review" />
        <StatCard label="In Progress" value={stats.inProgress} icon={Loader2} color="orange" sub="Assigned / In Progress" />
        <StatCard label="Resolved" value={stats.resolved} icon={CheckCircle2} color="green" sub="Successfully closed" />
      </div>

      {/* Quick actions */}
      <div className="flex flex-wrap gap-3 mb-8">
        <Link to="/citizen/submit" className="btn btn-teal" id="submit-complaint-btn">
          <Plus className="w-4 h-4" />
          Report New Issue
        </Link>
        <Link to="/citizen/track" className="btn btn-outline" id="track-complaints-btn">
          <Eye className="w-4 h-4" />
          View All My Complaints
        </Link>
      </div>

      {/* Recent complaints */}
      <div className="card">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-800">Recent Complaints</h2>
          <Link to="/citizen/track" className="text-xs text-teal-600 font-medium hover:text-teal-700">
            View all →
          </Link>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : recent.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No complaints yet"
            description="You haven't submitted any complaints. Start by reporting a civic issue in your area."
            action={
              <Link to="/citizen/submit" className="btn btn-teal">
                <Plus className="w-4 h-4" /> Report Your First Issue
              </Link>
            }
          />
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Ref ID</th>
                  <th>Category</th>
                  <th>Description</th>
                  <th>Location</th>
                  <th>Status</th>
                  <th>Submitted</th>
                </tr>
              </thead>
              <tbody>
                {recent.map(c => (
                  <tr key={c.id}>
                    <td>
                      <span className="font-mono text-xs font-semibold text-[#1e3a5f]">{c.ref_id}</span>
                    </td>
                    <td><CategoryBadge category={c.category} /></td>
                    <td className="max-w-xs">
                      <span className="text-xs text-slate-600">{truncate(c.description, 60)}</span>
                    </td>
                    <td className="text-xs text-slate-500">{truncate(c.location_text, 30) || '—'}</td>
                    <td><StatusBadge status={c.status} /></td>
                    <td className="text-xs text-slate-500">{formatRelative(c.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
