import type { BoardElement } from '../types'
import type { CollabBoardPayload } from './collab'

/** Compact key for deduping outbound board sync (avoids full JSON.stringify). */
export function boardSyncFingerprint(board: CollabBoardPayload): string {
  const parts: string[] = [
    board.mapId ?? '',
    board.layerId ?? '',
    board.activeSlideId ?? '',
    board.activeKey ?? '',
    board.customImageName ?? '',
  ]
  const slide = board.slides?.find((s) => s.id === board.activeSlideId)
  if (slide) {
    const el = slide.elements ?? {}
    const revs = Object.keys(el)
      .sort()
      .map((id) => `${id}:${(el[id] as BoardElement).rev ?? 0}`)
      .join(',')
    parts.push(revs)
  }
  const tombs = board.elementTombstones ?? {}
  const tombKeys = Object.keys(tombs)
    .sort()
    .map((id) => `${id}:${tombs[id]}`)
    .join(',')
  if (tombKeys) parts.push('t:' + tombKeys)
  if (board.slides?.length) parts.push('n:' + board.slides.map((s) => s.id).join(','))
  return parts.join('|')
}

import type { CollabRosterPayload } from './collab'
import type { RosterSquad, VehicleAssignment } from '../types'

export function rosterSyncFingerprint(roster: CollabRosterPayload): string {
  const sq = roster.squads
    .map((s: RosterSquad) => `${s.id}:${s.members?.length ?? 0}`)
    .join(',')
  const vh = (roster.vehicles ?? []).map((v: VehicleAssignment) => v.id).join(',')
  return `${sq}|${vh}|${(roster.playerPool ?? []).join(';')}`
}

/** Light board payload: full elements on active slide only (inactive slides keep local drawings on merge). */
export function buildLightBoardPayload(
  board: CollabBoardPayload,
  activeElements: Record<string, BoardElement>,
): CollabBoardPayload {
  const activeId = board.activeSlideId
  const slides = (board.slides ?? []).map((sl) =>
    sl.id === activeId
      ? { ...sl, elements: activeElements }
      : { id: sl.id, name: sl.name, notes: sl.notes, elements: {} },
  )
  return { ...board, slides, light: true as const }
}

export function isStructuralBoardChange(prev: CollabBoardPayload | null, next: CollabBoardPayload): boolean {
  if (!prev) return true
  if (prev.mapId !== next.mapId || prev.layerId !== next.layerId) return true
  if (prev.customImage !== next.customImage) return true
  const prevIds = (prev.slides ?? []).map((s) => s.id).join(',')
  const nextIds = (next.slides ?? []).map((s) => s.id).join(',')
  if (prevIds !== nextIds) return true
  if ((prev.boards && Object.keys(prev.boards).length) !== (next.boards && Object.keys(next.boards).length)) return true
  return false
}
