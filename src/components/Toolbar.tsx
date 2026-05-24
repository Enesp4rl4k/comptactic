import { useState } from 'react'
import { IconTrash } from './ui/Icons'
import TeamSlider from './TeamSlider'
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
    team,
    setTeam,
    strokeWidth,
    setStrokeWidth,
    snapToGrid,
    toggleSnap,
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

      <TeamSlider team={team} onChange={setTeam} />

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

      <label className="flex items-center gap-2 text-xs text-gray-400 select-none">
        Width
        <input
          type="range"
          min={1}
          max={14}
          value={strokeWidth}
          onChange={(e) => setStrokeWidth(Number(e.target.value))}
          className="w-24 accent-accent cursor-pointer"
        />
        <span className="w-4 text-gray-300 tabular-nums">{strokeWidth}</span>
      </label>

      <Divider />

      <button
        onClick={toggleSnap}
        title="Snap to grid"
        className={`h-9 px-2.5 rounded-md text-xs font-medium border transition-colors cursor-pointer ${
          snapToGrid ? 'bg-accent border-accent text-white' : 'bg-panel2 border-edge text-gray-400 hover:text-white'
        }`}
      >
        # Snap
      </button>

      <div className="ml-auto flex gap-1">
        <ActionBtn onClick={undo} title="Undo (Ctrl+Z)">↶</ActionBtn>
        <ActionBtn onClick={redo} title="Redo (Ctrl+Y)">↷</ActionBtn>
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

// Inline color strip: one-click palette swatches + a "+" popover for custom
// colors and palette management.
function ColorMenu() {
  const color = useBoardStore((s) => s.color)
  const setColor = useBoardStore((s) => s.setColor)
  const palette = useBoardStore((s) => s.palette)
  const addPaletteColor = useBoardStore((s) => s.addPaletteColor)
  const removePaletteColor = useBoardStore((s) => s.removePaletteColor)
  const [open, setOpen] = useState(false)
  const hex = /^#[0-9a-fA-F]{6}$/.test(color) ? color : '#ffffff'

  return (
    <div className="flex items-center gap-1">
      {palette.map((c) => (
        <button
          key={c}
          onClick={() => setColor(c)}
          onContextMenu={(e) => {
            e.preventDefault()
            removePaletteColor(c)
          }}
          title={`${c} — click to use, right-click to remove`}
          className={`h-6 w-6 rounded-full border-2 cursor-pointer transition-transform hover:scale-110 ${
            color.toLowerCase() === c.toLowerCase() ? 'border-white ring-2 ring-white/30' : 'border-black/40'
          }`}
          style={{ background: c }}
        />
      ))}

      <div className="relative">
        <button
          onClick={() => setOpen((v) => !v)}
          title="Custom color"
          className="h-6 w-6 grid place-items-center rounded-full border border-dashed border-edge text-gray-400 hover:text-white hover:border-gray-500 cursor-pointer text-sm leading-none"
        >
          +
        </button>
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <div className="absolute left-0 top-8 z-50 w-44 rounded-md border border-edge bg-panel2 p-2 shadow-panel">
              <div className="flex items-center gap-1.5">
                <input
                  type="color"
                  value={hex}
                  onChange={(e) => setColor(e.target.value)}
                  title="Pick a custom color"
                  className="h-7 w-7 rounded cursor-pointer bg-transparent border border-edge p-0"
                />
                <button onClick={() => addPaletteColor(color)} className="btn h-7 px-2 text-xs flex-1" title="Save current color to the strip">
                  Save to strip
                </button>
              </div>
              <p className="mt-1.5 text-[10px] text-gray-500">Right-click a swatch to remove it.</p>
            </div>
          </>
        )}
      </div>
    </div>
  )
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
