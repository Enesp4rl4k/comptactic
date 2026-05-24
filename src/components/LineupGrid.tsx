import { memo, useState } from 'react'
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

// Line-up: squads and vehicles stacked vertically (no horizontal scroll).
export default function LineupGrid() {
  const mapId = useBoardStore((s) => s.mapId)
  const layerId = useBoardStore((s) => s.layerId)
  const squads = useBoardStore((s) => s.squads)
  const addSquad = useBoardStore((s) => s.addSquad)
  const rosterUndo = useBoardStore((s) => s.rosterUndo)
  const rosterRedo = useBoardStore((s) => s.rosterRedo)
  const canUndo = useBoardStore((s) => s.rosterPast.length > 0)
  const canRedo = useBoardStore((s) => s.rosterFuture.length > 0)
  const map = mapId ? MAP_BY_ID[mapId] : null
  const layer = map?.layers.find((l) => l.id === layerId) ?? null

  const totalPlayers = squads.reduce((n, s) => n + s.members.filter((m) => m.name.trim()).length, 0)

  return (
    <div className="h-full flex flex-col bg-bg">
      <div className="lineup-header">
        <h2 className="font-display font-semibold text-sm tracking-wide">Line-up</h2>
        {layer && (
          <span className="text-xs text-gray-400">
            {map!.name} · {layer.name}
          </span>
        )}
        <span className="text-xs text-gray-500">
          · {squads.length} squads · {totalPlayers} players
        </span>
        <div className="ml-auto flex items-center gap-1.5">
          <button onClick={rosterUndo} disabled={!canUndo} title="Undo roster change" className="btn disabled:opacity-30 disabled:cursor-not-allowed">↶</button>
          <button onClick={rosterRedo} disabled={!canRedo} title="Redo roster change" className="btn disabled:opacity-30 disabled:cursor-not-allowed">↷</button>
          <button onClick={addSquad} className="btn btn-primary">+ Add Squad</button>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="p-4">
          {squads.length === 0 ? (
            <div className="grid place-items-center min-h-[12rem] text-center text-gray-500">
              <div>
                <div className="text-4xl mb-2">📋</div>
                <p>No squads yet.</p>
                <button onClick={addSquad} className="mt-3 btn btn-primary">
                  + Add First Squad
                </button>
              </div>
            </div>
          ) : (
            <div className="lineup-stack mx-auto w-full max-w-2xl flex flex-col gap-3">
              {squads.map((sq) => (
                <SquadColumn key={sq.id} squad={sq} />
              ))}
            </div>
          )}
        </div>

        <VehiclePanel />
      </div>
    </div>
  )
}

