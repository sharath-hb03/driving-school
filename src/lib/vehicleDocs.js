// Shared config + helpers for vehicle documents (insurance, PUC, fitness, etc.)
import { ShieldCheck, Leaf, Wrench, ReceiptText, FileText } from 'lucide-react'
import { differenceInCalendarDays } from 'date-fns'

// Days before expiry at which a document starts showing as "due soon".
export const WARN_DAYS = 30

// Order here = display order. Each type tailors the form labels to the document.
export const DOC_TYPES = [
  { value: 'insurance', label: 'Insurance', short: 'Insurance', icon: ShieldCheck, providerLabel: 'Insurer', numberLabel: 'Policy no.' },
  { value: 'puc',       label: 'PUC (Pollution)', short: 'PUC', icon: Leaf, providerLabel: 'Centre', numberLabel: 'Certificate no.' },
  { value: 'fitness',   label: 'Fitness', short: 'Fitness', icon: Wrench, providerLabel: 'Issuing RTO', numberLabel: 'Certificate no.' },
  { value: 'road_tax',  label: 'Road Tax', short: 'Road tax', icon: ReceiptText, providerLabel: 'Authority', numberLabel: 'Receipt no.' },
  { value: 'permit',    label: 'Permit', short: 'Permit', icon: FileText, providerLabel: 'Issuing RTO', numberLabel: 'Permit no.' }
]

export const DOC_TYPE_MAP = Object.fromEntries(DOC_TYPES.map((t) => [t.value, t]))

export const docTypeLabel = (v) => DOC_TYPE_MAP[v]?.label || v
export const docTypeShort = (v) => DOC_TYPE_MAP[v]?.short || v

// Expiry status for a YYYY-MM-DD date. Returns { tone, label, daysLeft }.
// tone maps onto the <Badge> colours: green / amber / red / gray.
export function expiryStatus(expiryDate, today = new Date()) {
  if (!expiryDate) return { tone: 'gray', label: 'No date', daysLeft: null }
  const days = differenceInCalendarDays(new Date(`${String(expiryDate).slice(0, 10)}T00:00:00`), today)
  if (days < 0) return { tone: 'red', label: `Expired ${Math.abs(days)}d ago`, daysLeft: days }
  if (days === 0) return { tone: 'red', label: 'Expires today', daysLeft: 0 }
  if (days <= WARN_DAYS) return { tone: 'amber', label: `${days}d left`, daysLeft: days }
  return { tone: 'green', label: `${days}d left`, daysLeft: days }
}

// Reduce a flat list of documents to the current (latest-expiring) one per type.
export function currentByType(docs = []) {
  const map = {}
  for (const d of docs) {
    const cur = map[d.doc_type]
    if (!cur || String(d.expiry_date) > String(cur.expiry_date)) map[d.doc_type] = d
  }
  return map
}
