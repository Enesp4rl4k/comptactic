import type { CollabRosterPayload } from './collab'
import type { RosterMember, RosterSquad, VehicleAssignment } from '../types'

function mergeMembers(local: RosterMember[], remote: RosterMember[]): RosterMember[] {
  const byId = new Map(local.map((m) => [m.id, m]))
  for (const rm of remote) {
    const lm = byId.get(rm.id)
    byId.set(rm.id, lm ? { ...lm, ...rm } : rm)
  }
  const remoteIds = new Set(remote.map((m) => m.id))
  const order = [...remote.map((m) => m.id), ...local.filter((m) => !remoteIds.has(m.id)).map((m) => m.id)]
  const seen = new Set<string>()
  const out: RosterMember[] = []
  for (const id of order) {
    if (seen.has(id)) continue
    seen.add(id)
    const m = byId.get(id)
    if (m) out.push(m)
  }
  return out
}

function mergeSquads(local: RosterSquad[], remote: RosterSquad[]): RosterSquad[] {
  const byId = new Map(local.map((s) => [s.id, s]))
  for (const rs of remote) {
    const ls = byId.get(rs.id)
    byId.set(
      rs.id,
      ls
        ? {
            ...ls,
            ...rs,
            members: mergeMembers(ls.members, rs.members),
          }
        : rs,
    )
  }
  const remoteIds = new Set(remote.map((s) => s.id))
  const order = [...remote.map((s) => s.id), ...local.filter((s) => !remoteIds.has(s.id)).map((s) => s.id)]
  const seen = new Set<string>()
  const out: RosterSquad[] = []
  for (const id of order) {
    if (seen.has(id)) continue
    seen.add(id)
    const s = byId.get(id)
    if (s) out.push(s)
  }
  return out
}

function mergeVehicles(local: VehicleAssignment[], remote: VehicleAssignment[]): VehicleAssignment[] {
  const byId = new Map(local.map((v) => [v.id, v]))
  for (const rv of remote) {
    const lv = byId.get(rv.id)
    if (!lv) byId.set(rv.id, rv)
    else {
      const crew = [...new Set([...(lv.crew ?? []), ...(rv.crew ?? [])])]
      const squadIds = [...new Set([...lv.squadIds, ...rv.squadIds])]
      byId.set(rv.id, { ...lv, ...rv, crew, squadIds })
    }
  }
  const remoteIds = new Set(remote.map((v) => v.id))
  const order = [...remote.map((v) => v.id), ...local.filter((v) => !remoteIds.has(v.id)).map((v) => v.id)]
  const seen = new Set<string>()
  const out: VehicleAssignment[] = []
  for (const id of order) {
    if (seen.has(id)) continue
    seen.add(id)
    const v = byId.get(id)
    if (v) out.push(v)
  }
  return out
}

/** Merge roster edits from a collaborator without wiping local-only squads/vehicles. */
export function mergeRosterPayload(local: CollabRosterPayload, remote: CollabRosterPayload): CollabRosterPayload {
  const pool = [...new Set([...(local.playerPool ?? []), ...(remote.playerPool ?? [])])]
  return {
    squads: mergeSquads(local.squads, remote.squads),
    vehicles: mergeVehicles(local.vehicles ?? [], remote.vehicles ?? []),
    playerPool: pool,
  }
}
