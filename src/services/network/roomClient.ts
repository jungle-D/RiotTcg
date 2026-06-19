import type { DeckSnapshot, OnlineRoom } from '@shared/roomTypes'
import type { DeckState } from '../../types/cards'
import { deckToSnapshot, snapshotToDeck } from '../roomService'
import { apiFetch, gameWebSocket } from './wsClient'

export type CreateOnlineRoomResult =
  | { ok: true; roomId: string }
  | { ok: false; reason: 'write_failed' | 'room_exists' }

export type JoinOnlineRoomResult =
  | {
      ok: true
      role: 'guest'
      hostDeck: DeckState
      guestDeck: DeckState
    }
  | { ok: false; reason: 'not_found' | 'already_joined' | 'network_error' }

export async function createOnlineRoom(
  roomId: string,
  hostDeck: DeckState,
  hostClientId: string,
): Promise<CreateOnlineRoomResult> {
  try {
    const result = await apiFetch<{ roomId: string }>('/api/rooms', {
      method: 'POST',
      body: JSON.stringify({
        roomId,
        hostDeck: deckToSnapshot(hostDeck),
        hostClientId,
      }),
    })
    return { ok: true, roomId: result.roomId }
  } catch (error) {
    if (error instanceof Error && error.message === 'room_exists') {
      return { ok: false, reason: 'room_exists' }
    }
    return { ok: false, reason: 'write_failed' }
  }
}

export async function joinOnlineRoom(
  roomId: string,
  guestDeck: DeckState,
  guestClientId: string,
): Promise<JoinOnlineRoomResult> {
  try {
    const result = await apiFetch<{
      role: 'guest'
      hostDeck: DeckSnapshot
      guestDeck: DeckSnapshot
    }>(`/api/rooms/${encodeURIComponent(roomId.trim())}/join`, {
      method: 'POST',
      body: JSON.stringify({
        guestDeck: deckToSnapshot(guestDeck),
        guestClientId,
      }),
    })
    return {
      ok: true,
      role: result.role,
      hostDeck: snapshotToDeck(result.hostDeck),
      guestDeck: snapshotToDeck(result.guestDeck),
    }
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'not_found') {
        return { ok: false, reason: 'not_found' }
      }
      if (error.message === 'already_joined') {
        return { ok: false, reason: 'already_joined' }
      }
    }
    return { ok: false, reason: 'network_error' }
  }
}

export async function fetchOnlineRoom(roomId: string): Promise<OnlineRoom | null> {
  try {
    return await apiFetch<OnlineRoom>(`/api/rooms/${encodeURIComponent(roomId.trim())}`)
  } catch {
    return null
  }
}

export async function resolveOnlineRole(
  roomId: string,
  clientId: string,
): Promise<'host' | 'guest' | null> {
  try {
    const result = await apiFetch<{ role: 'host' | 'guest' }>(
      `/api/rooms/${encodeURIComponent(roomId.trim())}/role/${encodeURIComponent(clientId)}`,
    )
    return result.role
  } catch {
    return null
  }
}

export async function deleteOnlineRoom(roomId: string): Promise<void> {
  try {
    await apiFetch(`/api/rooms/${encodeURIComponent(roomId.trim())}`, {
      method: 'DELETE',
    })
  } catch {
    // ignore
  }
}

export function subscribeRoomUpdates(
  roomId: string,
  clientId: string,
  onUpdate: (room: OnlineRoom) => void,
): () => void {
  void gameWebSocket.connect()
  const unsubscribe = gameWebSocket.subscribe((message) => {
    if (message.type === 'room_updated' && message.room.roomId === roomId.trim()) {
      onUpdate(message.room)
    }
  })
  gameWebSocket.send({ type: 'subscribe_room', roomId: roomId.trim(), clientId })
  return unsubscribe
}

export async function hydrateSessionFromRoom(
  roomId: string,
  clientId: string,
  playerDeck: DeckState,
): Promise<{
  role: 'host' | 'guest'
  playerDeck: DeckState
  opponentDeck: DeckState
} | null> {
  const room = await fetchOnlineRoom(roomId)
  if (!room) {
    return null
  }
  const role = room.hostClientId === clientId ? 'host' : room.guestClientId === clientId ? 'guest' : null
  if (!role || !room.guestDeck) {
    return null
  }
  const hostDeck = snapshotToDeck(room.hostDeck)
  const guestDeck = snapshotToDeck(room.guestDeck)
  return {
    role,
    playerDeck: role === 'host' ? hostDeck : playerDeck,
    opponentDeck: role === 'host' ? guestDeck : hostDeck,
  }
}
