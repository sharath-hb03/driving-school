import { useMemo, useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import {
  startOfMonth, startOfWeek, startOfDay, addDays, addMonths, addMinutes,
  isSameDay, isSameMonth, isBefore, isToday, format, set
} from 'date-fns'
import { Calendar, ChevronLeft, ChevronRight, Clock } from 'lucide-react'
import { toInputDateTime } from '../lib/format'

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
const key = (d) => format(d, 'yyyy-MM-dd')
const hourOf = (hhmm, fallback) => {
  const h = parseInt(String(hhmm || '').slice(0, 2), 10)
  return Number.isNaN(h) ? fallback : h
}

export default function DateTimePicker({ value, onChange, disablePast = true, holidays = [], availability = null }) {
  const selected = value ? new Date(value) : null
  const validSelected = selected && !Number.isNaN(selected.getTime()) ? selected : null

  const [open, setOpen] = useState(false)
  const [view, setView] = useState(startOfMonth(validSelected || new Date()))
  const [isMobile, setIsMobile] = useState(false)
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0, maxHeight: 460 })

  const buttonRef = useRef(null)
  const containerRef = useRef(null)

  // Detect mobile viewport
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 640)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  const today = startOfDay(new Date())
  const now = new Date()

  const holidayMap = useMemo(() => {
    const m = {}
    for (const h of holidays) m[h.date] = h.name
    return m
  }, [holidays])
  const offSet = useMemo(() => new Set(availability?.daysOff || []), [availability])
  const workDays = availability?.workDays || null
  const startH = hourOf(availability?.workStart, 6)
  const lastStartH = hourOf(availability?.workEnd, 21) - 1

  const slots = useMemo(() => {
    const out = []
    for (let h = startH; h <= lastStartH; h += 1) out.push(h)
    return out
  }, [startH, lastStartH])

  // Why is a given day not bookable?
  const dayBlock = (day) => {
    if (disablePast && isBefore(day, today)) return { disabled: true }
    const k = key(day)
    if (holidayMap[k]) return { disabled: true, type: 'holiday', label: holidayMap[k] }
    if (offSet.has(k)) return { disabled: true, type: 'off', label: 'Instructor off' }
    if (workDays && !workDays.includes(day.getDay())) return { disabled: true, type: 'nonwork', label: 'Not working' }
    return { disabled: false }
  }

  const grid = useMemo(() => {
    const first = startOfWeek(startOfMonth(view), { weekStartsOn: 0 })
    return Array.from({ length: 42 }, (_, i) => addDays(first, i))
  }, [view])

  const pickDay = (day) => {
    const base = validSelected || set(new Date(), { hours: 10, minutes: 0, seconds: 0, milliseconds: 0 })
    let next = set(day, { hours: base.getHours(), minutes: 0, seconds: 0, milliseconds: 0 })
    const inWindow = next.getHours() >= startH && next.getHours() <= lastStartH
    if (!inWindow || (disablePast && next < now)) {
      const h = slots.find((hh) => set(day, { hours: hh, minutes: 0 }) > now) ?? slots[0]
      next = set(day, { hours: h, minutes: 0, seconds: 0, milliseconds: 0 })
    }
    onChange(toInputDateTime(next))
  }

  const pickTime = (h) => {
    const day = validSelected || new Date()
    const next = set(day, { hours: h, minutes: 0, seconds: 0, milliseconds: 0 })
    onChange(toInputDateTime(next))
    setOpen(false)
  }

  const prevDisabled = disablePast && !isBefore(today, startOfMonth(view))
  const hasMarkers = holidays.length > 0 || Boolean(availability)
  const triggerHoliday = validSelected ? holidayMap[key(validSelected)] : null

  // Calculate coordinates for fixed positioning on desktop (relative to viewport)
  const updateCoords = () => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      let left = rect.left
      const dropdownWidth = 320 // max-width of DateTimePicker card
      const estimatedHeight = 460 // ideal height of DateTimePicker including gap

      // Right-edge alignment check
      if (rect.left + dropdownWidth > window.innerWidth) {
        left = rect.right - dropdownWidth
      }

      // Left-edge alignment check
      if (left < 10) {
        left = 10
      }

      // Vertical bounds alignment check (smart flip + dynamic maxHeight)
      const spaceBelow = window.innerHeight - rect.bottom - 24 // 24px safety margin
      const spaceAbove = rect.top - 24 // 24px safety margin
      let top = rect.bottom + 8 // 8px gap below by default
      let maxHeight = estimatedHeight

      if (spaceBelow < estimatedHeight && spaceAbove > spaceBelow) {
        // Open above instead
        maxHeight = Math.max(200, Math.min(estimatedHeight, spaceAbove))
        top = rect.top - maxHeight - 8
      } else {
        // Open below
        maxHeight = Math.max(200, Math.min(estimatedHeight, spaceBelow))
      }

      setCoords({
        top,
        left,
        width: rect.width,
        maxHeight
      })
    }
  }

  // Manage event listeners for dropdown behavior (resize, scroll-close, click-outside)
  useEffect(() => {
    if (!open) return

    if (isMobile) return

    updateCoords()
    window.addEventListener('resize', updateCoords)

    // Close on any scroll event in the document except when scrolling internally
    const handleScroll = (event) => {
      if (containerRef.current && containerRef.current.contains(event.target)) {
        return // Ignore internal scrollbar scrolls
      }
      setOpen(false)
    }
    window.addEventListener('scroll', handleScroll, true)

    // Click outside to close (desktop only)
    const handleClickOutside = (event) => {
      if (
        containerRef.current && !containerRef.current.contains(event.target) &&
        buttonRef.current && !buttonRef.current.contains(event.target)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('touchstart', handleClickOutside)

    return () => {
      window.removeEventListener('resize', updateCoords)
      window.removeEventListener('scroll', handleScroll, true)
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('touchstart', handleClickOutside)
    }
  }, [open, isMobile])

  // Shared DateTimePicker Content
  const pickerContent = (
    <div className="w-full">
      {/* Month header */}
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          disabled={prevDisabled}
          onClick={() => setView((v) => addMonths(v, -1))}
          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-50 hover:text-slate-600 disabled:opacity-30 disabled:hover:bg-transparent"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <p className="text-sm font-bold text-slate-700 select-none">{format(view, 'MMMM yyyy')}</p>
        <button 
          type="button" 
          onClick={() => setView((v) => addMonths(v, 1))} 
          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-50 hover:text-slate-600"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {/* Weekday labels */}
      <div className="grid grid-cols-7 text-center text-xs font-semibold text-slate-400 mb-2 select-none">
        {WEEKDAYS.map((d) => (
          <span key={d} className="py-1">{d}</span>
        ))}
      </div>

      {/* Days */}
      <div className="grid grid-cols-7 gap-y-1 gap-x-0.5">
        {grid.map((day) => {
          const muted = !isSameMonth(day, view)
          const block = dayBlock(day)
          const isSel = validSelected && isSameDay(day, validSelected)
          const dot = block.type === 'holiday' ? 'bg-red-400' : block.type === 'off' ? 'bg-amber-400' : ''
          return (
            <button
              key={day.toISOString()}
              type="button"
              disabled={block.disabled}
              title={block.label || ''}
              onClick={() => pickDay(day)}
              className={[
                'relative mx-auto flex h-9 w-9 flex-col items-center justify-center rounded-full text-sm transition focus:outline-none',
                isSel
                  ? 'bg-brand-600 font-semibold text-white hover:bg-brand-700 shadow-sm'
                  : block.disabled
                  ? `cursor-not-allowed text-slate-300 ${block.type ? '' : 'line-through'}`
                  : muted
                  ? 'text-slate-300 hover:bg-slate-50'
                  : 'text-slate-700 hover:bg-slate-50',
                !isSel && isToday(day) ? 'font-bold text-brand-600 border border-brand-200' : ''
              ].join(' ')}
            >
              <span>{format(day, 'd')}</span>
              {dot && !isSel && <span className={`absolute bottom-1 h-1 w-1 rounded-full ${dot}`} />}
            </button>
          )
        })}
      </div>

      {hasMarkers && (
        <div className="mt-2 flex items-center justify-center gap-3 text-[10px] text-slate-400 select-none">
          {holidays.length > 0 && <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-red-400" /> Holiday</span>}
          {availability && <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-amber-400" /> Off / not working</span>}
        </div>
      )}

      {/* Times */}
      <div className="mt-3 border-t border-slate-100 pt-3">
        <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-slate-500 select-none">
          <Clock className="h-3.5 w-3.5" /> Time
          <span className="font-normal text-slate-400">· {format(set(new Date(), { hours: startH, minutes: 0 }), 'h a')}–{format(set(new Date(), { hours: lastStartH + 1, minutes: 0 }), 'h a')}</span>
        </div>
        <div className="grid max-h-40 grid-cols-2 gap-1.5 overflow-y-auto">
          {slots.map((h) => {
            const dayRef = validSelected || today
            const slotDate = set(dayRef, { hours: h, minutes: 0, seconds: 0, milliseconds: 0 })
            const endDate = addMinutes(slotDate, 60)
            const disabled = disablePast && validSelected && isToday(validSelected) && slotDate < now
            const isSel = validSelected && validSelected.getHours() === h
            return (
              <button
                key={h}
                type="button"
                disabled={disabled}
                onClick={() => pickTime(h)}
                className={[
                  'rounded-lg py-1.5 text-xs font-semibold transition focus:outline-none',
                  isSel
                    ? 'bg-brand-600 text-white font-bold shadow-sm'
                    : disabled
                    ? 'cursor-not-allowed bg-slate-50 text-slate-300'
                    : 'bg-slate-100 text-slate-600 hover:bg-brand-50 hover:text-brand-700'
                ].join(' ')}
              >
                {format(slotDate, 'h:mm')} – {format(endDate, 'h:mm a')}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`input flex items-center justify-between text-left ${open ? 'border-brand-500 ring-2 ring-brand-100' : ''}`}
      >
        <span className={validSelected ? 'text-slate-800' : 'text-slate-400'}>
          {validSelected ? format(validSelected, 'EEE, d MMM yyyy · h:mm a') : 'Pick a date & time'}
        </span>
        <Calendar className="h-4.5 w-4.5 shrink-0 text-slate-400" />
      </button>

      {triggerHoliday && (
        <p className="mt-1 text-xs font-medium text-red-500">⚠ {triggerHoliday} — school is closed this day.</p>
      )}

      {open && (
        isMobile ? (
          // Mobile Modal Dialog
          createPortal(
            <div className="fixed inset-0 z-[9999] bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
              <div className="fixed inset-0" onClick={() => setOpen(false)} />
              <div 
                ref={containerRef}
                className="relative z-10 w-full max-w-[320px] rounded-2xl border border-slate-100 bg-white p-4 shadow-soft page-enter overflow-y-auto max-h-[85vh]"
              >
                {pickerContent}
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="btn-ghost mt-4 w-full py-2 text-sm font-semibold rounded-xl"
                >
                  Close
                </button>
              </div>
            </div>,
            document.body
          )
        ) : (
          // Desktop body portal floating dropdown
          createPortal(
            <>
              <div className="fixed inset-0 z-[9998] bg-transparent" onClick={() => setOpen(false)} />
              <div
                ref={containerRef}
                className="fixed z-[9999] rounded-2xl border border-slate-200 bg-white p-4 shadow-soft page-enter overflow-y-auto"
                style={{
                  top: coords.top,
                  left: coords.left,
                  minWidth: '290px',
                  maxWidth: '340px',
                  maxHeight: `${coords.maxHeight}px`
                }}
              >
                {pickerContent}
              </div>
            </>,
            document.body
          )
        )
      )}
    </div>
  )
}
