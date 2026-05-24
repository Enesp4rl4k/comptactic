import { nanoid } from 'nanoid'
import { supabase } from './supabase'
import type { BoardSnapshot, CustomMapMeta } from '../types'

// Partitioned realtime sync: board (map, slides, drawings) and roster (squads,
// vehicles, pool) are broadcast separately so editing one does not overwrite the other.

export const clientId = nanoid(8)

export interface CollabBoardPayload {
  mapId: string | null
  layerId: string | null
  customImage?: string | null
  customImageName?: string | null
  customMapMeta?: CustomMapMeta | null
  slides: BoardSnapshot['slides']
  activeSlideId: string
  boards?: BoardSnapshot['boards']
  activeKey?: string
}

export interface CollabRosterPayload {
  squads: BoardSnapshot['squads']
  vehicles: BoardSnapshot['vehicles']
  playerPool: string[]
}

export type CollabMessageType = 'sync-board' | 'sync-roster' | 'sync' | 'hello'

export interface CollabMessage {
  type: CollabMessageType
  sender: string
  version: number
  board?: CollabBoardPayload
  roster?: CollabRosterPayload
  /** @deprecated legacy full snapshot */
  snap?: BoardSnapshot
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

/** Start a fresh collaboration room (clears ?s= and hash, sets new ?room=). */
export function createNewRoom(): string {
  const room = nanoid(8)
  const url = new URL(window.location.href)
  url.search = ''
  url.hash = ''
  url.searchParams.set('room', room)
  history.replaceState(null, '', url.toString())
  return room
}

/** Keep a hosted (URL) custom image but drop heavy inline data-URLs before sending. */
export function lightenBoard(board: CollabBoardPayload): CollabBoardPayload {
  const isUrl = !!board.customImage && /^https?:\/\//.test(board.customImage)
  if (isUrl) return board
  return { ...board, customImage: null, customImageName: null, customMapMeta: board.customMapMeta ?? null }
}

export function boardFromSnapshot(snap: BoardSnapshot): CollabBoardPayload {
  return {
    mapId: snap.mapId,
    layerId: snap.layerId,
    customImage: snap.customImage ?? null,
    customImageName: snap.customImageName ?? null,
    customMapMeta: snap.customMapMeta ?? null,
    slides: snap.slides,
    activeSlideId: snap.activeSlideId,
    boards: snap.boards,
    activeKey: snap.activeKey,
  }
}

export function rosterFromSnapshot(snap: BoardSnapshot): CollabRosterPayload {
  return {
    squads: snap.squads,
    vehicles: snap.vehicles ?? [],
    playerPool: snap.playerPool ?? [],
  }
}

export interface CollabHandle {
  broadcastBoard: (board: CollabBoardPayload) => void
  broadcastRoster: (roster: CollabRosterPayload) => void
  stop: () => void
}

export function startCollab(
  roomId: string,
  onRemoteBoard: (board: CollabBoardPayload) => void,
  onRemoteRoster: (roster: CollabRosterPayload) => void,
  getBoard?: () => CollabBoardPayload,
  getRoster?: () => CollabRosterPayload,
): CollabHandle {
  let lastBoardVersion = 0
  let lastRosterVersion = 0

  const bc = 'BroadcastChannel' in window ? new BroadcastChannel('comptactic:room:' + roomId) : null
  const channel = supabase
    ? supabase.channel('room:' + roomId, { config: { broadcast: { self: false } } })
    : null

  const send = (msg: CollabMessage) => {
    bc?.postMessage(msg)
    channel?.send({ type: 'broadcast', event: 'collab', payload: msg })
  }

  const broadcastBoard = (board: CollabBoardPayload) => {
    send({
      type: 'sync-board',
      sender: clientId,
      version: Date.now(),
      board: lightenBoard(board),
    })
  }

  const broadcastRoster = (roster: CollabRosterPayload) => {
    send({ type: 'sync-roster', sender: clientId, version: Date.now(), roster })
  }

  const replyToHello = () => {
    if (getBoard) broadcastBoard(getBoard())
    if (getRoster) broadcastRoster(getRoster())
  }

  const applyMessage = (m: CollabMessage) => {
    if (!m || m.sender === clientId) return

    if (m.type === 'hello') {
      replyToHello()
      return
    }

    // Legacy: full snapshot overwrites both sections.
    if (m.type === 'sync' && m.snap) {
      if (m.version > lastBoardVersion) {
        lastBoardVersion = m.version
        onRemoteBoard(boardFromSnapshot(m.snap))
      }
      if (m.version > lastRosterVersion) {
        lastRosterVersion = m.version
        onRemoteRoster(rosterFromSnapshot(m.snap))
      }
      return
    }

    if (m.type === 'sync-board' && m.board && m.version > lastBoardVersion) {
      lastBoardVersion = m.version
      onRemoteBoard(m.board)
      return
    }

    if (m.type === 'sync-roster' && m.roster && m.version > lastRosterVersion) {
      lastRosterVersion = m.version
      onRemoteRoster(m.roster)
    }
  }

  const sendHello = () => {
    send({ type: 'hello', sender: clientId, version: 0 })
  }

  if (bc) {
    bc.onmessage = (e: MessageEvent<CollabMessage>) => applyMessage(e.data)
  }

  if (channel) {
    channel.on('broadcast', { event: 'collab' }, ({ payload }: { payload: CollabMessage }) => applyMessage(payload))
    // Legacy event name from older clients
    channel.on('broadcast', { event: 'sync' }, ({ payload }: { payload: CollabMessage }) => {
      applyMessage({ ...payload, type: payload.type ?? 'sync' })
    })
    channel.on('broadcast', { event: 'hello' }, ({ payload }: { payload: { sender: string } }) => {
      if (payload?.sender !== clientId) replyToHello()
    })
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') sendHello()
    })
  }

  bc?.postMessage({ type: 'hello', sender: clientId, version: 0 })

  const stop = () => {
    bc?.close()
    if (channel && supabase) supabase.removeChannel(channel)
  }

  return { broadcastBoard, broadcastRoster, stop }
}
