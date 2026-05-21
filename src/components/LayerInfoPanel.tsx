import { useState } from 'react'
import { useBoardStore } from '../store/useBoardStore'
import { MAP_BY_ID } from '../data/maps'
import { ASSET_BY_ID, iconUrl } from '../data/assets'
import { useLayerInfo, assetIdForIcon, timingLabel, type LayerTeam } from '../lib/useLayerInfo'

// Real per-layer faction setup + vehicle inventory (with spawn/respawn timings).
// Collapsible so it doesn't dominate the line-up / tactic sheet.
export default function LayerInfoPanel({ readOnly = false }: { readOnly?: boolean }) {
  const mapId = useBoardStore((s) => s.mapId)
  const layerId = useBoardStore((s) => s.layerId)
  const info = useLayerInfo(layerId)
  const [open, setOpen] = useState(false)

  const map = mapId ? MAP_BY_ID[mapId] : null
  const layer = map?.layers.find((l) => l.id === layerId) ?? null

  if (!layer) return null

  return (
    <div className="border-b border-edge bg-panel shrink-0">
      <button
        onClick={() => setOpen((v) => !v)}
        className="panel-header w-full text-left cursor-pointer hover:text-gray-300"
      >
        <span className="text-gray-400">{open ? '▾' : '▸'}</span>
        <span>Layer Setup</span>
        <span className="normal-case tracking-normal text-gray-500 font-normal">· {layer.name}</span>
        <span className="normal-case tracking-normal text-gray-600 font-normal">· {(map!.sizeMeters / 1000).toFixed(1)} km</span>
      </button>

      {open &&
        (!info ? (
          <div className="px-3 py-3 text-[11px] text-gray-600">No detailed data for this layer.</div>
        ) : (
          <div className="grid grid-cols-2 gap-2 p-2">
            <TeamColumn team={info.t1} side="blufor" readOnly={readOnly} />
            <TeamColumn team={info.t2} side="opfor" readOnly={readOnly} />
          </div>
        ))}
    </div>
  )
}

function TeamColumn({
  team,
  side,
  readOnly,
}: {
  team: LayerTeam | undefined
  side: 'blufor' | 'opfor'
  readOnly: boolean
}) {
  const addVehiclePreset = useBoardStore((s) => s.addVehiclePreset)
  const accent = side === 'blufor' ? 'text-blufor' : 'text-opfor'

  if (!team) return <div className="text-[11px] text-gray-600 px-1">—</div>

  return (
    <div className="rounded border border-edge bg-panel2 p-2 min-w-0">
      <div className="flex items-center gap-2 mb-1.5">
        <span className={`text-sm font-bold ${accent}`}>{team.f}</span>
        <span className="text-[10px] text-gray-500">🎫 {team.t}</span>
        {team.c && <span className="text-[10px] text-gray-500" title="Commander available">⭐ CMD</span>}
        <span className="ml-auto text-[10px] text-gray-600">{team.v.length} types</span>
      </div>

      <div className="flex flex-col gap-1 max-h-56 overflow-y-auto pr-1">
        {team.v.length === 0 && <span className="text-[10px] text-gray-600">No vehicles</span>}
        {team.v.map((v, i) => {
          const asset = ASSET_BY_ID[assetIdForIcon(v.i)]
          const url = iconUrl(asset, side)
          const timing = timingLabel(v.d, v.r)
          return (
            <div key={i} className="flex items-center gap-1.5 rounded bg-panel px-1.5 py-1 border border-edge/60">
              {url ? (
                <img src={url} alt="" className="h-4 w-4 object-contain shrink-0" />
              ) : (
                <span className="text-xs">🚗</span>
              )}
              <span className="text-[11px] text-gray-200 truncate flex-1 min-w-0">
                {v.q > 1 && <span className="text-gray-400">{v.q}× </span>}
                {v.n}
              </span>
              <span className="text-[10px] text-amber-300/90 shrink-0">{timing}</span>
              {!readOnly && (
                <button
                  onClick={() => addVehiclePreset(assetIdForIcon(v.i), v.q > 1 ? `${v.q}× ${v.n}` : v.n, '')}
                  title="Add to assignments"
                  className="shrink-0 h-5 w-5 grid place-items-center rounded bg-accent hover:brightness-125 text-white text-xs leading-none cursor-pointer"
                >
                  +
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
