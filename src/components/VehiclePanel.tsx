import { useState } from 'react'
import { ASSETS, ASSET_BY_ID, iconUrl } from '../data/assets'
import { useBoardStore } from '../store/useBoardStore'
import type { VehicleAssignment } from '../types'

const VEHICLE_ASSETS = ASSETS.filter((a) => a.category === 'vehicle')

// Vehicle assignments: which squads / players crew or ride each asset, shown
// with symbols (vehicle glyph + colored squad chips + crew note).
export default function VehiclePanel({ readOnly = false }: { readOnly?: boolean }) {
  const vehicles = useBoardStore((s) => s.vehicles)
  const squads = useBoardStore((s) => s.squads)
  const addVehicle = useBoardStore((s) => s.addVehicle)
  const [adding, setAdding] = useState(false)

  const squadIndex = (id: string) => squads.findIndex((s) => s.id === id)

  return (
    <div className="border-t border-edge bg-panel">
      <div className="panel-header">
        <span>Vehicle Assignments</span>
        <span className="text-gray-600 font-normal">· {vehicles.length}</span>
        {!readOnly && (
          <div className="ml-auto relative">
            <button
              onClick={() => setAdding((v) => !v)}
              className="btn btn-primary h-7 px-2 text-xs"
            >
              + Add Vehicle
            </button>
            {adding && (
              <div className="absolute right-0 bottom-9 z-20 w-44 max-h-64 overflow-y-auto rounded border border-edge bg-panel2 shadow-lg">
                {VEHICLE_ASSETS.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => {
                      addVehicle(a.id)
                      setAdding(false)
                    }}
                    className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-sm hover:bg-edge"
                  >
                    {iconUrl(a, 'blufor') ? (
                      <img src={iconUrl(a, 'blufor')!} alt="" className="h-5 w-5 object-contain" />
                    ) : (
                      <span>{a.glyph}</span>
                    )}
                    <span className="text-gray-200">{a.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex gap-2 overflow-x-auto p-2 min-h-[92px]">
        {vehicles.length === 0 && (
          <div className="text-[11px] text-gray-600 px-1 py-3">
            No vehicles yet.{!readOnly && ' Use “+ Add Vehicle”.'}
          </div>
        )}
        {vehicles.map((v) => (
          <VehicleCard key={v.id} v={v} readOnly={readOnly} squadIndex={squadIndex} />
        ))}
      </div>
    </div>
  )
}

function VehicleCard({
  v,
  readOnly,
  squadIndex,
}: {
  v: VehicleAssignment
  readOnly: boolean
  squadIndex: (id: string) => number
}) {
  const squads = useBoardStore((s) => s.squads)
  const updateVehicle = useBoardStore((s) => s.updateVehicle)
  const removeVehicle = useBoardStore((s) => s.removeVehicle)
  const toggleVehicleSquad = useBoardStore((s) => s.toggleVehicleSquad)
  const asset = ASSET_BY_ID[v.assetId]

  return (
    <div className="shrink-0 w-56 rounded border border-edge bg-panel2 p-2">
      <div className="flex items-center gap-2">
        {iconUrl(asset, 'blufor') ? (
          <img src={iconUrl(asset, 'blufor')!} alt="" className="h-6 w-6 object-contain" />
        ) : (
          <span className="text-xl">{asset?.glyph ?? '🚗'}</span>
        )}
        {readOnly ? (
          <span className="text-sm font-medium flex-1 truncate">{v.name || asset?.name}</span>
        ) : (
          <input
            value={v.name ?? ''}
            placeholder={asset?.name}
            onChange={(e) => updateVehicle(v.id, { name: e.target.value })}
            className="bg-transparent text-sm font-medium flex-1 min-w-0 outline-none"
          />
        )}
        {!readOnly && (
          <button onClick={() => removeVehicle(v.id)} className="text-gray-500 hover:text-red-400 px-1" title="Remove">
            ×
          </button>
        )}
      </div>

      {/* squad chips */}
      <div className="flex flex-wrap gap-1 mt-2">
        {squads.length === 0 && <span className="text-[10px] text-gray-600">No squads</span>}
        {squads.map((sq) => {
          const on = v.squadIds.includes(sq.id)
          const n = squadIndex(sq.id) + 1
          if (readOnly && !on) return null
          return (
            <button
              key={sq.id}
              disabled={readOnly}
              onClick={() => toggleVehicleSquad(v.id, sq.id)}
              title={sq.name}
              className={`px-1.5 h-5 rounded text-[10px] font-bold border ${
                on ? 'text-black border-white' : 'text-gray-400 border-edge'
              }`}
              style={{ background: on ? sq.color : sq.color + '33' }}
            >
              S{n}
            </button>
          )
        })}
      </div>

      {/* crew note */}
      {readOnly ? (
        v.note ? <div className="text-[11px] text-gray-400 mt-1.5">👤 {v.note}</div> : null
      ) : (
        <input
          value={v.note ?? ''}
          placeholder="crew / players…"
          onChange={(e) => updateVehicle(v.id, { note: e.target.value })}
          className="mt-1.5 w-full bg-panel text-[11px] rounded border border-edge px-1.5 py-1 outline-none focus:border-accent"
        />
      )}

      {/* spawn / respawn timing */}
      {readOnly ? (
        v.timing ? <div className="text-[11px] text-amber-300/90 mt-1">⏱ {v.timing}</div> : null
      ) : (
        <input
          value={v.timing ?? ''}
          placeholder="timing e.g. 0:00 · resp 6:00"
          onChange={(e) => updateVehicle(v.id, { timing: e.target.value })}
          className="mt-1 w-full bg-panel text-[11px] text-amber-200 rounded border border-edge px-1.5 py-1 outline-none focus:border-amber-500"
        />
      )}
    </div>
  )
}
