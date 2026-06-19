import type { PublishPayload } from '@shared/wsMessages'
import type { PlayerRole, RoomGameSyncState } from '@shared/gameSyncTypes'
import { generateShuffleSeed } from '@shared/gameSyncTypes'
import type { RuneColor } from '@shared/runeColors'
import type { GameCardInstance, ZoneId } from '../../types/game'
import { apiFetch, gameWebSocket } from './wsClient'

const syncCache = new Map<string, RoomGameSyncState>()
const syncListeners = new Map<string, Set<(state: RoomGameSyncState) => void>>()
const activeSyncRooms = new Set<string>()
let globalWsSubscribed = false

function notifySync(roomId: string, state: RoomGameSyncState): void {
  syncCache.set(roomId.trim(), state)
  const listeners = syncListeners.get(roomId.trim())
  if (!listeners) {
    return
  }
  for (const listener of listeners) {
    listener(state)
  }
}

function resubscribeAllSyncRooms(): void {
  for (const roomId of activeSyncRooms) {
    gameWebSocket.send({ type: 'subscribe_sync', roomId })
  }
}

function ensureGlobalSubscription(): void {
  if (globalWsSubscribed) {
    return
  }
  globalWsSubscribed = true
  gameWebSocket.subscribe((message) => {
    if (message.type === 'sync_updated') {
      notifySync(message.state.roomId, message.state)
    }
  })
  gameWebSocket.onReconnect(() => {
    resubscribeAllSyncRooms()
  })
}

export function getCachedSync(roomId: string): RoomGameSyncState | null {
  return syncCache.get(roomId.trim()) ?? null
}

export async function fetchSync(roomId: string): Promise<RoomGameSyncState | null> {
  try {
    const state = await apiFetch<RoomGameSyncState | null>(
      `/api/rooms/${encodeURIComponent(roomId.trim())}/sync`,
    )
    if (!state) {
      return getCachedSync(roomId)
    }
    notifySync(roomId, state)
    return state
  } catch {
    return getCachedSync(roomId)
  }
}

export function subscribeSync(
  roomId: string,
  callback: (state: RoomGameSyncState) => void,
): () => void {
  ensureGlobalSubscription()
  const trimmed = roomId.trim()
  activeSyncRooms.add(trimmed)
  let set = syncListeners.get(trimmed)
  if (!set) {
    set = new Set()
    syncListeners.set(trimmed, set)
  }
  set.add(callback)

  void gameWebSocket.connect().then(() => {
    gameWebSocket.send({ type: 'subscribe_sync', roomId: trimmed })
  })

  const cached = getCachedSync(trimmed)
  if (cached) {
    callback(cached)
  }

  return () => {
    set?.delete(callback)
    if (set?.size === 0) {
      activeSyncRooms.delete(trimmed)
    }
  }
}

async function publishPayload(roomId: string, payload: PublishPayload): Promise<boolean> {
  ensureGlobalSubscription()
  const trimmed = roomId.trim()
  const before = getCachedSync(trimmed)?.version ?? -1

  try {
    const result = await apiFetch<{ state: RoomGameSyncState }>(
      `/api/rooms/${encodeURIComponent(trimmed)}/publish`,
      {
        method: 'POST',
        body: JSON.stringify({ payload }),
      },
    )
    notifySync(trimmed, result.state)
    return result.state.version > before
  } catch {
    await gameWebSocket.connect()
    gameWebSocket.send({ type: 'publish', roomId: trimmed, payload })

    for (let attempt = 0; attempt < 20; attempt += 1) {
      await new Promise((resolve) => window.setTimeout(resolve, 50))
      const latest = getCachedSync(trimmed)
      if (latest && latest.version > before) {
        return true
      }
    }

    const fetched = await fetchSync(trimmed)
    return fetched !== null && fetched.version > before
  }
}

