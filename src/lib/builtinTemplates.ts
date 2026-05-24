import { nanoid } from 'nanoid'
import type { RosterTemplate, StampTemplate } from './templates'
const SQUAD_COLORS = [
  '#60a5fa', '#34d399', '#fbbf24', '#f472b6', '#a78bfa',
  '#22d3ee', '#fb923c', '#a3e635', '#e879f9', '#f87171',
]

const now = Date.now()

function emptySquads(count: number, prefix = 'Squad') {
  return Array.from({ length: count }, (_, i) => ({
    id: nanoid(6),
    name: `${prefix} ${i + 1}`,
    team: 'blufor' as const,
    color: SQUAD_COLORS[i % SQUAD_COLORS.length]!,
    members: [
      { id: nanoid(6), name: '', role: 'sl' },
      { id: nanoid(6), name: '', role: 'medic' },
      ...Array.from({ length: 7 }, () => ({ id: nanoid(6), name: '', role: 'rifleman' })),
    ],
  }))
}

export const BUILTIN_ROSTERS: RosterTemplate[] = [
  {
    id: 'builtin-9sq',
    kind: 'roster',
    name: '9 squads · BLUFOR (empty)',
    squads: emptySquads(9),
    vehicles: [],
    playerPool: [],
    createdAt: now,
  },
  {
    id: 'builtin-6sq',
    kind: 'roster',
    name: '6 squads · BLUFOR (empty)',
    squads: emptySquads(6),
    vehicles: [],
    playerPool: [],
    createdAt: now,
  },
]

export const BUILTIN_STAMPS: StampTemplate[] = []

export function allBuiltinTemplates(): (RosterTemplate | StampTemplate)[] {
  return [...BUILTIN_ROSTERS, ...BUILTIN_STAMPS]
}
