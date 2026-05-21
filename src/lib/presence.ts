import { create } from 'zustand'
import { nanoid } from 'nanoid'
import { supabase } from './supabase'

// Lightweight presence: each client broadcasts its cursor + identity over the
// room channel (BroadcastChannel for same-origin tabs, Supabase Realtime for
// cross-network). Peers are pruned when their last message goes stale.

export interface Peer {
  id: string
  name: string
  color: string
  x: number | null
  y: number | null
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

interface PresenceState {
  peers: Record<string, Peer>
  name: string
  color: string
  myId: string
  setName: (n: string) => void
  setCursor: (x: number | null, y: number | null) => void
  _send?: (msg: Peer) => void
  start: (roomId: string) => () => void
}

export const usePresence = create<PresenceState>((set, get) => ({
  peers: {},
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
    s._send?.({ id: myId, name: s.name || 'Guest', color: s.color, x, y, t: Date.now() })
  },

  start: (roomId) => {
    const bc = 'BroadcastChannel' in window ? new BroadcastChannel('comptactic:presence:' + roomId) : null
    const channel = supabase ? supabase.channel('presence:' + roomId, { config: { broadcast: { self: false } } }) : null

    const recv = (p: Peer) => {
      if (!p || p.id === myId) return
      set((s) => ({ peers: { ...s.peers, [p.id]: p } }))
    }
    if (bc) bc.onmessage = (e: MessageEvent<Peer>) => recv(e.data)
    if (channel) {
      channel.on('broadcast', { event: 'cursor' }, ({ payload }: { payload: Peer }) => recv(payload))
      channel.subscribe()
    }

    const send = (msg: Peer) => {
      bc?.postMessage(msg)
      channel?.send({ type: 'broadcast', event: 'cursor', payload: msg })
    }
    set({ _send: send })

    // heartbeat so peers know we're online even when the cursor is idle
    const hb = setInterval(() => {
      const s = get()
      send({ id: myId, name: s.name || 'Guest', color: s.color, x: null, y: null, t: Date.now() })
    }, 3000)
    // drop peers we haven't heard from recently
    const prune = setInterval(() => {
      const now = Date.now()
      set((s) => {
        const peers = Object.fromEntries(Object.entries(s.peers).filter(([, p]) => now - p.t < 8000))
        return Object.keys(peers).length === Object.keys(s.peers).length ? s : { peers }
      })
    }, 2000)

    return () => {
      clearInterval(hb)
      clearInterval(prune)
      bc?.close()
      if (channel && supabase) supabase.removeChannel(channel)
      set({ _send: undefined, peers: {} })
    }
  },
}))
