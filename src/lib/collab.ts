import { nanoid } from 'nanoid'
import { supabase } from './supabase'
import type { BoardSnapshot } from '../types'

// Lightweight realtime collaboration: every client in the same room broadcasts
// its board snapshot on change; peers apply the newest one (last-write-wins).
// Transport is BroadcastChannel (same-origin tabs/windows) plus Supabase
// Realtime broadcast (cross-network) when configured.

export const clientId = nanoid(8)

export interface CollabMessage {
  sender: string
  version: number
  snap: BoardSnapshot
}

/** Stable room id from the URL (?room=...); created and pinned to the URL if absent. */
export function getRoomId(): string {
  const url = new URL(window.location.href)
  let room = url.searchParams.get('room')
  if (!room) {
    room = nanoid(8)
    url.searchParams.set('room', room)
    history.replaceState(null, '', url.toString())
  }
  return room
}

/** Drop the heavy custom-image data URL from a snapshot before sending. */
function lighten(snap: BoardSnapshot): BoardSnapshot {
  return { ...snap, customImage: null, customImageName: null }
}

export interface CollabHandle {
  broadcast: (snap: BoardSnapshot) => void
  stop: () => void
}

/** Start collaboration for `roomId`, calling `onRemote` with peers' snapshots. */
export function startCollab(roomId: string, onRemote: (snap: BoardSnapshot) => void): CollabHandle {
  let lastVersion = 0

  const bc = 'BroadcastChannel' in window ? new BroadcastChannel('comptactic:room:' + roomId) : null
  if (bc) {
    bc.onmessage = (e: MessageEvent<CollabMessage>) => {
      const m = e.data
      if (!m || m.sender === clientId || m.version <= lastVersion) return
      lastVersion = m.version
      onRemote(m.snap)
    }
  }

  const channel = supabase
    ? supabase.channel('room:' + roomId, { config: { broadcast: { self: false } } })
    : null
  if (channel) {
    channel.on('broadcast', { event: 'sync' }, ({ payload }: { payload: CollabMessage }) => {
      if (!payload || payload.sender === clientId || payload.version <= lastVersion) return
      lastVersion = payload.version
      onRemote(payload.snap)
    })
    channel.subscribe()
  }

  const broadcast = (snap: BoardSnapshot) => {
    const msg: CollabMessage = { sender: clientId, version: Date.now(), snap: lighten(snap) }
    bc?.postMessage(msg)
    channel?.send({ type: 'broadcast', event: 'sync', payload: msg })
  }

  const stop = () => {
    bc?.close()
    if (channel && supabase) supabase.removeChannel(channel)
  }

  return { broadcast, stop }
}
