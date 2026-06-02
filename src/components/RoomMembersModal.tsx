import { usePresence } from '../lib/presence'
import type { RoomRole } from '../lib/roomPolicy'

interface Props {
  open: boolean
  roomId: string
  roomTitle: string
  onRoomTitleChange: (title: string) => void
  onRoomTitleCommit: () => void
  onClose: () => void
  onCopyRoomCode: () => void
  onCopyEditLink: () => void
  onCopyViewLink: () => void
}

function RoleBadge({ role, host }: { role: RoomRole; host?: boolean }) {
  if (host) {
    return <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-semibold uppercase">Host</span>
  }
  return (
    <span
      className={`text-[9px] px-1.5 py-0.5 rounded font-semibold uppercase ${
        role === 'editor' ? 'bg-highlight/20 text-amber-200' : 'bg-zinc-600/30 text-zinc-400'
      }`}
    >
      {role === 'editor' ? 'Editor' : 'View'}
    </span>
  )
}

export default function RoomMembersModal({
  open,
  roomId,
  roomTitle,
  onRoomTitleChange,
  onRoomTitleCommit,
  onClose,
  onCopyRoomCode,
  onCopyEditLink,
  onCopyViewLink,
}: Props) {
  const peers = usePresence((s) => s.peers)
  const name = usePresence((s) => s.name)
  const color = usePresence((s) => s.color)
  const host = usePresence((s) => s.host)
  const myRole = usePresence((s) => s.myRole)
  const roomPolicy = usePresence((s) => s.roomPolicy)
  const setName = usePresence((s) => s.setName)
  const setMemberRole = usePresence((s) => s.setMemberRole)
  const setDefaultRole = usePresence((s) => s.setDefaultRole)
  const kick = usePresence((s) => s.kick)

  if (!open) return null

  const others = Object.values(peers)
  const defaultRole = roomPolicy?.defaultRole ?? 'viewer'

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel max-w-[520px]" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Room members</h2>
          <button type="button" onClick={onClose} className="btn btn-icon btn-ghost ml-auto text-lg leading-none" aria-label="Close">
            ×
          </button>
        </div>

        <div className="p-4 space-y-4 overflow-y-auto max-h-[70vh]">
          {host && (
            <div className="rounded-lg border border-edge bg-panel2/50 p-3 space-y-2">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Room</div>
              <label className="block text-xs text-zinc-500">
                Display name (recent rooms &amp; saves)
                <input
                  value={roomTitle}
                  onChange={(e) => onRoomTitleChange(e.target.value)}
                  onBlur={onRoomTitleCommit}
                  className="input mt-1 w-full text-sm"
                  placeholder="Friday AAS brief"
                />
              </label>
              <p className="text-xs text-zinc-400">
                Access is stored on the server — editors keep working when you are offline. Set default role for new joiners below.
              </p>
              <label className="flex items-center justify-between gap-3 text-sm text-zinc-300">
                <span>Default for new members</span>
                <select
                  value={defaultRole}
                  onChange={(e) => setDefaultRole(e.target.value as RoomRole)}
                  className="h-8 rounded-lg bg-panel border border-edge px-2 text-xs outline-none focus:border-highlight/60"
                >
                  <option value="viewer">View only</option>
                  <option value="editor">Can edit</option>
                </select>
              </label>
            </div>
          )}

          {!host && (
            <div className="rounded-lg border border-edge bg-panel2/50 px-3 py-2 text-xs text-zinc-400 flex items-center gap-2">
              Your access: <RoleBadge role={myRole} />
              {myRole === 'viewer' && <span>Ask the host for edit access, or use an editor invite.</span>}
            </div>
          )}

          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 mb-2">
              In session · {others.length + 1}
            </div>
            <div className="rounded-lg border border-edge overflow-hidden divide-y divide-edge/60">
              <MemberRow
                peerName={name || 'You'}
                peerColor={color}
                isYou
                isHost={host}
                role={host ? 'editor' : myRole}
                host={host}
                onRename={() => {
                  const n = window.prompt('Your display name:', name)
                  if (n != null) setName(n.trim())
                }}
              />
              {others.map((p) => (
                <MemberRow
                  key={p.id}
                  peerName={p.name}
                  peerColor={p.color}
                  role={p.role ?? defaultRole}
                  host={host}
                  onSetRole={(role) => setMemberRole(p.id, role)}
                  onKick={() => {
                    if (confirm(`Remove ${p.name} from the room?`)) kick(p.id)
                  }}
                />
              ))}
              {others.length === 0 && (
                <div className="px-3 py-4 text-xs text-zinc-600 text-center">No one else here yet. Share an invite link below.</div>
              )}
            </div>
          </div>

          <div className="rounded-lg border border-edge bg-panel2/50 p-3 space-y-2">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Invite</div>
            <div className="flex items-center gap-2 rounded border border-edge bg-panel px-2 py-1.5">
              <span className="text-[10px] uppercase text-zinc-500 shrink-0">Code</span>
              <span className="font-mono text-sm text-zinc-200 truncate flex-1">{roomId}</span>
              <button type="button" className="btn h-7 px-2 text-xs shrink-0" onClick={onCopyRoomCode}>
                Copy
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn btn-success text-xs" onClick={onCopyViewLink}>
                View-only link
              </button>
              {host && (
                <button type="button" className="btn text-xs" onClick={onCopyEditLink}>
                  Plan + room link
                </button>
              )}
            </div>
            <p className="text-[11px] text-zinc-600">
              Links include the room code. View-only is read-only; plan link syncs the tactic and live room.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

function MemberRow({
  peerName,
  peerColor,
  isYou,
  isHost,
  role,
  host,
  onRename,
  onSetRole,
  onKick,
}: {
  peerName: string
  peerColor: string
  isYou?: boolean
  isHost?: boolean
  role: RoomRole
  host: boolean
  onRename?: () => void
  onSetRole?: (role: RoomRole) => void
  onKick?: () => void
}) {
  const initial = (peerName.trim().charAt(0) || '?').toUpperCase()

  return (
    <div className="flex items-center gap-2 px-3 py-2.5">
      <span
        className="h-8 w-8 shrink-0 rounded-full grid place-items-center text-[11px] font-bold text-black"
        style={{ background: peerColor }}
      >
        {initial}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-zinc-100 truncate">
          {peerName}
          {isYou && <span className="text-zinc-500"> (you)</span>}
        </p>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <RoleBadge role={role} host={isHost} />
        {host && !isYou && !isHost && onSetRole && (
          <select
            value={role}
            onChange={(e) => onSetRole(e.target.value as RoomRole)}
            className="h-7 rounded-md bg-panel border border-edge px-1.5 text-[10px] text-zinc-300 outline-none"
            title="Change access"
          >
            <option value="viewer">View</option>
            <option value="editor">Edit</option>
          </select>
        )}
        {isYou && onRename && (
          <button type="button" onClick={onRename} className="text-[11px] text-zinc-500 hover:text-zinc-200">
            Rename
          </button>
        )}
        {host && !isYou && !isHost && onKick && (
          <button type="button" onClick={onKick} className="text-[11px] text-zinc-500 hover:text-red-400 px-1">
            Remove
          </button>
        )}
      </div>
    </div>
  )
}
