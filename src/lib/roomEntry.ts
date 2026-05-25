import { nanoid } from 'nanoid'

export interface ParsedRoomEntry {
  room: string
  viewOnly: boolean
}

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
  url.search = ''
  url.hash = ''
  url.searchParams.set('room', room)
  history.replaceState(null, '', url.toString())
  localStorage.setItem('ct:host:' + room, '1')
  return room
}

export function enterRoom(roomId: string, opts?: { viewOnly?: boolean }) {
  const id = roomId.trim()
  const url = new URL(window.location.href)
  url.searchParams.set('room', id)
  if (opts?.viewOnly) url.searchParams.set('view', '1')
  else url.searchParams.delete('view')
  url.searchParams.delete('s')
  url.hash = ''
  history.replaceState(null, '', url.toString())
}

/** Join an existing room as guest (never grants host). */
export function joinExistingRoom(roomId: string, opts?: { viewOnly?: boolean }) {
  const id = roomId.trim()
  enterRoom(id, opts)
  localStorage.removeItem('ct:host:' + id)
}

export function leaveToHome() {
  const url = new URL(window.location.origin + window.location.pathname)
  history.replaceState(null, '', url.toString())
}

export function parseRoomInput(raw: string): ParsedRoomEntry | null {
  const t = raw.trim()
  if (!t) return null

  const base = window.location.origin + window.location.pathname

  try {
    if (t.includes('room=') || t.includes('://') || t.startsWith('?') || t.startsWith('/')) {
      const href = t.startsWith('http')
        ? t
        : t.startsWith('?')
          ? base + t
          : t.startsWith('/')
            ? window.location.origin + t
            : t.includes('room=')
              ? `${base}?${t.replace(/^\?/, '')}`
              : base + (t.startsWith('/') ? t : '/' + t)
      const url = new URL(href)
      const room = url.searchParams.get('room')
      if (room) {
        return { room, viewOnly: url.searchParams.get('view') === '1' }
      }
    }
  } catch {
    /* plain code below */
  }

  const code = t.replace(/\s/g, '')
  if (/^[a-zA-Z0-9_-]{6,14}$/.test(code)) return { room: code, viewOnly: false }
  return null
}
