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

/** Move the item with `fromId` to the position of `toId`. */
function reorderById<T extends { id: string }>(arr: T[], fromId: string, toId: string): T[] {
  if (fromId === toId) return arr
  const from = arr.findIndex((x) => x.id === fromId)
  const to = arr.findIndex((x) => x.id === toId)
  if (from < 0 || to < 0) return arr
  const copy = [...arr]
  const [moved] = copy.splice(from, 1)
  copy.splice(to, 0, moved)
  return copy
}

/** Returns a copy of an element shifted by (dx, dy), handling point- and xy-based shapes. */
function shiftEl(el: BoardElement, dx: number, dy: number): BoardElement {
  const e = { ...el } as BoardElement & { x?: number; y?: number; points?: number[] }
  if (Array.isArray(e.points)) e.points = e.points.map((p, i) => (i % 2 === 0 ? p + dx : p + dy))
  if (typeof e.x === 'number') e.x += dx
  if (typeof e.y === 'number') e.y += dy
  return e as BoardElement
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
  /** Internal clipboard for copy/paste of elements. */
  clipboard: BoardElement[]
  /** Snap element drags to the grid. */
  snapToGrid: boolean
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
  /** Asset armed for click-to-place; left-clicking the map drops it (stays armed). */
  placingAssetId: string | null

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
  setPlacingAsset: (assetId: string | null) => void
  setTeam: (team: Team) => void
  setColor: (color: string) => void
  setStrokeWidth: (w: number) => void
  addPaletteColor: (color: string) => void
  removePaletteColor: (color: string) => void

  addElement: (el: Omit<BoardElement, 'id' | 'z'> & Partial<Pick<BoardElement, 'id'>>) => string
  updateElement: (id: string, patch: Partial<BoardElement>, commit?: boolean) => void
  removeElements: (ids: string[]) => void
  setSelection: (ids: string[]) => void
  toggleSelection: (id: string) => void
  copySelection: () => void
  paste: () => void
  duplicateSelection: () => void
  /** Add a saved group of elements (a "stamp") with fresh ids; selects them. */
  addStampElements: (els: BoardElement[]) => void
  /** Replace the roster (squads + vehicles + player pool) from a saved template. */
  applyRoster: (squads: RosterSquad[], vehicles: VehicleAssignment[], pool: string[]) => void
  moveSelectionBy: (dx: number, dy: number, exceptId: string) => void
  toggleSnap: () => void
  clearBoard: () => void

  beginHistory: () => void
  undo: () => void
  redo: () => void

  bringToFront: (id: string) => void
  sendToBack: (id: string) => void
  raiseElement: (id: string) => void
  lowerElement: (id: string) => void
  toggleElementHidden: (id: string) => void
  toggleElementLocked: (id: string) => void

  // roster
  addSquad: () => void
  updateSquad: (id: string, patch: Partial<RosterSquad>) => void
  setSquadColor: (id: string, color: string) => void
  removeSquad: (id: string) => void
  setActiveSquad: (id: string | null) => void
  setMemberSlot: (squadId: string, index: number, patch: Partial<{ name: string; role: string }>) => void
  removeMemberSlot: (squadId: string, index: number) => void
  moveMember: (fromSquadId: string, memberId: string, toSquadId: string) => void
  memberToPool: (squadId: string, memberId: string) => void
  reorderSquads: (fromId: string, toId: string) => void
  reorderVehicles: (fromId: string, toId: string) => void

  // player pool (paste sign-ups, then distribute to squads)
  addToPool: (names: string[]) => void
  removeFromPool: (name: string) => void
  clearPool: () => void
  assignPlayerToSquad: (name: string, squadId: string) => void

  // vehicles
  addVehicle: (assetId: string) => void
  addVehiclePreset: (assetId: string, name: string, timing: string) => void
  updateVehicle: (id: string, patch: Partial<VehicleAssignment>) => void
  removeVehicle: (id: string) => void
  toggleVehicleSquad: (id: string, squadId: string) => void
  assignSquadToVehicle: (id: string, squadId: string) => void
  addVehicleCrew: (id: string, name: string) => void
  removeVehicleCrew: (id: string, name: string) => void

  loadSnapshot: (snap: BoardSnapshot) => void
  applyRemote: (snap: BoardSnapshot) => void
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
  clipboard: [],
  snapToGrid: false,
  past: [],
  future: [],
  squads: [],
  activeSquadId: null,
  vehicles: [],
  playerPool: [],
  placingAssetId: null,

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
  setTool: (tool) => set({ tool, selectedIds: tool === 'select' ? get().selectedIds : [], placingAssetId: null }),
  // Arm an asset for click-to-place; keep the select tool so map clicks drop it.
  setPlacingAsset: (assetId) => set((s) => ({ placingAssetId: assetId, tool: 'select', selectedIds: assetId ? [] : s.selectedIds })),
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

  toggleSelection: (id) =>
    set((s) => ({
      selectedIds: s.selectedIds.includes(id) ? s.selectedIds.filter((x) => x !== id) : [...s.selectedIds, id],
    })),

  copySelection: () =>
    set((s) => ({ clipboard: s.selectedIds.map((id) => s.elements[id]).filter(Boolean) as BoardElement[] })),

  paste: () => {
    const { clipboard, elements } = get()
    if (!clipboard.length) return
    get().beginHistory()
    let z = Math.max(0, ...Object.values(elements).map((e) => e.z))
    const next = { ...elements }
    const newIds: string[] = []
    for (const el of clipboard) {
      const id = nanoid(8)
      z += 1
      next[id] = { ...shiftEl(el, 20, 20), id, z } as BoardElement
      newIds.push(id)
    }
    set({ elements: next, selectedIds: newIds })
  },

  duplicateSelection: () => {
    const { elements, selectedIds } = get()
    if (!selectedIds.length) return
    get().beginHistory()
    let z = Math.max(0, ...Object.values(elements).map((e) => e.z))
    const next = { ...elements }
    const newIds: string[] = []
    for (const id of selectedIds) {
      const el = elements[id]
      if (!el) continue
      const nid = nanoid(8)
      z += 1
      next[nid] = { ...shiftEl(el, 16, 16), id: nid, z } as BoardElement
      newIds.push(nid)
    }
    set({ elements: next, selectedIds: newIds })
  },

  addStampElements: (els) => {
    if (!els.length) return
    get().beginHistory()
    const { elements } = get()
    let z = Math.max(0, ...Object.values(elements).map((e) => e.z))
    const next = { ...elements }
    const newIds: string[] = []
    for (const el of els) {
      const id = nanoid(8)
      z += 1
      next[id] = { ...shiftEl(el, 24, 24), id, z } as BoardElement
      newIds.push(id)
    }
    set({ elements: next, selectedIds: newIds })
  },

  applyRoster: (squads, vehicles, pool) =>
    set({ squads: structuredClone(squads), vehicles: structuredClone(vehicles), playerPool: [...pool], activeSquadId: null }),

  /** Shift every selected element (except the one being dragged) by (dx, dy). */
  moveSelectionBy: (dx, dy, exceptId) =>
    set((s) => {
      if (s.selectedIds.length < 2) return s
      const next = { ...s.elements }
      for (const id of s.selectedIds) {
        if (id === exceptId) continue
        const el = next[id]
        if (el) next[id] = shiftEl(el, dx, dy)
      }
      return { elements: next }
    }),

  toggleSnap: () => set((s) => ({ snapToGrid: !s.snapToGrid })),

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

  // Swap z with the next element above/below in stacking order.
  raiseElement: (id) => {
    const sorted = Object.values(get().elements).sort((a, b) => a.z - b.z)
    const i = sorted.findIndex((e) => e.id === id)
    if (i < 0 || i >= sorted.length - 1) return
    const a = sorted[i]
    const b = sorted[i + 1]
    get().beginHistory()
    set((s) => ({ elements: { ...s.elements, [a.id]: { ...a, z: b.z }, [b.id]: { ...b, z: a.z } } }))
  },
  lowerElement: (id) => {
    const sorted = Object.values(get().elements).sort((a, b) => a.z - b.z)
    const i = sorted.findIndex((e) => e.id === id)
    if (i <= 0) return
    const a = sorted[i]
    const b = sorted[i - 1]
    get().beginHistory()
    set((s) => ({ elements: { ...s.elements, [a.id]: { ...a, z: b.z }, [b.id]: { ...b, z: a.z } } }))
  },
  toggleElementHidden: (id) => {
    const el = get().elements[id]
    if (!el) return
    get().updateElement(id, { hidden: !el.hidden } as Partial<BoardElement>, true)
  },
  toggleElementLocked: (id) => {
    const el = get().elements[id]
    if (!el) return
    get().updateElement(id, { locked: !el.locked } as Partial<BoardElement>, true)
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

  moveMember: (fromSquadId, memberId, toSquadId) =>
    set((s) => {
      if (fromSquadId === toSquadId) return s
      const from = s.squads.find((sq) => sq.id === fromSquadId)
      const to = s.squads.find((sq) => sq.id === toSquadId)
      const m = from?.members.find((mm) => mm.id === memberId)
      if (!from || !to || !m || to.members.length >= MAX_MEMBERS) return s
      return {
        squads: s.squads.map((sq) => {
          if (sq.id === fromSquadId) return { ...sq, members: sq.members.filter((mm) => mm.id !== memberId) }
          if (sq.id === toSquadId) return { ...sq, members: [...sq.members, m] }
          return sq
        }),
      }
    }),

  memberToPool: (squadId, memberId) =>
    set((s) => {
      const sq = s.squads.find((x) => x.id === squadId)
      const m = sq?.members.find((mm) => mm.id === memberId)
      if (!m) return s
      const name = m.name.trim()
      const playerPool = name && !s.playerPool.includes(name) ? [...s.playerPool, name] : s.playerPool
      return {
        squads: s.squads.map((x) => (x.id === squadId ? { ...x, members: x.members.filter((mm) => mm.id !== memberId) } : x)),
        playerPool,
      }
    }),

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

  reorderSquads: (fromId, toId) => set((s) => ({ squads: reorderById(s.squads, fromId, toId) })),
  reorderVehicles: (fromId, toId) => set((s) => ({ vehicles: reorderById(s.vehicles, fromId, toId) })),

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

  assignSquadToVehicle: (id, squadId) =>
    set((s) => ({
      vehicles: s.vehicles.map((v) =>
        v.id === id && !v.squadIds.includes(squadId) ? { ...v, squadIds: [...v.squadIds, squadId] } : v,
      ),
    })),

  addVehicleCrew: (id, name) =>
    set((s) => ({
      vehicles: s.vehicles.map((v) => {
        if (v.id !== id) return v
        const crew = v.crew ?? []
        return crew.includes(name) ? v : { ...v, crew: [...crew, name] }
      }),
    })),

  removeVehicleCrew: (id, name) =>
    set((s) => ({
      vehicles: s.vehicles.map((v) => (v.id === id ? { ...v, crew: (v.crew ?? []).filter((n) => n !== name) } : v)),
    })),

  applyRemote: (snap) =>
    set((s) => {
      const slides = snap.slides && snap.slides.length ? snap.slides : s.slides
      const activeSlideId =
        snap.activeSlideId && slides.some((x) => x.id === snap.activeSlideId) ? snap.activeSlideId : slides[0]?.id ?? s.activeSlideId
      const active = slides.find((x) => x.id === activeSlideId)
      return {
        // adopt shared board state...
        mapId: snap.mapId,
        layerId: snap.layerId,
        boards: snap.boards ?? s.boards,
        activeKey: snap.activeKey ?? s.activeKey,
        slides,
        activeSlideId,
        elements: active ? active.elements : s.elements,
        squads: snap.squads,
        vehicles: snap.vehicles ?? [],
        playerPool: snap.playerPool ?? [],
        // hosted (URL) custom backgrounds sync; otherwise keep local
        customImage: snap.customImage ?? null,
        customImageName: snap.customImageName ?? null,
        // ...but keep local selection/tooling/view
      }
    }),

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
