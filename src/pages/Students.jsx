import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Users, Phone, ChevronRight } from 'lucide-react'
import { api } from '../lib/api'
import { inr } from '../lib/format'
import { PageHeader, Fab } from '../components/PageHeader'
import { Avatar, Badge, EmptyState, SearchInput, Segmented, SkeletonList } from '../components/ui'
import StudentForm from '../components/StudentForm'

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'completed', label: 'Done' },
]

export default function Students() {
  const [students, setStudents] = useState([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState('all')
  const [formOpen, setFormOpen] = useState(false)

  const load = async () => {
    setLoading(true)
    try { const d = await api.get('/students'); setStudents(d.students || []) } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const visible = useMemo(() => {
    const term = q.trim().toLowerCase()
    return students.filter((s) => {
      if (filter !== 'all' && s.status !== filter) return false
      if (!term) return true
      return s.name?.toLowerCase().includes(term) || s.phone?.includes(term)
    })
  }, [students, q, filter])

  return (
    <div className="page-enter">
      <PageHeader title="Students" subtitle={`${students.length} total`} />
      <div className="mb-4 space-y-3">
        <SearchInput value={q} onChange={setQ} placeholder="Search by name or phone…" />
        <Segmented value={filter} onChange={setFilter} options={FILTERS} />
      </div>

      {loading ? <SkeletonList /> : visible.length === 0 ? (
        <EmptyState icon={Users}
          title={q || filter !== 'all' ? 'No matching students' : 'No students yet'}
          subtitle={q || filter !== 'all' ? 'Try a different search or filter.' : 'Add your first student to get started.'}
          action={!q && filter === 'all' ? <button className="btn-primary" onClick={() => setFormOpen(true)}>Add student</button> : null} />
      ) : (
        <div className="space-y-3">
          {visible.map((s) => (
            <Link key={s.id} to={`/students/${s.id}`} className="card flex items-center gap-3 p-3.5 active:scale-[.99]">
              <Avatar name={s.name} size={46} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate font-semibold text-slate-800">{s.name}</p>
                  <Badge color={s.license_type === '2W' ? 'violet' : 'blue'}>{s.license_type}</Badge>
                </div>
                <p className="mt-0.5 truncate text-xs text-slate-400">
                  {s.package_name || 'No package'}
                  {s.total_classes ? ` · ${s.completed_classes}/${s.total_classes} done` : ''}
                </p>
              </div>
              <div className="text-right">
                {s.balance > 0
                  ? <span className="text-xs font-bold text-amber-600">{inr(s.balance)} due</span>
                  : <span className="text-xs font-semibold text-emerald-600">Paid</span>}
              </div>
              {s.phone && (
                <a href={`tel:${s.phone}`} onClick={(e) => e.stopPropagation()} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100">
                  <Phone className="h-4 w-4" />
                </a>
              )}
              <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" />
            </Link>
          ))}
        </div>
      )}

      <Fab onClick={() => setFormOpen(true)} label="Add student" />
      <StudentForm open={formOpen} onClose={() => setFormOpen(false)} onSaved={load} />
    </div>
  )
}
