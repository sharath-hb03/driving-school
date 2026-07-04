import { useState, useMemo } from 'react'
import toast from 'react-hot-toast'
import { MessageCircle, Phone, Plus, MessageSquare, Edit, Trash2, ArrowRight, UserPlus, CheckCircle, Smartphone } from 'lucide-react'
import { useApi } from '../lib/useApi'
import { api } from '../lib/api'
import { PageHeader, Fab } from '../components/PageHeader'
import { Badge, EmptyState, SearchInput, Segmented, SkeletonList, Spinner } from '../components/ui'
import { fmtDate } from '../lib/format'
import { useAuth } from '../context/AuthContext'
import { useConfirm } from '../components/ConfirmDialog'
import StudentForm from '../components/StudentForm'
import Modal from '../components/Modal'

const SOURCE_OPTS = [
  { value: 'web', label: 'Website Enquiries' },
  { value: 'manual', label: 'Walk-in Leads' }
]

export default function Enquiries() {
  const { user } = useAuth()
  const confirm = useConfirm()
  const { data, loading, reload } = useApi('/enquiries')
  const enquiries = data?.enquiries || []

  // View States
  const [activeSource, setActiveSource] = useState('web')
  const [activeStatus, setActiveStatus] = useState('new')
  const [dateFilter, setDateFilter] = useState('this-week')
  const [q, setQ] = useState('')

  // Modals & Forms
  const [showAddModal, setShowAddModal] = useState(false)
  const [showDetailsModal, setShowDetailsModal] = useState(false)
  const [showConvertModal, setShowConvertModal] = useState(false)
  const [convertLead, setConvertLead] = useState(null)
  const [isSavingNotes, setIsSavingNotes] = useState(false)

  const [addForm, setAddForm] = useState({ name: '', phone: '', message: '', staff_notes: '' })
  const [editForm, setEditForm] = useState({ id: '', name: '', phone: '', message: '', staff_notes: '' })

  // Filter enquiries by source and date range
  const dateFilteredLeads = useMemo(() => {
    const now = new Date()
    
    // Calculate start of this week (Monday)
    const day = now.getDay()
    const diff = now.getDate() - day + (day === 0 ? -6 : 1)
    const monday = new Date(now.setDate(diff))
    const thisWeekStr = monday.toISOString().slice(0, 10) // YYYY-MM-DD
    
    // This month (YYYY-MM)
    const thisMonthStr = new Date().toISOString().slice(0, 7)
    
    // Last month (YYYY-MM)
    const prevDate = new Date()
    prevDate.setMonth(prevDate.getMonth() - 1)
    const lastMonthStr = prevDate.toISOString().slice(0, 7)

    return enquiries.filter(e => {
      // Filter by source
      const matchesSource = (e.source || 'web') === activeSource
      if (!matchesSource) return false

      // Filter by date
      if (!e.created_at) return false
      const datePart = e.created_at.slice(0, 10) // YYYY-MM-DD
      const monthPart = e.created_at.slice(0, 7)  // YYYY-MM

      if (dateFilter === 'this-week') {
        return datePart >= thisWeekStr
      }
      if (dateFilter === 'this-month') {
        return monthPart === thisMonthStr
      }
      if (dateFilter === 'last-month') {
        return monthPart === lastMonthStr
      }
      return true // 'all'
    })
  }, [enquiries, activeSource, dateFilter])

  // 1. Calculate badge counts dynamically for the current source + date range
  const counts = useMemo(() => {
    return {
      new: dateFilteredLeads.filter(e => e.status === 'new').length,
      contacted: dateFilteredLeads.filter(e => e.status === 'contacted').length,
      converted: dateFilteredLeads.filter(e => e.status === 'converted').length,
      total: dateFilteredLeads.length
    }
  }, [dateFilteredLeads])

  // 2. Filter visible leads based on status and search query
  const visible = useMemo(() => {
    const term = q.trim().toLowerCase()
    return dateFilteredLeads.filter(e => {
      // Filter by status
      if (e.status !== activeStatus) return false

      // Filter by search query
      if (!term) return true
      return e.name?.toLowerCase().includes(term) || e.phone?.includes(term)
    })
  }, [dateFilteredLeads, q, activeStatus])

  // 3. Update Enquiry Status (e.g. from New to Contacted)
  const updateStatus = async (e, status) => {
    try {
      await api.put(`/enquiries/${e.id}`, { status })
      toast.success(`Moved to ${status}`)
      reload()
    } catch (err) {
      toast.error(err.message)
    }
  }

  // 4. Edit Lead / Notes Click handler
  const handleEditClick = (e) => {
    setEditForm({
      id: e.id,
      name: e.name,
      phone: e.phone,
      message: e.message || '',
      staff_notes: e.staff_notes || ''
    })
    setShowDetailsModal(true)
  }

  // 5. Save Lead Details and Notes
  const saveDetails = async () => {
    if (!editForm.name.trim() || !editForm.phone.trim()) {
      return toast.error('Name and Phone are required')
    }
    setIsSavingNotes(true)
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
      setIsSavingNotes(false)
    }
  }

  // 6. Delete Lead handler
  const handleDeleteClick = async (e) => {
    const ok = await confirm({
      title: 'Delete Lead',
      message: `Are you sure you want to delete "${e.name}"? This action cannot be undone.`,
      confirmText: 'Delete',
      danger: true
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

  // 7. Add Walk-in Lead
  const addLead = async () => {
    if (!addForm.name.trim() || !addForm.phone.trim()) {
      return toast.error('Name and Phone are required')
    }
    setIsSavingNotes(true)
    try {
      await api.post('/enquiries', {
        name: addForm.name.trim(),
        phone: addForm.phone.trim(),
        message: addForm.message.trim(),
        staff_notes: addForm.staff_notes.trim(),
        source: 'manual'
      })
      toast.success('Walk-in lead added successfully')
      setShowAddModal(false)
      setAddForm({ name: '', phone: '', message: '', staff_notes: '' })
      reload()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setIsSavingNotes(false)
    }
  }

  // 8. Convert to Student Click Handler
  const handleConvertClick = (e) => {
    setConvertLead(e)
    setShowConvertModal(true)
  }

  // 9. Convert to Student Save Handler
  const handleConverted = async () => {
    try {
      await api.put(`/enquiries/${convertLead.id}`, { status: 'converted' })
      toast.success('Lead marked as converted')
      setShowConvertModal(false)
      reload()
    } catch (err) {
      toast.error('Failed to update lead status: ' + err.message)
    }
  }

  // Prefill data structure for StudentForm
  const prefillStudentData = useMemo(() => {
    if (!convertLead) return null
    return {
      name: convertLead.name,
      phone: convertLead.phone,
      notes: `Converted from Lead.\nOriginal Message: ${convertLead.message || 'None'}\nStaff Notes: ${convertLead.staff_notes || 'None'}`
    }
  }, [convertLead])

  // Clean and format WhatsApp URL
  const getWhatsAppLink = (e) => {
    const schoolName = user?.school_name || 'our driving school'
    const text = `Hi ${e.name}, thank you for contacting ${schoolName}! We received your enquiry and would love to help you get started with your driving lessons. When is a good time to speak?`
    const cleanedPhone = e.phone.replace(/\D/g, '')
    // Prefix 91 for Indian numbers if it's 10 digits
    const phoneWithCountry = cleanedPhone.length === 10 ? `91${cleanedPhone}` : cleanedPhone
    return `https://wa.me/${phoneWithCountry}?text=${encodeURIComponent(text)}`
  }

  const statusTabs = [
    { value: 'new', label: 'New', count: counts.new, colorClass: 'bg-rose-500' },
    { value: 'contacted', label: 'Contacted', count: counts.contacted, colorClass: 'bg-amber-500' },
    { value: 'converted', label: 'Converted', count: counts.converted, colorClass: 'bg-emerald-500' }
  ]

  return (
    <div className="page-enter pb-16">
      <PageHeader 
        title="Leads Hub" 
        subtitle={`${counts.total} total ${activeSource === 'web' ? 'enquiries' : 'walk-ins'}`}
        action={
          <button className="btn-primary" onClick={() => setShowAddModal(true)}>
            <Plus className="h-4 w-4" /> Add Lead
          </button>
        }
      />

      <div className="mb-5 space-y-4">
        {/* Search */}
        <SearchInput value={q} onChange={setQ} placeholder="Search by name or phone…" />

        {/* Double Toggles + Date Filter */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between flex-wrap">
          <div className="flex items-center gap-2.5 justify-between sm:justify-start w-full sm:w-auto">
            {/* Primary Toggle: Web vs Manual */}
            <Segmented value={activeSource} onChange={setActiveSource} options={SOURCE_OPTS} />

            {/* Date Select Dropdown */}
            <select
              value={dateFilter}
              onChange={e => setDateFilter(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-xs font-semibold text-slate-600 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 transition shadow-sm"
            >
              <option value="this-week">This Week</option>
              <option value="this-month">This Month</option>
              <option value="last-month">Last Month</option>
              <option value="all">All Time</option>
            </select>
          </div>

          {/* Secondary Mobile-Friendly Tabs */}
          <div className="flex rounded-xl bg-slate-100 p-1 w-full sm:w-auto shrink-0">
            {statusTabs.map(tab => (
              <button
                key={tab.value}
                onClick={() => setActiveStatus(tab.value)}
                className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${
                  activeStatus === tab.value
                    ? 'bg-white text-slate-800 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {tab.label}
                <span className={`inline-flex items-center justify-center px-1.5 py-0.5 text-[10px] font-bold rounded-full ${
                  activeStatus === tab.value
                    ? `${tab.colorClass} text-white`
                    : 'bg-slate-200 text-slate-500'
                }`}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <SkeletonList />
      ) : visible.length === 0 ? (
        <EmptyState 
          icon={MessageCircle} 
          title={q ? 'No matching leads' : `No ${activeStatus} leads`} 
          subtitle={q ? 'Try a different search query.' : activeSource === 'web' ? 'Online enquiries submitted via your landing page appear here.' : 'No manual leads logged in this category.'} 
          action={
            !q && activeStatus === 'new' && activeSource === 'manual' ? (
              <button className="btn-outline" onClick={() => setShowAddModal(true)}>
                <Plus className="h-4 w-4" /> Add Walk-in Lead
              </button>
            ) : null
          }
        />
      ) : (
        <div className="space-y-4">
          {visible.map(e => (
            <div key={e.id} className="card p-4 hover:border-slate-200 transition-colors">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-slate-800 text-[15px]">{e.name}</p>
                    <span className={`chip text-[10px] px-2 py-0.5 font-bold ${
                      e.status === 'new' ? 'bg-rose-50 text-rose-600 border border-rose-100' :
                      e.status === 'contacted' ? 'bg-amber-50 text-amber-600 border border-amber-100' :
                      'bg-emerald-50 text-emerald-600 border border-emerald-100'
                    }`}>
                      {e.status.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {e.phone} · Received {fmtDate(e.created_at)}
                  </p>
                  
                  {e.message && (
                    <div className="mt-2.5 rounded-xl bg-slate-50 p-3 border border-slate-100">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Enquiry Details</p>
                      <p className="mt-0.5 text-sm text-slate-600 whitespace-pre-wrap">{e.message}</p>
                    </div>
                  )}

                  {e.staff_notes && (
                    <div className="mt-2.5 rounded-xl bg-brand-50/30 p-3 border border-brand-100/20">
                      <p className="text-[10px] font-bold text-brand-600 uppercase tracking-wider">Staff Notes</p>
                      <p className="mt-0.5 text-sm text-slate-700 whitespace-pre-wrap italic">"{e.staff_notes}"</p>
                    </div>
                  )}
                </div>

                {/* Quick Call & Whatsapp buttons */}
                <div className="flex gap-2 shrink-0">
                  <a href={`tel:${e.phone}`} className="rounded-xl p-2.5 text-slate-500 hover:bg-slate-100 border border-slate-150 active:scale-95 transition" title="Call Lead">
                    <Phone className="h-4 w-4" />
                  </a>
                  <a href={getWhatsAppLink(e)} target="_blank" rel="noopener noreferrer" className="rounded-xl p-2.5 text-emerald-600 hover:bg-emerald-50 border border-emerald-100 active:scale-95 transition" title="WhatsApp Lead">
                    <MessageSquare className="h-4 w-4" />
                  </a>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-4 pt-3.5 border-t border-slate-100 flex items-center justify-between gap-2 flex-wrap">
                <div className="flex gap-2">
                  <button className="btn-ghost px-3 py-1.5 text-xs text-slate-600 flex items-center gap-1.5" onClick={() => handleEditClick(e)}>
                    <Edit className="h-3.5 w-3.5" /> Edit / Notes
                  </button>
                  <button className="btn-ghost px-3 py-1.5 text-xs text-red-500 hover:bg-red-50 hover:text-red-600 flex items-center gap-1.5" onClick={() => handleDeleteClick(e)}>
                    <Trash2 className="h-3.5 w-3.5" /> Delete
                  </button>
                </div>

                <div className="flex gap-2">
                  {e.status === 'new' && (
                    <button className="btn bg-brand-50 text-brand-700 hover:bg-brand-100 px-3.5 py-1.5 text-xs font-bold rounded-xl flex items-center gap-1 border border-brand-200/50" onClick={() => updateStatus(e, 'contacted')}>
                      Mark Contacted <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  )}
                  {e.status === 'contacted' && (
                    <>
                      <button className="btn-ghost px-3 py-1.5 text-xs text-slate-400 hover:text-slate-600" onClick={() => updateStatus(e, 'new')}>
                        Revert to New
                      </button>
                      <button className="btn bg-emerald-500 text-white hover:bg-emerald-600 px-3.5 py-1.5 text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-sm active:scale-98 transition" onClick={() => handleConvertClick(e)}>
                        <UserPlus className="h-3.5 w-3.5" /> Convert to Student
                      </button>
                    </>
                  )}
                  {e.status === 'converted' && (
                    <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1 py-1.5 px-2 bg-emerald-50 rounded-lg">
                      <CheckCircle className="h-3.5 w-3.5" /> Converted to Student
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Floating Button for Mobile */}
      <Fab onClick={() => setShowAddModal(true)} label="Add Lead" />

      {/* Modal 1: Add Lead */}
      <Modal 
        open={showAddModal} 
        onClose={() => setShowAddModal(false)} 
        title="Add Walk-in / Phone Lead"
        footer={
          <div className="flex gap-3">
            <button className="btn-ghost flex-1" onClick={() => setShowAddModal(false)}>Cancel</button>
            <button className="btn-primary flex-1" onClick={addLead} disabled={isSavingNotes}>
              {isSavingNotes ? <Spinner className="h-4 w-4" /> : 'Log Lead'}
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

      {/* Modal 2: Edit Lead Details / Notes */}
      <Modal 
        open={showDetailsModal} 
        onClose={() => setShowDetailsModal(false)} 
        title="Edit Lead Details & Notes"
        footer={
          <div className="flex gap-3">
            <button className="btn-ghost flex-1" onClick={() => setShowDetailsModal(false)}>Cancel</button>
            <button className="btn-primary flex-1" onClick={saveDetails} disabled={isSavingNotes}>
              {isSavingNotes ? <Spinner className="h-4 w-4" /> : 'Save changes'}
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

      {/* Student Conversion Modal */}
      <StudentForm 
        open={showConvertModal} 
        onClose={() => { setShowConvertModal(false); setConvertLead(null) }} 
        onSaved={handleConverted} 
        student={prefillStudentData} 
      />
    </div>
  )
}
