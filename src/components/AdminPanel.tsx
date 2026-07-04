import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  accessLogEnabled,
  fetchRecentAccessEvents,
  summarizeAllRooms,
  type RoomSummary,
  type VisitorSummary,
} from '../lib/roomAccessLog'

interface Props {
  open: boolean
  currentRoomId: string | null
  onClose: () => void
}

function timeAgo(iso: string): string {
  if (!iso) return '—'
  const ms = Date.now() - new Date(iso).getTime()
  const s = Math.floor(ms / 1000)
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 30) return `${d}d ago`
  return new Date(iso).toLocaleDateString()
}

function fmt(iso: string): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString()
}

export default function AdminPanel({ open, currentRoomId, onClose }: Props) {
  const [rooms, setRooms] = useState<RoomSummary[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [scope, setScope] = useState<'all' | 'current'>(currentRoomId ? 'current' : 'all')
  const [query, setQuery] = useState('')
  const [flaggedOnly, setFlaggedOnly] = useState(false)
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() =>
    currentRoomId ? { [currentRoomId]: true } : {},
  )

  const load = useCallback(async () => {
    if (!accessLogEnabled()) {
      setError('Cloud (Supabase) is not configured, so access logging is off.')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const events = await fetchRecentAccessEvents()
      setRooms(summarizeAllRooms(events))
    } catch {
      setError('Could not load the access log — check your connection.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // Fetch the access log when the panel opens (external data sync).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (open) void load()
  }, [open, load])

  const visibleRooms = useMemo(() => {
    let list = rooms
    if (scope === 'current' && currentRoomId) list = list.filter((r) => r.roomId === currentRoomId)
    const q = query.trim().toLowerCase()
    if (q) {
      list = list
        .map((r) => ({
          ...r,
          visitors: r.visitors.filter(
            (v) =>
              v.name.toLowerCase().includes(q) ||
              (v.authEmail ?? '').toLowerCase().includes(q) ||
              r.roomId.toLowerCase().includes(q),
          ),
        }))
        .filter((r) => r.roomId.toLowerCase().includes(q) || r.visitors.length > 0)
    }
    if (flaggedOnly) list = list.filter((r) => r.flags.length > 0 || r.visitors.some((v) => v.flags.length))
    return list
  }, [rooms, scope, currentRoomId, query, flaggedOnly])

  const totals = useMemo(() => {
    const all = scope === 'current' && currentRoomId ? rooms.filter((r) => r.roomId === currentRoomId) : rooms
    const visitorIds = new Set<string>()
    let visits = 0
    let guests = 0
    let signedIn = 0
    for (const r of all) {
      visits += r.totalVisits
      for (const v of r.visitors) {
        visitorIds.add(v.memberId)
        if (v.signedIn) signedIn++
        else if (!v.isHost) guests++
      }
    }
    return { rooms: all.length, visitors: visitorIds.size, visits, guests, signedIn }
  }, [rooms, scope, currentRoomId])

  if (!open) return null

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel max-w-[920px]" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Admin · Room access</h2>
          <span className="text-[11px] text-zinc-500 hidden sm:inline">Who opened your rooms &amp; whether a tactic leaked</span>
          <div className="ml-auto flex items-center gap-2">
            <button type="button" onClick={() => void load()} className="btn h-8 px-2.5 text-xs" title="Refresh">
              {loading ? 'Loading…' : 'Refresh'}
            </button>
            <button type="button" onClick={onClose} className="btn btn-icon btn-ghost text-lg leading-none" aria-label="Close">
              ×
            </button>
          </div>
        </div>

        <div className="p-4 space-y-4 overflow-y-auto">
          {/* Controls */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="tab-group">
              <button
                type="button"
                className={`tab-btn ${scope === 'current' ? 'tab-btn-active' : ''}`}
                onClick={() => setScope('current')}
                disabled={!currentRoomId}
                title={currentRoomId ? 'Only the room you are in' : 'Join a room to use this'}
              >
                This room
              </button>
              <button
                type="button"
                className={`tab-btn ${scope === 'all' ? 'tab-btn-active' : ''}`}
                onClick={() => setScope('all')}
              >
                All rooms
              </button>
            </div>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name, email or room code…"
              className="input h-8 text-sm flex-1 min-w-[180px]"
            />
            <label className="flex items-center gap-1.5 text-xs text-zinc-400 select-none cursor-pointer">
              <input type="checkbox" checked={flaggedOnly} onChange={(e) => setFlaggedOnly(e.target.checked)} />
              Flagged only
            </label>
          </div>

          {/* Stat cards */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            <Stat label="Rooms" value={totals.rooms} />
            <Stat label="Unique visitors" value={totals.visitors} />
            <Stat label="Total joins" value={totals.visits} />
            <Stat label="Signed in" value={totals.signedIn} tone="ok" />
            <Stat label="Guests" value={totals.guests} tone={totals.guests > 0 ? 'warn' : undefined} />
          </div>

          {error && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">{error}</div>
          )}

          {!error && !loading && visibleRooms.length === 0 && (
            <div className="rounded-lg border border-edge bg-panel2/50 px-3 py-8 text-center text-sm text-zinc-500">
              No access recorded yet. As people open your room links, they will show up here.
            </div>
          )}

          {/* Rooms */}
          <div className="space-y-3">
            {visibleRooms.map((room) => {
              const isOpen = expanded[room.roomId] ?? false
              return (
                <div key={room.roomId} className="rounded-lg border border-edge bg-panel2/40 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setExpanded((e) => ({ ...e, [room.roomId]: !isOpen }))}
                    className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-white/5 transition-colors"
                  >
                    <span className={`text-zinc-500 transition-transform ${isOpen ? 'rotate-90' : ''}`}>›</span>
                    <span className="font-mono text-sm text-zinc-200">{room.roomId}</span>
                    {room.roomId === currentRoomId && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-highlight/20 text-amber-200 uppercase font-semibold">Current</span>
                    )}
                    <span className="text-xs text-zinc-500">
                      {room.uniqueVisitors} visitor{room.uniqueVisitors !== 1 ? 's' : ''} · {room.totalVisits} joins
                    </span>
                    <span className="ml-auto text-[11px] text-zinc-500">{timeAgo(room.lastSeen)}</span>
                  </button>

                  {room.flags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 px-3 pb-2">
                      {room.flags.map((f) => (
                        <span key={f} className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/15 text-red-300 border border-red-500/20">
                          ⚠ {f}
                        </span>
                      ))}
                    </div>
                  )}

                  {isOpen && (
                    <div className="border-t border-edge/60 divide-y divide-edge/40">
                      {room.visitors.map((v) => (
                        <VisitorRow key={v.key} v={v} />
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          <p className="text-[11px] text-zinc-600 leading-relaxed">
            Each row is one visitor (grouped by a persistent browser id). Open <span className="text-zinc-400">Details</span> for
            everything captured on join: approximate location &amp; ISP (from IP), device, screen, timezone, language and the exact
            link they opened. Guests or external link sources on a private tactic are signs it was reshared. Location is best-effort
            from a public IP lookup and may be blocked by VPNs/ad-blockers. You are responsible for disclosing this collection to
            users (e.g. GDPR/KVKK). Logging requires Supabase; the panel is gated by <span className="font-mono">VITE_ADMIN_CODE</span>.
          </p>
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: 'ok' | 'warn' }) {
  const color = tone === 'warn' ? 'text-red-300' : tone === 'ok' ? 'text-emerald-300' : 'text-zinc-100'
  return (
    <div className="rounded-lg border border-edge bg-panel2/50 px-3 py-2">
      <div className={`text-xl font-semibold ${color}`}>{value}</div>
      <div className="text-[10px] uppercase tracking-wide text-zinc-500">{label}</div>
    </div>
  )
}

function VisitorRow({ v }: { v: VisitorSummary }) {
  const [open, setOpen] = useState(false)
  const initial = (v.name.trim().charAt(0) || '?').toUpperCase()
  const roleLabel = v.isHost ? 'Host' : v.bestRole === 'editor' ? 'Editor' : 'Viewer'
  const roleClass = v.isHost
    ? 'bg-amber-500/20 text-amber-300'
    : v.bestRole === 'editor'
      ? 'bg-highlight/20 text-amber-200'
      : 'bg-zinc-600/30 text-zinc-400'
  const e = v.latest
  return (
    <div className="px-3 py-2.5">
      <div className="flex items-start gap-3">
        <span
          className={`h-8 w-8 shrink-0 rounded-full grid place-items-center text-[11px] font-bold ${
            v.signedIn ? 'text-black bg-emerald-400' : 'text-black bg-zinc-400'
          }`}
          title={v.signedIn ? 'Signed in' : 'Guest'}
        >
          {initial}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-zinc-100 truncate">{v.name}</span>
            <span className={`text-[9px] px-1.5 py-0.5 rounded uppercase font-semibold ${roleClass}`}>{roleLabel}</span>
            {v.viewOnly && <span className="text-[9px] px-1.5 py-0.5 rounded bg-zinc-600/30 text-zinc-400 uppercase">View link</span>}
            {!v.signedIn && !v.isHost && (
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-500/15 text-red-300 uppercase">Guest</span>
            )}
          </div>
          <div className="text-[11px] text-zinc-500 truncate">
            {v.authEmail ? v.authEmail : 'No account'} · {v.device}
            {v.location && <> · {v.location}</>}
            {v.visits > 1 && <> · {v.visits} joins</>}
          </div>
          {v.external && e.referrer && (
            <div className="text-[10px] text-red-300/80 truncate" title={e.referrer}>
              ↳ opened from {safeHost(e.referrer)}
            </div>
          )}
        </div>
        <div className="text-right shrink-0">
          <div className="text-[11px] text-zinc-400" title={fmt(v.lastSeen)}>
            {timeAgo(v.lastSeen)}
          </div>
          <div className="text-[10px] text-zinc-600" title={`First seen ${fmt(v.firstSeen)}`}>
            first {timeAgo(v.firstSeen)}
          </div>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="text-[10px] text-highlight/80 hover:text-highlight mt-0.5"
          >
            {open ? 'Hide details' : 'Details'}
          </button>
        </div>
      </div>

      {open && (
        <dl className="mt-2 ml-11 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 rounded-lg border border-edge bg-panel/60 p-3 text-[11px]">
          <Detail label="IP address" value={e.ip} mono />
          <Detail label="Location" value={v.location} />
          <Detail label="Network / ISP" value={e.org} />
          <Detail label="Timezone" value={e.timezone} />
          <Detail label="Languages" value={e.languages} />
          <Detail label="Platform" value={e.platform} />
          <Detail label="Screen" value={e.screen} />
          <Detail label="Viewport" value={e.viewport} />
          <Detail label="Pixel ratio" value={e.devicePixelRatio != null ? String(e.devicePixelRatio) : null} />
          <Detail label="CPU cores" value={e.cpuCores != null ? String(e.cpuCores) : null} />
          <Detail label="Device memory" value={e.deviceMemory != null ? `${e.deviceMemory} GB` : null} />
          <Detail label="Touch" value={e.touch == null ? null : e.touch ? 'Yes' : 'No'} />
          <Detail label="Connection" value={e.connection} />
          <Detail label="Visitor id" value={v.visitorId} mono />
          <Detail label="Session id" value={v.memberId} mono />
          <Detail label="First seen" value={fmt(v.firstSeen)} />
          <Detail label="Last seen" value={fmt(v.lastSeen)} />
          <Detail label="Referrer" value={e.referrer} full />
          <Detail label="Landing URL" value={e.landingUrl} full />
          <Detail label="User agent" value={e.userAgent} full mono />
        </dl>
      )}
    </div>
  )
}

function Detail({ label, value, mono, full }: { label: string; value: string | null; mono?: boolean; full?: boolean }) {
  return (
    <div className={full ? 'sm:col-span-2 min-w-0' : 'min-w-0'}>
      <dt className="text-zinc-600 uppercase tracking-wide text-[9px]">{label}</dt>
      <dd className={`text-zinc-300 break-words ${mono ? 'font-mono' : ''}`}>{value || '—'}</dd>
    </div>
  )
}

function safeHost(url: string): string {
  try {
    return new URL(url).host || url
  } catch {
    return url
  }
}
