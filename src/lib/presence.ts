import { create } from 'zustand'
import { nanoid } from 'nanoid'
import { supabase } from './supabase'

// Lightweight presence: each client broadcasts its cursor + identity over the
// room channel (BroadcastChannel for same-origin tabs, Supabase Realtime for
// cross-network). Also relays transient "pings" (expanding rings) used to point
// at the map while explaining, without leaving a permanent mark.

export interface Peer {
  id: string
  name: string
  color: string
  x: number | null
  y: number | null
  t: number
}

export interface Ping {
  id: string
  x: number
  y: number
  color: string
  t: number
}

const myId = nanoid(8)
const COLORS = ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#a855f7', '#ec4899', '#14b8a6', '#eab308']

const savedName = () => localStorage.getItem('ct:presence:name') || ''
const savedColor = () => {
  let c = localStorage.getItem('ct:presence:color')
  if (!c) {
    c = COLORS[Math.floor(Math.random() * COLORS.length)]
    localStorage.setItem('ct:presence:color', c)
  }
  return c
}

type Sender = (event: 'cursor' | 'ping', payload: unknown) => void

interface PresenceState {
  peers: Record<string, Peer>
  pings: Ping[]
  name: string
  color: string
  myId: string
  setName: (n: string) => void
  setCursor: (x: number | null, y: number | null) => void
  sendPing: (x: number, y: number) => void
  _send?: Sender
  start: (roomId: string) => () => void
}

export const usePresence = create<PresenceState>((set, get) => ({
  peers: {},
  pings: [],
  name: savedName(),
  color: savedColor(),
  myId,

  setName: (n) => {
    localStorage.setItem('ct:presence:name', n)
    set({ name: n })
    get().setCursor(null, null) // push the new name immediately
  },

  setCursor: (x, y) => {
    const s = get()
    s._send?.('cursor', { id: myId, name: s.name || 'Guest', color: s.color, x, y, t: Date.now() })
  },

  sendPing: (x, y) => {
    const s = get()
    const ping: Ping = { id: nanoid(6), x, y, color: s.color, t: Date.now() }
    set({ pings: [...s.pings, ping] })
    s._send?.('ping', ping)
  },

  start: (roomId) => {
    const bc = 'BroadcastChannel' in window ? new BroadcastChannel('comptactic:presence:' + roomId) : null
    const channel = supabase ? supabase.channel('presence:' + roomId, { config: { broadcast: { self: false } } }) : null

    const recvCursor = (p: Peer) => {
      if (!p || p.id === myId) return
      set((s) => ({ peers: { ...s.peers, [p.id]: p } }))
    }
    const recvPing = (p: Ping) => {
      if (!p) return
      set((s) => (s.pings.some((x) => x.id === p.id) ? s : { pings: [...s.pings, p] }))
    }

    if (bc) {
      bc.onmessage = (e: MessageEvent<{ kind: 'cursor' | 'ping'; payload: unknown }>) => {
        const m = e.data
        if (!m) return
        if (m.kind === 'cursor') recvCursor(m.payload as Peer)
        else if (m.kind === 'ping') recvPing(m.payload as Ping)
      }
    }
    if (channel) {
      channel.on('broadcast', { event: 'cursor' }, ({ payload }: { payload: Peer }) => recvCursor(payload))
      channel.on('broadcast', { event: 'ping' }, ({ payload }: { payload: Ping }) => recvPing(payload))
      channel.subscribe()
    }

    const send: Sender = (event, payload) => {
      bc?.postMessage({ kind: event, payload })
      channel?.send({ type: 'broadcast', event, payload })
    }
    set({ _send: send })

    // heartbeat so peers know we're online even when the cursor is idle
    const hb = setInterval(() => {
      const s = get()
      send('cursor', { id: myId, name: s.name || 'Guest', color: s.color, x: null, y: null, t: Date.now() })
    }, 3000)
    // drop stale peers and expired pings
    const prune = setInterval(() => {
      const now = Date.now()
      set((s) => {
        const peers = Object.fromEntries(Object.entries(s.peers).filter(([, p]) => now - p.t < 8000))
        const pings = s.pings.filter((p) => now - p.t < 1600)
        const peersSame = Object.keys(peers).length === Object.keys(s.peers).length
        const pingsSame = pings.length === s.pings.length
        return peersSame && pingsSame ? s : { peers, pings }
      })
    }, 1000)

    return () => {
      clearInterval(hb)
      clearInterval(prune)
      bc?.close()
      if (channel && supabase) supabase.removeChannel(channel)
      set({ _send: undefined, peers: {}, pings: [] })
    }
  },
}))
