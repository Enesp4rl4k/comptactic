import { useState } from 'react'
import { ASSETS, ASSET_BY_ID, iconUrl, type AssetDef } from '../data/assets'
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

  // Timing is filled by the user to describe the vehicle's route in the plan,
  // not the layer's spawn/respawn — so just add the vehicle.
  const onAddVehicle = (a: AssetDef) => {
    addVehicle(a.id)
    setAdding(false)
  }

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
                    onClick={() => onAddVehicle(a)}
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

      <div className="flex flex-wrap gap-3 p-4 items-start content-start w-full min-h-[5.75rem]">
        {vehicles.length === 0 && (
          <div className="text-[11px] text-gray-600 px-1 py-2">
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
  const assignSquadToVehicle = useBoardStore((s) => s.assignSquadToVehicle)
  const addVehicleCrew = useBoardStore((s) => s.addVehicleCrew)
  const removeVehicleCrew = useBoardStore((s) => s.removeVehicleCrew)
  const reorderVehicles = useBoardStore((s) => s.reorderVehicles)
  const asset = ASSET_BY_ID[v.assetId]
  const [dragOver, setDragOver] = useState(false)

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const veh = e.dataTransfer.getData('vehicleMove')
    if (veh) {
      if (veh !== v.id) reorderVehicles(veh, v.id)
      return
    }
    const sq = e.dataTransfer.getData('squadMove')
    if (sq) {
      assignSquadToVehicle(v.id, sq)
      return
    }
    const member = e.dataTransfer.getData('memberMove')
    if (member) {
      try {
        const { name } = JSON.parse(member)
        if (name) addVehicleCrew(v.id, name)
      } catch {
        /* ignore */
      }
      return
    }
    const player = e.dataTransfer.getData('playerName')
    if (player) addVehicleCrew(v.id, player)
  }

  return (
    <div
      className={`shrink-0 w-56 rounded border bg-panel2 p-2 transition-colors ${
        dragOver ? 'border-accent ring-2 ring-accent/40' : 'border-edge'
      }`}
      onDragOver={
        readOnly
          ? undefined
          : (e) => {
              // Browsers lowercase DataTransfer.types, so compare against lowercase keys.
              const t = Array.from(e.dataTransfer.types).map((x) => x.toLowerCase())
              if (t.includes('vehiclemove') || t.includes('squadmove') || t.includes('membermove') || t.includes('playername')) {
                e.preventDefault()
                if (!dragOver) setDragOver(true)
              }
            }
      }
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(false)
      }}
      onDrop={readOnly ? undefined : onDrop}
    >
      <div className="flex items-center gap-2">
        {!readOnly && (
          <span
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData('vehicleMove', v.id)
              e.dataTransfer.effectAllowed = 'move'
            }}
            title="Drag to reorder vehicles"
            className="shrink-0 grid place-items-center h-5 w-4 rounded text-gray-500 hover:text-white hover:bg-edge text-sm cursor-grab active:cursor-grabbing select-none"
          >
            ⠿
          </span>
        )}
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

      {/* crew (dragged-in players) */}
      {(v.crew?.length ?? 0) > 0 && (
        <div className="flex flex-wrap gap-1 mt-1.5">
          {v.crew!.map((name) => (
            <span key={name} className="flex items-center gap-1 rounded bg-panel border border-edge px-1.5 h-5 text-[10px] text-gray-200">
              👤 {name}
              {!readOnly && (
                <button onClick={() => removeVehicleCrew(v.id, name)} className="text-gray-500 hover:text-red-400 cursor-pointer" title="Remove">
                  ×
                </button>
              )}
            </span>
          ))}
        </div>
      )}

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
          placeholder="route timing e.g. move 2:00 → arrive 4:00"
          onChange={(e) => updateVehicle(v.id, { timing: e.target.value })}
          className="mt-1 w-full bg-panel text-[11px] text-amber-200 rounded border border-edge px-1.5 py-1 outline-none focus:border-amber-500"
        />
      )}
    </div>
  )
}
