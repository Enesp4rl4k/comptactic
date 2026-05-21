import { useState } from 'react'
import { ASSETS, CATEGORY_LABELS, iconUrl, type AssetCategory, type AssetDef } from '../data/assets'
import { useBoardStore } from '../store/useBoardStore'
import { useTintedSvgUrl } from '../lib/useTintedIcon'
import type { Team } from '../types'

const ORDER: AssetCategory[] = ['infantry', 'deployable', 'vehicle']

export default function AssetPalette() {
  const team = useBoardStore((s) => s.team)
  const color = useBoardStore((s) => s.color)
  const squads = useBoardStore((s) => s.squads)
  const activeSquadId = useBoardStore((s) => s.activeSquadId)
  const setActiveSquad = useBoardStore((s) => s.setActiveSquad)
  const placingAssetId = useBoardStore((s) => s.placingAssetId)
  const setPlacingAsset = useBoardStore((s) => s.setPlacingAsset)
  const placeScale = useBoardStore((s) => s.placeScale)
  const setPlaceScale = useBoardStore((s) => s.setPlaceScale)
  const [query, setQuery] = useState('')

  const q = query.trim().toLowerCase()
  const activeSquad = squads.find((s) => s.id === activeSquadId) ?? null

  return (
    <div className="w-56 shrink-0 bg-panel border-l border-edge overflow-y-auto flex flex-col">
      <div className="panel-header">Components</div>

      {/* squad-specific placement selector */}
      <div className="px-2 py-2 border-b border-edge">
        <div className="text-[11px] font-semibold text-gray-400 px-1 mb-1">Place with squad color</div>
        <div className="flex flex-wrap gap-1">
          <button
            onClick={() => setActiveSquad(null)}
            className={`px-2 h-6 rounded text-[10px] border ${
              !activeSquadId ? 'border-white text-white' : 'border-edge text-gray-400'
            }`}
            style={{ background: !activeSquadId ? color : '#202022' }}
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

      {/* default size for newly placed icons */}
      <div className="px-2 py-2 border-b border-edge flex items-center gap-2">
        <span className="text-[11px] font-semibold text-gray-400">Default size</span>
        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={() => setPlaceScale(placeScale - 0.1)}
            className="h-6 w-6 grid place-items-center rounded border border-edge bg-panel2 text-gray-300 hover:bg-edge text-sm"
            title="Smaller"
          >
            −
          </button>
          <span className="w-10 text-center text-xs tabular-nums text-gray-200">{placeScale.toFixed(1)}×</span>
          <button
            onClick={() => setPlaceScale(placeScale + 0.1)}
            className="h-6 w-6 grid place-items-center rounded border border-edge bg-panel2 text-gray-300 hover:bg-edge text-sm"
            title="Larger"
          >
            +
          </button>
        </div>
      </div>

      <div className="px-2 pt-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search components…"
          className="input text-xs"
        />
      </div>

      <div className="p-2 text-[11px] text-gray-500">
        {placingAssetId
          ? 'Click the map to place — Esc to stop.'
          : 'Click to arm, then click the map. Or drag & drop.'}
      </div>

      <div className="flex-1">
        {ORDER.map((cat) => {
          const items = ASSETS.filter((a) => a.category === cat && (!q || a.name.toLowerCase().includes(q)))
          if (!items.length) return null
          return (
          <div key={cat} className="px-2 pb-3">
            <div className="text-[11px] font-semibold text-gray-400 px-1 mb-1">{CATEGORY_LABELS[cat]}</div>
            <div className="grid grid-cols-3 gap-1.5">
              {items.map((a) => (
                <PaletteAsset
                  key={a.id}
                  a={a}
                  team={team}
                  color={color}
                  squadColor={activeSquad?.color ?? null}
                  armed={placingAssetId === a.id}
                  onArm={() => setPlacingAsset(placingAssetId === a.id ? null : a.id)}
                />
              ))}
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

// A draggable palette entry. When a squad is active, its icon previews in that
// squad's color (matching how it will render on the board).
function PaletteAsset({
  a,
  team,
  color,
  squadColor,
  armed,
  onArm,
}: {
  a: AssetDef
  team: Team
  color: string
  squadColor: string | null
  armed: boolean
  onArm: () => void
}) {
  const tinted = useTintedSvgUrl(a.icon && squadColor ? `/icons/blue/${a.icon}.svg` : null, squadColor || '#ffffff')
  const variant = iconUrl(a, team)
  const src = squadColor ? tinted ?? variant : variant
  const badge = squadColor ?? (a.teamColored ? color : a.fixedColor ?? '#888')

  return (
    <div
      draggable
      onDragStart={(e) => e.dataTransfer.setData('assetId', a.id)}
      onClick={onArm}
      title={a.name}
      className={`flex flex-col items-center gap-1 p-1.5 rounded border cursor-pointer transition-colors ${
        armed ? 'bg-white/10 border-white ring-1 ring-white/40' : 'bg-panel2 border-edge hover:border-accent'
      }`}
    >
      {src ? (
        <img src={src} alt={a.name} draggable={false} className="h-9 w-9 object-contain pointer-events-none" />
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
}
