import { getStatusBadgeClass, getPriorityBadgeClass, STATUS_LABELS, PRIORITY_LABELS } from '../../lib/utils'

export function StatusBadge({ status }) {
  if (!status) return null
  return (
    <span className={getStatusBadgeClass(status)}>
      {STATUS_LABELS[status] || status}
    </span>
  )
}

export function PriorityBadge({ priority }) {
  if (!priority) return null
  return (
    <span className={getPriorityBadgeClass(priority)}>
      {PRIORITY_LABELS[priority] || priority}
    </span>
  )
}

export function CategoryBadge({ category }) {
  const labels = {
    pothole: 'Pothole',
    garbage: 'Garbage',
    drainage: 'Drainage',
    streetlight: 'Streetlight',
    damaged_footpath: 'Damaged Footpath',
    water_leakage: 'Water Leakage',
    other: 'Other',
  }
  return (
    <span className="badge bg-indigo-100 text-indigo-700">
      {labels[category] || category}
    </span>
  )
}
