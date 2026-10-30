import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import DashboardLayout from '../../components/layout/DashboardLayout'
import StatCard from '../../components/ui/StatCard'
import { StatusBadge, PriorityBadge, CategoryBadge } from '../../components/ui/Badge'
import EmptyState from '../../components/ui/EmptyState'
import {
  FileText, AlertTriangle, Clock, CheckCircle2,
  Loader2, TrendingUp, ChevronRight, AlertCircle
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts'
import { formatRelative, truncate, isOverdue } from '../../lib/utils'

const CATEGORY_COLORS = {
  pothole: '#14b8a6',
  garbage: '#f59e0b',
  drainage: '#3b82f6',
  streetlight: '#a855f7',
  damaged_footpath: '#ef4444',
  water_leakage: '#06b6d4',
  other: '#64748b',
}

export default function MunicipalDashboard() {
  const { profile } = useAuth()
  const [stats, setStats] = useState({
    total: 0, new_complaints: 0, under_review: 0,
    in_progress: 0, resolved: 0, overdue: 0
  })
  const [recent, setRecent] = useState([])
  const [trendData, setTrendData] = useState([])
  const [categoryData, setCategoryData] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchAll()
  }, [])

  async function fetchAll() {
    setLoading(true)
    try {
      const { data } = await supabase
        .from('complaints')
        .select('id, ref_id, category, description, status, priority, created_at, due_at, department, location_text')
        .order('created_at', { ascending: false })

      if (!data) return

      const now = new Date()
      const total = data.length
      const new_complaints = data.filter(c => c.status === 'submitted').length
      const under_review = data.filter(c => c.status === 'under_review').length
      const in_progress = data.filter(c => ['assigned', 'in_progress'].includes(c.status)).length
      const resolved = data.filter(c => c.status === 'resolved').length
      const overdue = data.filter(c => isOverdue(c.due_at, c.status)).length

      setStats({ total, new_complaints, under_review, in_progress, resolved, overdue })
      setRecent(data.slice(0, 8))

      // Category breakdown
      const catMap = {}
      data.forEach(c => { catMap[c.category] = (catMap[c.category] || 0) + 1 })
      setCategoryData(
        Object.entries(catMap).map(([name, value]) => ({
          name: name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
          value,
          fill: CATEGORY_COLORS[name] || '#64748b',
        }))
      )

      // 7-day trend
      const trend = []
      for (let i = 6; i >= 0; i--) {
        const d = new Date()
        d.setDate(d.getDate() - i)
        const label = d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric' })
        const dayStart = new Date(d.setHours(0, 0, 0, 0)).toISOString()
        const dayEnd = new Date(d.setHours(23, 59, 59, 999)).toISOString()
        const count = data.filter(c => c.created_at >= dayStart && c.created_at <= dayEnd).length
        trend.push({ label, count })
      }
      setTrendData(trend)
    } finally {
      setLoading(false)
    }
  }

  return (
    <DashboardLayout
      title="Municipal Dashboard"
      subtitle="Overview of all civic complaints and resolution metrics"
    >
      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
        <StatCard label="Total" value={stats.total} icon={FileText} color="navy" />
        <StatCard label="New" value={stats.new_complaints} icon={TrendingUp} color="teal" sub="Submitted" />
        <StatCard label="Under Review" value={stats.under_review} icon={Clock} color="amber" />
        <StatCard label="In Progress" value={stats.in_progress} icon={Loader2} color="orange" />
        <StatCard label="Resolved" value={stats.resolved} icon={CheckCircle2} color="green" />
        <StatCard label="Overdue" value={stats.overdue} icon={AlertTriangle} color="red" sub="Escalated" />
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-2 gap-6 mb-8">
        {/* Trend chart */}
        <div className="card p-5">
          <h2 className="font-semibold text-slate-800 mb-4 text-sm">Complaints — Last 7 Days</h2>
          {loading ? (
            <div className="h-48 flex items-center justify-center">
              <div className="w-6 h-6 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={trendData} margin={{ left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}
                  labelStyle={{ fontWeight: 600 }}
                />
                <Bar dataKey="count" fill="#14b8a6" radius={[4, 4, 0, 0]} name="Complaints" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Category pie */}
        <div className="card p-5">
          <h2 className="font-semibold text-slate-800 mb-4 text-sm">Complaints by Category</h2>
          {loading || categoryData.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-slate-400 text-sm">
              {loading ? (
                <div className="w-6 h-6 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
              ) : 'No data available'}
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={categoryData}
                  cx="50%"
                  cy="50%"
                  outerRadius={75}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  labelLine={false}
                  fontSize={10}
                >
                  {categoryData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Recent complaints table */}
      <div className="card mb-6">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-800">Recent Complaints</h2>
          <Link to="/municipal/complaints" className="text-xs text-teal-600 font-medium hover:text-teal-700">
            View all →
          </Link>
        </div>
        {loading ? (
          <div className="flex justify-center py-10">
            <div className="w-6 h-6 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : recent.length === 0 ? (
          <EmptyState icon={FileText} title="No complaints yet" description="Complaints submitted by citizens will appear here." />
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
                  <th>Department</th>
                  <th>Submitted</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {recent.map(c => {
                  const overdue = isOverdue(c.due_at, c.status)
                  return (
                    <tr key={c.id} className={overdue ? 'bg-red-50/40' : ''}>
                      <td>
                        <span className="font-mono text-xs font-bold text-[#1e3a5f]">{c.ref_id}</span>
                        {overdue && <span className="ml-1 badge badge-overdue text-xs">OVERDUE</span>}
                      </td>
                      <td><CategoryBadge category={c.category} /></td>
                      <td className="max-w-xs text-xs text-slate-600">{truncate(c.description, 50)}</td>
                      <td><StatusBadge status={c.status} /></td>
                      <td><PriorityBadge priority={c.priority} /></td>
                      <td className="text-xs text-slate-500">{c.department || '—'}</td>
                      <td className="text-xs text-slate-500">{formatRelative(c.created_at)}</td>
                      <td>
                        <Link
                          to={`/municipal/complaints/${c.id}`}
                          className="btn btn-ghost btn-sm"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
