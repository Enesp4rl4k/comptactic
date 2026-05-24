import type { BoardElement, Slide } from '../types'

/** Per-element last-write-wins using monotonic `rev` counters. */
export function mergeElementMaps(
  local: Record<string, BoardElement>,
  remote: Record<string, BoardElement>,
  tombstones: Record<string, number> = {},
): Record<string, BoardElement> {
  const out: Record<string, BoardElement> = { ...local }

  for (const [id, rel] of Object.entries(remote)) {
    const loc = local[id]
    const tomb = tombstones[id] ?? 0
    const locRev = loc?.rev ?? 0
    if (tomb > locRev) {
      delete out[id]
      continue
    }
    if (!loc || (rel.rev ?? 0) >= locRev) out[id] = rel
  }

  for (const [id, tomb] of Object.entries(tombstones)) {
    const loc = out[id]
    if (loc && tomb > (loc.rev ?? 0)) delete out[id]
  }

  return out
}

export function mergeSlides(
  local: Slide[],
  remote: Slide[],
  tombstones: Record<string, number> = {},
): Slide[] {
  const localById = Object.fromEntries(local.map((s) => [s.id, s]))
  const remoteIds = new Set(remote.map((s) => s.id))
  const merged: Slide[] = []

  for (const rs of remote) {
    const ls = localById[rs.id]
    merged.push({
      ...rs,
      elements: ls ? mergeElementMaps(ls.elements, rs.elements, tombstones) : rs.elements,
    })
  }

  for (const ls of local) {
    if (!remoteIds.has(ls.id)) merged.push(ls)
  }

  return merged
}

export function bumpRev(el: BoardElement): BoardElement {
  return { ...el, rev: (el.rev ?? 0) + 1 }
}
