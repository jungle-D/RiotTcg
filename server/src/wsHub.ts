import type { WebSocket } from 'ws'
import type { OnlineRoom } from '../../shared/roomTypes.js'
import type { RoomGameSyncState } from '../../shared/gameSyncTypes.js'
import type { ClientMessage, ServerMessage } from '../../shared/wsMessages.js'

const roomSubscribers = new Map<string, Set<WebSocket>>()
const syncSubscribers = new Map<string, Set<WebSocket>>()

function getOrCreateSet(map: Map<string, Set<WebSocket>>, key: string): Set<WebSocket> {
  let set = map.get(key)
  if (!set) {
    set = new Set()
    map.set(key, set)
  }
  return set
}

function send(ws: WebSocket, message: ServerMessage): void {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(message))
  }
}

export function subscribeRoom(roomId: string, ws: WebSocket): void {
  getOrCreateSet(roomSubscribers, roomId.trim()).add(ws)
}

export function subscribeSync(roomId: string, ws: WebSocket): void {
  getOrCreateSet(syncSubscribers, roomId.trim()).add(ws)
}

export function unsubscribeAll(ws: WebSocket): void {
  for (const set of roomSubscribers.values()) {
    set.delete(ws)
  }
  for (const set of syncSubscribers.values()) {
    set.delete(ws)
  }
}

export function broadcastRoomUpdate(room: OnlineRoom): void {
  const set = roomSubscribers.get(room.roomId)
  if (!set) {
    return
  }
  const message: ServerMessage = { type: 'room_updated', room }
  for (const ws of set) {
    send(ws, message)
  }
}

export function broadcastSyncUpdate(state: RoomGameSyncState): void {
  const set = syncSubscribers.get(state.roomId)
  if (!set) {
    return
  }
  const message: ServerMessage = { type: 'sync_updated', state }
  for (const ws of set) {
    send(ws, message)
  }
}

export function sendError(ws: WebSocket, code: string, message: string): void {
  send(ws, { type: 'error', code, message })
}

export function parseClientMessage(raw: string): ClientMessage | null {
  try {
    return JSON.parse(raw) as ClientMessage
  } catch {
    return null
  }
}
