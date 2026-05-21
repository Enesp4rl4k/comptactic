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
  | 'text'
  | 'measure'

export type ElementType =
  | 'arrow'
  | 'line'
  | 'pen'
  | 'measure'
  | 'rect'
  | 'circle'
  | 'text'
  | 'icon'

interface ElementBase {
  id: string
  type: ElementType
  z: number
  team: Team
  color: string
  rotation: number
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
  time: 'Day' | 'Night' | 'Dusk' | 'Dawn'
  capturePoints?: CapturePoint[]
}

export interface MapInfo {
  id: string
  name: string
  /** Path under /public, e.g. /maps/yehorivka.jpg */
  image: string
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
  members: RosterMember[]
}

// ---- Persisted board snapshot (Phase 4) ----

export interface BoardSnapshot {
  version: 1
  mapId: string | null
  layerId: string | null
  elements: Record<string, BoardElement>
  squads: RosterSquad[]
}
