import { useState } from 'react'
import { useBoardStore } from '../store/useBoardStore'

// Paste signed-up players (one per line or comma-separated), then distribute
// them into squads one-by-one or auto-balance across all squads.
export default function PlayerPool() {
  const pool = useBoardStore((s) => s.playerPool)
  const squads = useBoardStore((s) => s.squads)
  const addToPool = useBoardStore((s) => s.addToPool)
  const removeFromPool = useBoardStore((s) => s.removeFromPool)
  const clearPool = useBoardStore((s) => s.clearPool)
  const memberToPool = useBoardStore((s) => s.memberToPool)

  const [text, setText] = useState('')
  const [open, setOpen] = useState(true)
  const [dropActive, setDropActive] = useState(false)

  const parse = (raw: string) =>
    raw
      .split(/[\n,;]+/)
      .map((n) => n.trim())
      // strip common list prefixes like "1.", "- ", "• "
      .map((n) => n.replace(/^[\d]+[.)]\s*/, '').replace(/^[-•*]\s*/, '').trim())
      .filter(Boolean)

  const onAdd = () => {
    const names = parse(text)
    if (names.length) {
      addToPool(names)
      setText('')
    }
  }

  return (
    <div className="border-b border-edge bg-panel shrink-0">
      <button onClick={() => setOpen((v) => !v)} className="panel-header w-full text-left cursor-pointer hover:text-gray-300">
        <span className="text-gray-400">{open ? '▾' : '▸'}</span>
        <span>Player Pool</span>
        <span className="normal-case tracking-normal text-gray-500 font-normal">· {pool.length} unassigned</span>
      </button>

      {open && (
        <div
          className={`p-2 space-y-2 ${dropActive ? 'ring-2 ring-accent/50 ring-inset' : ''}`}
          onDragOver={(e) => {
            if (e.dataTransfer.types.includes('memberMove')) {
              e.preventDefault()
              if (!dropActive) setDropActive(true)
            }
          }}
          onDragLeave={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node)) setDropActive(false)
          }}
          onDrop={(e) => {
            const move = e.dataTransfer.getData('memberMove')
            if (!move) return
            e.preventDefault()
            setDropActive(false)
            try {
              const { squadId, memberId } = JSON.parse(move)
              memberToPool(squadId, memberId)
            } catch {
              /* ignore */
            }
          }}
        >
          <div className="flex gap-2">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Paste players from sign-ups (one per line)…"
              rows={3}
              className="input flex-1 resize-y min-h-[58px] font-mono text-[12px]"
            />
            <div className="flex flex-col gap-1.5 shrink-0">
              <button onClick={onAdd} className="btn btn-primary h-8 px-3 text-xs">Add</button>
              <button onClick={clearPool} disabled={!pool.length} className="btn h-8 px-3 text-xs">Clear</button>
            </div>
          </div>

          {pool.length > 0 && (
            <div className="flex flex-wrap gap-2.5 pt-1">
              {pool.map((name, i) => (
                <div
                  key={`${name}-${i}`}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData('playerName', name)
                    e.dataTransfer.effectAllowed = 'move'
                  }}
                  title={`${name} — drag onto a squad`}
                  className="group relative flex w-16 flex-col items-center gap-1 cursor-grab active:cursor-grabbing"
                >
                  <div
                    className="h-11 w-11 rounded-full grid place-items-center text-sm font-bold text-white shadow ring-1 ring-black/40"
                    style={{ background: colorFor(name) }}
                  >
                    {initials(name)}
                  </div>
                  <span className="w-full truncate text-center text-[10px] leading-tight text-gray-300">{name}</span>
                  <button
                    onClick={() => removeFromPool(name)}
                    title="Remove"
                    className="absolute -top-1.5 -right-0.5 hidden h-4 w-4 place-items-center rounded-full bg-panel2 border border-edge text-gray-400 hover:text-red-400 text-[10px] group-hover:grid cursor-pointer"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          {squads.length === 0 && pool.length > 0 && (
            <div className="text-[11px] text-gray-600">Add squads first, then drag players into them.</div>
          )}
        </div>
      )}
    </div>
  )
}

const TOKEN_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#3b82f6', '#8b5cf6', '#ec4899', '#06b6d4', '#a3e635',
]

/** Up to 2 uppercase initials from a nickname. */
function initials(name: string): string {
  const parts = name.split(/[\s_.-]+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return name.replace(/[^a-zA-Z0-9]/g, '').slice(0, 2).toUpperCase() || '?'
}

/** Deterministic token color from the nickname. */
function colorFor(name: string): string {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
  return TOKEN_COLORS[h % TOKEN_COLORS.length]
}
