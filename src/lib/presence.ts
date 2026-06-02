import { create } from 'zustand'
import { nanoid } from 'nanoid'
import { supabase } from './supabase'
import { upsertRoomPolicy } from './roomCloud'
import { presenceTiming } from './supabaseTier'
import {
  createDefaultPolicy,
  loadRoomPolicy,
  roleForMember,
  saveRoomPolicy,
  type RoomPolicy,
  type RoomRole,
} from './roomPolicy'

export type { RoomRole }

export interface Peer {
  id: string
  name: string
  color: string
  x: number | null
  y: number | null
  t: number
  host?: boolean
  role?: RoomRole
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

type Sender = (event: 'cursor' | 'ping' | 'kick' | 'policy', payload: unknown) => void

interface PresenceState {
  peers: Record<string, Peer>
  pings: Ping[]
  name: string
  color: string
  myId: string
  host: boolean
  myRole: RoomRole
  roomPolicy: RoomPolicy | null
  setHost: (h: boolean) => void
  setName: (n: string) => void
  setCursor: (x: number | null, y: number | null) => void
  sendPing: (x: number, y: number) => void
  kick: (id: string) => void
  initRoomPolicy: (roomId: string) => void
  setMemberRole: (memberId: string, role: RoomRole) => void
  setDefaultRole: (role: RoomRole) => void
  broadcastPolicy: () => void
  applyRemotePolicy: (policy: RoomPolicy) => void
  _send?: Sender
  start: (roomId: string) => () => void
}

function peerPayload(s: PresenceState): Peer {
  const role = s.host ? 'editor' : roleForMember(s.roomPolicy, myId, false)
  return {
    id: myId,
    name: s.name || 'Guest',
    color: s.color,
    x: null,
    y: null,
    t: Date.now(),
    host: s.host,
    role,
  }
}

function peerWithRole(p: Peer, policy: RoomPolicy | null): Peer {
  if (p.host) return { ...p, role: 'editor' }
  return { ...p, role: roleForMember(policy, p.id, false) }
}

export const usePresence = create<PresenceState>((set, get) => ({
  peers: {},
  pings: [],
  name: savedName(),
  color: savedColor(),
  myId,
  host: false,
  myRole: 'viewer',
  roomPolicy: null,

  setHost: (h) => set({ host: h, myRole: h ? 'editor' : get().myRole }),

  setName: (n) => {
    localStorage.setItem('ct:presence:name', n)
    set({ name: n })
    get().setCursor(null, null)
  },

  setCursor: (x, y) => {
    const s = get()
    s._send?.('cursor', { ...peerPayload(s), x, y, t: Date.now() })
  },

  kick: (id) => {
    const s = get()
    if (!s.host || !s.roomPolicy) return
    s._send?.('kick', { target: id, by: myId })
    const memberRoles = { ...s.roomPolicy.memberRoles }
    delete memberRoles[id]
    const updated = { ...s.roomPolicy, memberRoles, version: Date.now() }
    saveRoomPolicy(updated)
    set((st) => {
      const peers = { ...st.peers }
      delete peers[id]
      return { peers, roomPolicy: updated }
    })
    get().broadcastPolicy()
  },

  sendPing: (x, y) => {
    const s = get()
    const ping: Ping = { id: nanoid(6), x, y, color: s.color, t: Date.now() }
    set({ pings: [...s.pings, ping] })
    s._send?.('ping', ping)
  },

  initRoomPolicy: (roomId) => {
    const s = get()
    if (!s.host) return
    let policy = loadRoomPolicy(roomId)
    if (!policy || policy.hostId !== myId) {
      policy = createDefaultPolicy(roomId, myId)
    }
    saveRoomPolicy(policy)
    set({ roomPolicy: policy, myRole: 'editor' })
    void upsertRoomPolicy(policy)
    get().broadcastPolicy()
  },

  setMemberRole: (memberId, role) => {
    const s = get()
    if (!s.host || !s.roomPolicy || memberId === myId) return
    const updated: RoomPolicy = {
      ...s.roomPolicy,
      memberRoles: { ...s.roomPolicy.memberRoles, [memberId]: role },
      version: Date.now(),
    }
    saveRoomPolicy(updated)
    void upsertRoomPolicy(updated)
    set((st) => ({
      roomPolicy: updated,
      peers: st.peers[memberId] ? { ...st.peers, [memberId]: { ...st.peers[memberId], role } } : st.peers,
    }))
    get().broadcastPolicy()
  },

  setDefaultRole: (role) => {
    const s = get()
    if (!s.host || !s.roomPolicy) return
    const updated: RoomPolicy = { ...s.roomPolicy, defaultRole: role, version: Date.now() }
    saveRoomPolicy(updated)
    void upsertRoomPolicy(updated)
    set({ roomPolicy: updated })
    get().broadcastPolicy()
  },

  broadcastPolicy: () => {
    const s = get()
    if (!s.host || !s.roomPolicy) return
    void upsertRoomPolicy(s.roomPolicy)
    s._send?.('policy', s.roomPolicy)
  },

  applyRemotePolicy: (policy) => {
    saveRoomPolicy(policy)
    const role = roleForMember(policy, myId, get().host)
    set((s) => ({
      roomPolicy: policy,
      myRole: role,
      peers: Object.fromEntries(Object.entries(s.peers).map(([id, p]) => [id, peerWithRole(p, policy)])),
    }))
  },

  start: (roomId) => {
    const bc = 'BroadcastChannel' in window ? new BroadcastChannel('comptactic:presence:' + roomId) : null
    const channel = supabase ? supabase.channel('presence:' + roomId, { config: { broadcast: { self: false } } }) : null

    const registerPeer = (p: Peer) => {
      if (!p || p.id === myId) return
      const s = get()
      set((st) => ({ peers: { ...st.peers, [p.id]: peerWithRole(p, s.roomPolicy) } }))

      if (s.host && s.roomPolicy && !s.roomPolicy.memberRoles[p.id]) {
        const updated: RoomPolicy = {
          ...s.roomPolicy,
          memberRoles: { ...s.roomPolicy.memberRoles, [p.id]: s.roomPolicy.defaultRole },
          version: Date.now(),
        }
        saveRoomPolicy(updated)
        void upsertRoomPolicy(updated)
        set({ roomPolicy: updated })
        get().broadcastPolicy()
      }
    }

    const recvPolicy = (policy: RoomPolicy) => {
      if (!policy || policy.roomId !== roomId) return
      get().applyRemotePolicy(policy)
    }

    const recvKick = (k: { target: string; by: string }) => {
      if (!k) return
      if (k.target === myId) {
        alert('You were removed from this session by the host.')
        window.location.href = window.location.origin + window.location.pathname
        return
      }
      set((s) => {
        const peers = { ...s.peers }
        delete peers[k.target]
        return { peers }
      })
    }

    if (bc) {
      bc.onmessage = (e: MessageEvent<{ kind: string; payload: unknown }>) => {
        const m = e.data
        if (!m) return
        if (m.kind === 'cursor') registerPeer(m.payload as Peer)
        else if (m.kind === 'ping') {
          const p = m.payload as Ping
          if (p) set((s) => (s.pings.some((x) => x.id === p.id) ? s : { pings: [...s.pings, p] }))
        } else if (m.kind === 'kick') recvKick(m.payload as { target: string; by: string })
        else if (m.kind === 'policy') recvPolicy(m.payload as RoomPolicy)
      }
    }

    const send: Sender = (event, payload) => {
      bc?.postMessage({ kind: event, payload })
      channel?.send({ type: 'broadcast', event, payload })
    }
    set({ _send: send })

    if (channel) {
      channel.on('broadcast', { event: 'cursor' }, ({ payload }: { payload: Peer }) => registerPeer(payload))
      channel.on('broadcast', { event: 'ping' }, ({ payload }: { payload: Ping }) => {
        if (payload) set((s) => (s.pings.some((x) => x.id === payload.id) ? s : { pings: [...s.pings, payload] }))
      })
      channel.on('broadcast', { event: 'kick' }, ({ payload }: { payload: { target: string; by: string } }) => recvKick(payload))
      channel.on('broadcast', { event: 'policy' }, ({ payload }: { payload: RoomPolicy }) => recvPolicy(payload))
      channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') send('cursor', peerPayload(get()))
      })
    }

    send('cursor', peerPayload(get()))

    const { cursorIntervalMs, policyIntervalMs } = presenceTiming()
    const hb = setInterval(() => send('cursor', peerPayload(get())), cursorIntervalMs)
    const policyHb = setInterval(() => {
      if (get().host) get().broadcastPolicy()
    }, policyIntervalMs)
    const prune = setInterval(() => {
      const now = Date.now()
      set((s) => {
        const peers = Object.fromEntries(Object.entries(s.peers).filter(([, p]) => now - p.t < 12_000))
        const pings = s.pings.filter((p) => now - p.t < 1600)
        if (Object.keys(peers).length === Object.keys(s.peers).length && pings.length === s.pings.length) return s
        return { peers, pings }
      })
    }, 1000)

    return () => {
      clearInterval(hb)
      clearInterval(policyHb)
      clearInterval(prune)
      bc?.close()
      if (channel && supabase) supabase.removeChannel(channel)
      set({ _send: undefined, peers: {}, pings: [], roomPolicy: null, myRole: 'viewer' })
    }
  },
}))
