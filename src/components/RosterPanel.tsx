import { useBoardStore } from '../store/useBoardStore'
import { MAP_BY_ID } from '../data/maps'
import { ROLES } from '../data/roles'
import { nanoid } from 'nanoid'
import type { RosterSquad, Team } from '../types'

const MAX_MEMBERS = 9

export default function RosterPanel() {
  const { mapId, layerId, squads, addSquad, updateSquad, removeSquad, team } = useBoardStore()
  const map = mapId ? MAP_BY_ID[mapId] : null
  const layer = map?.layers.find((l) => l.id === layerId) ?? null

  return (
    <div className="w-64 shrink-0 bg-panel border-r border-edge flex flex-col">
      {/* layer info */}
      <div className="px-3 py-3 border-b border-edge">
        <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">Aktif Layer</div>
        {layer ? (
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
          <div className="text-xs text-gray-600">Harita seçilmedi</div>
        )}
      </div>

      {/* roster */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-edge">
        <span className="text-xs uppercase tracking-wide text-gray-500">Kadro / Line-up</span>
        <button
          onClick={addSquad}
          className="text-xs px-2 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white"
        >
          + Squad
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {squads.length === 0 && (
          <p className="text-[11px] text-gray-600 px-1 py-2">
            Henüz squad yok. “+ Squad” ile başla. Her squad max 9 kişi.
          </p>
        )}
        {squads.map((sq) => (
          <SquadCard key={sq.id} squad={sq} onUpdate={(p) => updateSquad(sq.id, p)} onRemove={() => removeSquad(sq.id)} />
        ))}
      </div>

      <div className="px-3 py-2 text-[10px] text-gray-600 border-t border-edge">
        Yeni squadlar <span style={{ color: team === 'opfor' ? '#ef4444' : '#3b82f6' }}>{team.toUpperCase()}</span> takımına eklenir.
      </div>
    </div>
  )
}

function SquadCard({
  squad,
  onUpdate,
  onRemove,
}: {
  squad: RosterSquad
  onUpdate: (patch: Partial<RosterSquad>) => void
  onRemove: () => void
}) {
  const accent = squad.team === 'opfor' ? '#ef4444' : squad.team === 'neutral' ? '#eab308' : '#3b82f6'

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
          <option value="neutral">NÖT</option>
        </select>
        <button onClick={onRemove} className="text-gray-500 hover:text-red-400 px-1" title="Squad sil">
          ×
        </button>
      </div>

      <div className="px-2 pb-2 space-y-1">
        {squad.members.map((m) => (
          <div key={m.id} className="flex items-center gap-1">
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
              placeholder="oyuncu"
              onChange={(e) => updateMember(m.id, { name: e.target.value })}
              className="bg-panel text-xs rounded border border-edge px-1.5 py-0.5 flex-1 min-w-0 outline-none focus:border-blue-500"
            />
            <button onClick={() => removeMember(m.id)} className="text-gray-600 hover:text-red-400 text-xs px-1">
              ×
            </button>
          </div>
        ))}
        <div className="flex items-center justify-between pt-0.5">
          <button
            onClick={addMember}
            disabled={squad.members.length >= MAX_MEMBERS}
            className="text-[11px] text-blue-400 hover:text-blue-300 disabled:text-gray-600"
          >
            + Oyuncu
          </button>
          <span className="text-[10px] text-gray-500">{squad.members.length}/{MAX_MEMBERS}</span>
        </div>
      </div>
    </div>
  )
}
