import { useLayoutEffect, useState, type CSSProperties, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'

interface Props {
  open: boolean
  onClose: () => void
  anchorRef: RefObject<HTMLElement | null>
  children: ReactNode
  className?: string
  align?: 'right' | 'left'
}

/** Portal dropdown — avoids header overflow/backdrop-filter clipping. */
export function DropdownMenuPortal({
  open,
  onClose,
  anchorRef,
  children,
  className = '',
  align = 'right',
}: Props) {
  const [style, setStyle] = useState<CSSProperties>({})

  useLayoutEffect(() => {
    if (!open || !anchorRef.current) return

    const update = () => {
      const el = anchorRef.current
      if (!el) return
      const r = el.getBoundingClientRect()
      const top = r.bottom + 6
      if (align === 'right') {
        setStyle({ top, right: Math.max(8, window.innerWidth - r.right), minWidth: Math.max(r.width, 208) })
      } else {
        setStyle({ top, left: Math.max(8, r.left), minWidth: Math.max(r.width, 208) })
      }
    }

    update()
    window.addEventListener('scroll', update, true)
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('scroll', update, true)
      window.removeEventListener('resize', update)
    }
  }, [open, anchorRef, align])

  if (!open) return null

  return createPortal(
    <>
      <div className="dropdown-backdrop" onClick={onClose} aria-hidden="true" />
      <div className={`dropdown-menu dropdown-menu-fixed ${className}`.trim()} style={style} role="menu">
        {children}
      </div>
    </>,
    document.body,
  )
}
