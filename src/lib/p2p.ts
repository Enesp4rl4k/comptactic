import { joinRoom, type Room } from '@trystero-p2p/torrent'

let activeRoomId: string | null = null
let currentRoom: Room | null = null
let refCount = 0

/**
 * Returns a shared WebRTC P2P Room instance for the specified roomId.
 * Multiple modules (collab and presence) share the same underlying peer connections.
 */
export function getP2PRoom(roomId: string): Room {
  if (currentRoom && activeRoomId === roomId) {
    refCount++
    return currentRoom
  }
  if (currentRoom) {
    try {
      void currentRoom.leave()
    } catch {
      // ignore
    }
  }
  activeRoomId = roomId
  refCount = 1
  currentRoom = joinRoom({ appId: 'comptactic-app' }, roomId)
  return currentRoom
}

/**
 * Releases the shared room reference. When all consumers stop, leaves the room.
 */
export function releaseP2PRoom(roomId: string): void {
  if (activeRoomId === roomId) {
    refCount--
    if (refCount <= 0) {
      try {
        void currentRoom?.leave()
      } catch {
        // ignore
      }
      currentRoom = null
      activeRoomId = null
      refCount = 0
    }
  }
}
