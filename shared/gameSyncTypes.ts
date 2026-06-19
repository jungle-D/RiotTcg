import type { RuneColor } from './runeColors'
import { emptyRuneEnergy } from './runeColors'

export type PlayerRole = 'host' | 'guest'

export type TurnPhase =
  | 'battlefieldSelect'
  | 'diceRoll'
  | 'firstPlayerChoice'
  | 'mulligan'
  | 'main'
  | 'waitingOpponent'

export type ZoneId =
  | 'legend'
  | 'hero'
  | 'mainDeck'
  | 'runeDeck'
  | 'base'
  | 'runeBoard'
  | 'battlefieldA'
  | 'battlefieldB'
  | 'hand'
  | 'discard'

export type CardKind = 'legend' | 'hero' | 'main' | 'rune'

export interface GameCardInstance {
  instanceId: string
  cardId: string
  kind: CardKind
  tapped: boolean
}

export interface RoomGameSyncState {
  roomId: string
  version: number
  updatedAt: number
  shuffleSeed: string
  hostBattlefieldChoice: string | null
  guestBattlefieldChoice: string | null
  hostMulliganDone: boolean
  guestMulliganDone: boolean
  hostDice: number | null
  guestDice: number | null
  diceRollGeneration: number
  diceWinner: PlayerRole | null
  firstPlayer: PlayerRole | null
  secondPlayer: PlayerRole | null
  activePlayer: PlayerRole | null
  pendingTurnStartFor: PlayerRole | null
  turnPhase: TurnPhase
  firstRoundSecondPlayerBonusPending: boolean
  openingHandsReady: boolean
  hostZones: Record<ZoneId, GameCardInstance[]> | null
  guestZones: Record<ZoneId, GameCardInstance[]> | null
  hostScore: number
  guestScore: number
  hostMana: number
  guestMana: number
  hostRuneEnergy: Record<RuneColor, number>
  guestRuneEnergy: Record<RuneColor, number>
}

export function createEmptySync(roomId: string, shuffleSeed: string): RoomGameSyncState {
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
    hostRuneEnergy: emptyRuneEnergy(),
    guestRuneEnergy: emptyRuneEnergy(),
  }
}

export function generateShuffleSeed(): string {
  return `seed_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}