// Memoized: re-renders only when this squad's object reference changes.
const SquadColumn = memo(function SquadColumn({ squad }: { squad: RosterSquad }) {
  const updateSquad = useBoardStore((s) => s.updateSquad)
  const setSquadColor = useBoardStore((s) => s.setSquadColor)
  const removeSquad = useBoardStore((s) => s.removeSquad)
  const setMemberSlot = useBoardStore((s) => s.setMemberSlot)
  const removeMemberSlot = useBoardStore((s) => s.removeMemberSlot)
  const assignPlayerToSquad = useBoardStore((s) => s.assignPlayerToSquad)
  const moveMember = useBoardStore((s) => s.moveMember)
  const reorderSquads = useBoardStore((s) => s.reorderSquads)
  const reorderMember = useBoardStore((s) => s.reorderMember)

  const id = squad.id
  const accent = squad.color
  const count = squad.members.length
  const [dragOver, setDragOver] = useState(false)
  const full = count >= MAX_SLOTS
  const visible = Math.min(MAX_SLOTS, count + (count < MAX_SLOTS ? 1 : 0))
  const rows = Math.max(1, visible)

  const focusNext = (index: number) => {
    setTimeout(() => {
      const next = document.querySelector<HTMLInputElement>(`[data-name="${id}-${index + 1}"]`)
      next?.focus()
    }, 0)
  }

  return (
    <div
      className={`w-full rounded border bg-panel overflow-hidden transition-colors ${
        dragOver ? 'border-accent ring-2 ring-accent/40' : 'border-edge'
      }`}
      onDragOver={(e) => {
        // Browsers lowercase DataTransfer.types, so compare against lowercase keys.
        const t = Array.from(e.dataTransfer.types).map((x) => x.toLowerCase())
        const isSquad = t.includes('squadmove')
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
        const sqMove = e.dataTransfer.getData('squadMove')
        if (sqMove) {
          if (sqMove !== id) reorderSquads(sqMove, id)
          return
        }
        const name = e.dataTransfer.getData('playerName')
        if (name) {
          assignPlayerToSquad(name, id)
          return
        }
        const move = e.dataTransfer.getData('memberMove')
        if (move) {
          try {
            const { squadId, memberId } = JSON.parse(move)
            if (squadId !== id) moveMember(squadId, memberId, id)
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
            useBoardStore.getState().setEditingLock('roster')
            e.dataTransfer.setData('squadMove', id)
            e.dataTransfer.effectAllowed = 'copyMove'
          }}
          onDragEnd={() => useBoardStore.getState().setEditingLock(null)}
          title="Drag: reorder squads, or drop onto a vehicle"
          className="shrink-0 grid place-items-center h-5 w-4 -ml-0.5 rounded text-gray-400 hover:text-white hover:bg-edge text-sm cursor-grab active:cursor-grabbing select-none"
        >
          ⠿
        </span>
        <input
          type="color"
          value={accent}
          onChange={(e) => setSquadColor(id, e.target.value)}
          title="Squad color"
          className="h-4 w-4 shrink-0 rounded cursor-pointer bg-transparent border-0 p-0"
        />
        <input
          value={squad.name}
          onChange={(e) => updateSquad(id, { name: e.target.value })}
          className="bg-transparent text-sm font-semibold flex-1 min-w-0 outline-none"
        />
        <span className="text-[10px] text-gray-400">{count}/{MAX_SLOTS}</span>
        <select
          value={squad.team}
          onChange={(e) => updateSquad(id, { team: e.target.value as Team })}
          className="bg-panel2 text-[10px] rounded border border-edge px-1 py-0.5"
        >
          <option value="blufor">BLU</option>
          <option value="opfor">OPF</option>
          <option value="neutral">NEU</option>
        </select>
        <button onClick={() => removeSquad(id)} className="text-gray-500 hover:text-red-400 px-1" title="Remove squad">
          ×
        </button>
      </div>

      {/* player rows */}
      {Array.from({ length: rows }).map((_, i) => {
        const m = squad.members[i]
        const isAddRow = i === count && count < MAX_SLOTS
        const isLeader = i === 0
        return (
          <div
            key={i}
            className={`flex items-center gap-1 h-9 px-1.5 border-b border-edge/40 ${isAddRow ? 'opacity-70' : ''}`}
            onDragOver={
              m
                ? (e) => {
                    if (Array.from(e.dataTransfer.types).map((x) => x.toLowerCase()).includes('membermove')) e.preventDefault()
                  }
                : undefined
            }
            onDrop={
              m
                ? (e) => {
                    const move = e.dataTransfer.getData('memberMove')
                    if (!move) return
                    try {
                      const { squadId, memberId } = JSON.parse(move)
                      if (squadId === id) {
                        e.stopPropagation()
                        e.preventDefault()
                        if (memberId !== m.id) reorderMember(id, memberId, m.id)
                      }
                    } catch {
                      /* ignore */
                    }
                  }
                : undefined
            }
          >
            {!isAddRow && m ? (
              <div
                draggable
                onDragStart={(e) => {
                  useBoardStore.getState().setEditingLock('roster')
                  e.dataTransfer.setData('memberMove', JSON.stringify({ squadId: id, memberId: m.id, name: m.name }))
                  e.dataTransfer.effectAllowed = 'move'
                }}
                onDragEnd={() => useBoardStore.getState().setEditingLock(null)}
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
              onChange={(e) => setMemberSlot(id, i, { role: e.target.value })}
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
              data-name={`${id}-${i}`}
              value={m?.name ?? ''}
              placeholder={isAddRow ? '+ add player' : isLeader ? 'Squad Leader' : `player ${i + 1}`}
              onChange={(e) => setMemberSlot(id, i, { name: e.target.value })}
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
                onClick={() => removeMemberSlot(id, i)}
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
})
