import { useRef, useState } from 'react'
import { UI_THEMES } from '../lib/uiTheme'
import { useUiThemeStore } from '../store/useUiThemeStore'
import { DropdownMenuPortal } from './ui/DropdownMenu'

interface Props {
  className?: string
  align?: 'right' | 'left'
}

export default function ThemeMenu({ className = '', align = 'right' }: Props) {
  const [open, setOpen] = useState(false)
  const anchorRef = useRef<HTMLButtonElement>(null)
  const themeId = useUiThemeStore((s) => s.themeId)
  const setTheme = useUiThemeStore((s) => s.setTheme)
  const active = UI_THEMES.find((t) => t.id === themeId) ?? UI_THEMES[0]!

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        title="Accent color"
        className={`btn btn-icon ${className}`.trim()}
      >
        <span
          className="h-3.5 w-3.5 rounded-full border border-white/20 shadow-sm"
          style={{ backgroundColor: active.swatch }}
          aria-hidden="true"
        />
      </button>
      <DropdownMenuPortal open={open} onClose={() => setOpen(false)} anchorRef={anchorRef} align={align} className="w-52">
        <div className="dropdown-label">Accent color</div>
        {UI_THEMES.map((theme) => {
          const selected = theme.id === themeId
          return (
            <button
              key={theme.id}
              type="button"
              role="menuitemradio"
              aria-checked={selected}
              onClick={() => {
                setTheme(theme.id)
                setOpen(false)
              }}
              className={`dropdown-item flex items-center gap-2.5 ${selected ? 'text-zinc-50 bg-highlight/10' : ''}`}
            >
              <span
                className={`h-3.5 w-3.5 shrink-0 rounded-full border ${selected ? 'border-white/50 ring-2 ring-highlight/40' : 'border-white/15'}`}
                style={{ backgroundColor: theme.swatch }}
                aria-hidden="true"
              />
              <span className="flex-1 text-left">{theme.label}</span>
              {selected && <span className="text-[10px] uppercase tracking-wide text-highlight">Active</span>}
            </button>
          )
        })}
      </DropdownMenuPortal>
    </>
  )
}
