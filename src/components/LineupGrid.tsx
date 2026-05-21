import { useState } from 'react'
import { useBoardStore } from '../store/useBoardStore'
import { MAP_BY_ID } from '../data/maps'
import { ROLES } from '../data/roles'
import VehiclePanel from './VehiclePanel'
import type { RosterSquad, Team } from '../types'

const MAX_SLOTS = 9 // Squad holds at most 9 players in-game

/** Up to 2 uppercase initials from a player name (for the squad avatar). */
function memberInitials(name: string): string {
  const parts = name.split(/[\s_.-]+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return name.replace(/[^a-zA-Z0-9]/g, '').slice(0, 2).toUpperCase() || '?'
}

// Excel-style line-up: squads = columns, players = rows.
// Rows grow dynamically: a new empty row opens as players are added (max 9).
export default function LineupGrid() {
  const { mapId, layerId, squads, addSquad, updateSquad, setSquadColor, removeSquad, setMemberSlot, removeMemberSlot, assignPlayerToSquad, moveMember, reorderSquads } =
    useBoardStore()
  const map = mapId ? MAP_BY_ID[mapId] : null
  const layer = map?.layers.find((l) => l.id === layerId) ?? null

  const totalPlayers = squads.reduce((n, s) => n + s.members.filter((m) => m.name.trim()).length, 0)

  // Visible rows = largest squad's player count + 1 empty row (capped at 9)
  const maxRows = Math.min(
    MAX_SLOTS,
    Math.max(1, ...squads.map((s) => Math.min(MAX_SLOTS, s.members.length + 1))),
  )

  return (
    <div className="h-full flex flex-col bg-bg">
      <div className="flex items-center gap-3 px-4 py-2 border-b border-edge bg-panel">
        <h2 className="font-semibold">Line-up</h2>
        {layer && (
          <span className="text-xs text-gray-400">
            {map!.name} · {layer.name}
          </span>
        )}
        <span className="text-xs text-gray-500">
          · {squads.length} squads · {totalPlayers} players
        </span>
        <button
          onClick={addSquad}
          className="ml-auto btn btn-primary"
        >
          + Add Squad
        </button>
      </div>

      <div className="flex-1 overflow-auto p-4">
        {squads.length === 0 ? (
          <div className="grid place-items-center h-full text-center text-gray-500">
            <div>
              <div className="text-4xl mb-2">📋</div>
              <p>No squads yet.</p>
              <button
                onClick={addSquad}
                className="mt-3 btn btn-primary"
              >
                + Add First Squad
              </button>
            </div>
          </div>
        ) : (
          <div className="inline-flex gap-2 items-start">
            {/* row number labels */}
            <div className="shrink-0 pt-[42px]">
              {Array.from({ length: maxRows }).map((_, i) => (
                <div key={i} className="h-9 w-8 grid place-items-center text-xs text-gray-500 border-b border-edge/40">
                  {i + 1}
                </div>
              ))}
            </div>

            {squads.map((sq) => (
              <SquadColumn
                key={sq.id}
                squad={sq}
                rows={maxRows}
                onUpdate={(p) => updateSquad(sq.id, p)}
                onColor={(c) => setSquadColor(sq.id, c)}
                onRemove={() => removeSquad(sq.id)}
                onSlot={(i, p) => setMemberSlot(sq.id, i, p)}
                onRemoveSlot={(i) => removeMemberSlot(sq.id, i)}
                onAssign={(name) => assignPlayerToSquad(name, sq.id)}
                onMoveHere={(fromSquadId, memberId) => moveMember(fromSquadId, memberId, sq.id)}
                onReorder={(fromSquadId) => reorderSquads(fromSquadId, sq.id)}
              />
            ))}

            <button
              onClick={addSquad}
              className="shrink-0 mt-[42px] h-9 px-3 rounded border border-dashed border-edge text-gray-400 hover:border-gray-500 hover:text-gray-200 text-sm"
            >
              + Squad
            </button>
          </div>
        )}
      </div>

      <VehiclePanel />
    </div>
  )
}

function SquadColumn({
  squad,
  rows,
  onUpdate,
  onColor,
  onRemove,
  onSlot,
  onRemoveSlot,
  onAssign,
  onMoveHere,
  onReorder,
}: {
  squad: RosterSquad
  rows: number
  onUpdate: (patch: Partial<RosterSquad>) => void
  onColor: (color: string) => void
  onRemove: () => void
  onSlot: (index: number, patch: Partial<{ name: string; role: string }>) => void
  onRemoveSlot: (index: number) => void
  onAssign: (name: string) => void
  onMoveHere: (fromSquadId: string, memberId: string) => void
  onReorder: (fromSquadId: string) => void
}) {
  const accent = squad.color
  const count = squad.members.length
  const [dragOver, setDragOver] = useState(false)
  const full = count >= MAX_SLOTS
  // Rows for this squad: filled members + (if room) 1 extra row to add another
  const visible = Math.min(MAX_SLOTS, count + (count < MAX_SLOTS ? 1 : 0))

  const focusNext = (index: number) => {
    setTimeout(() => {
      const next = document.querySelector<HTMLInputElement>(`[data-name="${squad.id}-${index + 1}"]`)
      next?.focus()
    }, 0)
  }

  return (
    <div
      className={`shrink-0 w-56 rounded border bg-panel overflow-hidden transition-colors ${
        dragOver ? 'border-accent ring-2 ring-accent/40' : 'border-edge'
      }`}
      onDragOver={(e) => {
        // Browsers lowercase DataTransfer.types, so compare against lowercase keys.
        const t = Array.from(e.dataTransfer.types).map((x) => x.toLowerCase())
        const isSquad = t.includes('squadmove')
        // accept squad reorder always; accept player/member only if not full
        if (!isSquad && full) return
        if (isSquad || t.includes('playername') || t.includes('membermove')) {
          e.preventDefault()
          if (!dragOver) setDragOver(true)
        }
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(false)
      }}
      onDrop={(e) => {
        e.preventDefault()
        setDragOver(false)
        // reorder squads
        const sqMove = e.dataTransfer.getData('squadMove')
        if (sqMove) {
          if (sqMove !== squad.id) onReorder(sqMove)
          return
        }
        const name = e.dataTransfer.getData('playerName')
        if (name) {
          onAssign(name)
          return
        }
        const move = e.dataTransfer.getData('memberMove')
        if (move) {
          try {
            const { squadId, memberId } = JSON.parse(move)
            if (squadId !== squad.id) onMoveHere(squadId, memberId)
          } catch {
            /* ignore */
          }
        }
      }}
    >
      {/* header */}
      <div className="flex items-center gap-1 px-2 h-[42px]" style={{ background: accent + '22', borderBottom: `2px solid ${accent}` }}>
        <span
          draggable
          onDragStart={(e) => {
            e.dataTransfer.setData('squadMove', squad.id)
            e.dataTransfer.effectAllowed = 'copyMove'
          }}
          title="Drag: reorder squads, or drop onto a vehicle"
          className="shrink-0 grid place-items-center h-5 w-4 -ml-0.5 rounded text-gray-400 hover:text-white hover:bg-edge text-sm cursor-grab active:cursor-grabbing select-none"
        >
          ⠿
        </span>
        <input
          type="color"
          value={accent}
          onChange={(e) => onColor(e.target.value)}
          title="Squad color"
          className="h-4 w-4 shrink-0 rounded cursor-pointer bg-transparent border-0 p-0"
        />
        <input
          value={squad.name}
          onChange={(e) => onUpdate({ name: e.target.value })}
          className="bg-transparent text-sm font-semibold flex-1 min-w-0 outline-none"
        />
        <span className="text-[10px] text-gray-400">{count}/{MAX_SLOTS}</span>
        <select
          value={squad.team}
          onChange={(e) => onUpdate({ team: e.target.value as Team })}
          className="bg-panel2 text-[10px] rounded border border-edge px-1 py-0.5"
        >
          <option value="blufor">BLU</option>
          <option value="opfor">OPF</option>
          <option value="neutral">NEU</option>
        </select>
        <button onClick={onRemove} className="text-gray-500 hover:text-red-400 px-1" title="Remove squad">
          ×
        </button>
      </div>

      {/* rows */}
      {Array.from({ length: rows }).map((_, i) => {
        if (i >= visible) {
          // empty spacer cell (keeps rows aligned across squads)
          return <div key={i} className="h-9 border-b border-edge/20" />
        }
        const m = squad.members[i]
        const isAddRow = i === count && count < MAX_SLOTS
        const isLeader = i === 0
        return (
          <div key={i} className={`flex items-center gap-1 h-9 px-1.5 border-b border-edge/40 ${isAddRow ? 'opacity-70' : ''}`}>
            {!isAddRow && m ? (
              <div
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('memberMove', JSON.stringify({ squadId: squad.id, memberId: m.id, name: m.name }))
                  e.dataTransfer.effectAllowed = 'move'
                }}
                title="Drag to another squad or back to the pool"
                className="h-5 w-5 shrink-0 rounded-full grid place-items-center text-[9px] font-bold text-white cursor-grab active:cursor-grabbing"
                style={{ background: squad.color }}
              >
                {memberInitials(m.name)}
              </div>
            ) : (
              <span className="h-5 w-5 shrink-0" />
            )}
            <select
              value={m?.role ?? (isLeader ? 'sl' : 'rifleman')}
              onChange={(e) => onSlot(i, { role: e.target.value })}
              className="bg-panel2 text-[10px] rounded border border-edge px-1 py-0.5 w-[52px]"
              style={isLeader ? { color: '#fde68a', fontWeight: 600 } : undefined}
            >
              {ROLES.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.short}
                </option>
              ))}
            </select>
            <input
              data-name={`${squad.id}-${i}`}
              value={m?.name ?? ''}
              placeholder={isAddRow ? '+ add player' : isLeader ? 'Squad Leader' : `player ${i + 1}`}
              onChange={(e) => onSlot(i, { name: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  focusNext(i)
                }
              }}
              className="bg-panel2 text-xs rounded border border-edge px-1.5 py-1 flex-1 min-w-0 outline-none focus:border-accent"
            />
            {!isAddRow && (
              <button
                onClick={() => onRemoveSlot(i)}
                className="text-gray-600 hover:text-red-400 text-xs px-1"
                title="Remove player"
              >
                ×
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}
