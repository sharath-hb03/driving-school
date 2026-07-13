import { useState } from 'react'
import { Building2 } from 'lucide-react'

// School logo with the default brand mark as fallback.
// `size` is the box in px; the image keeps its aspect ratio inside it.
export default function SchoolLogo({ src, size = 36, className = '' }) {
  const [broken, setBroken] = useState(false)

  if (src && !broken) {
    return (
      <img
        src={src}
        alt="School logo"
        width={size}
        height={size}
        onError={() => setBroken(true)}
        className={`shrink-0 rounded-xl border border-slate-100 bg-white object-contain p-0.5 ${className}`}
        style={{ width: size, height: size }}
      />
    )
  }

  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-xl bg-brand-600 ${className}`}
      style={{ width: size, height: size }}
    >
      <Building2 className="text-white" style={{ width: size * 0.55, height: size * 0.55 }} />
    </div>
  )
}
