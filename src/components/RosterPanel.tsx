import { useBoardStore } from '../store/useBoardStore'
import { MAP_BY_ID } from '../data/maps'
import { ROLES } from '../data/roles'
import { nanoid } from 'nanoid'
import type { RosterSquad, Team } from '../types'

const MAX_MEMBERS = 9

export default function RosterPanel({ readOnly = false }: { readOnly?: boolean }) {
  const { mapId, layerId, customImage, customImageName, squads, addSquad, updateSquad, removeSquad, team } = useBoardStore()
  const map = mapId ? MAP_BY_ID[mapId] : null
  const layer = map?.layers.find((l) => l.id === layerId) ?? null

  return (
    <div className="workspace-panel-left">
      <div className="px-3 py-3 border-b border-edge">
        <div className="panel-header !border-0 !px-0 !py-0 mb-1.5">Active Layer</div>
        <div className="layer-info-card">
        {customImage ? (
          <div className="font-medium text-sm truncate">🖼 {customImageName || 'Custom image'}</div>
        ) : layer ? (
          <>
            <div className="font-medium text-sm">{layer.name}</div>
            <div className="text-xs text-gray-400 mt-1">
              <span className="text-blufor">{layer.factions[0]}</span> vs{' '}
              <span className="text-opfor">{layer.factions[1]}</span>
            </div>
            <div className="text-[11px] text-gray-500 mt-0.5">
              {layer.mode} · {layer.time} · {(map!.sizeMeters / 1000).toFixed(1)} km
            </div>
          </>
        ) : (
          <div className="text-xs text-gray-600">No map selected</div>
        )}
        </div>
      </div>

      {/* roster */}
      <div className="panel-header justify-between">
        <span>Roster / Line-up</span>
        {!readOnly && (
          <button onClick={addSquad} className="btn btn-primary h-6 px-2 text-xs normal-case tracking-normal">
            + Squad
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {squads.length === 0 && (
          <p className="text-[11px] text-gray-600 px-1 py-2">
            No squads yet. Start with “+ Squad”. Each squad holds up to 9 players.
          </p>
        )}
        {squads.map((sq) => (
          <SquadCard
            key={sq.id}
            squad={sq}
            readOnly={readOnly}
            onUpdate={(p) => updateSquad(sq.id, p)}
            onRemove={() => removeSquad(sq.id)}
          />
        ))}
      </div>

      <div className="px-3 py-2 text-[10px] text-gray-600 border-t border-edge">
        New squads are added to the <span style={{ color: team === 'opfor' ? '#ef4444' : '#3b82f6' }}>{team.toUpperCase()}</span> team.
      </div>
    </div>
  )
}

function SquadCard({
  squad,
  readOnly,
  onUpdate,
  onRemove,
}: {
  squad: RosterSquad
  readOnly?: boolean
  onUpdate: (patch: Partial<RosterSquad>) => void
  onRemove: () => void
}) {
  const setSquadColor = useBoardStore((s) => s.setSquadColor)
  const accent = squad.color

  const addMember = () => {
    if (squad.members.length >= MAX_MEMBERS) return
    const role = squad.members.length === 0 ? 'sl' : 'rifleman'
    onUpdate({ members: [...squad.members, { id: nanoid(5), name: '', role }] })
  }
  const updateMember = (id: string, patch: Partial<{ name: string; role: string }>) =>
    onUpdate({ members: squad.members.map((m) => (m.id === id ? { ...m, ...patch } : m)) })
  const removeMember = (id: string) => onUpdate({ members: squad.members.filter((m) => m.id !== id) })

  return (
    <div className="rounded border border-edge bg-panel2" style={{ borderLeft: `3px solid ${accent}` }}>
      <div className="flex items-center gap-1 px-2 py-1.5">
        {readOnly ? (
          <>
            <span className="h-5 w-5 shrink-0 rounded border border-edge" style={{ background: squad.color }} />
            <span className="text-sm font-medium flex-1 min-w-0 truncate">{squad.name}</span>
            <span className="text-[10px] text-gray-500 uppercase">{squad.team}</span>
          </>
        ) : (
          <>
            <input
              type="color"
              value={squad.color}
              onChange={(e) => setSquadColor(squad.id, e.target.value)}
              title="Squad color"
              className="h-5 w-5 shrink-0 rounded cursor-pointer bg-transparent border border-edge p-0"
            />
            <input
              value={squad.name}
              onChange={(e) => onUpdate({ name: e.target.value })}
              className="bg-transparent text-sm font-medium flex-1 min-w-0 outline-none"
            />
            <select
              value={squad.team}
              onChange={(e) => onUpdate({ team: e.target.value as Team })}
              className="bg-panel text-[10px] rounded border border-edge px-1 py-0.5"
            >
              <option value="blufor">BLU</option>
              <option value="opfor">OPF</option>
              <option value="neutral">NEU</option>
            </select>
            <button onClick={onRemove} className="text-gray-500 hover:text-red-400 px-1" title="Remove squad">
              ×
            </button>
          </>
        )}
      </div>

      <div className="px-2 pb-2 space-y-1">
        {squad.members.map((m) => (
          <div key={m.id} className="flex items-center gap-1">
            {readOnly ? (
              <>
                <span className="text-[10px] font-bold text-gray-500 w-9">{ROLES.find((r) => r.id === m.role)?.short ?? m.role}</span>
                <span className="text-xs text-gray-200 truncate flex-1">{m.name || '—'}</span>
              </>
            ) : (
              <>
                <select
                  value={m.role}
                  onChange={(e) => updateMember(m.id, { role: e.target.value })}
                  className="bg-panel text-[10px] rounded border border-edge px-1 py-0.5 w-14"
                >
                  {ROLES.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.short}
                    </option>
                  ))}
                </select>
                <input
                  value={m.name}
                  placeholder="player"
                  onChange={(e) => updateMember(m.id, { name: e.target.value })}
                  className="bg-panel text-xs rounded border border-edge px-1.5 py-0.5 flex-1 min-w-0 outline-none focus:border-accent"
                />
                <button onClick={() => removeMember(m.id)} className="text-gray-600 hover:text-red-400 text-xs px-1">
                  ×
                </button>
              </>
            )}
          </div>
        ))}
        {!readOnly && (
          <div className="flex items-center justify-between pt-0.5">
            <button
              onClick={addMember}
              disabled={squad.members.length >= MAX_MEMBERS}
              className="text-[11px] text-gray-300 hover:text-white disabled:text-gray-600"
            >
              + Player
            </button>
            <span className="text-[10px] text-gray-500">
              {squad.members.length}/{MAX_MEMBERS}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
