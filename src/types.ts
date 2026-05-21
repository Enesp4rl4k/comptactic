// Core data model. Designed to be collaboration-ready: every board element is a
// flat, id-keyed object so the element map can later be swapped for a Yjs Y.Map
// (Phase 5) with no shape changes.

export type Team = 'blufor' | 'opfor' | 'neutral'

export type ToolId =
  | 'select'
  | 'arrow'
  | 'line'
  | 'pen'
  | 'rect'
  | 'circle'
  | 'zone'
  | 'text'
  | 'measure'

export type ElementType =
  | 'arrow'
  | 'line'
  | 'pen'
  | 'measure'
  | 'rect'
  | 'circle'
  | 'zone'
  | 'text'
  | 'icon'

interface ElementBase {
  id: string
  type: ElementType
  z: number
  team: Team
  color: string
  rotation: number
  /** Optional link to a roster squad; lets squad color changes recolor this mark. */
  rosterSquadId?: string
  /** Hidden elements are not rendered (toggled from the Layers panel). */
  hidden?: boolean
  /** Locked elements can't be selected/dragged on the board. */
  locked?: boolean
  /** Optional display name shown in the Layers panel. */
  name?: string
}

/** Polyline-based elements store absolute stage coordinates in `points`. */
export interface PolyElement extends ElementBase {
  type: 'arrow' | 'line' | 'pen' | 'measure'
  points: number[]
  strokeWidth: number
}

export interface RectElement extends ElementBase {
  type: 'rect'
  x: number
  y: number
  width: number
  height: number
}

export interface CircleElement extends ElementBase {
  type: 'circle'
  x: number
  y: number
  radius: number
}

/** Polygon area marked by clicking corners; absolute stage coords in `points`. */
export interface ZoneElement extends ElementBase {
  type: 'zone'
  points: number[]
  label?: string
  /** Optional link to a roster squad (squad-colored zone). */
  rosterSquadId?: string
}

export interface TextElement extends ElementBase {
  type: 'text'
  x: number
  y: number
  text: string
  fontSize: number
}

export interface IconElement extends ElementBase {
  type: 'icon'
  x: number
  y: number
  assetId: string
  scale: number
  label?: string
  /** Optional link to a roster squad (Phase 3). */
  rosterSquadId?: string
}

export type BoardElement =
  | PolyElement
  | RectElement
  | CircleElement
  | ZoneElement
  | TextElement
  | IconElement

// ---- Map / layer data ----

export type GameMode =
  | 'RAAS'
  | 'AAS'
  | 'Invasion'
  | 'Skirmish'
  | 'TC'
  | 'Insurgency'
  | 'Destruction'
  | 'Seed'
  | 'TA'
  | 'Tanks'
  | 'Grounds'
  | (string & {})

export interface CapturePoint {
  id: string
  name: string
  /** Normalized 0..1 position on the map image. */
  x: number
  y: number
}

export interface LayerInfo {
  id: string
  name: string
  mode: GameMode
  factions: [string, string]
  /** Lighting/time-of-day label as reported by the dataset (e.g. "Sunny Mid Day"). */
  time: string
  /** Per-layer minimap URL (capture points & lanes baked in). */
  image: string
  capturePoints?: CapturePoint[]
}

export interface MapInfo {
  id: string
  name: string
  /** Real-world size of the map square in metres (for the range/mortar tool). */
  sizeMeters: number
  layers: LayerInfo[]
}

// ---- Roster (Phase 3) ----

export interface RosterMember {
  id: string
  name: string
  role: string
}

export interface RosterSquad {
  id: string
  name: string
  team: Team
  /** Distinct squad color used to tint squad-specific markers on the board. */
  color: string
  members: RosterMember[]
}

// ---- Vehicle assignments (who crews/rides which asset) ----

export interface VehicleAssignment {
  id: string
  /** Vehicle asset id from the asset catalog (e.g. 'logi', 'ifv', 'mbt'). */
  assetId: string
  /** Optional custom label, e.g. "Armor 1". */
  name?: string
  /** Squads assigned to this vehicle. */
  squadIds: string[]
  /** Specific player nicks crewing this vehicle (dragged in). */
  crew?: string[]
  /** Free-form crew note / specific players. */
  note?: string
  /** Spawn / respawn timing note, e.g. "0:00 · resp 6:00". */
  timing?: string
}

// ---- Slides (multiple tactics on the same layer) ----

export interface Slide {
  id: string
  name: string
  elements: Record<string, BoardElement>
}

/** A per-map/layer board: its own set of slides. */
export interface BoardData {
  slides: Slide[]
  activeSlideId: string
}

// ---- Persisted board snapshot (Phase 4) ----

export interface BoardSnapshot {
  version: 1
  mapId: string | null
  layerId: string | null
  /** Optional user-supplied background image (data URL) used instead of a map layer. */
  customImage?: string | null
  customImageName?: string | null
  slides: Slide[]
  activeSlideId: string
  /** Cached per-map/layer boards so switching maps keeps each tactic separate. */
  boards?: Record<string, BoardData>
  activeKey?: string
  /** @deprecated legacy single-board field — read only for backward compatibility. */
  elements?: Record<string, BoardElement>
  squads: RosterSquad[]
  vehicles: VehicleAssignment[]
  /** Unassigned players pasted from sign-ups, waiting to be put into squads. */
  playerPool?: string[]
}