export async function initRoomGameSyncRemote(
  roomId: string,
  shuffleSeed: string,
): Promise<RoomGameSyncState> {
  ensureGlobalSubscription()
  await gameWebSocket.connect()

  const existing = await fetchSync(roomId)
  if (existing) {
    return existing
  }

  gameWebSocket.send({ type: 'init_sync', roomId: roomId.trim(), shuffleSeed })

  for (let attempt = 0; attempt < 30; attempt += 1) {
    await new Promise((resolve) => window.setTimeout(resolve, 50))
    const latest = getCachedSync(roomId)
    if (latest) {
      return latest
    }
  }

  const fetched = await fetchSync(roomId)
  if (fetched) {
    return fetched
  }

  return {
    roomId: roomId.trim(),
    version: 0,
    updatedAt: Date.now(),
    shuffleSeed,
    hostBattlefieldChoice: null,
    guestBattlefieldChoice: null,
    hostMulliganDone: false,
    guestMulliganDone: false,
    hostDice: null,
    guestDice: null,
    diceRollGeneration: 0,
    diceWinner: null,
    firstPlayer: null,
    secondPlayer: null,
    activePlayer: null,
    pendingTurnStartFor: null,
    turnPhase: 'battlefieldSelect',
    firstRoundSecondPlayerBonusPending: false,
    openingHandsReady: false,
    hostZones: null,
    guestZones: null,
    hostScore: 0,
    guestScore: 0,
    hostMana: 0,
    guestMana: 0,
    hostRuneEnergy: { red: 0, blue: 0, green: 0, purple: 0, orange: 0, yellow: 0 },
    guestRuneEnergy: { red: 0, blue: 0, green: 0, purple: 0, orange: 0, yellow: 0 },
  }
}

export async function clearRoomGameSyncRemote(roomId: string): Promise<void> {
  syncCache.delete(roomId.trim())
  syncListeners.delete(roomId.trim())
  activeSyncRooms.delete(roomId.trim())
  await apiFetch(`/api/rooms/${encodeURIComponent(roomId.trim())}`, { method: 'DELETE' }).catch(
    () => undefined,
  )
}

export { generateShuffleSeed }

export async function publishBattlefieldChoiceRemote(
  roomId: string,
  role: PlayerRole,
  battlefieldId: string,
): Promise<boolean> {
  return publishPayload(roomId, { action: 'battlefieldChoice', role, battlefieldId })
}

export async function publishOpeningHandsReadyRemote(
  roomId: string,
  hostZones: Record<ZoneId, GameCardInstance[]>,
  guestZones: Record<ZoneId, GameCardInstance[]>,
): Promise<boolean> {
  return publishPayload(roomId, { action: 'openingHandsReady', hostZones, guestZones })
}

export async function publishMulliganDoneRemote(
  roomId: string,
  role: PlayerRole,
  zones: Record<ZoneId, GameCardInstance[]>,
): Promise<boolean> {
  return publishPayload(roomId, { action: 'mulliganDone', role, zones })
}

export async function publishDiceRollRemote(
  roomId: string,
  role: PlayerRole,
  value: number,
  generation: number,
): Promise<boolean> {
  return publishPayload(roomId, { action: 'diceRoll', role, value, generation })
}

export async function publishDiceTieRerollRemote(
  roomId: string,
  generation: number,
): Promise<boolean> {
  return publishPayload(roomId, { action: 'diceTieReroll', generation })
}

export async function publishDiceWinnerDeterminedRemote(
  roomId: string,
  winner: PlayerRole,
): Promise<boolean> {
  return publishPayload(roomId, { action: 'diceWinnerDetermined', winner })
}

export async function publishFirstPlayerChoiceRemote(
  roomId: string,
  firstPlayer: PlayerRole,
): Promise<boolean> {
  return publishPayload(roomId, { action: 'firstPlayerChoice', firstPlayer })
}

export async function publishTurnStartCompleteRemote(
  roomId: string,
  role: PlayerRole,
  zones: Record<ZoneId, GameCardInstance[]>,
  mana: number,
  runeEnergy: Record<RuneColor, number>,
): Promise<boolean> {
  return publishPayload(roomId, { action: 'turnStartComplete', role, zones, mana, runeEnergy })
}

export async function publishTurnEndRemote(
  roomId: string,
  role: PlayerRole,
  zones: Record<ZoneId, GameCardInstance[]>,
  mana: number,
  runeEnergy: Record<RuneColor, number>,
): Promise<boolean> {
  return publishPayload(roomId, { action: 'turnEnd', role, zones, mana, runeEnergy })
}

export async function publishZonesSnapshotRemote(
  roomId: string,
  role: PlayerRole,
  zones: Record<ZoneId, GameCardInstance[]>,
  mana: number,
  runeEnergy: Record<RuneColor, number>,
  score: number,
): Promise<boolean> {
  return publishPayload(roomId, {
    action: 'zonesSnapshot',
    role,
    zones,
    mana,
    runeEnergy,
    score,
  })
}

export async function hasRoomGameSyncRemote(roomId: string): Promise<boolean> {
  const sync = getCachedSync(roomId) ?? (await fetchSync(roomId))
  return sync !== null
}
