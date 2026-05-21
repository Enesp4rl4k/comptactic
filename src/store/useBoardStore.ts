import { create } from 'zustand'
import { nanoid } from 'nanoid'
import type {
  BoardData,
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

// User-customizable drawing palette (persisted as a preference).
const DEFAULT_PALETTE = ['#3b82f6', '#ef4444', '#eab308', '#22c55e', '#a855f7', '#f97316', '#ffffff', '#0b0e13']
const PALETTE_KEY = 'comptactic:palette'

function loadPalette(): string[] {
  try {
    const raw = localStorage.getItem(PALETTE_KEY)
    const arr = raw ? (JSON.parse(raw) as unknown) : null
    if (Array.isArray(arr) && arr.length && arr.every((c) => typeof c === 'string')) return arr as string[]
  } catch {
    /* ignore */
  }
  return DEFAULT_PALETTE
}

function savePalette(p: string[]) {
  try {
    localStorage.setItem(PALETTE_KEY, JSON.stringify(p))
  } catch {
    /* ignore */
  }
}

// --- per-map/layer board cache helpers ---
const NONE_KEY = 'none'

function keyFor(layerId: string | null, customImageName: string | null, customImage: string | null): string {
  if (customImage) return 'custom:' + (customImageName || 'image')
  if (layerId) return 'layer:' + layerId
  return NONE_KEY
}

function freshSlides(): Slide[] {
  return [{ id: nanoid(6), name: '1', elements: {} }]
}

/** Stash the current active board, then load (or create) the board for `newKey`. */
function switchBoard(
  s: Pick<BoardState, 'slides' | 'activeSlideId' | 'elements' | 'activeKey' | 'boards'>,
  newKey: string,
  patch: Partial<BoardState>,
): Partial<BoardState> {
  const syncedSlides = s.slides.map((sl) => (sl.id === s.activeSlideId ? { ...sl, elements: s.elements } : sl))
  const boards = { ...s.boards, [s.activeKey]: { slides: syncedSlides, activeSlideId: s.activeSlideId } }
  const target = boards[newKey]
  const slides = target ? target.slides : freshSlides()
  const activeSlideId = target ? target.activeSlideId : slides[0].id
  const active = slides.find((sl) => sl.id === activeSlideId) ?? slides[0]
  return {
    ...patch,
    boards,
    activeKey: newKey,
    slides,
    activeSlideId,
    elements: active.elements,
    selectedIds: [],
    past: [],
    future: [],
  }
}

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
  /** Customizable drawing color palette (user preference). */
  palette: string[]
  // slides (multiple tactics on the same layer); `elements` is the active slide buffer
  slides: Slide[]
  activeSlideId: string
  /** Cached boards keyed by map/layer so switching maps keeps each tactic separate. */
  boards: Record<string, BoardData>
  activeKey: string
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
  // unassigned players pasted from sign-ups
  playerPool: string[]

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
  addPaletteColor: (color: string) => void
  removePaletteColor: (color: string) => void

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

  // player pool (paste sign-ups, then distribute to squads)
  addToPool: (names: string[]) => void
  removeFromPool: (name: string) => void
  clearPool: () => void
  assignPlayerToSquad: (name: string, squadId: string) => void
  autoDistribute: () => void

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
const MAX_MEMBERS = 9

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
  palette: loadPalette(),
  slides: [{ id: 'slide1', name: '1', elements: {} }],
  activeSlideId: 'slide1',
  boards: {},
  activeKey: NONE_KEY,
  elements: {},
  selectedIds: [],
  past: [],
  future: [],
  squads: [],
  activeSquadId: null,
  vehicles: [],
  playerPool: [],

  setMap: (mapId, layerId) =>
    set((s) => switchBoard(s, keyFor(layerId, null, null), { mapId, layerId, customImage: null, customImageName: null })),
  setLayer: (layerId) =>
    set((s) => switchBoard(s, keyFor(layerId, null, null), { layerId, customImage: null, customImageName: null })),
  setCustomImage: (dataUrl, name = null) =>
    set((s) =>
      dataUrl
        ? switchBoard(s, keyFor(null, name, dataUrl), { customImage: dataUrl, customImageName: name })
        : { customImage: null, customImageName: null, selectedIds: [] },
    ),

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

  addPaletteColor: (color) =>
    set((s) => {
      const c = color.toLowerCase()
      if (s.palette.some((p) => p.toLowerCase() === c)) return s
      const palette = [...s.palette, color]
      savePalette(palette)
      return { palette }
    }),

  removePaletteColor: (color) =>
    set((s) => {
      if (s.palette.length <= 1) return s
      const palette = s.palette.filter((p) => p !== color)
      savePalette(palette)
      return { palette }
    }),

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
        boards: Object.fromEntries(
          Object.entries(s.boards).map(([k, b]) => [
            k,
            { ...b, slides: b.slides.map((sl) => ({ ...sl, elements: recolor(sl.elements) })) },
          ]),
        ),
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

  addToPool: (names) =>
    set((s) => {
      const clean = names.map((n) => n.trim()).filter(Boolean)
      const merged = [...s.playerPool]
      for (const n of clean) if (!merged.includes(n)) merged.push(n)
      return { playerPool: merged }
    }),

  removeFromPool: (name) =>
    set((s) => {
      const pool = [...s.playerPool]
      const i = pool.indexOf(name)
      if (i >= 0) pool.splice(i, 1)
      return { playerPool: pool }
    }),

  clearPool: () => set({ playerPool: [] }),

  assignPlayerToSquad: (name, squadId) =>
    set((s) => {
      const squad = s.squads.find((sq) => sq.id === squadId)
      if (!squad || squad.members.length >= MAX_MEMBERS) return s
      const role = squad.members.length === 0 ? 'sl' : 'rifleman'
      const pool = [...s.playerPool]
      const i = pool.indexOf(name)
      if (i >= 0) pool.splice(i, 1)
      return {
        squads: s.squads.map((sq) =>
          sq.id === squadId ? { ...sq, members: [...sq.members, { id: nanoid(5), name, role }] } : sq,
        ),
        playerPool: pool,
      }
    }),

  autoDistribute: () =>
    set((s) => {
      if (!s.squads.length) return s
      const squads = s.squads.map((sq) => ({ ...sq, members: [...sq.members] }))
      const remaining: string[] = []
      for (const name of s.playerPool) {
        const target = squads
          .filter((sq) => sq.members.length < MAX_MEMBERS)
          .sort((a, b) => a.members.length - b.members.length)[0]
        if (!target) {
          remaining.push(name)
          continue
        }
        target.members.push({ id: nanoid(5), name, role: target.members.length === 0 ? 'sl' : 'rifleman' })
      }
      return { squads, playerPool: remaining }
    }),

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
      let slides: Slide[] =
        snap.slides && snap.slides.length
          ? snap.slides
          : [{ id: 'slide1', name: '1', elements: snap.elements ?? {} }]
      let activeSlideId =
        snap.activeSlideId && slides.some((s) => s.id === snap.activeSlideId) ? snap.activeSlideId : slides[0].id
      const activeKey =
        snap.activeKey || keyFor(snap.layerId, snap.customImageName ?? null, snap.customImage ?? null)
      const boards: Record<string, BoardData> =
        snap.boards && Object.keys(snap.boards).length ? { ...snap.boards } : {}
      if (boards[activeKey]) {
        slides = boards[activeKey].slides
        activeSlideId = boards[activeKey].activeSlideId
      } else {
        boards[activeKey] = { slides, activeSlideId }
      }
      const active = slides.find((s) => s.id === activeSlideId) ?? slides[0]
      return {
        mapId: snap.mapId,
        layerId: snap.layerId,
        customImage: snap.customImage ?? null,
        customImageName: snap.customImageName ?? null,
        boards,
        activeKey,
        slides,
        activeSlideId,
        elements: active.elements,
        squads: snap.squads,
        vehicles: snap.vehicles ?? [],
        playerPool: snap.playerPool ?? [],
        selectedIds: [],
        past: [],
        future: [],
      }
    }),

  toSnapshot: () => {
    const { mapId, layerId, customImage, customImageName, boards, activeKey, slides, activeSlideId, elements, squads, vehicles, playerPool } = get()
    const synced = slides.map((sl) => (sl.id === activeSlideId ? { ...sl, elements } : sl))
    const syncedBoards = { ...boards, [activeKey]: { slides: synced, activeSlideId } }
    return { version: 1, mapId, layerId, customImage, customImageName, boards: syncedBoards, activeKey, slides: synced, activeSlideId, squads, vehicles, playerPool }
  },
}))
