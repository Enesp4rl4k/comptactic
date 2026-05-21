import { create } from 'zustand'
import { nanoid } from 'nanoid'
import type {
  BoardElement,
  BoardSnapshot,
  RosterSquad,
  Slide,
  Team,
  ToolId,
  VehicleAssignment,
} from '../types'

const TEAM_COLORS: Record<Team, string> = {
  blufor: '#3b82f6',
  opfor: '#ef4444',
  neutral: '#eab308',
}

// Distinct per-squad colors (cycled by squad index).
export const SQUAD_COLORS = [
  '#60a5fa', '#34d399', '#fbbf24', '#f472b6', '#a78bfa',
  '#22d3ee', '#fb923c', '#a3e635', '#e879f9', '#f87171',
]

interface BoardState {
  // selection / map
  mapId: string | null
  layerId: string | null
  /** User-supplied background image (data URL); overrides the map layer when set. */
  customImage: string | null
  customImageName: string | null
  // tool config
  tool: ToolId
  team: Team
  color: string
  strokeWidth: number
  // slides (multiple tactics on the same layer); `elements` is the active slide buffer
  slides: Slide[]
  activeSlideId: string
  // elements (id-keyed -> collaboration ready)
  elements: Record<string, BoardElement>
  selectedIds: string[]
  // history
  past: Record<string, BoardElement>[]
  future: Record<string, BoardElement>[]
  // roster (Phase 3)
  squads: RosterSquad[]
  /** When set, newly placed markers/units adopt this squad's color + label. */
  activeSquadId: string | null
  // vehicle assignments
  vehicles: VehicleAssignment[]

  // slides
  addSlide: () => void
  removeSlide: (id: string) => void
  setActiveSlide: (id: string) => void
  renameSlide: (id: string, name: string) => void
  nextSlide: () => void
  prevSlide: () => void

  setMap: (mapId: string, layerId: string) => void
  setLayer: (layerId: string) => void
  setCustomImage: (dataUrl: string | null, name?: string | null) => void
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
  sendToBack: (id: string) => void

  // roster
  addSquad: () => void
  updateSquad: (id: string, patch: Partial<RosterSquad>) => void
  setSquadColor: (id: string, color: string) => void
  removeSquad: (id: string) => void
  setActiveSquad: (id: string | null) => void
  setMemberSlot: (squadId: string, index: number, patch: Partial<{ name: string; role: string }>) => void
  removeMemberSlot: (squadId: string, index: number) => void

  // vehicles
  addVehicle: (assetId: string) => void
  addVehiclePreset: (assetId: string, name: string, timing: string) => void
  updateVehicle: (id: string, patch: Partial<VehicleAssignment>) => void
  removeVehicle: (id: string) => void
  toggleVehicleSquad: (id: string, squadId: string) => void

  loadSnapshot: (snap: BoardSnapshot) => void
  toSnapshot: () => BoardSnapshot
}

const HISTORY_LIMIT = 100

export const teamColor = (team: Team) => TEAM_COLORS[team]

