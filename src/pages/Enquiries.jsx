import { useState, useMemo } from 'react'
import toast from 'react-hot-toast'
import { MessageCircle, Phone, Plus, MessageSquare, Edit, Trash2, UserPlus, CheckCircle, StickyNote, ChevronDown, RotateCcw, Check, X, Globe, Store } from 'lucide-react'
import { useApi } from '../lib/useApi'
import { api } from '../lib/api'
import { PageHeader, Fab } from '../components/PageHeader'
import { EmptyState, SearchInput, Segmented, SkeletonList, Spinner } from '../components/ui'
import { fmtDate } from '../lib/format'
import { useAuth } from '../context/AuthContext'
import { useConfirm } from '../components/ConfirmDialog'
import StudentForm from '../components/StudentForm'
import Modal from '../components/Modal'

const SOURCE_OPTS = [
  { value: 'web', label: 'Website' },
  { value: 'manual', label: 'Walk-in' }
]

// Compact "time ago" — stored timestamps are UTC without a zone marker
function ago(value) {
  if (!value) return ''
  const raw = String(value)
  const iso = raw.includes('T') ? raw : raw.replace(' ', 'T')
  const d = new Date(/[Z+]/.test(iso) ? iso : iso + 'Z')
  const s = Math.floor((Date.now() - d.getTime()) / 1000)
  if (s < 60) return 'just now'
  const m = Math.floor(s / 60); if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`
  const days = Math.floor(h / 24); if (days < 7) return `${days}d ago`
  const w = Math.floor(days / 7); if (w < 5) return `${w}w ago`
  return fmtDate(value, 'dd MMM')
}

const STATUS_META = {
  new: { dot: 'bg-rose-500', pill: 'bg-rose-500' },
  contacted: { dot: 'bg-amber-500', pill: 'bg-amber-500' },
  converted: { dot: 'bg-emerald-500', pill: 'bg-emerald-500' }
}

export default function Enquiries() {
  const { user } = useAuth()
  const confirm = useConfirm()
  const { data, loading, reload } = useApi('/enquiries')
  const enquiries = data?.enquiries || []

  // View states
  const [activeSource, setActiveSource] = useState('web')
  const [activeStatus, setActiveStatus] = useState('new')
  const [dateFilter, setDateFilter] = useState('this-week')
  const [q, setQ] = useState('')

  // Per-card inline expand + note draft
  const [expandedId, setExpandedId] = useState(null)
  const [noteDraft, setNoteDraft] = useState('')
  const [savingId, setSavingId] = useState(null)

  // Modals
  const [showAddModal, setShowAddModal] = useState(false)
  const [showDetailsModal, setShowDetailsModal] = useState(false)
  const [showConvertModal, setShowConvertModal] = useState(false)
  const [convertLead, setConvertLead] = useState(null)
  const [isSaving, setIsSaving] = useState(false)

  const [addForm, setAddForm] = useState({ name: '', phone: '', message: '', staff_notes: '' })
  const [editForm, setEditForm] = useState({ id: '', name: '', phone: '', message: '', staff_notes: '' })

  // Filter by source + date range
  const dateFilteredLeads = useMemo(() => {
    const now = new Date()
    const day = now.getDay()
    const diff = now.getDate() - day + (day === 0 ? -6 : 1)
    const monday = new Date(new Date().setDate(diff))
    const thisWeekStr = monday.toISOString().slice(0, 10)
    const thisMonthStr = new Date().toISOString().slice(0, 7)
    const prevDate = new Date()
    prevDate.setMonth(prevDate.getMonth() - 1)
    const lastMonthStr = prevDate.toISOString().slice(0, 7)

    return enquiries.filter(e => {
      if ((e.source || 'web') !== activeSource) return false
      if (!e.created_at) return false
      const datePart = e.created_at.slice(0, 10)
      const monthPart = e.created_at.slice(0, 7)
      if (dateFilter === 'this-week') return datePart >= thisWeekStr
      if (dateFilter === 'this-month') return monthPart === thisMonthStr
      if (dateFilter === 'last-month') return monthPart === lastMonthStr
      return true
    })
  }, [enquiries, activeSource, dateFilter])

  const counts = useMemo(() => ({
    new: dateFilteredLeads.filter(e => e.status === 'new').length,
    contacted: dateFilteredLeads.filter(e => e.status === 'contacted').length,
    converted: dateFilteredLeads.filter(e => e.status === 'converted').length,
    total: dateFilteredLeads.length
  }), [dateFilteredLeads])

  const visible = useMemo(() => {
    const term = q.trim().toLowerCase()
    return dateFilteredLeads.filter(e => {
      if (e.status !== activeStatus) return false
      if (!term) return true
      return e.name?.toLowerCase().includes(term) || e.phone?.includes(term)
    })
  }, [dateFilteredLeads, q, activeStatus])

  // ── Actions ─────────────────────────────────────────
  const updateStatus = async (e, status) => {
    setSavingId(e.id)
    try {
      await api.put(`/enquiries/${e.id}`, { status })
      toast.success(status === 'contacted' ? 'Marked as contacted' : `Moved to ${status}`)
      reload()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSavingId(null)
    }
  }

  const toggleExpand = (e) => {
    if (expandedId === e.id) { setExpandedId(null); return }
    setExpandedId(e.id)
    setNoteDraft(e.staff_notes || '')
  }

  const saveNote = async (e) => {
    setSavingId(e.id)
    try {
      await api.put(`/enquiries/${e.id}`, { staff_notes: noteDraft.trim() })
      toast.success('Note saved')
      setExpandedId(null)
      reload()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSavingId(null)
    }
  }

  const handleEditClick = (e) => {
    setEditForm({
      id: e.id, name: e.name, phone: e.phone,
      message: e.message || '', staff_notes: e.staff_notes || ''
    })
    setShowDetailsModal(true)
  }

  const saveDetails = async () => {
    if (!editForm.name.trim() || !editForm.phone.trim()) {
      return toast.error('Name and Phone are required')
    }
    setIsSaving(true)
    try {
      await api.put(`/enquiries/${editForm.id}`, {
        name: editForm.name.trim(),
        phone: editForm.phone.trim(),
        message: editForm.message.trim(),
        staff_notes: editForm.staff_notes.trim()
      })
      toast.success('Lead details updated')
      setShowDetailsModal(false)
      reload()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeleteClick = async (e) => {
    const ok = await confirm({
      title: 'Delete Lead',
      message: `Are you sure you want to delete "${e.name}"? This action cannot be undone.`,
      confirmText: 'Delete', danger: true
    })
    if (!ok) return
    try {
      await api.del(`/enquiries/${e.id}`)
      toast.success('Lead deleted')
      reload()
    } catch (err) {
      toast.error(err.message)
    }
  }

  const addLead = async () => {
    if (!addForm.name.trim() || !addForm.phone.trim()) {
      return toast.error('Name and Phone are required')
    }
    setIsSaving(true)
    try {
      await api.post('/enquiries', {
        name: addForm.name.trim(),
        phone: addForm.phone.trim(),
        message: addForm.message.trim(),
        staff_notes: addForm.staff_notes.trim(),
        source: 'manual'
      })
      toast.success('Walk-in lead added')
      setShowAddModal(false)
      setActiveSource('manual')
      setActiveStatus('new')
      setAddForm({ name: '', phone: '', message: '', staff_notes: '' })
      reload()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setIsSaving(false)
    }
  }

  const handleConvertClick = (e) => {
    setConvertLead(e)
    setShowConvertModal(true)
  }

  const handleConverted = async () => {
    try {
      await api.put(`/enquiries/${convertLead.id}`, { status: 'converted' })
      toast.success('Lead converted to student')
      setShowConvertModal(false)
      reload()
    } catch (err) {
      toast.error('Failed to update lead status: ' + err.message)
    }
  }

  const prefillStudentData = useMemo(() => {
    if (!convertLead) return null
    return {
      name: convertLead.name,
      phone: convertLead.phone,
      notes: `Converted from Lead.\nOriginal Message: ${convertLead.message || 'None'}\nStaff Notes: ${convertLead.staff_notes || 'None'}`
    }
  }, [convertLead])

  const getWhatsAppLink = (e) => {
    const schoolName = user?.school_name || 'our driving school'
    const text = `Hi ${e.name}, thank you for contacting ${schoolName}! We received your enquiry and would love to help you get started with your driving lessons. When is a good time to speak?`
    const cleanedPhone = e.phone.replace(/\D/g, '')
    const phoneWithCountry = cleanedPhone.length === 10 ? `91${cleanedPhone}` : cleanedPhone
    return `https://wa.me/${phoneWithCountry}?text=${encodeURIComponent(text)}`
  }

  const statusTabs = [
    { value: 'new', label: 'New', count: counts.new },
    { value: 'contacted', label: 'Contacted', count: counts.contacted },
    { value: 'converted', label: 'Converted', count: counts.converted }
  ]

  return (
    <div className="page-enter pb-16">
      <PageHeader
        title="Leads Hub"
        subtitle={`${counts.total} ${activeSource === 'web' ? 'website enquiries' : 'walk-ins'} · ${dateFilter.replace('-', ' ')}`}
        action={
          <button className="btn-primary" onClick={() => setShowAddModal(true)}>
            <Plus className="h-4 w-4" /> Add Lead
          </button>
        }
      />

      <div className="mb-5 space-y-3">
        {/* Search — the fast way to find a lead */}
        <SearchInput value={q} onChange={setQ} placeholder="Search by name or phone…" />

        {/* Primary filter: status pipeline */}
        <div className="flex rounded-xl bg-slate-100 p-1 gap-1">
          {statusTabs.map(tab => (
            <button
              key={tab.value}
              onClick={() => { setActiveStatus(tab.value); setExpandedId(null) }}
              className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-sm font-semibold transition ${
                activeStatus === tab.value ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab.label}
              <span className={`inline-flex min-w-[18px] items-center justify-center px-1.5 py-0.5 text-[10px] font-bold rounded-full ${
                activeStatus === tab.value ? `${STATUS_META[tab.value].pill} text-white` : 'bg-slate-200 text-slate-500'
              }`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Secondary filters: source + date */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Segmented value={activeSource} onChange={v => { setActiveSource(v); setExpandedId(null) }} options={SOURCE_OPTS} />
          <select
            value={dateFilter}
            onChange={e => setDateFilter(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 transition shadow-sm"
          >
            <option value="this-week">This Week</option>
            <option value="this-month">This Month</option>
            <option value="last-month">Last Month</option>
            <option value="all">All Time</option>
          </select>
        </div>
      </div>

      {loading ? (
        <SkeletonList />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={MessageCircle}
          title={q ? 'No matching leads' : `No ${activeStatus} leads`}
          subtitle={q ? 'Try a different search.' : activeSource === 'web' ? 'Online enquiries from your landing page appear here.' : 'No walk-in leads logged in this range.'}
          action={
            !q && activeSource === 'manual' ? (
              <button className="btn-outline" onClick={() => setShowAddModal(true)}>
                <Plus className="h-4 w-4" /> Add Walk-in Lead
              </button>
            ) : null
          }
        />
      ) : (
        <div className="space-y-3">
          {visible.map(e => {
            const expanded = expandedId === e.id
            const busy = savingId === e.id
            return (
              <div key={e.id} className="card p-4">
                {/* Identity */}
                <div className="flex items-start gap-2.5">
                  <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${STATUS_META[e.status]?.dot || 'bg-slate-300'}`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-slate-800 text-[15px] leading-tight">{e.name}</p>
                      <span className="text-[11px] text-slate-400">{ago(e.created_at)}</span>
                    </div>
                    <p className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-400">
                      {e.source === 'manual' ? <Store className="h-3 w-3" /> : <Globe className="h-3 w-3" />}
                      {e.phone}
                    </p>
                    {e.message && (
                      <p className="mt-2 text-sm text-slate-600 whitespace-pre-wrap line-clamp-3">{e.message}</p>
                    )}
                    {e.staff_notes && !expanded && (
                      <p className="mt-2 flex items-start gap-1.5 text-xs text-slate-500 italic">
                        <StickyNote className="h-3.5 w-3.5 shrink-0 text-amber-400 mt-px" />
                        <span className="line-clamp-2">{e.staff_notes}</span>
                      </p>
                    )}
                  </div>
                </div>

                {/* Quick actions */}
                <div className="mt-3 flex items-center gap-2">
                  <a href={`tel:${e.phone}`} className="rounded-xl p-2.5 text-slate-500 hover:bg-slate-100 border border-slate-150 active:scale-95 transition" title="Call">
                    <Phone className="h-4 w-4" />
                  </a>
                  <a href={getWhatsAppLink(e)} target="_blank" rel="noopener noreferrer" className="rounded-xl p-2.5 text-emerald-600 hover:bg-emerald-50 border border-emerald-100 active:scale-95 transition" title="WhatsApp">
                    <MessageSquare className="h-4 w-4" />
                  </a>
                  <button
                    onClick={() => toggleExpand(e)}
                    className={`rounded-xl p-2.5 border active:scale-95 transition ${expanded ? 'bg-amber-50 text-amber-600 border-amber-200' : 'text-slate-500 hover:bg-slate-100 border-slate-150'}`}
                    title="Note & more"
                  >
                    <StickyNote className="h-4 w-4" />
                  </button>

                  <div className="flex-1" />

                  {/* One clear primary action per stage */}
                  {e.status === 'new' && (
                    <button className="btn bg-brand-600 text-white hover:bg-brand-700 px-3.5 py-2 text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-sm active:scale-95 transition disabled:opacity-60" onClick={() => updateStatus(e, 'contacted')} disabled={busy}>
                      {busy ? <Spinner className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />} Mark Contacted
                    </button>
                  )}
                  {e.status === 'contacted' && (
                    <button className="btn bg-emerald-500 text-white hover:bg-emerald-600 px-3.5 py-2 text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-sm active:scale-95 transition disabled:opacity-60" onClick={() => handleConvertClick(e)} disabled={busy}>
                      <UserPlus className="h-3.5 w-3.5" /> Convert
                    </button>
                  )}
                  {e.status === 'converted' && (
                    <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1 py-1.5 px-2.5 bg-emerald-50 rounded-lg">
                      <CheckCircle className="h-3.5 w-3.5" /> Student
                    </span>
                  )}
                </div>

                {/* Inline expand: note editor + rare actions */}
                {expanded && (
                  <div className="mt-3 pt-3 border-t border-slate-100 space-y-3">
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Staff Note</label>
                      <textarea
                        className="input mt-1 min-h-[72px] text-sm"
                        placeholder="Log a call, add a follow-up reminder…"
                        value={noteDraft}
                        onChange={ev => setNoteDraft(ev.target.value)}
                        autoFocus
                      />
                      <div className="mt-2 flex gap-2">
                        <button className="btn-primary flex-1 py-2 text-xs" onClick={() => saveNote(e)} disabled={busy}>
                          {busy ? <Spinner className="h-4 w-4" /> : <><Check className="h-3.5 w-3.5" /> Save note</>}
                        </button>
                        <button className="btn-ghost px-3 py-2 text-xs" onClick={() => setExpandedId(null)}>
                          <X className="h-3.5 w-3.5" /> Cancel
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 flex-wrap pt-1">
                      <button className="btn-ghost px-2.5 py-1.5 text-xs text-slate-600 flex items-center gap-1.5" onClick={() => handleEditClick(e)}>
                        <Edit className="h-3.5 w-3.5" /> Edit details
                      </button>
                      {e.status === 'contacted' && (
                        <button className="btn-ghost px-2.5 py-1.5 text-xs text-slate-500 flex items-center gap-1.5" onClick={() => updateStatus(e, 'new')}>
                          <RotateCcw className="h-3.5 w-3.5" /> Revert to New
                        </button>
                      )}
                      {e.status === 'converted' && (
                        <button className="btn-ghost px-2.5 py-1.5 text-xs text-slate-500 flex items-center gap-1.5" onClick={() => updateStatus(e, 'contacted')}>
                          <RotateCcw className="h-3.5 w-3.5" /> Reopen
                        </button>
                      )}
                      <div className="flex-1" />
                      <button className="btn-ghost px-2.5 py-1.5 text-xs text-red-500 hover:bg-red-50 hover:text-red-600 flex items-center gap-1.5" onClick={() => handleDeleteClick(e)}>
                        <Trash2 className="h-3.5 w-3.5" /> Delete
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <Fab onClick={() => setShowAddModal(true)} label="Add Lead" />

      {/* Add Lead */}
      <Modal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Add Walk-in / Phone Lead"
        footer={
          <div className="flex gap-3">
            <button className="btn-ghost flex-1" onClick={() => setShowAddModal(false)}>Cancel</button>
            <button className="btn-primary flex-1" onClick={addLead} disabled={isSaving}>
              {isSaving ? <Spinner className="h-4 w-4" /> : 'Log Lead'}
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="label">Full Name <span className="text-red-500">*</span></label>
            <input type="text" className="input" placeholder="e.g. Amit Kumar" value={addForm.name} onChange={e => setAddForm({ ...addForm, name: e.target.value })} />
          </div>
          <div>
            <label className="label">Phone Number <span className="text-red-500">*</span></label>
            <input type="tel" className="input" placeholder="e.g. 9876543210" value={addForm.phone} onChange={e => setAddForm({ ...addForm, phone: e.target.value })} />
          </div>
          <div>
            <label className="label">Lead Inquiry Message / Details</label>
            <textarea className="input min-h-[80px]" placeholder="e.g. Needs automatic transmission class, weekends only" value={addForm.message} onChange={e => setAddForm({ ...addForm, message: e.target.value })} />
          </div>
          <div>
            <label className="label">Staff Notes</label>
            <textarea className="input min-h-[80px]" placeholder="e.g. Offered standard package. Promised to consult family and call back." value={addForm.staff_notes} onChange={e => setAddForm({ ...addForm, staff_notes: e.target.value })} />
          </div>
        </div>
      </Modal>

      {/* Edit Lead Details */}
      <Modal
        open={showDetailsModal}
        onClose={() => setShowDetailsModal(false)}
        title="Edit Lead Details"
        footer={
          <div className="flex gap-3">
            <button className="btn-ghost flex-1" onClick={() => setShowDetailsModal(false)}>Cancel</button>
            <button className="btn-primary flex-1" onClick={saveDetails} disabled={isSaving}>
              {isSaving ? <Spinner className="h-4 w-4" /> : 'Save changes'}
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="label">Name</label>
            <input type="text" className="input" value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} />
          </div>
          <div>
            <label className="label">Phone</label>
            <input type="text" className="input" value={editForm.phone} onChange={e => setEditForm({ ...editForm, phone: e.target.value })} />
          </div>
          <div>
            <label className="label">Inquiry Message</label>
            <textarea className="input min-h-[80px]" value={editForm.message} onChange={e => setEditForm({ ...editForm, message: e.target.value })} />
          </div>
          <div>
            <label className="label">Staff Notes & Interactions</label>
            <textarea className="input min-h-[100px] border-brand-200 focus:border-brand-500" value={editForm.staff_notes} onChange={e => setEditForm({ ...editForm, staff_notes: e.target.value })} placeholder="Record phone calls or status updates..." />
          </div>
        </div>
      </Modal>

      <StudentForm
        open={showConvertModal}
        onClose={() => { setShowConvertModal(false); setConvertLead(null) }}
        onSaved={handleConverted}
        student={prefillStudentData}
      />
    </div>
  )
}
