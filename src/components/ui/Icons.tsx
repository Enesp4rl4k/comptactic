/** Inline SVG icons — no emoji, consistent 16/20px stroke icons. */

type IconProps = { className?: string; size?: number }

const base = (size: number) => ({ width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const })

export function IconMap({ className = '', size = 16 }: IconProps) {
  const p = base(size)
  return (
    <svg className={className} {...p}>
      <path d="M9 20l-5-2V6l5 2 7-3 5 2v12l-5-2-7 3z" />
      <path d="M9 6v12M16 3v12" />
    </svg>
  )
}

export function IconPlay({ className = '', size = 16 }: IconProps) {
  const p = base(size)
  return (
    <svg className={className} {...p}>
      <polygon points="8 5 19 12 8 19 8 5" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function IconCloud({ className = '', size = 16 }: IconProps) {
  const p = base(size)
  return (
    <svg className={className} {...p}>
      <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
    </svg>
  )
}

export function IconChevronDown({ className = '', size = 14 }: IconProps) {
  const p = base(size)
  return (
    <svg className={className} {...p}>
      <path d="M6 9l6 6 6-6" />
    </svg>
  )
}

export function IconClose({ className = '', size = 18 }: IconProps) {
  const p = base(size)
  return (
    <svg className={className} {...p}>
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  )
}

export function IconHelp({ className = '', size = 16 }: IconProps) {
  const p = base(size)
  return (
    <svg className={className} {...p}>
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01" />
    </svg>
  )
}

export function IconTrash({ className = '', size = 16 }: IconProps) {
  const p = base(size)
  return (
    <svg className={className} {...p}>
      <path d="M3 6h18M8 6V4h8v2M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
    </svg>
  )
}

export function IconChevronLeft({ className = '', size = 16 }: IconProps) {
  const p = base(size)
  return (
    <svg className={className} {...p}>
      <path d="M15 18l-6-6 6-6" />
    </svg>
  )
}

export function IconChevronRight({ className = '', size = 16 }: IconProps) {
  const p = base(size)
  return (
    <svg className={className} {...p}>
      <path d="M9 18l6-6-6-6" />
    </svg>
  )
}

export function IconPlus({ className = '', size = 16 }: IconProps) {
  const p = base(size)
  return (
    <svg className={className} {...p}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}
