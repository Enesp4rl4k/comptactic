import { nanoid } from 'nanoid'

const MAX = 8

export interface RecentRoom {
  id: string
  /** Last visit (ms). Newest first when listed. */
  at: number
  host?: boolean
  viewOnly?: boolean
  /** Optional plan title or note shown beside the code. */
  label?: string
}

function deviceScope(): string {
  let id = localStorage.getItem('ct:device-id')
  if (!id) {
    id = nanoid(8)
    localStorage.setItem('ct:device-id', id)
  }
  return `d:${id}`
}

/** Per signed-in user or this browser profile (guest). */
export function recentRoomsScope(authUserId?: string | null): string {
  if (authUserId) return `u:${authUserId}`
  return deviceScope()
}

function storageKey(scope: string) {
  return `comptactic:recent-rooms:${scope}`
}

export function loadRecentRooms(authUserId?: string | null): RecentRoom[] {
  const scope = recentRoomsScope(authUserId)
  try {
    const raw = localStorage.getItem(storageKey(scope))
    const arr = raw ? (JSON.parse(raw) as RecentRoom[]) : []
    if (!Array.isArray(arr)) return []
    return arr
      .filter((r) => r?.id && typeof r.at === 'number')
      .sort((a, b) => b.at - a.at)
      .slice(0, MAX)
  } catch {
    return []
  }
}

export function rememberRecentRoom(
  roomId: string,
  opts?: { authUserId?: string | null; host?: boolean; viewOnly?: boolean; label?: string },
) {
  const id = roomId.trim()
  if (!id) return
  const scope = recentRoomsScope(opts?.authUserId)
  const label = opts?.label?.trim()
  const entry: RecentRoom = {
    id,
    at: Date.now(),
    host: opts?.host,
    viewOnly: opts?.viewOnly,
    label: label || undefined,
  }
  const next = [
    entry,
    ...loadRecentRooms(opts?.authUserId).filter((r) => r.id !== id),
  ].slice(0, MAX)
  localStorage.setItem(storageKey(scope), JSON.stringify(next))
}

export function removeRecentRoom(roomId: string, authUserId?: string | null) {
  const scope = recentRoomsScope(authUserId)
  const next = loadRecentRooms(authUserId).filter((r) => r.id !== roomId)
  localStorage.setItem(storageKey(scope), JSON.stringify(next))
}

export function formatRecentRoomWhen(at: number): string {
  const sec = Math.max(0, Math.floor((Date.now() - at) / 1000))
  if (sec < 60) return 'just now'
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 48) return `${hr}h ago`
  const day = Math.floor(hr / 24)
  if (day < 14) return `${day}d ago`
  return new Date(at).toLocaleDateString()
}
