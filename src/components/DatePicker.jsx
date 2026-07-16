import { useState, useRef, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import {
  startOfMonth, startOfWeek, startOfDay, addDays, addMonths,
  isSameDay, isSameMonth, isBefore, isToday, format, parseISO, isValid
} from 'date-fns'
import { Calendar, ChevronLeft, ChevronRight, X } from 'lucide-react'

export default function DatePicker({
  value,
  onChange,
  name,
  placeholder = 'Select date',
  min,
  max,
  required,
  disabled: inputDisabled,
  className = '',
  inputClassName = ''
}) {
  const [open, setOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0, maxHeight: 330 })
  
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

  // Parse current value
  const selectedDate = useMemo(() => {
    if (!value) return null
    const parsed = typeof value === 'string' ? parseISO(value) : new Date(value)
    return isValid(parsed) ? parsed : null
  }, [value])

  // Current view month (defaults to selected date or today)
  const [viewDate, setViewDate] = useState(() => selectedDate || new Date())

  // Update view when selected value changes externally
  useEffect(() => {
    if (selectedDate) {
      setViewDate(selectedDate)
    }
  }, [selectedDate])

  // Calculate coordinates for fixed positioning on desktop (relative to viewport)
  const updateCoords = () => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      let left = rect.left
      const dropdownWidth = 320 // calendar max-width
      const estimatedHeight = 330 // estimated height of DatePicker including gap

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
        return // Ignore internal list scrolls
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

  // Define date limits
  const minDate = useMemo(() => (min ? startOfDay(parseISO(min)) : null), [min])
  const maxDate = useMemo(() => (max ? startOfDay(parseISO(max)) : null), [max])

  // Compute grid of 42 days for the calendar
  const grid = useMemo(() => {
    const startOfViewMonth = startOfMonth(viewDate)
    const startOfCalendarGrid = startOfWeek(startOfViewMonth, { weekStartsOn: 0 })
    return Array.from({ length: 42 }, (_, i) => addDays(startOfCalendarGrid, i))
  }, [viewDate])

  const isDateDisabled = (day) => {
    if (minDate && isBefore(day, minDate) && !isSameDay(day, minDate)) return true
    if (maxDate && isBefore(maxDate, day) && !isSameDay(day, maxDate)) return true
    return false
  }

  const handleSelectDay = (day) => {
    if (isDateDisabled(day)) return
    const formatted = format(day, 'yyyy-MM-dd')
    if (onChange) {
      onChange({
        target: {
          name,
          value: formatted
        }
      })
    }
    setOpen(false)
  }

  const handleClear = (e) => {
    e.stopPropagation()
    if (onChange) {
      onChange({
        target: {
          name,
          value: ''
        }
      })
    }
  }

  const formattedDisplay = selectedDate ? format(selectedDate, 'dd MMM yyyy') : ''

  // Shared Calendar UI Content
  const calendarContent = (
    <div className="w-full">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setViewDate((v) => addMonths(v, -1))}
          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <p className="text-sm font-bold text-slate-700 select-none">
          {format(viewDate, 'MMMM yyyy')}
        </p>
        <button
          type="button"
          onClick={() => setViewDate((v) => addMonths(v, 1))}
          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {/* Weekdays */}
      <div className="grid grid-cols-7 text-center text-xs font-semibold text-slate-400 mb-2 select-none">
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
          <span key={d} className="py-1">{d}</span>
        ))}
      </div>

      {/* Days Grid */}
      <div className="grid grid-cols-7 gap-y-1 gap-x-0.5">
        {grid.map((day) => {
          const isCurrentMonth = isSameMonth(day, viewDate)
          const disabled = isDateDisabled(day)
          const isSelected = selectedDate && isSameDay(day, selectedDate)
          const isTodayDay = isToday(day)

          return (
            <button
              key={day.toISOString()}
              type="button"
              disabled={disabled}
              onClick={() => handleSelectDay(day)}
              className={[
                'relative mx-auto flex h-9 w-9 items-center justify-center rounded-full text-sm transition focus:outline-none',
                isSelected
                  ? 'bg-brand-600 font-semibold text-white hover:bg-brand-700 shadow-sm'
                  : disabled
                  ? 'cursor-not-allowed text-slate-300 line-through'
                  : !isCurrentMonth
                  ? 'text-slate-300 hover:bg-slate-50'
                  : 'text-slate-700 hover:bg-slate-50',
                isTodayDay && !isSelected ? 'font-bold text-brand-600 border border-brand-200' : ''
              ].join(' ')}
            >
              {format(day, 'd')}
            </button>
          )
        })}
      </div>
    </div>
  )

  return (
    <div className={`relative ${className}`}>
      <div className="relative">
        <button
          ref={buttonRef}
          type="button"
          disabled={inputDisabled}
          onClick={() => setOpen((o) => !o)}
          className={`input flex items-center text-left cursor-pointer pr-9 ${
            inputDisabled ? 'bg-slate-50 cursor-not-allowed text-slate-400' : ''
          } ${open ? 'border-brand-500 ring-2 ring-brand-100' : ''} ${inputClassName}`}
        >
          <span className={`truncate ${formattedDisplay ? 'text-slate-800' : 'text-slate-400'}`}>
            {formattedDisplay || placeholder}
          </span>
        </button>
        {formattedDisplay && !required && !inputDisabled ? (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : (
          <Calendar className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        )}
      </div>

      {open && !inputDisabled && (
        isMobile ? (
          // Mobile Modal Dialog
          createPortal(
            <div className="fixed inset-0 z-[9999] bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
              <div className="fixed inset-0" onClick={() => setOpen(false)} />
              <div 
                ref={containerRef}
                className="relative z-10 w-full max-w-[320px] rounded-2xl border border-slate-100 bg-white p-4 shadow-soft page-enter overflow-y-auto max-h-[85vh]"
              >
                {calendarContent}
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
                  minWidth: '280px',
                  maxWidth: '340px',
                  maxHeight: `${coords.maxHeight}px`
                }}
              >
                {calendarContent}
              </div>
            </>,
            document.body
          )
        )
      )}
    </div>
  )
}
