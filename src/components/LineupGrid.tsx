import { useBoardStore } from '../store/useBoardStore'
import { MAP_BY_ID } from '../data/maps'
import { ROLES } from '../data/roles'
import type { RosterSquad, Team } from '../types'

const SLOTS = 9

const TEAM_ACCENT: Record<Team, string> = {
  blufor: '#3b82f6',
  opfor: '#ef4444',
  neutral: '#eab308',
}

// Excel-style line-up: squads are columns, the 9 kit slots are rows.
// "Önce squad ekle, sonra oyuncuları doldur" akışı.
export default function LineupGrid() {
  const { mapId, layerId, squads, addSquad, updateSquad, removeSquad, setMemberSlot } = useBoardStore()
  const map = mapId ? MAP_BY_ID[mapId] : null
  const layer = map?.layers.find((l) => l.id === layerId) ?? null

  const totalPlayers = squads.reduce((n, s) => n + s.members.filter((m) => m.name.trim()).length, 0)

  return (
    <div className="h-full flex flex-col bg-[#0c0f14]">
      <div className="flex items-center gap-3 px-4 py-2 border-b border-edge bg-panel">
        <h2 className="font-semibold">Line-up</h2>
        {layer && (
          <span className="text-xs text-gray-400">
            {map!.name} · {layer.name}
          </span>
        )}
        <span className="text-xs text-gray-500">· {squads.length} squad · {totalPlayers} oyuncu</span>
        <button
          onClick={addSquad}
          className="ml-auto px-3 h-8 rounded bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium"
        >
          + Squad Ekle
        </button>
      </div>

      <div className="flex-1 overflow-auto p-4">
        {squads.length === 0 ? (
          <div className="grid place-items-center h-full text-center text-gray-500">
            <div>
              <div className="text-4xl mb-2">📋</div>
              <p>Henüz squad yok.</p>
              <button
                onClick={addSquad}
                className="mt-3 px-4 py-2 rounded bg-blue-600 hover:bg-blue-500 text-white text-sm"
              >
                + İlk Squad'ı Ekle
              </button>
            </div>
          </div>
        ) : (
          <div className="inline-flex gap-2 items-start">
            {/* row labels */}
            <div className="shrink-0 pt-[42px]">
              {Array.from({ length: SLOTS }).map((_, i) => (
                <div
                  key={i}
                  className="h-9 w-8 grid place-items-center text-xs text-gray-500 border-b border-edge/40"
                >
                  {i + 1}
                </div>
              ))}
            </div>

            {squads.map((sq) => (
              <SquadColumn
                key={sq.id}
                squad={sq}
                onUpdate={(p) => updateSquad(sq.id, p)}
                onRemove={() => removeSquad(sq.id)}
                onSlot={(i, p) => setMemberSlot(sq.id, i, p)}
              />
            ))}

            <button
              onClick={addSquad}
              className="shrink-0 mt-[42px] h-9 px-3 rounded border border-dashed border-edge text-gray-400 hover:border-blue-500 hover:text-blue-400 text-sm"
            >
              + Squad
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function SquadColumn({
  squad,
  onUpdate,
  onRemove,
  onSlot,
}: {
  squad: RosterSquad
  onUpdate: (patch: Partial<RosterSquad>) => void
  onRemove: () => void
  onSlot: (index: number, patch: Partial<{ name: string; role: string }>) => void
}) {
  const accent = TEAM_ACCENT[squad.team]

  return (
    <div className="shrink-0 w-56 rounded border border-edge bg-panel overflow-hidden">
      {/* header */}
      <div className="flex items-center gap-1 px-2 h-[42px]" style={{ background: accent + '22', borderBottom: `2px solid ${accent}` }}>
        <input
          value={squad.name}
          onChange={(e) => onUpdate({ name: e.target.value })}
          className="bg-transparent text-sm font-semibold flex-1 min-w-0 outline-none"
        />
        <select
          value={squad.team}
          onChange={(e) => onUpdate({ team: e.target.value as Team })}
          className="bg-panel2 text-[10px] rounded border border-edge px-1 py-0.5"
        >
          <option value="blufor">BLU</option>
          <option value="opfor">OPF</option>
          <option value="neutral">NÖT</option>
        </select>
        <button onClick={onRemove} className="text-gray-500 hover:text-red-400 px-1" title="Squad sil">
          ×
        </button>
      </div>

      {/* slots */}
      {Array.from({ length: SLOTS }).map((_, i) => {
        const m = squad.members[i]
        const isLeader = i === 0
        return (
          <div key={i} className="flex items-center gap-1 h-9 px-1.5 border-b border-edge/40">
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
              value={m?.name ?? ''}
              placeholder={isLeader ? 'Squad Leader' : `oyuncu ${i + 1}`}
              onChange={(e) => onSlot(i, { name: e.target.value })}
              className="bg-panel2 text-xs rounded border border-edge px-1.5 py-1 flex-1 min-w-0 outline-none focus:border-blue-500"
            />
          </div>
        )
      })}
    </div>
  )
}
