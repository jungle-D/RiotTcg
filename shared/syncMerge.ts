import type { PublishPayload } from './wsMessages'
import type { PlayerRole, RoomGameSyncState } from './gameSyncTypes'

export function applyPublishPayload(
  current: RoomGameSyncState,
  payload: PublishPayload,
): RoomGameSyncState | null {
  switch (payload.action) {
    case 'battlefieldChoice':
      return {
        ...current,
        hostBattlefieldChoice:
          payload.role === 'host' ? payload.battlefieldId : current.hostBattlefieldChoice,
        guestBattlefieldChoice:
          payload.role === 'guest' ? payload.battlefieldId : current.guestBattlefieldChoice,
      }
    case 'openingHandsReady':
      return {
        ...current,
        openingHandsReady: true,
        turnPhase: 'mulligan',
        hostMulliganDone: false,
        guestMulliganDone: false,
        hostZones: payload.hostZones,
        guestZones: payload.guestZones,
      }
    case 'mulliganDone': {
      const hostMulliganDone = payload.role === 'host' ? true : current.hostMulliganDone
      const guestMulliganDone = payload.role === 'guest' ? true : current.guestMulliganDone
      const bothDone = hostMulliganDone && guestMulliganDone
      return {
        ...current,
        hostMulliganDone,
        guestMulliganDone,
        hostZones: payload.role === 'host' ? payload.zones : current.hostZones,
        guestZones: payload.role === 'guest' ? payload.zones : current.guestZones,
        turnPhase: bothDone ? 'diceRoll' : 'mulligan',
        hostDice: bothDone ? null : current.hostDice,
        guestDice: bothDone ? null : current.guestDice,
        diceWinner: bothDone ? null : current.diceWinner,
      }
    }
    case 'diceRoll': {
      if (current.diceRollGeneration !== payload.generation) {
        return null
      }
      if (payload.role === 'host' && current.hostDice !== null) {
        return current
      }
      if (payload.role === 'guest' && current.guestDice !== null) {
        return current
      }
      return {
        ...current,
        hostDice: payload.role === 'host' ? payload.value : current.hostDice,
        guestDice: payload.role === 'guest' ? payload.value : current.guestDice,
      }
    }
    case 'diceTieReroll':
      if (current.diceRollGeneration !== payload.generation) {
        return null
      }
      return {
        ...current,
        hostDice: null,
        guestDice: null,
        diceWinner: null,
        diceRollGeneration: current.diceRollGeneration + 1,
      }
    case 'diceWinnerDetermined':
      return {
        ...current,
        diceWinner: payload.winner,
        turnPhase: 'firstPlayerChoice',
      }
    case 'firstPlayerChoice': {
      const secondPlayer: PlayerRole = payload.firstPlayer === 'host' ? 'guest' : 'host'
      return {
        ...current,
        firstPlayer: payload.firstPlayer,
        secondPlayer,
        activePlayer: payload.firstPlayer,
        pendingTurnStartFor: payload.firstPlayer,
        firstRoundSecondPlayerBonusPending: true,
        turnPhase: 'waitingOpponent',
      }
    }
    case 'turnStartComplete':
      return {
        ...current,
        pendingTurnStartFor: null,
        turnPhase: 'main',
        activePlayer: payload.role,
        hostZones: payload.role === 'host' ? payload.zones : current.hostZones,
        guestZones: payload.role === 'guest' ? payload.zones : current.guestZones,
        hostMana: payload.role === 'host' ? payload.mana : current.hostMana,
        guestMana: payload.role === 'guest' ? payload.mana : current.guestMana,
        hostRuneEnergy: payload.role === 'host' ? payload.runeEnergy : current.hostRuneEnergy,
        guestRuneEnergy: payload.role === 'guest' ? payload.runeEnergy : current.guestRuneEnergy,
      }
    case 'turnEnd': {
      const nextActive: PlayerRole = payload.role === 'host' ? 'guest' : 'host'
      return {
        ...current,
        activePlayer: nextActive,
        pendingTurnStartFor: nextActive,
        turnPhase: 'waitingOpponent',
        hostZones: payload.role === 'host' ? payload.zones : current.hostZones,
        guestZones: payload.role === 'guest' ? payload.zones : current.guestZones,
        hostMana: payload.role === 'host' ? payload.mana : current.hostMana,
        guestMana: payload.role === 'guest' ? payload.mana : current.guestMana,
        hostRuneEnergy: payload.role === 'host' ? payload.runeEnergy : current.hostRuneEnergy,
        guestRuneEnergy: payload.role === 'guest' ? payload.runeEnergy : current.guestRuneEnergy,
      }
    }
    case 'zonesSnapshot':
      return {
        ...current,
        hostZones: payload.role === 'host' ? payload.zones : current.hostZones,
        guestZones: payload.role === 'guest' ? payload.zones : current.guestZones,
        hostMana: payload.role === 'host' ? payload.mana : current.hostMana,
        guestMana: payload.role === 'guest' ? payload.mana : current.guestMana,
        hostRuneEnergy: payload.role === 'host' ? payload.runeEnergy : current.hostRuneEnergy,
        guestRuneEnergy: payload.role === 'guest' ? payload.runeEnergy : current.guestRuneEnergy,
        hostScore: payload.role === 'host' ? payload.score : current.hostScore,
        guestScore: payload.role === 'guest' ? payload.score : current.guestScore,
      }
    default:
      return null
  }
}

export function mergeSyncState(
  current: RoomGameSyncState,
  updater: (state: RoomGameSyncState) => RoomGameSyncState | null,
): RoomGameSyncState | null {
  const updated = updater(current)
  if (!updated) {
    return null
  }
  return {
    ...updated,
    updatedAt: Date.now(),
    version: current.version + 1,
  }
}

export function canApplyDiceRoll(
  current: RoomGameSyncState,
  role: PlayerRole,
  generation: number,
): boolean {
  if (current.diceRollGeneration !== generation) {
    return false
  }
  if (role === 'host' && current.hostDice !== null) {
    return true
  }
  if (role === 'guest' && current.guestDice !== null) {
    return true
  }
  return true
}
