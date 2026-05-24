/** Who may change the tactic board in a live room. */
export type RoomRole = 'editor' | 'viewer'

export interface RoomPolicy {
  roomId: string
  hostId: string
  /** Role assigned to newcomers until the host changes it. */
  defaultRole: RoomRole
  memberRoles: Record<string, RoomRole>
  version: number
}

const key = (roomId: string) => `ct:room-policy:${roomId}`

export function loadRoomPolicy(roomId: string): RoomPolicy | null {
  try {
    const raw = localStorage.getItem(key(roomId))
    if (!raw) return null
    return JSON.parse(raw) as RoomPolicy
  } catch {
    return null
  }
}

export function saveRoomPolicy(policy: RoomPolicy) {
  localStorage.setItem(key(policy.roomId), JSON.stringify(policy))
}

export function createDefaultPolicy(roomId: string, hostId: string): RoomPolicy {
  return {
    roomId,
    hostId,
    defaultRole: 'viewer',
    memberRoles: { [hostId]: 'editor' },
    version: Date.now(),
  }
}

export function roleForMember(policy: RoomPolicy | null, memberId: string, isHost: boolean): RoomRole {
  if (isHost) return 'editor'
  if (!policy) return 'viewer'
  if (memberId === policy.hostId) return 'editor'
  return policy.memberRoles[memberId] ?? policy.defaultRole
}
