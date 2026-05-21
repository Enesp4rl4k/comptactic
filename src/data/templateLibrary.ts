import type { Template } from '../lib/templates'
import type { BoardElement, RosterSquad, VehicleAssignment } from '../types'

// Built-in starter library: ready-made roster structures and tactical mark
// stamps so the Templates panel is useful out of the box. These are read-only
// (can't be deleted/renamed); applying them clones fresh content.

const COLORS = ['#60a5fa', '#34d399', '#fbbf24', '#f472b6', '#a78bfa', '#22d3ee']

function squad(n: number, name: string): RosterSquad {
  return { id: `b${n}`, name, team: 'blufor', color: COLORS[(n - 1) % COLORS.length], members: [] }
}
function vehicle(i: number, assetId: string, name: string): VehicleAssignment {
  return { id: `bv${i}`, assetId, name, squadIds: [], crew: [], timing: '' }
}

const icon = (assetId: string, x: number, y: number, color = '#3b82f6'): BoardElement =>
  ({ id: '', z: 0, type: 'icon', x, y, assetId, scale: 1, team: 'blufor', color, rotation: 0 }) as BoardElement

export const BUILTIN_TEMPLATES: Template[] = [
  // ---- Roster structures ----
  {
    id: 'builtin:roster-inf4',
    kind: 'roster',
    name: 'Standard Infantry — 4 squads',
    squads: [squad(1, 'Inf 1'), squad(2, 'Inf 2'), squad(3, 'Inf 3'), squad(4, 'Inf 4')],
    vehicles: [vehicle(1, 'logi', 'Logi 1'), vehicle(2, 'transport', 'Transport 1')],
    playerPool: [],
    createdAt: 0,
  },
  {
    id: 'builtin:roster-mech',
    kind: 'roster',
    name: 'Mechanized — 3 Inf + Armor',
    squads: [squad(1, 'Inf 1'), squad(2, 'Inf 2'), squad(3, 'Inf 3'), squad(4, 'Armor')],
    vehicles: [vehicle(1, 'mbt', 'MBT'), vehicle(2, 'ifv', 'IFV'), vehicle(3, 'logi', 'Logi 1'), vehicle(4, 'transport', 'Transport 1')],
    playerPool: [],
    createdAt: 0,
  },
  {
    id: 'builtin:roster-full',
    kind: 'roster',
    name: 'Full Stack — 6 squads',
    squads: [squad(1, 'Inf 1'), squad(2, 'Inf 2'), squad(3, 'Inf 3'), squad(4, 'Inf 4'), squad(5, 'Armor'), squad(6, 'Logi/CMD')],
    vehicles: [vehicle(1, 'mbt', 'MBT'), vehicle(2, 'ifv', 'IFV'), vehicle(3, 'apc', 'APC'), vehicle(4, 'logi', 'Logi 1'), vehicle(5, 'transport', 'Transport 1')],
    playerPool: [],
    createdAt: 0,
  },

  // ---- Mark stamps (recentered on the map when placed) ----
  {
    id: 'builtin:stamp-fob',
    kind: 'stamp',
    name: 'Defensive FOB (radio + 2 HAB)',
    elements: [icon('fob', 512, 512), icon('hab', 452, 472), icon('hab', 572, 472)],
    createdAt: 0,
  },
  {
    id: 'builtin:stamp-armor-stage',
    kind: 'stamp',
    name: 'Armor staging (MBT · IFV · APC)',
    elements: [icon('mbt', 470, 512, '#ef4444'), icon('ifv', 512, 512, '#ef4444'), icon('apc', 554, 512, '#ef4444')],
    createdAt: 0,
  },
  {
    id: 'builtin:stamp-logi',
    kind: 'stamp',
    name: 'Logistics run (2 Logi + Transport)',
    elements: [icon('logi', 488, 512), icon('logi', 524, 512), icon('transport', 560, 512)],
    createdAt: 0,
  },
]

export const isBuiltin = (id: string) => id.startsWith('builtin:')
