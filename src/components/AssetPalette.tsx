import { useState } from 'react'
import { ASSETS, CATEGORY_LABELS, iconUrl, type AssetCategory } from '../data/assets'
import { useBoardStore } from '../store/useBoardStore'

const ORDER: AssetCategory[] = ['infantry', 'deployable', 'vehicle']

export default function AssetPalette() {
  const team = useBoardStore((s) => s.team)
  const color = useBoardStore((s) => s.color)
  const squads = useBoardStore((s) => s.squads)
  const activeSquadId = useBoardStore((s) => s.activeSquadId)
  const setActiveSquad = useBoardStore((s) => s.setActiveSquad)
  const [query, setQuery] = useState('')

  const q = query.trim().toLowerCase()
  const activeSquad = squads.find((s) => s.id === activeSquadId) ?? null

  return (
    <div className="w-56 shrink-0 bg-panel border-l border-edge overflow-y-auto flex flex-col">
      <div className="px-3 py-2 text-xs uppercase tracking-wide text-gray-500 border-b border-edge">
        Comp Components
      </div>

      {/* squad-specific placement selector */}
      <div className="px-2 py-2 border-b border-edge">
        <div className="text-[11px] font-semibold text-gray-400 px-1 mb-1">Place with squad color</div>
        <div className="flex flex-wrap gap-1">
          <button
            onClick={() => setActiveSquad(null)}
            className={`px-2 h-6 rounded text-[10px] border ${
              !activeSquadId ? 'border-white text-white' : 'border-edge text-gray-400'
            }`}
            style={{ background: !activeSquadId ? color : '#232833' }}
          >
            Team
          </button>
          {squads.map((sq, i) => (
            <button
              key={sq.id}
              onClick={() => setActiveSquad(sq.id)}
              title={sq.name}
              className={`px-2 h-6 rounded text-[10px] font-semibold border ${
                activeSquadId === sq.id ? 'border-white text-black' : 'border-edge text-gray-200'
              }`}
              style={{ background: activeSquadId === sq.id ? sq.color : sq.color + '55' }}
            >
              S{i + 1}
            </button>
          ))}
          {squads.length === 0 && <span className="text-[10px] text-gray-600 px-1">Add a squad from Line-up</span>}
        </div>
      </div>

      <div className="px-2 pt-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search components…"
          className="w-full bg-panel2 text-xs rounded border border-edge px-2 py-1.5 outline-none focus:border-blue-500"
        />
      </div>

      <div className="p-2 text-[11px] text-gray-500">Drag &amp; drop onto the map.</div>

      <div className="flex-1">
        {ORDER.map((cat) => {
          const items = ASSETS.filter((a) => a.category === cat && (!q || a.name.toLowerCase().includes(q)))
          if (!items.length) return null
          return (
          <div key={cat} className="px-2 pb-3">
            <div className="text-[11px] font-semibold text-gray-400 px-1 mb-1">{CATEGORY_LABELS[cat]}</div>
            <div className="grid grid-cols-3 gap-1.5">
              {items.map((a) => {
                const url = iconUrl(a, team)
                const badge = activeSquad ? activeSquad.color : a.teamColored ? color : a.fixedColor ?? '#888'
                return (
                  <div
                    key={a.id}
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData('assetId', a.id)}
                    title={a.name}
                    className="flex flex-col items-center gap-1 p-1.5 rounded bg-panel2 border border-edge hover:border-blue-500 cursor-grab active:cursor-grabbing"
                  >
                    {url ? (
                      <img src={url} alt={a.name} draggable={false} className="h-9 w-9 object-contain pointer-events-none" />
                    ) : (
                      <div
                        className="h-8 w-8 grid place-items-center text-lg border border-black/50"
                        style={{
                          background: badge,
                          borderRadius: a.shape === 'square' ? 6 : a.shape === 'diamond' ? 4 : 999,
                          transform: a.shape === 'diamond' ? 'rotate(45deg)' : undefined,
                        }}
                      >
                        <span style={{ transform: a.shape === 'diamond' ? 'rotate(-45deg)' : undefined }}>{a.glyph}</span>
                      </div>
                    )}
                    <span className="text-[9px] text-gray-400 text-center leading-tight">{a.name}</span>
                  </div>
                )
              })}
            </div>
          </div>
          )
        })}
        {q && ORDER.every((cat) => !ASSETS.some((a) => a.category === cat && a.name.toLowerCase().includes(q))) && (
          <div className="px-3 py-4 text-[11px] text-gray-600">No components match “{query}”.</div>
        )}
      </div>

      <div className="px-3 py-2 text-[10px] text-gray-600 border-t border-edge">
        Placing as: {activeSquad ? (
          <span style={{ color: activeSquad.color }}>{activeSquad.name}</span>
        ) : (
          <span style={{ color }}>{team.toUpperCase()} team</span>
        )}
      </div>
    </div>
  )
}
