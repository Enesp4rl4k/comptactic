// Catalog of placeable comp components. Icons are rendered procedurally on the
// canvas (emoji glyph + colored badge) so no external image files are required;
// swapping to SVG sprites later only touches the IconElement renderer.

export type AssetCategory = 'deployable' | 'vehicle' | 'infantry' | 'marker'

export interface AssetDef {
  id: string
  name: string
  category: AssetCategory
  glyph: string
  /** Default badge shape. */
  shape: 'circle' | 'square' | 'diamond'
  /** If true, the icon adopts the active team color; otherwise uses `fixedColor`. */
  teamColored: boolean
  fixedColor?: string
}

export const ASSETS: AssetDef[] = [
  // --- Deployables / FOB infrastructure ---
  { id: 'fob', name: 'FOB Radio', category: 'deployable', glyph: '📻', shape: 'square', teamColored: true },
  { id: 'hab', name: 'HAB', category: 'deployable', glyph: '🏠', shape: 'square', teamColored: true },
  { id: 'repair', name: 'Repair Station', category: 'deployable', glyph: '🔧', shape: 'square', teamColored: true },
  { id: 'ammo', name: 'Ammo Crate', category: 'deployable', glyph: '📦', shape: 'square', teamColored: true },
  { id: 'mortar', name: 'Mortar', category: 'deployable', glyph: '🧨', shape: 'circle', teamColored: true },
  { id: 'hmg', name: 'HMG Emplacement', category: 'deployable', glyph: '🔫', shape: 'circle', teamColored: true },
  { id: 'tow', name: 'TOW / ATGM', category: 'deployable', glyph: '🚀', shape: 'circle', teamColored: true },
  { id: 'hasco', name: 'HASCO Wall', category: 'deployable', glyph: '🧱', shape: 'square', teamColored: true },
  { id: 'sandbag', name: 'Sandbags', category: 'deployable', glyph: '⛰️', shape: 'square', teamColored: true },
  { id: 'razorwire', name: 'Razor Wire', category: 'deployable', glyph: '🌵', shape: 'square', teamColored: true },

  // --- Vehicles ---
  { id: 'logi', name: 'Logistics Truck', category: 'vehicle', glyph: '🚚', shape: 'diamond', teamColored: true },
  { id: 'transport', name: 'Transport Truck', category: 'vehicle', glyph: '🚛', shape: 'diamond', teamColored: true },
  { id: 'mrap', name: 'MRAP / Jeep', category: 'vehicle', glyph: '🚙', shape: 'diamond', teamColored: true },
  { id: 'apc', name: 'APC', category: 'vehicle', glyph: '🛻', shape: 'diamond', teamColored: true },
  { id: 'ifv', name: 'IFV', category: 'vehicle', glyph: '🚜', shape: 'diamond', teamColored: true },
  { id: 'mbt', name: 'Main Battle Tank', category: 'vehicle', glyph: '🛡️', shape: 'diamond', teamColored: true },
  { id: 'heli_trans', name: 'Transport Heli', category: 'vehicle', glyph: '🚁', shape: 'diamond', teamColored: true },
  { id: 'heli_atk', name: 'Attack Heli', category: 'vehicle', glyph: '🚁', shape: 'diamond', teamColored: true },
  { id: 'boat', name: 'Boat / RHIB', category: 'vehicle', glyph: '🚤', shape: 'diamond', teamColored: true },

  // --- Infantry / squads ---
  { id: 'squad', name: 'Squad', category: 'infantry', glyph: '👥', shape: 'circle', teamColored: true },
  { id: 'sl', name: 'Squad Leader', category: 'infantry', glyph: '⭐', shape: 'circle', teamColored: true },
  { id: 'inf_at', name: 'AT Team', category: 'infantry', glyph: '🚀', shape: 'circle', teamColored: true },
  { id: 'inf_mg', name: 'MG Team', category: 'infantry', glyph: '🔫', shape: 'circle', teamColored: true },
  { id: 'inf_sniper', name: 'Sniper', category: 'infantry', glyph: '🎯', shape: 'circle', teamColored: true },

  // --- Tactical markers (fixed colors, intent-based) ---
  { id: 'attack', name: 'Attack', category: 'marker', glyph: '⚔️', shape: 'diamond', teamColored: false, fixedColor: '#ef4444' },
  { id: 'defend', name: 'Defend', category: 'marker', glyph: '🛡️', shape: 'diamond', teamColored: false, fixedColor: '#22c55e' },
  { id: 'objective', name: 'Objective', category: 'marker', glyph: '🚩', shape: 'diamond', teamColored: false, fixedColor: '#eab308' },
  { id: 'rally', name: 'Rally Point', category: 'marker', glyph: '🟢', shape: 'circle', teamColored: false, fixedColor: '#16a34a' },
  { id: 'enemy', name: 'Enemy Spotted', category: 'marker', glyph: '❗', shape: 'diamond', teamColored: false, fixedColor: '#f97316' },
  { id: 'overwatch', name: 'Overwatch', category: 'marker', glyph: '👁️', shape: 'diamond', teamColored: false, fixedColor: '#a855f7' },
]

export const ASSET_BY_ID = Object.fromEntries(ASSETS.map((a) => [a.id, a]))

export const CATEGORY_LABELS: Record<AssetCategory, string> = {
  deployable: 'Deployables',
  vehicle: 'Araçlar',
  infantry: 'Piyade / Squad',
  marker: 'Markerlar',
}
