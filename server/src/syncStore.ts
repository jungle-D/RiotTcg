import { createEmptySync } from '../../shared/gameSyncTypes.js'
import type { RoomGameSyncState } from '../../shared/gameSyncTypes.js'
import { applyPublishPayload } from '../../shared/syncMerge.js'
import type { PublishPayload } from '../../shared/wsMessages.js'

const syncByRoom = new Map<string, RoomGameSyncState>()

export function getSync(roomId: string): RoomGameSyncState | null {
  return syncByRoom.get(roomId.trim()) ?? null
}

export function initSync(roomId: string, shuffleSeed: string): RoomGameSyncState {
  const trimmed = roomId.trim()
  const existing = syncByRoom.get(trimmed)
  if (existing) {
    return existing
  }
  const state = createEmptySync(trimmed, shuffleSeed)
  syncByRoom.set(trimmed, state)
  return state
}

export function clearSync(roomId: string): void {
  syncByRoom.delete(roomId.trim())
}

export function publishSync(roomId: string, payload: PublishPayload): RoomGameSyncState | null {
  const trimmed = roomId.trim()
  const current = syncByRoom.get(trimmed)
  if (!current) {
    return null
  }

  if (payload.action === 'diceRoll') {
    if (current.diceRollGeneration !== payload.generation) {
      return null
    }
    if (payload.role === 'host' && current.hostDice !== null) {
      return current
    }
    if (payload.role === 'guest' && current.guestDice !== null) {
      return current
    }
  }

  const updated = applyPublishPayload(current, payload)
  if (!updated) {
    return null
  }

  const merged: RoomGameSyncState = {
    ...updated,
    updatedAt: Date.now(),
    version: current.version + 1,
  }
  syncByRoom.set(trimmed, merged)
  return merged
}
