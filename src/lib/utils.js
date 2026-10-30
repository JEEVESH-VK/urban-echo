import { format, formatDistanceToNow, isPast, parseISO } from 'date-fns'

/**
 * Generate a human-readable complaint reference ID
 * Pattern: UE-YYYY-XXXX (sequential padding will be ensured by DB sequence)
 */
export function generateRefId(sequenceNumber) {
  const year = new Date().getFullYear()
  const padded = String(sequenceNumber).padStart(4, '0')
  return `UE-${year}-${padded}`
}

/**
 * Format a date string nicely
 */
export function formatDate(dateStr) {
  if (!dateStr) return '—'
  try {
    return format(parseISO(dateStr), 'dd MMM yyyy, h:mm a')
  } catch {
    return '—'
  }
}

/**
 * Format a date to relative time (e.g. "3 hours ago")
 */
export function formatRelative(dateStr) {
  if (!dateStr) return '—'
  try {
    return formatDistanceToNow(parseISO(dateStr), { addSuffix: true })
  } catch {
    return '—'
  }
}

/**
 * Check if a due_at date is overdue (past and not resolved)
 */
export function isOverdue(dueAt, status) {
  // Treat all terminal/verification statuses as non-overdue
  if (!dueAt) return false
  if (['resolved', 'verified', 'awaiting_citizen_verification'].includes(status)) return false
  try {
    return isPast(parseISO(dueAt))
  } catch {
    return false
  }
}

/**
 * Get overdue duration string
 */
export function getOverdueDuration(dueAt) {
  if (!dueAt) return ''
  try {
    return formatDistanceToNow(parseISO(dueAt), { addSuffix: false })
  } catch {
    return ''
  }
}

/**
 * Status display labels
 */
export const STATUS_LABELS = {
  submitted:                      'Submitted',
  under_review:                   'Under Review',
  assigned:                       'Assigned',
  in_progress:                    'In Progress',
  awaiting_citizen_verification:  'Awaiting Verification',
  verified:                       'Verified ✓',
  reopened:                       'Reopened',
  resolved:                       'Resolved',
}

/**
 * Status ordered list for timeline
 */
export const STATUS_ORDER = [
  'submitted',
  'under_review',
  'assigned',
  'in_progress',
  'awaiting_citizen_verification',
  'verified',
]

/**
 * Priority display labels
 */
export const PRIORITY_LABELS = {
  low:      'Low',
  medium:   'Medium',
  high:     'High',
  critical: 'Critical',
}

/**
 * Category display labels
 */
export const CATEGORY_LABELS = {
  pothole:         'Pothole',
  garbage:         'Garbage',
  drainage:        'Drainage',
  streetlight:     'Streetlight',
  damaged_footpath: 'Damaged Footpath',
  water_leakage:   'Water Leakage',
  other:           'Other',
}

/**
 * Department options for assignment
 */
export const DEPARTMENTS = [
  'Roads',
  'Sanitation',
  'Drainage',
  'Electrical',
  'Water Supply',
  'Other',
]

/**
 * Category options for complaint form
 */
export const CATEGORIES = [
  { value: 'pothole',          label: 'Pothole' },
  { value: 'garbage',          label: 'Garbage' },
  { value: 'drainage',         label: 'Drainage' },
  { value: 'streetlight',      label: 'Streetlight' },
  { value: 'damaged_footpath', label: 'Damaged Footpath' },
  { value: 'water_leakage',    label: 'Water Leakage' },
  { value: 'other',            label: 'Other' },
]

/**
 * Priority options
 */
export const PRIORITIES = [
  { value: 'low',      label: 'Low' },
  { value: 'medium',   label: 'Medium' },
  { value: 'high',     label: 'High' },
  { value: 'critical', label: 'Critical' },
]

/**
 * Status options for update
 */
// Staff-selectable statuses — does NOT include resolved, awaiting_citizen_verification,
// verified, or reopened. Those are set programmatically through the verification workflow.
export const STATUSES = [
  { value: 'submitted',    label: 'Submitted' },
  { value: 'under_review', label: 'Under Review' },
  { value: 'assigned',     label: 'Assigned' },
  { value: 'in_progress',  label: 'In Progress' },
]

/**
 * Get the CSS class for a status badge
 */
export function getStatusBadgeClass(status) {
  const map = {
    submitted:                     'badge-submitted',
    under_review:                  'badge-under_review',
    assigned:                      'badge-assigned',
    in_progress:                   'badge-in_progress',
    awaiting_citizen_verification: 'badge-awaiting_citizen_verification',
    verified:                      'badge-verified',
    reopened:                      'badge-reopened',
    resolved:                      'badge-resolved',
    overdue:                       'badge-overdue',
  }
  return `badge ${map[status] || 'badge-submitted'}`
}

/**
 * Get the CSS class for a priority badge
 */
export function getPriorityBadgeClass(priority) {
  const map = {
    low:      'badge-low',
    medium:   'badge-medium',
    high:     'badge-high',
    critical: 'badge-critical',
  }
  return `badge ${map[priority] || 'badge-medium'}`
}

/**
 * Truncate text
 */
export function truncate(text, length = 80) {
  if (!text) return ''
  return text.length > length ? text.slice(0, length) + '…' : text
}

/**
 * Upload a photo to Supabase Storage
 */
export async function uploadPhoto(supabase, file, complaintId) {
  const ext = file.name.split('.').pop()
  const fileName = `${complaintId}-${Date.now()}.${ext}`
  const { data, error } = await supabase.storage
    .from('complaint-photos')
    .upload(fileName, file, { upsert: false })

  if (error) throw error

  const { data: urlData } = supabase.storage
    .from('complaint-photos')
    .getPublicUrl(data.path)

  return urlData.publicUrl
}
