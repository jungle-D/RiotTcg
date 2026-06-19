export type { PlayerRole, RoomGameSyncState, TurnPhase } from '@shared/gameSyncTypes'
export { generateShuffleSeed } from '@shared/gameSyncTypes'

import { generateShuffleSeed } from '@shared/gameSyncTypes'
import type { PlayerRole, RoomGameSyncState } from '@shared/gameSyncTypes'
import type { RuneColor } from '@shared/runeColors'
import type { GameCardInstance, ZoneId } from '../types/game'
import {
  clearRoomGameSyncRemote,
  fetchSync,
  getCachedSync,
  hasRoomGameSyncRemote,
  initRoomGameSyncRemote,
  publishBattlefieldChoiceRemote,
  publishDiceRollRemote,
  publishDiceTieRerollRemote,
  publishDiceWinnerDeterminedRemote,
  publishFirstPlayerChoiceRemote,
  publishMulliganDoneRemote,
  publishOpeningHandsReadyRemote,
  publishTurnEndRemote,
  publishTurnStartCompleteRemote,
  publishZonesSnapshotRemote,
  subscribeSync,
} from './network/gameSyncClient'

export function getRoomGameSync(roomId: string): RoomGameSyncState | null {
  return getCachedSync(roomId)
}

export async function fetchRoomGameSync(roomId: string): Promise<RoomGameSyncState | null> {
  return fetchSync(roomId)
}

export async function initRoomGameSync(
  roomId: string,
  shuffleSeed: string,
): Promise<RoomGameSyncState> {
  return initRoomGameSyncRemote(roomId, shuffleSeed)
}

export async function hasRoomGameSync(roomId: string): Promise<boolean> {
  return hasRoomGameSyncRemote(roomId)
}

export async function clearRoomGameSync(roomId: string): Promise<void> {
  return clearRoomGameSyncRemote(roomId)
}

export { subscribeSync }

export async function publishBattlefieldChoice(
  roomId: string,
  role: PlayerRole,
  battlefieldId: string,
): Promise<boolean> {
  return publishBattlefieldChoiceRemote(roomId, role, battlefieldId)
}

export async function publishOpeningHandsReady(
  roomId: string,
  hostZones: Record<ZoneId, GameCardInstance[]>,
  guestZones: Record<ZoneId, GameCardInstance[]>,
): Promise<boolean> {
  return publishOpeningHandsReadyRemote(roomId, hostZones, guestZones)
}

export async function publishMulliganDone(
  roomId: string,
  role: PlayerRole,
  zones: Record<ZoneId, GameCardInstance[]>,
): Promise<boolean> {
  return publishMulliganDoneRemote(roomId, role, zones)
}

export async function publishDiceRoll(
  roomId: string,
  role: PlayerRole,
  value: number,
  generation: number,
): Promise<boolean> {
  return publishDiceRollRemote(roomId, role, value, generation)
}

export async function publishDiceTieReroll(
  roomId: string,
  generation: number,
): Promise<boolean> {
  return publishDiceTieRerollRemote(roomId, generation)
}

export async function publishDiceWinnerDetermined(
  roomId: string,
  winner: PlayerRole,
): Promise<boolean> {
  return publishDiceWinnerDeterminedRemote(roomId, winner)
}

export async function publishFirstPlayerChoice(
  roomId: string,
  firstPlayer: PlayerRole,
): Promise<boolean> {
  return publishFirstPlayerChoiceRemote(roomId, firstPlayer)
}

export async function publishTurnStartComplete(
  roomId: string,
  role: PlayerRole,
  zones: Record<ZoneId, GameCardInstance[]>,
  mana: number,
  runeEnergy: Record<RuneColor, number>,
): Promise<boolean> {
  return publishTurnStartCompleteRemote(roomId, role, zones, mana, runeEnergy)
}

export async function publishTurnEnd(
  roomId: string,
  role: PlayerRole,
  zones: Record<ZoneId, GameCardInstance[]>,
  mana: number,
  runeEnergy: Record<RuneColor, number>,
): Promise<boolean> {
  return publishTurnEndRemote(roomId, role, zones, mana, runeEnergy)
}

export async function publishZonesSnapshot(
  roomId: string,
  role: PlayerRole,
  zones: Record<ZoneId, GameCardInstance[]>,
  mana: number,
  runeEnergy: Record<RuneColor, number>,
  score: number,
): Promise<boolean> {
  return publishZonesSnapshotRemote(roomId, role, zones, mana, runeEnergy, score)
}

/** @deprecated no longer uses localStorage */
export function getRoomGameSyncStorageKey(_roomId: string): string {
  return ''
}

/** @deprecated */
export function getBattlefieldSyncStorageKey(roomId: string): string {
  return getRoomGameSyncStorageKey(roomId)
}

/** @deprecated */
export function getBattlefieldSync(roomId: string): RoomGameSyncState | null {
  return getRoomGameSync(roomId)
}

/** @deprecated */
export async function initBattlefieldSync(roomId: string): Promise<void> {
  const existing = getRoomGameSync(roomId)
  if (!existing) {
    await initRoomGameSync(roomId, generateShuffleSeed())
  }
}

/** @deprecated */
export async function clearBattlefieldSync(roomId: string): Promise<void> {
  await clearRoomGameSync(roomId)
}

/** @deprecated */
export async function publishFirstPlayerResolved(
  roomId: string,
  firstPlayer: PlayerRole,
  secondPlayer: PlayerRole,
): Promise<boolean> {
  void secondPlayer
  return publishFirstPlayerChoice(roomId, firstPlayer)
}
