import { useState, useRef, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { Clock, X } from 'lucide-react'

// Helper to convert 24h HH:mm to 12h components
function parseTime24(timeStr) {
  if (!timeStr) return { hour: 9, minute: 0, period: 'AM' }
  const [hStr, mStr] = timeStr.split(':')
  let hour = parseInt(hStr, 10)
  const minute = parseInt(mStr, 10) || 0
  
  if (Number.isNaN(hour)) hour = 9
  
  const period = hour >= 12 ? 'PM' : 'AM'
  let hour12 = hour % 12
  if (hour12 === 0) hour12 = 12
  
  return { hour: hour12, minute, period }
}

// Helper to convert 12h components to 24h HH:mm
function formatTime24(hour12, minute, period) {
  let hour = hour12
  if (period === 'PM' && hour < 12) hour += 12
  if (period === 'AM' && hour === 12) hour = 0
  
  const hh = String(hour).padStart(2, '0')
  const mm = String(minute).padStart(2, '0')
  return `${hh}:${mm}`
}

export default function TimePicker({
  value,
  onChange,
  name,
  placeholder = 'Select time',
  required,
  disabled: inputDisabled,
  className = '',
  inputClassName = ''
}) {
  const [open, setOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0, maxHeight: 250 })

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

  // Parse time
  const { hour, minute, period } = useMemo(() => parseTime24(value), [value])

  // Calculate coordinates for fixed positioning on desktop (relative to viewport)
  const updateCoords = () => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      let left = rect.left
      const dropdownWidth = 280 // time picker max-width
      const estimatedHeight = 250 // estimated height of TimePicker including gap

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

  // Scroll active elements into view inside dropdown
  const hourListRef = useRef(null)
  const minuteListRef = useRef(null)

  useEffect(() => {
    if (open) {
      setTimeout(() => {
        const activeHour = hourListRef.current?.querySelector('.active-hour')
        if (activeHour) {
          activeHour.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
        }
        const activeMinute = minuteListRef.current?.querySelector('.active-minute')
        if (activeMinute) {
          activeMinute.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
        }
      }, 50)
    }
  }, [open, hour, minute])

  const hoursList = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
  const minutesList = Array.from({ length: 12 }, (_, i) => i * 5) // 0, 5, 10... 55

  const updateTime = (newHour, newMinute, newPeriod) => {
    const formatted = formatTime24(newHour, newMinute, newPeriod)
    if (onChange) {
      onChange({
        target: {
          name,
          value: formatted
        }
      })
    }
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

  // Display value in 12h format
  const displayValue = useMemo(() => {
    if (!value) return ''
    const { hour: h, minute: m, period: p } = parseTime24(value)
    return `${h}:${String(m).padStart(2, '0')} ${p}`
  }, [value])

  // Shared Time Picker Content UI
  const timeContent = (
    <div className="w-full">
      <div className="mb-2.5 text-center text-xs font-bold uppercase tracking-wider text-slate-400 select-none">
        Select Time
      </div>

      <div className="grid grid-cols-3 gap-2 border-t border-slate-100 pt-3 h-48">
        {/* Hours Column */}
        <div 
          ref={hourListRef}
          className="overflow-y-auto scrollbar-none flex flex-col gap-1 pr-1 border-r border-slate-100"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {hoursList.map((h) => {
            const isActive = hour === h
            return (
              <button
                key={h}
                type="button"
                onClick={() => updateTime(h, minute, period)}
                className={`rounded-lg py-1.5 text-xs font-semibold transition text-center focus:outline-none ${
                  isActive 
                    ? 'bg-brand-600 text-white active-hour font-bold shadow-sm' 
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                {h}
              </button>
            )
          })}
        </div>

        {/* Minutes Column */}
        <div 
          ref={minuteListRef}
          className="overflow-y-auto scrollbar-none flex flex-col gap-1 pr-1 border-r border-slate-100"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {minutesList.map((m) => {
            const isActive = minute === m
            const displayMin = String(m).padStart(2, '0')
            return (
              <button
                key={m}
                type="button"
                onClick={() => updateTime(hour, m, period)}
                className={`rounded-lg py-1.5 text-xs font-semibold transition text-center focus:outline-none ${
                  isActive 
                    ? 'bg-brand-600 text-white active-minute font-bold shadow-sm' 
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                {displayMin}
              </button>
            )
          })}
        </div>

        {/* AM/PM Column */}
        <div className="flex flex-col justify-center gap-2">
          {['AM', 'PM'].map((p) => {
            const isActive = period === p
            return (
              <button
                key={p}
                type="button"
                onClick={() => updateTime(hour, minute, p)}
                className={`rounded-lg py-3 text-xs font-bold transition text-center focus:outline-none ${
                  isActive 
                    ? 'bg-brand-600 text-white font-bold shadow-sm' 
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                }`}
              >
                {p}
              </button>
            )
          })}
        </div>
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
          className={`input flex items-center justify-between text-left cursor-pointer pr-10 ${
            inputDisabled ? 'bg-slate-50 cursor-not-allowed text-slate-400' : ''
          } ${open ? 'border-brand-500 ring-2 ring-brand-100' : ''} ${inputClassName}`}
        >
          <span className={displayValue ? 'text-slate-800' : 'text-slate-400'}>
            {displayValue || placeholder}
          </span>
          <Clock className="h-4.5 w-4.5 shrink-0 text-slate-400" />
        </button>
        {displayValue && !required && !inputDisabled && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-10 top-1/2 -translate-y-1/2 p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100"
          >
            <X className="h-3.5 w-3.5" />
          </button>
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
                className="relative z-10 w-full max-w-[280px] rounded-2xl border border-slate-100 bg-white p-4 shadow-soft page-enter overflow-y-auto max-h-[85vh]"
              >
                {timeContent}
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
                  minWidth: '260px',
                  maxWidth: '280px',
                  maxHeight: `${coords.maxHeight}px`
                }}
              >
                {timeContent}
              </div>
            </>,
            document.body
          )
        )
      )}
    </div>
  )
}
