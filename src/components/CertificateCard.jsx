import { Award, Download, RefreshCw } from 'lucide-react'
import { fmtDate } from '../lib/format'
import { Spinner } from './ui'
import { Select } from './Field'

// Shared certificate panel used by the staff student page and the student portal.
//  - certificate        : the row from the API (or null/undefined)
//  - eligible           : course is completed (so a certificate can exist)
//  - canGenerate        : this viewer may (re)generate it
//  - busy               : a generate request is in flight
//  - onGenerate         : () => Promise — issue / regenerate
//  - instructors        : optional list — when given, shows an instructor picker (staff)
//  - instructorId       : selected instructor id ('' = most-attended, auto)
//  - onInstructorChange : (id) => void
export default function CertificateCard({ certificate, eligible, canGenerate, busy, onGenerate, instructors, instructorId, onInstructorChange }) {
  const picker =
    canGenerate && instructors && instructors.length > 0 ? (
      <Select
        label="Instructor on certificate"
        value={instructorId || ''}
        onChange={(e) => onInstructorChange?.(e.target.value)}
        options={instructors.map((i) => ({ value: i.id, label: i.name }))}
        placeholder="Most-attended (auto)"
      />
    ) : null

  return (
    <div className="card p-5">
      <div className="mb-3 flex items-center gap-2">
        <Award className="h-5 w-5 text-brand-600" />
        <h2 className="font-bold text-slate-800">Certificate of Completion</h2>
      </div>

      {certificate ? (
        <div className="space-y-3">
          <a href={certificate.download_url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-xl border border-slate-200 shadow-sm">
            <img src={certificate.image_url} alt="Certificate of completion" className="w-full" loading="lazy" />
          </a>
          <div className="flex flex-wrap items-center justify-between gap-1 text-xs text-slate-400">
            <span>No. {certificate.certificate_no}</span>
            <span>Issued {fmtDate(certificate.issued_on)}</span>
          </div>
          {picker}
          <div className="flex gap-2">
            <a href={certificate.download_url} target="_blank" rel="noreferrer" className="btn-primary flex-1 justify-center px-3 py-2.5 text-sm">
              <Download className="h-4 w-4" /> Download
            </a>
            {canGenerate && (
              <button onClick={onGenerate} disabled={busy} className="btn-ghost px-3 py-2.5 text-sm" title="Regenerate certificate">
                {busy ? <Spinner className="h-4 w-4" /> : <RefreshCw className="h-4 w-4" />}
              </button>
            )}
          </div>
        </div>
      ) : canGenerate ? (
        <div>
          <p className="mb-3 text-center text-sm text-slate-500">
            {eligible ? 'The course is complete — generate the certificate.' : 'Issue a certificate of completion for this student.'}
          </p>
          {picker}
          <button onClick={onGenerate} disabled={busy} className="btn-primary mx-auto px-4 py-2.5 text-sm">
            {busy ? <Spinner className="h-4 w-4" /> : <Award className="h-4 w-4" />} Generate certificate
          </button>
        </div>
      ) : (
        <p className="py-4 text-center text-sm text-slate-400">
          Available once the course is completed.
        </p>
      )}
    </div>
  )
}
