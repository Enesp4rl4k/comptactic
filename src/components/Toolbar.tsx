import { useState } from 'react'
import { IconTrash } from './ui/Icons'
import { useBoardStore } from '../store/useBoardStore'
import type { ToolId } from '../types'

const TOOLS: { id: ToolId; label: string; glyph: string; key: string }[] = [
  { id: 'select', label: 'Select / Move', glyph: '⭖', key: 'V' },
  { id: 'arrow', label: 'Arrow', glyph: '↗', key: 'A' },
  { id: 'line', label: 'Line', glyph: '╱', key: 'L' },
  { id: 'pen', label: 'Freehand', glyph: '✎', key: 'P' },
  { id: 'rect', label: 'Rectangle', glyph: '▭', key: 'R' },
  { id: 'circle', label: 'Circle', glyph: '◯', key: 'C' },
  { id: 'zone', label: 'Zone — click corners, double-click / Enter to close', glyph: '⬠', key: 'Z' },
  { id: 'text', label: 'Text', glyph: 'T', key: 'T' },
  { id: 'measure', label: 'Measure distance', glyph: '📏', key: 'M' },
  { id: 'range', label: 'Range ring (drag radius, map scale)', glyph: '◉', key: 'O' },
  { id: 'ping', label: 'Ping — click to flash a marker for everyone', glyph: '◎', key: 'G' },
]

const RANGE_PRESETS: { label: string; meters: number }[] = [
  { label: 'FOB 150m', meters: 150 },
  { label: 'FOB 300m', meters: 300 },
  { label: '82mm ~400m', meters: 400 },
  { label: '120mm ~600m', meters: 600 },
]

export default function Toolbar() {
  const {
    tool,
    setTool,
    strokeWidth,
    setStrokeWidth,
    undo,
    redo,
    clearBoard,
    pendingRangeMeters,
    setPendingRangeMeters,
  } = useBoardStore()

  return (
    <div className="toolbar-rail">
      <div className="flex gap-1 shrink-0">
        {TOOLS.map((t) => (
          <button
            key={t.id}
            title={`${t.label} (${t.key})`}
            onClick={() => setTool(t.id)}
            className={`tool-btn ${tool === t.id ? 'tool-btn-active' : ''}`}
          >
            {t.glyph}
            <span
              className={`absolute bottom-0 right-0.5 text-[8px] leading-none font-semibold ${
                tool === t.id ? 'text-white/70' : 'text-gray-600'
              }`}
            >
              {t.key}
            </span>
          </button>
        ))}
      </div>

      <Divider />

      {(tool === 'range' || pendingRangeMeters != null) && (
        <>
          <div className="flex gap-1 flex-wrap max-w-[220px]">
            {RANGE_PRESETS.map((p) => (
              <button
                key={p.meters}
                type="button"
                title={`Click map to place ${p.meters} m ring`}
                onClick={() => setPendingRangeMeters(p.meters)}
                className={`h-7 px-2 rounded text-[10px] font-medium border cursor-pointer ${
                  pendingRangeMeters === p.meters
                    ? 'bg-accent border-accent text-white'
                    : 'bg-panel2 border-edge text-gray-400 hover:text-white'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <Divider />
        </>
      )}

      <ColorMenu />

      <Divider />

      <label className="flex items-center gap-2 text-xs text-gray-400 select-none shrink-0">
        Width
        <input
          type="range"
          min={1}
          max={14}
          value={strokeWidth}
          onChange={(e) => setStrokeWidth(Number(e.target.value))}
          className="w-20 sm:w-24 accent-accent cursor-pointer"
        />
        <span className="w-4 text-gray-300 tabular-nums">{strokeWidth}</span>
      </label>

      <div className="ml-auto flex gap-1 shrink-0">
        <ActionBtn onClick={undo} title="Undo (Ctrl+Z)">
          ↶
        </ActionBtn>
        <ActionBtn onClick={redo} title="Redo (Ctrl+Y)">
          ↷
        </ActionBtn>
        <ActionBtn
          onClick={() => {
            if (confirm('Clear the board?')) clearBoard()
          }}
          title="Clear board"
          danger
        >
          <IconTrash size={15} />
        </ActionBtn>
      </div>
    </div>
  )
}

function Divider() {
  return <div className="toolbar-divider" />
}

function ColorMenu() {
  const color = useBoardStore((s) => s.color)
  const setColor = useBoardStore((s) => s.setColor)
  const palette = useBoardStore((s) => s.palette)
  const addPaletteColor = useBoardStore((s) => s.addPaletteColor)
  const removePaletteColor = useBoardStore((s) => s.removePaletteColor)
  const [open, setOpen] = useState(false)
  const hex = /^#[0-9a-fA-F]{6}$/.test(color) ? color : '#ffffff'

  return (
    <div className="color-strip shrink-0">
      <div className="color-swatches">
        {palette.map((c) => {
          const active = color.toLowerCase() === c.toLowerCase()
          const light = isLightColor(c)
          return (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              onContextMenu={(e) => {
                e.preventDefault()
                removePaletteColor(c)
              }}
              title={`${c} — click to use, right-click to remove`}
              className={`color-swatch ${active ? 'color-swatch-active' : ''} ${light ? 'color-swatch-light' : ''}`}
              style={{ background: c }}
              aria-label={`Color ${c}`}
              aria-pressed={active}
            />
          )
        })}
        <div className="relative">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            title="Custom color"
            className="color-swatch-add"
            aria-expanded={open}
          >
            +
          </button>
          {open && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden="true" />
              <div className="absolute left-0 top-[calc(100%+6px)] z-50 w-44 rounded-lg border border-edge bg-panel2 p-2 shadow-panel">
                <div className="flex items-center gap-1.5">
                  <input
                    type="color"
                    value={hex}
                    onChange={(e) => setColor(e.target.value)}
                    title="Pick a custom color"
                    className="h-7 w-7 rounded cursor-pointer bg-transparent border border-edge p-0"
                  />
                  <button
                    type="button"
                    onClick={() => addPaletteColor(color)}
                    className="btn h-7 px-2 text-xs flex-1"
                    title="Save current color to the strip"
                  >
                    Save
                  </button>
                </div>
                <p className="mt-1.5 text-[10px] text-gray-500">Right-click a swatch to remove it.</p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function isLightColor(hex: string): boolean {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex)
  if (!m) return false
  const r = parseInt(m[1], 16)
  const g = parseInt(m[2], 16)
  const b = parseInt(m[3], 16)
  return (r * 299 + g * 587 + b * 114) / 1000 > 180
}

function ActionBtn({
  children,
  onClick,
  title,
  danger,
}: {
  children: React.ReactNode
  onClick: () => void
  title: string
  danger?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`h-9 w-9 rounded-md bg-panel2 border border-edge grid place-items-center transition-colors cursor-pointer ${
        danger ? 'text-gray-400 hover:text-red-400 hover:border-red-500/60' : 'text-gray-300 hover:bg-edge hover:text-white'
      }`}
    >
      {children}
    </button>
  )
}
