import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { ArrowLeft, Phone, Pencil, Trash2, Plus, CheckCircle2, XCircle, CalendarDays, Wallet, FolderOpen, GraduationCap, ClipboardList } from 'lucide-react'
import { useApi } from '../lib/useApi'
import { api } from '../lib/api'
import { inr, fmtDate, fmtTime } from '../lib/format'
import { Avatar, Badge, Spinner } from '../components/ui'
import { useConfirm } from '../components/ConfirmDialog'
import StudentForm from '../components/StudentForm'
import PaymentForm from '../components/PaymentForm'
import ClassForm from '../components/ClassForm'
import LicenseCard from '../components/LicenseCard'
import CertificateCard from '../components/CertificateCard'
import StudentStagesCard from '../components/StudentStagesCard'
import StudentDocuments from '../components/StudentDocuments'
import LLProfileCard from '../components/LLProfileCard'

const STATUS_COLOR = { scheduled: 'blue', attended: 'green', absent: 'red', cancelled: 'gray' }

export default function StudentDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { data, loading, reload } = useApi(`/students/${id}`, [id])
  const confirm = useConfirm()

  const [tab, setTab] = useState('overview')
  const [editOpen, setEditOpen] = useState(false)
  const [payOpen, setPayOpen] = useState(false)
  const [classOpen, setClassOpen] = useState(false)
  const [editCls, setEditCls] = useState(null)
  const [certBusy, setCertBusy] = useState(false)
  const [certInstructorId, setCertInstructorId] = useState('')

  const { data: instructorsData } = useApi('/instructors')

  const student = data?.student
  const classes = data?.classes || []
  const payments = data?.payments || []
  const documents = data?.documents || []

  const del = async () => {
    const ok = await confirm({ title: 'Delete student?', message: `Permanently delete ${student?.name}?`, danger: true, confirmText: 'Delete' })
    if (!ok) return
    try {
      await api.del(`/students/${id}`)
      toast.success('Deleted')
      navigate('/students')
    } catch (err) {
      toast.error(err.message)
    }
  }

  const generateCertificate = async () => {
    setCertBusy(true)
    try {
      await api.post(`/certificates/${id}`, { instructor_id: certInstructorId || null })
      toast.success(data?.certificate ? 'Certificate regenerated' : 'Certificate generated')
      reload()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setCertBusy(false)
    }
  }

  const delPayment = async (p) => {
    const ok = await confirm({ title: 'Delete payment?', message: `Delete ${inr(p.amount)} payment?`, danger: true, confirmText: 'Delete' })
    if (!ok) return
    try {
      await api.del(`/payments/${p.id}`)
      toast.success('Payment deleted')
      reload()
    } catch (err) {
      toast.error(err.message)
    }
  }

  const delClass = async (c) => {
    const ok = await confirm({ title: 'Delete class?', message: `Delete class on ${fmtDate(c.scheduled_at)}?`, danger: true, confirmText: 'Delete' })
    if (!ok) return
    try {
      await api.del(`/classes/${c.id}`)
      toast.success('Class deleted')
      reload()
    } catch (err) {
      toast.error(err.message)
    }
  }

  const updateStatus = async (c, status) => {
    try {
      await api.put(`/classes/${c.id}`, { status })
      toast.success(`Marked ${status}`)
      reload()
    } catch (err) {
      toast.error(err.message)
    }
  }

  if (loading) return <div className="flex h-[60vh] items-center justify-center text-slate-400"><Spinner className="h-7 w-7" /></div>
  if (!student) return <div className="py-20 text-center text-slate-400">Student not found</div>

  const balance = student.balance ?? 0
  const paid = Number(student.paid_amount || 0)
  const netFee = Math.max(0, Number(student.fee || 0) - Number(student.discount || 0))
  const completed = student.completed_classes || 0
  const total = student.total_classes || 0
  const pct = total ? Math.min(100, Math.round((completed / total) * 100)) : 0

  const tabs = [
    { key: 'overview', label: 'Overview', icon: GraduationCap },
    { key: 'classes', label: 'Classes', icon: CalendarDays, count: classes.length },
    { key: 'payments', label: 'Payments', icon: Wallet, count: payments.length },
    { key: 'documents', label: 'Documents', icon: FolderOpen, count: documents.length },
    { key: 'profile', label: 'Profile', icon: ClipboardList },
  ]

  return (
    <div className="page-enter">
      <div className="mb-4 flex items-center justify-between">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-800">
          <ArrowLeft className="h-4 w-4" /> Students
        </button>
        <div className="flex gap-2">
          <button onClick={() => setEditOpen(true)} className="btn-ghost px-3 py-1.5 text-xs"><Pencil className="h-3.5 w-3.5" /> Edit</button>
          <button onClick={del} className="btn-danger px-3 py-1.5 text-xs"><Trash2 className="h-3.5 w-3.5" /></button>
        </div>
      </div>

      <div className="card mb-4 p-5">
        <div className="flex items-center gap-4">
          <Avatar name={student.name} size={60} />
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-extrabold text-slate-900">{student.name}</h1>
            <div className="mt-1 flex flex-wrap gap-1.5">
              <Badge color={student.license_type === '2W' ? 'violet' : 'blue'}>{student.license_type}</Badge>
              <Badge color={student.status === 'active' ? 'green' : student.status === 'completed' ? 'cyan' : 'gray'}>{student.status}</Badge>
              {balance > 0 && <Badge color="amber">{inr(balance)} due</Badge>}
              {balance <= 0 && total > 0 && <Badge color="green">Paid</Badge>}
            </div>
          </div>
          {student.phone && <a href={`tel:${student.phone}`} className="btn-ghost px-3 py-2"><Phone className="h-5 w-5" /></a>}
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
          {[
            ['Phone', student.phone || '-'],
            ['Email', student.email || '-'],
            ['Joined', fmtDate(student.joining_date)],
            ['Package', student.package_name || '-'],
            ['Discount', student.discount > 0 ? inr(student.discount) : '-'],
            ['Fee', student.fee ? inr(netFee) : '-'],
          ].map(([k, v]) => (
            <div key={k}><dt className="text-xs text-slate-400">{k}</dt><dd className="font-medium text-slate-700">{v}</dd></div>
          ))}
        </dl>

        {total > 0 && (
          <div className="mt-4">
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="font-medium text-slate-600">Classes {completed}/{total}</span>
              <span className="font-bold text-brand-600">{pct}%</span>
            </div>
            <div className="h-2 rounded-full bg-slate-100">
              <div className="h-2 rounded-full bg-brand-500 transition-all" style={{ width: `${pct}%` }} />
            </div>
          </div>
        )}

        {student.notes && <p className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-500">{student.notes}</p>}
      </div>

      {/* Tab bar */}
      <div className="sticky top-0 z-20 -mx-4 mb-4 bg-slate-50/95 px-4 py-2 backdrop-blur">
        <div className="flex gap-1 overflow-x-auto rounded-2xl bg-slate-100 p-1">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex shrink-0 items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-semibold transition ${
                tab === t.key ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <t.icon className="h-4 w-4" /> {t.label}
              {t.count != null && (
                <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${tab === t.key ? 'bg-brand-100 text-brand-700' : 'bg-slate-200 text-slate-500'}`}>
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ---- Overview ---- */}
      {tab === 'overview' && (
        <div className="page-enter space-y-4">
          {!!student.opt_for_license && (
            <>
              <StudentStagesCard student={student} stages={data?.stages || []} onSaved={reload} />
              <LicenseCard student={student} onSaved={reload} />
            </>
          )}
          <CertificateCard
            certificate={data?.certificate}
            eligible={student.status === 'completed'}
            canGenerate
            busy={certBusy}
            onGenerate={generateCertificate}
            instructors={instructorsData?.instructors || []}
            instructorId={certInstructorId}
            onInstructorChange={setCertInstructorId}
          />
        </div>
      )}

      {/* ---- Classes ---- */}
      {tab === 'classes' && (
        <div className="page-enter">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-base font-bold text-slate-800"><CalendarDays className="h-5 w-5 text-brand-600" /> Classes</h2>
            <button className="btn-primary px-3 py-1.5 text-xs" onClick={() => { setEditCls(null); setClassOpen(true) }}><Plus className="h-4 w-4" /> Book</button>
          </div>
          {classes.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white py-8 text-center text-sm text-slate-400">No classes booked</div>
          ) : (
            <div className="space-y-2">
              {classes.map(c => (
                <div key={c.id} className="flex items-center gap-3 rounded-xl border border-slate-100 bg-white px-4 py-3">
                  <div className="flex w-14 shrink-0 flex-col">
                    <span className="text-xs font-bold text-brand-600">{fmtDate(c.scheduled_at, 'dd MMM')}</span>
                    <span className="text-[11px] text-slate-400">{fmtTime(c.scheduled_at)}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-700">{c.instructor_name || '-'}</p>
                    <p className="text-xs text-slate-400">{c.vehicle_number || 'No vehicle'} - {c.duration_min}m</p>
                  </div>
                  <Badge color={STATUS_COLOR[c.status]}>{c.status}</Badge>
                  <div className="flex gap-1">
                    {c.status === 'scheduled' && <>
                      <button onClick={() => updateStatus(c, 'attended')} className="rounded-lg p-1.5 text-emerald-500 hover:bg-emerald-50"><CheckCircle2 className="h-4 w-4" /></button>
                      <button onClick={() => updateStatus(c, 'absent')} className="rounded-lg p-1.5 text-red-400 hover:bg-red-50"><XCircle className="h-4 w-4" /></button>
                    </>}
                    <button onClick={() => { setEditCls(c); setClassOpen(true) }} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"><Pencil className="h-4 w-4" /></button>
                    <button onClick={() => delClass(c)} className="rounded-lg p-1.5 text-red-400 hover:bg-red-50"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ---- Payments ---- */}
      {tab === 'payments' && (
        <div className="page-enter card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-base font-bold text-slate-800"><Wallet className="h-5 w-5 text-brand-600" /> Payments</h2>
            <button className="btn-primary px-3 py-2 text-xs" onClick={() => setPayOpen(true)}><Plus className="h-4 w-4" /> Add</button>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-xs text-slate-400">Fee</p>
              <p className="mt-0.5 text-sm font-bold text-slate-700">{inr(netFee)}</p>
            </div>
            <div className="rounded-xl bg-emerald-50 p-3">
              <p className="text-xs text-emerald-600">Paid</p>
              <p className="mt-0.5 text-sm font-bold text-emerald-700">{inr(paid)}</p>
            </div>
            <div className={`rounded-xl p-3 ${balance > 0 ? 'bg-amber-50' : 'bg-slate-50'}`}>
              <p className={`text-xs ${balance > 0 ? 'text-amber-600' : 'text-slate-400'}`}>Balance</p>
              <p className={`mt-0.5 text-sm font-bold ${balance > 0 ? 'text-amber-700' : 'text-slate-700'}`}>{inr(balance)}</p>
            </div>
          </div>

          {student.discount > 0 && (
            <p className="mt-2 text-center text-xs text-slate-400">
              Package {inr(student.fee)} - Discount <span className="font-semibold text-amber-600">-{inr(student.discount)}</span>
            </p>
          )}

          {payments.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-white py-8 text-center text-sm text-slate-400">No payments recorded</div>
          ) : (
            <div className="mt-4 space-y-2">
              {payments.map(p => (
                <div key={p.id} className="flex items-center gap-3 rounded-xl border border-slate-100 bg-white px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-slate-800">{inr(p.amount)}</p>
                    <p className="text-xs text-slate-400">{fmtDate(p.paid_at)} - {p.method}{p.note ? ` - ${p.note}` : ''}</p>
                  </div>
                  <button onClick={() => delPayment(p)} className="rounded-lg p-2 text-red-400 hover:bg-red-50"><Trash2 className="h-4 w-4" /></button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ---- Documents ---- */}
      {tab === 'documents' && (
        <div className="page-enter card p-5">
          <h2 className="mb-4 flex items-center gap-2 text-base font-bold text-slate-800">
            <FolderOpen className="h-5 w-5 text-brand-600" /> Documents
          </h2>
          <StudentDocuments documents={documents} />
        </div>
      )}

      {/* ---- Profile ---- */}
      {tab === 'profile' && (
        <div className="page-enter">
          <LLProfileCard profile={student.ll_profile} />
        </div>
      )}

      <StudentForm open={editOpen} student={student} onClose={() => setEditOpen(false)} onSaved={reload} />
      <PaymentForm open={payOpen} student={student} balance={balance} onClose={() => setPayOpen(false)} onSaved={reload} />
      <ClassForm open={classOpen} student={student} klass={editCls} onClose={() => { setClassOpen(false); setEditCls(null) }} onSaved={reload} />
    </div>
  )
}