export const useBoardStore = create<BoardState>((set, get) => ({
  mapId: null,
  layerId: null,
  customImage: null,
  customImageName: null,
  tool: 'select',
  team: 'blufor',
  color: TEAM_COLORS.blufor,
  strokeWidth: 4,
  slides: [{ id: 'slide1', name: '1', elements: {} }],
  activeSlideId: 'slide1',
  elements: {},
  selectedIds: [],
  past: [],
  future: [],
  squads: [],
  activeSquadId: null,
  vehicles: [],

  setMap: (mapId, layerId) => set({ mapId, layerId, customImage: null, customImageName: null, selectedIds: [] }),
  setLayer: (layerId) => set({ layerId }),
  setCustomImage: (dataUrl, name = null) => set({ customImage: dataUrl, customImageName: name, selectedIds: [] }),

  addSlide: () =>
    set((s) => {
      const slides = s.slides.map((sl) => (sl.id === s.activeSlideId ? { ...sl, elements: s.elements } : sl))
      const nextNum = Math.max(0, ...slides.map((sl) => parseInt(sl.name, 10) || 0)) + 1
      const slide: Slide = { id: nanoid(6), name: String(nextNum), elements: {} }
      return { slides: [...slides, slide], activeSlideId: slide.id, elements: {}, selectedIds: [], past: [], future: [] }
    }),

  removeSlide: (id) =>
    set((s) => {
      if (s.slides.length <= 1) return s
      const synced = s.slides.map((sl) => (sl.id === s.activeSlideId ? { ...sl, elements: s.elements } : sl))
      const idx = synced.findIndex((sl) => sl.id === id)
      const slides = synced.filter((sl) => sl.id !== id)
      if (id !== s.activeSlideId) return { slides }
      const target = slides[Math.max(0, idx - 1)]
      return { slides, activeSlideId: target.id, elements: target.elements, selectedIds: [], past: [], future: [] }
    }),

  setActiveSlide: (id) =>
    set((s) => {
      if (id === s.activeSlideId) return s
      const slides = s.slides.map((sl) => (sl.id === s.activeSlideId ? { ...sl, elements: s.elements } : sl))
      const target = slides.find((sl) => sl.id === id)
      if (!target) return s
      return { slides, activeSlideId: id, elements: target.elements, selectedIds: [], past: [], future: [] }
    }),

  renameSlide: (id, name) =>
    set((s) => ({ slides: s.slides.map((sl) => (sl.id === id ? { ...sl, name } : sl)) })),

  nextSlide: () => {
    const { slides, activeSlideId } = get()
    const i = slides.findIndex((sl) => sl.id === activeSlideId)
    if (i < slides.length - 1) get().setActiveSlide(slides[i + 1].id)
  },

  prevSlide: () => {
    const { slides, activeSlideId } = get()
    const i = slides.findIndex((sl) => sl.id === activeSlideId)
    if (i > 0) get().setActiveSlide(slides[i - 1].id)
  },
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

  sendToBack: (id) => {
    const minZ = Math.min(0, ...Object.values(get().elements).map((e) => e.z))
    get().updateElement(id, { z: minZ - 1 } as Partial<BoardElement>, false)
  },

  addSquad: () => {
    const team = get().team
    const count = get().squads.length
    const squad: RosterSquad = {
      id: nanoid(6),
      name: `Squad ${count + 1}`,
      team,
      color: SQUAD_COLORS[count % SQUAD_COLORS.length],
      members: [],
    }
    set((s) => ({ squads: [...s.squads, squad] }))
  },

  setActiveSquad: (id) => set({ activeSquadId: id }),

  updateSquad: (id, patch) =>
    set((s) => ({
      squads: s.squads.map((sq) => (sq.id === id ? { ...sq, ...patch } : sq)),
    })),

  setSquadColor: (id, color) =>
    set((s) => {
      const recolor = (els: Record<string, BoardElement>) => {
        let changed = false
        const next: Record<string, BoardElement> = {}
        for (const [k, e] of Object.entries(els)) {
          const rid = (e as { rosterSquadId?: string }).rosterSquadId
          if (rid === id && e.color !== color) {
            next[k] = { ...e, color } as BoardElement
            changed = true
          } else next[k] = e
        }
        return changed ? next : els
      }
      return {
        squads: s.squads.map((sq) => (sq.id === id ? { ...sq, color } : sq)),
        elements: recolor(s.elements),
        slides: s.slides.map((sl) => ({ ...sl, elements: recolor(sl.elements) })),
      }
    }),

  removeSquad: (id) =>
    set((s) => ({
      squads: s.squads.filter((sq) => sq.id !== id),
      activeSquadId: s.activeSquadId === id ? null : s.activeSquadId,
    })),

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

  addVehicle: (assetId) =>
    set((s) => ({
      vehicles: [...s.vehicles, { id: nanoid(6), assetId, squadIds: [], note: '' }],
    })),

  addVehiclePreset: (assetId, name, timing) =>
    set((s) => ({
      vehicles: [...s.vehicles, { id: nanoid(6), assetId, squadIds: [], note: '', name, timing }],
    })),

  updateVehicle: (id, patch) =>
    set((s) => ({
      vehicles: s.vehicles.map((v) => (v.id === id ? { ...v, ...patch } : v)),
    })),

  removeVehicle: (id) =>
    set((s) => ({ vehicles: s.vehicles.filter((v) => v.id !== id) })),

  toggleVehicleSquad: (id, squadId) =>
    set((s) => ({
      vehicles: s.vehicles.map((v) =>
        v.id === id
          ? {
              ...v,
              squadIds: v.squadIds.includes(squadId)
                ? v.squadIds.filter((x) => x !== squadId)
                : [...v.squadIds, squadId],
            }
          : v,
      ),
    })),

  loadSnapshot: (snap) =>
    set(() => {
      const slides: Slide[] =
        snap.slides && snap.slides.length
          ? snap.slides
          : [{ id: 'slide1', name: '1', elements: snap.elements ?? {} }]
      const activeSlideId =
        snap.activeSlideId && slides.some((s) => s.id === snap.activeSlideId) ? snap.activeSlideId : slides[0].id
      const active = slides.find((s) => s.id === activeSlideId)!
      return {
        mapId: snap.mapId,
        layerId: snap.layerId,
        customImage: snap.customImage ?? null,
        customImageName: snap.customImageName ?? null,
        slides,
        activeSlideId,
        elements: active.elements,
        squads: snap.squads,
        vehicles: snap.vehicles ?? [],
        selectedIds: [],
        past: [],
        future: [],
      }
    }),

  toSnapshot: () => {
    const { mapId, layerId, customImage, customImageName, slides, activeSlideId, elements, squads, vehicles } = get()
    const synced = slides.map((sl) => (sl.id === activeSlideId ? { ...sl, elements } : sl))
    return { version: 1, mapId, layerId, customImage, customImageName, slides: synced, activeSlideId, squads, vehicles }
  },
}))
