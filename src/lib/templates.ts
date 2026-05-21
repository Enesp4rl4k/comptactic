import { nanoid } from 'nanoid'
import type { BoardElement, RosterSquad, VehicleAssignment } from '../types'

// Reusable templates stored locally: element "stamps" (groups of marks) and
// roster setups (squads + vehicles + player pool). Persisted in localStorage.

export interface StampTemplate {
  id: string
  kind: 'stamp'
  name: string
  elements: BoardElement[]
  createdAt: number
}

export interface RosterTemplate {
  id: string
  kind: 'roster'
  name: string
  squads: RosterSquad[]
  vehicles: VehicleAssignment[]
  playerPool: string[]
  createdAt: number
}

export type Template = StampTemplate | RosterTemplate

const KEY = 'comptactic:templates'

export function loadTemplates(): Template[] {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as Template[]) : []
  } catch {
    return []
  }
}

function save(list: Template[]) {
  localStorage.setItem(KEY, JSON.stringify(list))
}

export function saveStamp(name: string, elements: BoardElement[]): Template[] {
  const list = loadTemplates()
  const tpl: StampTemplate = { id: nanoid(8), kind: 'stamp', name, elements: structuredClone(elements), createdAt: Date.now() }
  const next = [tpl, ...list]
  save(next)
  return next
}

export function saveRoster(
  name: string,
  squads: RosterSquad[],
  vehicles: VehicleAssignment[],
  playerPool: string[],
): Template[] {
  const list = loadTemplates()
  const tpl: RosterTemplate = {
    id: nanoid(8),
    kind: 'roster',
    name,
    squads: structuredClone(squads),
    vehicles: structuredClone(vehicles),
    playerPool: [...playerPool],
    createdAt: Date.now(),
  }
  const next = [tpl, ...list]
  save(next)
  return next
}

export function deleteTemplate(id: string): Template[] {
  const next = loadTemplates().filter((t) => t.id !== id)
  save(next)
  return next
}
