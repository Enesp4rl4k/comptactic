// Catalog of placeable comp components.
// Real in-game Squad map icons (SVG) live under /public/icons/{variant}/{category}/<file>.svg
// where variant = blue (BLUFOR) | red (OPFOR/enemy) | default (neutral).
// Icons are sourced from SquadCalc (sh4rkman/SquadCalc, MIT non-commercial),
// originally from the Squad SDK by Offworld Industries — used for non-commercial
// community tooling. `glyph` stays as a fallback for items without a vector icon.

export type AssetCategory = 'deployable' | 'vehicle' | 'infantry'

export interface AssetDef {
  id: string
  name: string
  category: AssetCategory
  glyph: string
  /** Vector icon path relative to /icons/{variant}/, e.g. 'vehicles/map_tank'. */
  icon?: string
  /** Default badge shape (used only as a glyph fallback). */
  shape: 'circle' | 'square' | 'diamond'
  teamColored: boolean
  fixedColor?: string
}

export const ASSETS: AssetDef[] = [
  // --- Deployables / FOB infrastructure ---
  { id: 'fob', name: 'FOB Radio', category: 'deployable', glyph: '📻', icon: 'deployables/deployable_fob', shape: 'square', teamColored: true },
  { id: 'hab', name: 'HAB', category: 'deployable', glyph: '🏠', icon: 'deployables/deployable_hab', shape: 'square', teamColored: true },
  { id: 'repair', name: 'Repair Station', category: 'deployable', glyph: '🔧', icon: 'deployables/deployable_repairstation', shape: 'square', teamColored: true },
  { id: 'ammo', name: 'Ammo Crate', category: 'deployable', glyph: '📦', icon: 'deployables/deployable_ammocrate', shape: 'square', teamColored: true },
  { id: 'mortar', name: 'Mortar', category: 'deployable', glyph: '🧨', icon: 'deployables/deployable_mortars', shape: 'circle', teamColored: true },
  { id: 'hmg', name: 'HMG Emplacement', category: 'deployable', glyph: '🔫', icon: 'deployables/deployable_HMG', shape: 'circle', teamColored: true },
  { id: 'tow', name: 'TOW / ATGM', category: 'deployable', glyph: '🚀', icon: 'deployables/deployable_anti_tank_gun', shape: 'circle', teamColored: true },
  { id: 'helipad', name: 'Helipad', category: 'deployable', glyph: '🚁', icon: 'deployables/deployable_helipad', shape: 'square', teamColored: true },
  { id: 'rally', name: 'Rally Point', category: 'deployable', glyph: '🟢', icon: 'deployables/rallypoint', shape: 'circle', teamColored: true },

  // --- Vehicles ---
  { id: 'logi', name: 'Logistics Truck', category: 'vehicle', glyph: '🚚', icon: 'vehicles/map_truck_logistics', shape: 'diamond', teamColored: true },
  { id: 'transport', name: 'Transport Truck', category: 'vehicle', glyph: '🚛', icon: 'vehicles/map_truck_transport', shape: 'diamond', teamColored: true },
  { id: 'mrap', name: 'MRAP / Jeep', category: 'vehicle', glyph: '🚙', icon: 'vehicles/map_jeep', shape: 'diamond', teamColored: true },
  { id: 'apc', name: 'APC', category: 'vehicle', glyph: '🛻', icon: 'vehicles/map_apc', shape: 'diamond', teamColored: true },
  { id: 'ifv', name: 'IFV', category: 'vehicle', glyph: '🚜', icon: 'vehicles/map_ifv', shape: 'diamond', teamColored: true },
  { id: 'mbt', name: 'Main Battle Tank', category: 'vehicle', glyph: '🛡️', icon: 'vehicles/map_tank', shape: 'diamond', teamColored: true },
  { id: 'heli_trans', name: 'Transport Heli', category: 'vehicle', glyph: '🚁', icon: 'vehicles/map_transporthelo', shape: 'diamond', teamColored: true },
  { id: 'heli_atk', name: 'Attack Heli', category: 'vehicle', glyph: '🚁', icon: 'vehicles/map_attackhelo', shape: 'diamond', teamColored: true },
  { id: 'boat', name: 'Boat / RHIB', category: 'vehicle', glyph: '🚤', icon: 'vehicles/map_boat', shape: 'diamond', teamColored: true },

  // --- Infantry / squads ---
  { id: 'squad', name: 'Squad', category: 'infantry', glyph: '👥', icon: 'infantry/map_genericinfantry', shape: 'circle', teamColored: true },
  { id: 'inf_lat', name: 'LAT', category: 'infantry', glyph: '🚀', icon: 'infantry/map_lat', shape: 'circle', teamColored: true },
  { id: 'inf_hat', name: 'HAT', category: 'infantry', glyph: '🚀', icon: 'infantry/map_hat', shape: 'circle', teamColored: true },
  { id: 'inf_mg', name: 'MG Team', category: 'infantry', glyph: '🔫', icon: 'infantry/map_infmg', shape: 'circle', teamColored: true },
  { id: 'inf_sniper', name: 'Marksman / Sniper', category: 'infantry', glyph: '🎯', icon: 'infantry/map_marksmansniper', shape: 'circle', teamColored: true },
]

export const ASSET_BY_ID = Object.fromEntries(ASSETS.map((a) => [a.id, a]))

/** Resolve the icon URL for an asset given the placing team. */
export function iconUrl(asset: AssetDef | undefined, team: 'blufor' | 'opfor' | 'neutral'): string | null {
  if (!asset?.icon) return null
  const variant = team === 'opfor' ? 'red' : team === 'neutral' ? 'default' : 'blue'
  return `/icons/${variant}/${asset.icon}.svg`
}

export const CATEGORY_LABELS: Record<AssetCategory, string> = {
  infantry: 'Infantry / Squad',
  deployable: 'Deployables',
  vehicle: 'Vehicles',
}
