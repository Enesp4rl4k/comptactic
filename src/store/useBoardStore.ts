import { create } from 'zustand'
import { nanoid } from 'nanoid'
import type {
  BoardElement,
  BoardSnapshot,
  RosterSquad,
  Team,
  ToolId,
} from '../types'

const TEAM_COLORS: Record<Team, string> = {
  blufor: '#3b82f6',
  opfor: '#ef4444',
  neutral: '#eab308',
}

interface BoardState {
  // selection / map
  mapId: string | null
  layerId: string | null
  // tool config
  tool: ToolId
  team: Team
  color: string
  strokeWidth: number
  // elements (id-keyed -> collaboration ready)
  elements: Record<string, BoardElement>
  selectedIds: string[]
  // history
  past: Record<string, BoardElement>[]
  future: Record<string, BoardElement>[]
  // roster (Phase 3)
  squads: RosterSquad[]

  setMap: (mapId: string, layerId: string) => void
  setLayer: (layerId: string) => void
  setTool: (tool: ToolId) => void
  setTeam: (team: Team) => void
  setColor: (color: string) => void
  setStrokeWidth: (w: number) => void

  addElement: (el: Omit<BoardElement, 'id' | 'z'> & Partial<Pick<BoardElement, 'id'>>) => string
  updateElement: (id: string, patch: Partial<BoardElement>, commit?: boolean) => void
  removeElements: (ids: string[]) => void
  setSelection: (ids: string[]) => void
  clearBoard: () => void

  beginHistory: () => void
  undo: () => void
  redo: () => void

  bringToFront: (id: string) => void

  // roster
  addSquad: () => void
  updateSquad: (id: string, patch: Partial<RosterSquad>) => void
  removeSquad: (id: string) => void
  setMemberSlot: (squadId: string, index: number, patch: Partial<{ name: string; role: string }>) => void
  removeMemberSlot: (squadId: string, index: number) => void

  loadSnapshot: (snap: BoardSnapshot) => void
  toSnapshot: () => BoardSnapshot
}

const HISTORY_LIMIT = 100

export const teamColor = (team: Team) => TEAM_COLORS[team]

export const useBoardStore = create<BoardState>((set, get) => ({
  mapId: null,
  layerId: null,
  tool: 'select',
  team: 'blufor',
  color: TEAM_COLORS.blufor,
  strokeWidth: 4,
  elements: {},
  selectedIds: [],
  past: [],
  future: [],
  squads: [],

  setMap: (mapId, layerId) => set({ mapId, layerId, selectedIds: [] }),
  setLayer: (layerId) => set({ layerId }),
  setTool: (tool) => set({ tool, selectedIds: tool === 'select' ? get().selectedIds : [] }),
  setTeam: (team) => set({ team, color: TEAM_COLORS[team] }),
  setColor: (color) => set({ color }),
  setStrokeWidth: (strokeWidth) => set({ strokeWidth }),

  beginHistory: () => {
    const { elements, past } = get()
    set({
      past: [...past.slice(-HISTORY_LIMIT + 1), structuredClone(elements)],
      future: [],
    })
  },

  addElement: (partial) => {
    const id = partial.id ?? nanoid(8)
    const z = Object.keys(get().elements).length + 1
    const el = { ...partial, id, z } as BoardElement
    get().beginHistory()
    set((s) => ({ elements: { ...s.elements, [id]: el }, selectedIds: [id] }))
    return id
  },

  updateElement: (id, patch, commit = true) => {
    if (commit) get().beginHistory()
    set((s) => {
      const cur = s.elements[id]
      if (!cur) return s
      return { elements: { ...s.elements, [id]: { ...cur, ...patch } as BoardElement } }
    })
  },

  removeElements: (ids) => {
    if (!ids.length) return
    get().beginHistory()
    set((s) => {
      const next = { ...s.elements }
      ids.forEach((id) => delete next[id])
      return { elements: next, selectedIds: [] }
    })
  },

  setSelection: (ids) => set({ selectedIds: ids }),

  clearBoard: () => {
    get().beginHistory()
    set({ elements: {}, selectedIds: [] })
  },

  undo: () => {
    const { past, future, elements } = get()
    if (!past.length) return
    const prev = past[past.length - 1]
    set({
      elements: prev,
      past: past.slice(0, -1),
      future: [structuredClone(elements), ...future].slice(0, HISTORY_LIMIT),
      selectedIds: [],
    })
  },

  redo: () => {
    const { past, future, elements } = get()
    if (!future.length) return
    const next = future[0]
    set({
      elements: next,
      future: future.slice(1),
      past: [...past, structuredClone(elements)].slice(-HISTORY_LIMIT),
      selectedIds: [],
    })
  },

  bringToFront: (id) => {
    const maxZ = Math.max(0, ...Object.values(get().elements).map((e) => e.z))
    get().updateElement(id, { z: maxZ + 1 } as Partial<BoardElement>, false)
  },

  addSquad: () => {
    const team = get().team
    const n = get().squads.length + 1
    const squad: RosterSquad = {
      id: nanoid(6),
      name: `Squad ${n}`,
      team,
      members: [],
    }
    set((s) => ({ squads: [...s.squads, squad] }))
  },

  updateSquad: (id, patch) =>
    set((s) => ({
      squads: s.squads.map((sq) => (sq.id === id ? { ...sq, ...patch } : sq)),
    })),

  removeSquad: (id) =>
    set((s) => ({ squads: s.squads.filter((sq) => sq.id !== id) })),

  setMemberSlot: (squadId, index, patch) =>
    set((s) => ({
      squads: s.squads.map((sq) => {
        if (sq.id !== squadId) return sq
        const members = [...sq.members]
        while (members.length <= index) {
          members.push({ id: nanoid(5), name: '', role: members.length === 0 ? 'sl' : 'rifleman' })
        }
        members[index] = { ...members[index], ...patch }
        return { ...sq, members }
      }),
    })),

  removeMemberSlot: (squadId, index) =>
    set((s) => ({
      squads: s.squads.map((sq) =>
        sq.id === squadId ? { ...sq, members: sq.members.filter((_, i) => i !== index) } : sq,
      ),
    })),

  loadSnapshot: (snap) =>
    set({
      mapId: snap.mapId,
      layerId: snap.layerId,
      elements: snap.elements,
      squads: snap.squads,
      selectedIds: [],
      past: [],
      future: [],
    }),

  toSnapshot: () => {
    const { mapId, layerId, elements, squads } = get()
    return { version: 1, mapId, layerId, elements, squads }
  },
}))
