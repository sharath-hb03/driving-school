import { format, parseISO, isToday, isTomorrow, isYesterday } from 'date-fns'

const money = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })
export const inr = (n) => money.format(Number(n || 0))
export const todayStr = () => format(new Date(), 'yyyy-MM-dd')

function toDate(value) {
  if (!value) return null
  if (value instanceof Date) return value
  const iso = String(value).includes('T') ? value : String(value).replace(' ', 'T')
  try { return parseISO(iso) } catch { return new Date(value) }
}

export function fmtDate(value, pattern = 'dd MMM yyyy') {
  const d = toDate(value)
  return d ? format(d, pattern) : '—'
}
export function fmtTime(value) {
  const d = toDate(value)
  return d ? format(d, 'h:mm a') : '—'
}
export function fmtDateTime(value) {
  const d = toDate(value)
  return d ? format(d, 'dd MMM, h:mm a') : '—'
}
export function relativeDay(value) {
  const d = toDate(value)
  if (!d) return '—'
  if (isToday(d)) return 'Today'
  if (isTomorrow(d)) return 'Tomorrow'
  if (isYesterday(d)) return 'Yesterday'
  return format(d, 'EEE, dd MMM')
}
export function initials(name = '') {
  return name.split(' ').filter(Boolean).slice(0, 2).map(p => p[0]?.toUpperCase()).join('')
}
export function toInputDateTime(d = new Date()) {
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
export function fmtClock(hhmm) {
  if (!hhmm) return ''
  const [h, m] = String(hhmm).split(':').map(Number)
  const d = new Date(); d.setHours(h||0, m||0, 0, 0)
  return format(d, 'h:mm a')
}
const DAY_ORDER = [1,2,3,4,5,6,0]
const DAY_SHORT = {0:'Sun',1:'Mon',2:'Tue',3:'Wed',4:'Thu',5:'Fri',6:'Sat'}
export function formatWorkDays(csv) {
  const inc = new Set(String(csv||'').split(',').filter(x=>x!=='').map(Number))
  const days = DAY_ORDER.filter(n => inc.has(n))
  if (days.length===0) return 'No days set'
  if (days.length===7) return 'Every day'
  const idxs = days.map(d => DAY_ORDER.indexOf(d))
  const contiguous = idxs.every((v,i) => i===0||v===idxs[i-1]+1)
  if (contiguous && days.length>2) return `${DAY_SHORT[days[0]]}–${DAY_SHORT[days[days.length-1]]}`
  return days.map(d => DAY_SHORT[d]).join(', ')
}
