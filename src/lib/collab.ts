import { nanoid } from 'nanoid'
import { supabase } from './supabase'
import { collabTiming } from './supabaseTier'
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
  /** Deleted element ids → tombstone rev (remote wins when tombstone > local element rev). */
  elementTombstones?: Record<string, number>
  /** When true, inactive slides omit elements (merge keeps local). */
  light?: true
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
  localStorage.setItem('ct:host:' + room, '1')
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
  broadcastBoard: (board: CollabBoardPayload, opts?: { urgent?: boolean }) => void
  broadcastRoster: (roster: CollabRosterPayload, opts?: { urgent?: boolean }) => void
  stop: () => void
}

export function startCollab(
  roomId: string,
  onRemoteBoard: (board: CollabBoardPayload) => void,
  onRemoteRoster: (roster: CollabRosterPayload) => void,
  getBoard?: () => CollabBoardPayload,
  getRoster?: () => CollabRosterPayload,
  onConnectionChange?: (connected: boolean) => void,
): CollabHandle {
  let lastBoardVersion = 0
  let lastRosterVersion = 0
  let helloReplyTimer: ReturnType<typeof setTimeout> | undefined
  let boardSendTimer: ReturnType<typeof setTimeout> | undefined
  let rosterSendTimer: ReturnType<typeof setTimeout> | undefined
  let pendingBoard: CollabBoardPayload | null = null
  let pendingRoster: CollabRosterPayload | null = null
  let lastBoardSendAt = 0
  let lastRosterSendAt = 0
  const { minBoardSendMs: MIN_BOARD_MS, minRosterSendMs: MIN_ROSTER_MS } = collabTiming()

  const bc = 'BroadcastChannel' in window ? new BroadcastChannel('comptactic:room:' + roomId) : null
  const channel = supabase
    ? supabase.channel('room:' + roomId, { config: { broadcast: { self: false } } })
    : null

  const send = (msg: CollabMessage) => {
    bc?.postMessage(msg)
    channel?.send({ type: 'broadcast', event: 'collab', payload: msg })
  }

  const flushBoardSend = (board: CollabBoardPayload) => {
    lastBoardSendAt = Date.now()
    pendingBoard = null
    boardSendTimer = undefined
    send({
      type: 'sync-board',
      sender: clientId,
      version: Date.now(),
      board: lightenBoard(board),
    })
  }

  const flushRosterSend = (roster: CollabRosterPayload) => {
    lastRosterSendAt = Date.now()
    pendingRoster = null
    rosterSendTimer = undefined
    send({ type: 'sync-roster', sender: clientId, version: Date.now(), roster })
  }

  const broadcastBoard = (board: CollabBoardPayload, opts?: { urgent?: boolean }) => {
    pendingBoard = board
    const delay = opts?.urgent ? 0 : Math.max(0, MIN_BOARD_MS - (Date.now() - lastBoardSendAt))
    clearTimeout(boardSendTimer)
    if (delay === 0) flushBoardSend(board)
    else boardSendTimer = setTimeout(() => pendingBoard && flushBoardSend(pendingBoard), delay)
  }

  const broadcastRoster = (roster: CollabRosterPayload, opts?: { urgent?: boolean }) => {
    pendingRoster = roster
    const delay = opts?.urgent ? 0 : Math.max(0, MIN_ROSTER_MS - (Date.now() - lastRosterSendAt))
    clearTimeout(rosterSendTimer)
    if (delay === 0) flushRosterSend(roster)
    else rosterSendTimer = setTimeout(() => pendingRoster && flushRosterSend(pendingRoster), delay)
  }

  const replyToHello = () => {
    clearTimeout(helloReplyTimer)
    helloReplyTimer = setTimeout(() => {
      if (getBoard) broadcastBoard(getBoard(), { urgent: true })
      if (getRoster) broadcastRoster(getRoster(), { urgent: true })
    }, 150 + Math.floor(Math.random() * 350))
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
      const connected = status === 'SUBSCRIBED'
      onConnectionChange?.(connected)
      if (connected) sendHello()
    })
  } else {
    onConnectionChange?.(!!bc)
  }

  bc?.postMessage({ type: 'hello', sender: clientId, version: 0 })

  const stop = () => {
    onConnectionChange?.(false)
    clearTimeout(helloReplyTimer)
    clearTimeout(boardSendTimer)
    clearTimeout(rosterSendTimer)
    bc?.close()
    if (channel && supabase) supabase.removeChannel(channel)
  }

  return { broadcastBoard, broadcastRoster, stop }
}
