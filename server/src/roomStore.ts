import type { OnlineRoom } from '../../shared/roomTypes.js'
import type { DeckSnapshot } from '../../shared/roomTypes.js'

const ROOM_TTL_MS = 2 * 60 * 60 * 1000

const rooms = new Map<string, OnlineRoom>()

function normalizeRoomId(roomId: string): string {
  return roomId.trim()
}

function isExpired(room: OnlineRoom): boolean {
  return Date.now() - room.createdAt > ROOM_TTL_MS
}

function purgeExpired(): void {
  for (const [id, room] of rooms) {
    if (isExpired(room)) {
      rooms.delete(id)
    }
  }
}

export function createRoom(roomId: string, hostDeck: DeckSnapshot, hostClientId: string): OnlineRoom | null {
  purgeExpired()
  const id = normalizeRoomId(roomId)
  if (rooms.has(id)) {
    return null
  }
  const room: OnlineRoom = {
    roomId: id,
    hostDeck,
    guestDeck: null,
    hostClientId,
    guestClientId: null,
    createdAt: Date.now(),
  }
  rooms.set(id, room)
  return room
}

export type JoinResult =
  | { ok: true; room: OnlineRoom; role: 'guest' }
  | { ok: false; reason: 'not_found' | 'already_joined' }

export function joinRoom(
  roomId: string,
  guestDeck: DeckSnapshot,
  guestClientId: string,
): JoinResult {
  purgeExpired()
  const id = normalizeRoomId(roomId)
  const room = rooms.get(id)
  if (!room || isExpired(room)) {
    rooms.delete(id)
    return { ok: false, reason: 'not_found' }
  }
  if (room.guestDeck) {
    return { ok: false, reason: 'already_joined' }
  }
  const updated: OnlineRoom = {
    ...room,
    guestDeck,
    guestClientId,
  }
  rooms.set(id, updated)
  return { ok: true, room: updated, role: 'guest' }
}

export function getRoom(roomId: string): OnlineRoom | null {
  purgeExpired()
  const id = normalizeRoomId(roomId)
  const room = rooms.get(id)
  if (!room || isExpired(room)) {
    rooms.delete(id)
    return null
  }
  return room
}

export function deleteRoom(roomId: string): boolean {
  return rooms.delete(normalizeRoomId(roomId))
}

export function resolveRole(roomId: string, clientId: string): 'host' | 'guest' | null {
  const room = getRoom(roomId)
  if (!room) {
    return null
  }
  if (room.hostClientId === clientId) {
    return 'host'
  }
  if (room.guestClientId === clientId) {
    return 'guest'
  }
  return null
}

setInterval(purgeExpired, 60_000)
