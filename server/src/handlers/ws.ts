import type { WebSocket } from 'ws'
import * as roomStore from '../roomStore.js'
import * as syncStore from '../syncStore.js'
import {
  broadcastRoomUpdate,
  broadcastSyncUpdate,
  parseClientMessage,
  sendError,
  subscribeRoom,
  subscribeSync,
} from '../wsHub.js'

export function handleWsMessage(ws: WebSocket, raw: string): void {
  const message = parseClientMessage(raw)
  if (!message) {
    sendError(ws, 'invalid_message', 'Invalid JSON message')
    return
  }

  switch (message.type) {
    case 'subscribe_room': {
      const room = roomStore.getRoom(message.roomId)
      if (!room) {
        sendError(ws, 'room_not_found', 'Room not found')
        return
      }
      subscribeRoom(message.roomId, ws)
      ws.send(JSON.stringify({ type: 'room_updated', room }))
      break
    }
    case 'subscribe_sync': {
      subscribeSync(message.roomId, ws)
      const sync = syncStore.getSync(message.roomId)
      if (sync) {
        ws.send(JSON.stringify({ type: 'sync_updated', state: sync }))
      }
      break
    }
    case 'init_sync': {
      const room = roomStore.getRoom(message.roomId)
      if (!room) {
        sendError(ws, 'room_not_found', 'Room not found')
        return
      }
      const state = syncStore.initSync(message.roomId, message.shuffleSeed)
      broadcastSyncUpdate(state)
      break
    }
    case 'publish': {
      const state = syncStore.publishSync(message.roomId, message.payload)
      if (!state) {
        sendError(ws, 'publish_failed', 'Failed to apply publish action')
        return
      }
      broadcastSyncUpdate(state)
      break
    }
    default:
      sendError(ws, 'unknown_type', 'Unknown message type')
  }
}

export { broadcastRoomUpdate }
