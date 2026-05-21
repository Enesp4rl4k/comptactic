import { nanoid } from 'nanoid'
import { supabase } from './supabase'
import type { BoardSnapshot } from '../types'

// Lightweight realtime collaboration: every client in the same room broadcasts
// its board snapshot on change; peers apply the newest one (last-write-wins).
// Transport is BroadcastChannel (same-origin tabs/windows) plus Supabase
// Realtime broadcast (cross-network) when configured.
//
// On join, a client sends a "hello"; existing peers reply with their current
// snapshot so late joiners immediately see the squads/line-up/board already set.

export const clientId = nanoid(8)

export interface CollabMessage {
  type?: 'sync' | 'hello'
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

/** Keep a hosted (URL) custom image but drop heavy inline data-URLs before sending. */
function lighten(snap: BoardSnapshot): BoardSnapshot {
  const isUrl = !!snap.customImage && /^https?:\/\//.test(snap.customImage)
  return isUrl ? snap : { ...snap, customImage: null, customImageName: null }
}

export interface CollabHandle {
  broadcast: (snap: BoardSnapshot) => void
  stop: () => void
}

/**
 * Start collaboration for `roomId`.
 * @param onRemote called with peers' snapshots (apply them locally).
 * @param getSnapshot optional: returns the local snapshot, used to answer a peer's join "hello".
 */
export function startCollab(
  roomId: string,
  onRemote: (snap: BoardSnapshot) => void,
  getSnapshot?: () => BoardSnapshot,
): CollabHandle {
  let lastVersion = 0

  const bc = 'BroadcastChannel' in window ? new BroadcastChannel('comptactic:room:' + roomId) : null
  const channel = supabase
    ? supabase.channel('room:' + roomId, { config: { broadcast: { self: false } } })
    : null

  const broadcast = (snap: BoardSnapshot) => {
    const msg: CollabMessage = { type: 'sync', sender: clientId, version: Date.now(), snap: lighten(snap) }
    bc?.postMessage(msg)
    channel?.send({ type: 'broadcast', event: 'sync', payload: msg })
  }

  // Someone just joined and asked for the current state — reply with our snapshot.
  const replyToHello = () => {
    if (getSnapshot) broadcast(getSnapshot())
  }

  const applySync = (m: CollabMessage) => {
    if (!m || m.sender === clientId || m.version <= lastVersion) return
    lastVersion = m.version
    onRemote(m.snap)
  }

  const sendHello = () => {
    bc?.postMessage({ type: 'hello', sender: clientId })
    channel?.send({ type: 'broadcast', event: 'hello', payload: { sender: clientId } })
  }

  if (bc) {
    bc.onmessage = (e: MessageEvent<CollabMessage & { type?: string }>) => {
      const m = e.data
      if (!m) return
      if (m.type === 'hello') {
        if (m.sender !== clientId) replyToHello()
        return
      }
      applySync(m)
    }
  }

  if (channel) {
    channel.on('broadcast', { event: 'sync' }, ({ payload }: { payload: CollabMessage }) => applySync(payload))
    channel.on('broadcast', { event: 'hello' }, ({ payload }: { payload: { sender: string } }) => {
      if (payload?.sender !== clientId) replyToHello()
    })
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') sendHello()
    })
  }

  // Same-origin tabs are ready immediately; ask them for the current state too.
  bc?.postMessage({ type: 'hello', sender: clientId })

  const stop = () => {
    bc?.close()
    if (channel && supabase) supabase.removeChannel(channel)
  }

  return { broadcast, stop }
}
