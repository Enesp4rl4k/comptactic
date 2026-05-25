import { useLayoutEffect, useState, type CSSProperties, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'

interface Props {
  open: boolean
  onClose: () => void
  anchorRef: RefObject<HTMLElement | null>
  children: ReactNode
  className?: string
  align?: 'right' | 'left'
  /** Flip above anchor when there is not enough space below (e.g. bottom toolbar). */
  placement?: 'auto' | 'above' | 'below'
}

/** Portal dropdown — avoids header overflow/backdrop-filter clipping. */
export function DropdownMenuPortal({
  open,
  onClose,
  anchorRef,
  children,
  className = '',
  align = 'right',
  placement = 'below',
}: Props) {
  const [style, setStyle] = useState<CSSProperties>({})

  useLayoutEffect(() => {
    if (!open || !anchorRef.current) return

    const update = () => {
      const el = anchorRef.current
      if (!el) return
      const r = el.getBoundingClientRect()
      const gap = 6
      const maxMenu = Math.min(window.innerHeight * 0.7, 352)
      const spaceBelow = window.innerHeight - r.bottom - gap - 8
      const spaceAbove = r.top - gap - 8
      const openAbove =
        placement === 'above' ||
        (placement === 'auto' && spaceBelow < 200 && spaceAbove > spaceBelow)

      const maxHeight = Math.min(maxMenu, openAbove ? spaceAbove : spaceBelow)
      const horizontal =
        align === 'right'
          ? { right: Math.max(8, window.innerWidth - r.right), minWidth: Math.max(r.width, 208) }
          : { left: Math.max(8, r.left), minWidth: Math.max(r.width, 208) }

      if (openAbove) {
        setStyle({
          ...horizontal,
          bottom: window.innerHeight - r.top + gap,
          maxHeight,
        })
      } else {
        setStyle({
          ...horizontal,
          top: r.bottom + gap,
          maxHeight,
        })
      }
    }

    update()
    window.addEventListener('scroll', update, true)
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('scroll', update, true)
      window.removeEventListener('resize', update)
    }
  }, [open, anchorRef, align, placement])

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
