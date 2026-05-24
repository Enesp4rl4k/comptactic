import { nanoid } from 'nanoid'

/** True when the URL already targets a session (skip landing). */
export function shouldSkipHome(): boolean {
  const url = new URL(window.location.href)
  if (url.searchParams.get('embed') === '1') return true
  if (url.searchParams.get('room')) return true
  if (url.searchParams.get('s')) return true
  if (url.hash.includes('plan=')) return true
  return false
}

export function readRoomIdFromUrl(): string | null {
  return new URL(window.location.href).searchParams.get('room')
}

/** Add ?room= when entering via share/hash/embed without an id. Does not grant host. */
export function ensureRoomInUrl(): string {
  const url = new URL(window.location.href)
  let room = url.searchParams.get('room')
  if (!room) {
    room = nanoid(8)
    url.searchParams.set('room', room)
    history.replaceState(null, '', url.toString())
  }
  return room
}

export function resolveInitialRoomId(): string | null {
  if (!shouldSkipHome()) return null
  return readRoomIdFromUrl() ?? ensureRoomInUrl()
}

/** Host creates a fresh private room and updates the URL. */
export function createAndEnterRoom(): string {
  const room = nanoid(8)
  const url = new URL(window.location.origin + window.location.pathname)
  url.searchParams.set('room', room)
  history.replaceState(null, '', url.toString())
  localStorage.setItem('ct:host:' + room, '1')
  return room
}

export function enterRoom(roomId: string) {
  const url = new URL(window.location.href)
  url.searchParams.set('room', roomId.trim())
  history.replaceState(null, '', url.toString())
}

export function leaveToHome() {
  const url = new URL(window.location.origin + window.location.pathname)
  history.replaceState(null, '', url.toString())
}

export function parseRoomInput(raw: string): string | null {
  const t = raw.trim()
  if (!t) return null
  try {
    if (t.includes('://') || t.startsWith('?') || t.startsWith('/')) {
      const base = window.location.origin + window.location.pathname
      const url = new URL(t.startsWith('http') ? t : t.startsWith('?') ? base + t : base + (t.startsWith('/') ? t : '/' + t))
      const room = url.searchParams.get('room')
      if (room) return room
    }
  } catch {
    /* plain code below */
  }
  if (/^[a-zA-Z0-9_-]{6,14}$/.test(t)) return t
  return null
}
