import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import DashboardLayout from '../../components/layout/DashboardLayout'
import { CATEGORIES, uploadPhoto } from '../../lib/utils'
import { MapPin, Upload, X, CheckCircle2, Copy, Eye } from 'lucide-react'
import toast from 'react-hot-toast'
import Spinner from '../../components/ui/Spinner'

export default function SubmitComplaint() {
  const { user, profile } = useAuth()
  const navigate = useNavigate()

  const [form, setForm] = useState({
    category: '',
    description: '',
    location_text: '',
    latitude: '',
    longitude: '',
  })
  const [photoFile, setPhotoFile] = useState(null)
  const [photoPreview, setPhotoPreview] = useState(null)
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)
  const [gpsLoading, setGpsLoading] = useState(false)
  const [success, setSuccess] = useState(null) // { refId }

  function set(key) {
    return e => setForm(f => ({ ...f, [key]: e.target.value }))
  }

  function handlePhoto(e) {
    const file = e.target.files[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Photo must be under 5MB')
      return
    }
    setPhotoFile(file)
    const reader = new FileReader()
    reader.onload = ev => setPhotoPreview(ev.target.result)
    reader.readAsDataURL(file)
  }

  function captureGPS() {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser')
      return
    }
    setGpsLoading(true)
    navigator.geolocation.getCurrentPosition(
      pos => {
        setForm(f => ({
          ...f,
          latitude: pos.coords.latitude.toFixed(6),
          longitude: pos.coords.longitude.toFixed(6),
        }))
        toast.success('GPS location captured!')
        setGpsLoading(false)
      },
      err => {
        toast.error('Could not get GPS location. Please enter manually.')
        setGpsLoading(false)
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  function validate() {
    const e = {}
    if (!form.category) e.category = 'Please select a category'
    if (!form.description.trim() || form.description.trim().length < 10)
      e.description = 'Description must be at least 10 characters'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!validate()) return
    setLoading(true)

    try {
      // 1. Get next sequence number
      const { count } = await supabase
        .from('complaints')
        .select('id', { count: 'exact', head: true })

      const seq = (count || 0) + 1
      const year = new Date().getFullYear()
      const refId = `UE-${year}-${String(seq).padStart(4, '0')}`

      // 2. Upload photo if provided
      let photoUrl = null
      if (photoFile) {
        try {
          photoUrl = await uploadPhoto(supabase, photoFile, refId)
        } catch (err) {
          console.error('Photo upload failed:', err)
          toast.error('Photo upload failed. Submitting without photo.')
        }
      }

      // 3. Insert complaint
      const { data, error } = await supabase
        .from('complaints')
        .insert({
          ref_id: refId,
          reporter_id: user.id,
          category: form.category,
          description: form.description.trim(),
          photo_url: photoUrl,
          anonymous: false,
          location_text: form.location_text.trim() || null,
          latitude: form.latitude ? parseFloat(form.latitude) : null,
          longitude: form.longitude ? parseFloat(form.longitude) : null,
          status: 'submitted',
          priority: 'medium',
        })
        .select()
        .single()

      if (error) throw error

      setSuccess({ refId, id: data.id })
      toast.success('Complaint submitted successfully!')
    } catch (err) {
      console.error(err)
      toast.error(err.message || 'Submission failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  function copyRefId() {
    navigator.clipboard.writeText(success.refId)
    toast.success('Complaint ID copied!')
  }

  // ---- SUCCESS SCREEN ----
  if (success) {
    return (
      <DashboardLayout title="Complaint Submitted" subtitle="Your report has been recorded">
        <div className="max-w-lg mx-auto">
          <div className="card p-8 text-center animate-slide-up">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-slate-800 mb-2">Complaint Submitted!</h2>
            <p className="text-slate-500 text-sm mb-6">
              Your complaint has been received. Municipal staff will review it shortly.
            </p>

            <div className="bg-[#1e3a5f] rounded-xl p-5 mb-6">
              <p className="text-teal-300 text-xs mb-1 font-medium">YOUR COMPLAINT REFERENCE ID</p>
              <div className="flex items-center justify-center gap-3">
                <span className="text-3xl font-mono font-bold text-white">{success.refId}</span>
                <button
                  onClick={copyRefId}
                  className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors text-white"
                  title="Copy ID"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
              <p className="text-white/50 text-xs mt-2">Save this ID to track your complaint</p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => { setSuccess(null); setForm({ category: '', description: '', location_text: '', latitude: '', longitude: '' }); setPhotoFile(null); setPhotoPreview(null) }}
                className="flex-1 btn btn-outline"
              >
                Submit Another
              </button>
              <button
                onClick={() => navigate('/citizen/track')}
                className="flex-1 btn btn-teal"
              >
                <Eye className="w-4 h-4" /> Track Complaints
              </button>
            </div>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  // ---- FORM ----
  return (
    <DashboardLayout title="Report a Civic Issue" subtitle="Submit a new complaint about a public infrastructure problem">
      <div className="max-w-2xl mx-auto">
        <form onSubmit={handleSubmit} className="card p-6 space-y-5 animate-slide-up">

          {/* Category */}
          <div>
            <label className="label">Issue Category <span className="text-red-500">*</span></label>
            <select
              value={form.category}
              onChange={set('category')}
              className={`input ${errors.category ? 'input-error' : ''}`}
              id="complaint-category"
            >
              <option value="">Select category...</option>
              {CATEGORIES.map(c => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
            {errors.category && <p className="text-xs text-red-500 mt-1">{errors.category}</p>}
          </div>

          {/* Description */}
          <div>
            <label className="label">Description <span className="text-red-500">*</span></label>
            <textarea
              value={form.description}
              onChange={set('description')}
              rows={4}
              placeholder="Describe the issue in detail. Include relevant information about the severity and impact."
              className={`input resize-y min-h-24 ${errors.description ? 'input-error' : ''}`}
              id="complaint-description"
            />
            {errors.description && <p className="text-xs text-red-500 mt-1">{errors.description}</p>}
            <p className="text-xs text-slate-400 mt-1">{form.description.length} characters (min 10)</p>
          </div>

          {/* Photo upload */}
          <div>
            <label className="label">Photograph <span className="text-slate-400">(optional, max 5MB)</span></label>
            {photoPreview ? (
              <div className="relative">
                <img src={photoPreview} alt="Preview" className="w-full h-48 object-cover rounded-xl border border-slate-200" />
                <button
                  type="button"
                  onClick={() => { setPhotoFile(null); setPhotoPreview(null) }}
                  className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full hover:bg-red-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center gap-2 w-full h-32 border-2 border-dashed border-slate-200 rounded-xl cursor-pointer hover:border-teal-400 hover:bg-teal-50 transition-all">
                <Upload className="w-6 h-6 text-slate-400" />
                <span className="text-sm text-slate-500">Click to upload a photo</span>
                <span className="text-xs text-slate-400">JPG, PNG or WEBP</span>
                <input type="file" accept="image/*" className="hidden" onChange={handlePhoto} id="photo-upload" />
              </label>
            )}
          </div>

          {/* Location */}
          <div>
            <label className="label">Location</label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={form.location_text}
                onChange={set('location_text')}
                placeholder="Landmark or address (e.g. Near State Bank, MG Road)"
                className="input flex-1"
                id="location-text"
              />
              <button
                type="button"
                onClick={captureGPS}
                disabled={gpsLoading}
                className="btn btn-outline flex-shrink-0 gap-1.5"
                title="Capture GPS location"
              >
                {gpsLoading ? <Spinner size="sm" color="navy" /> : <MapPin className="w-4 h-4" />}
                <span className="hidden sm:inline text-xs">GPS</span>
              </button>
            </div>
            {(form.latitude || form.longitude) && (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={form.latitude}
                  onChange={set('latitude')}
                  placeholder="Latitude"
                  className="input text-xs"
                  id="latitude"
                />
                <input
                  type="text"
                  value={form.longitude}
                  onChange={set('longitude')}
                  placeholder="Longitude"
                  className="input text-xs"
                  id="longitude"
                />
              </div>
            )}
          </div>


          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="btn btn-teal w-full py-3 text-base"
            id="submit-btn"
          >
            {loading ? (
              <><Spinner size="sm" color="white" /> Submitting...</>
            ) : 'Submit Complaint'}
          </button>
        </form>
      </div>
    </DashboardLayout>
  )
}
