import TacticalBoard from './TacticalBoard'
import SlidesBar from './SlidesBar'
import VehiclePanel from './VehiclePanel'
import LayerInfoPanel from './LayerInfoPanel'
import { useBoardStore } from '../store/useBoardStore'
import { MAP_BY_ID } from '../data/maps'
import { ROLE_BY_ID } from '../data/roles'

// Discord-style shareable tactic widget:
//   top   -> layer name banner
//   center-> tactic map (read-only)
//   right -> line-up (squads + players)
//   bottom-> vehicle assignments (who rides what)
export default function TacticSheet() {
  const mapId = useBoardStore((s) => s.mapId)
  const layerId = useBoardStore((s) => s.layerId)
  const squads = useBoardStore((s) => s.squads)
  const map = mapId ? MAP_BY_ID[mapId] : null
  const layer = map?.layers.find((l) => l.id === layerId) ?? null

  return (
    <div className="h-full flex flex-col bg-bg">
      {/* layer banner */}
      <div className="flex items-center gap-3 px-4 py-2 bg-panel border-b border-edge">
        <span className="text-lg">🧩</span>
        <div className="min-w-0">
          <div className="font-semibold truncate">
            {layer ? layer.name : 'No layer selected'}
          </div>
          {layer && map && (
            <div className="text-xs text-gray-400">
              {map.name} · {layer.mode} · <span className="text-blufor">{layer.factions[0]}</span> vs{' '}
              <span className="text-opfor">{layer.factions[1]}</span> · {layer.time} ·{' '}
              {(map.sizeMeters / 1000).toFixed(1)} km
            </div>
          )}
        </div>
      </div>

      {/* map + line-up */}
      <div className="flex flex-1 min-h-0">
        <div className="flex-1 min-w-0 flex flex-col">
          <div className="flex-1 min-h-0 relative">
            <TacticalBoard readOnly />
          </div>
          <SlidesBar readOnly />
        </div>

        <aside className="w-72 shrink-0 border-l border-edge bg-panel overflow-y-auto">
          <div className="px-3 py-2 text-xs uppercase tracking-wide text-gray-500 border-b border-edge">
            Line-up · {squads.length} squads
          </div>
          {squads.length === 0 && <div className="p-3 text-[11px] text-gray-600">No squads added yet.</div>}
          <div className="p-2 space-y-2">
            {squads.map((sq, i) => (
              <div key={sq.id} className="rounded border border-edge bg-panel2" style={{ borderLeft: `3px solid ${sq.color}` }}>
                <div className="flex items-center gap-2 px-2 py-1.5 border-b border-edge/50">
                  <span className="h-3 w-3 rounded-full" style={{ background: sq.color }} />
                  <span className="text-sm font-semibold flex-1 truncate">{sq.name}</span>
                  <span className="text-[10px] text-gray-500">S{i + 1}</span>
                </div>
                <div className="px-2 py-1.5 space-y-0.5">
                  {sq.members.filter((m) => m.name.trim() || m.role).length === 0 && (
                    <div className="text-[11px] text-gray-600">empty</div>
                  )}
                  {sq.members.map((m, idx) => (
                    <div key={m.id} className="flex items-center gap-2 text-xs">
                      <span
                        className="inline-block w-9 text-[10px] font-bold shrink-0"
                        style={{ color: idx === 0 ? '#fde68a' : '#9ca3af' }}
                      >
                        {ROLE_BY_ID[m.role]?.short ?? m.role}
                      </span>
                      <span className="truncate text-gray-200">{m.name || <span className="text-gray-600">—</span>}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </aside>
      </div>

      {/* layer setup + vehicle assignments */}
      <LayerInfoPanel readOnly />
      <VehiclePanel readOnly />
    </div>
  )
}
