import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import DashboardLayout from '../../components/layout/DashboardLayout'
import { StatusBadge, PriorityBadge, CategoryBadge } from '../../components/ui/Badge'
import EmptyState from '../../components/ui/EmptyState'
import { Search, Filter, FileText, ChevronRight, X } from 'lucide-react'
import { formatRelative, truncate, isOverdue, CATEGORIES, STATUSES, PRIORITIES, DEPARTMENTS } from '../../lib/utils'

export default function MunicipalComplaints() {
  const [complaints, setComplaints] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState({ category: '', status: '', priority: '', department: '' })
  const [showFilters, setShowFilters] = useState(false)

  useEffect(() => { fetchComplaints() }, [])

  async function fetchComplaints() {
    setLoading(true)
    const { data } = await supabase
      .from('complaints')
      .select(`
        id, ref_id, category, description, status, priority, department,
        location_text, created_at, due_at, anonymous, reporter_id,
        profiles:reporter_id(full_name)
      `)
      .order('created_at', { ascending: false })
    if (data) setComplaints(data)
    setLoading(false)
  }

  const filtered = complaints.filter(c => {
    if (search && !(
      c.ref_id?.toLowerCase().includes(search.toLowerCase()) ||
      c.description?.toLowerCase().includes(search.toLowerCase()) ||
      c.category?.toLowerCase().includes(search.toLowerCase())
    )) return false
    if (filters.category && c.category !== filters.category) return false
    if (filters.status && c.status !== filters.status) return false
    if (filters.priority && c.priority !== filters.priority) return false
    if (filters.department && c.department !== filters.department) return false
    return true
  })

  const activeFilterCount = Object.values(filters).filter(Boolean).length

  function clearFilters() {
    setFilters({ category: '', status: '', priority: '', department: '' })
    setSearch('')
  }

  return (
    <DashboardLayout title="All Complaints" subtitle="View, filter and manage all civic complaints">
      {/* Search + filter bar */}
      <div className="flex flex-wrap gap-3 mb-5">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by ID, description or category..."
            className="input pl-9"
            id="complaints-search"
          />
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`btn ${activeFilterCount > 0 ? 'btn-teal' : 'btn-outline'} gap-2`}
        >
          <Filter className="w-4 h-4" />
          Filters {activeFilterCount > 0 && `(${activeFilterCount})`}
        </button>
        {(activeFilterCount > 0 || search) && (
          <button onClick={clearFilters} className="btn btn-ghost gap-1.5 text-red-500 hover:bg-red-50">
            <X className="w-4 h-4" /> Clear
          </button>
        )}
      </div>

      {/* Filters row */}
      {showFilters && (
        <div className="card p-4 mb-5 grid sm:grid-cols-4 gap-3 animate-slide-up">
          <div>
            <label className="label">Category</label>
            <select value={filters.category} onChange={e => setFilters(f => ({ ...f, category: e.target.value }))} className="input">
              <option value="">All Categories</option>
              {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Status</label>
            <select value={filters.status} onChange={e => setFilters(f => ({ ...f, status: e.target.value }))} className="input">
              <option value="">All Statuses</option>
              {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Priority</label>
            <select value={filters.priority} onChange={e => setFilters(f => ({ ...f, priority: e.target.value }))} className="input">
              <option value="">All Priorities</option>
              {PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Department</label>
            <select value={filters.department} onChange={e => setFilters(f => ({ ...f, department: e.target.value }))} className="input">
              <option value="">All Departments</option>
              {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
        </div>
      )}

      {/* Results count */}
      <p className="text-xs text-slate-500 mb-3">
        Showing {filtered.length} of {complaints.length} complaints
      </p>

      <div className="card">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No complaints found"
            description="Adjust your filters or search terms."
          />
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Ref ID</th>
                  <th>Category</th>
                  <th>Description</th>
                  <th>Reporter</th>
                  <th>Status</th>
                  <th>Priority</th>
                  <th>Department</th>
                  <th>Submitted</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => {
                  const overdue = isOverdue(c.due_at, c.status)
                  return (
                    <tr key={c.id} className={overdue ? 'bg-red-50/40' : ''}>
                      <td>
                        <div className="flex flex-col gap-0.5">
                          <span className="font-mono text-xs font-bold text-[#1e3a5f]">{c.ref_id}</span>
                          {overdue && <span className="badge badge-overdue text-xs w-fit">OVERDUE</span>}
                        </div>
                      </td>
                      <td><CategoryBadge category={c.category} /></td>
                      <td className="max-w-xs text-xs text-slate-600">{truncate(c.description, 55)}</td>
                      <td className="text-xs text-slate-500">
                        {c.anonymous ? (
                          <span className="text-slate-400 italic">Anonymous</span>
                        ) : (
                          c.profiles?.full_name || '—'
                        )}
                      </td>
                      <td><StatusBadge status={c.status} /></td>
                      <td><PriorityBadge priority={c.priority} /></td>
                      <td className="text-xs text-slate-500">{c.department || '—'}</td>
                      <td className="text-xs text-slate-500">{formatRelative(c.created_at)}</td>
                      <td>
                        <Link
                          to={`/municipal/complaints/${c.id}`}
                          className="btn btn-ghost btn-sm text-teal-600"
                        >
                          Manage <ChevronRight className="w-3.5 h-3.5" />
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
