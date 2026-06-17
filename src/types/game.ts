import type { DeckState } from './cards'

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
export type RuneColor = 'red' | 'blue' | 'green' | 'purple'

export type ActionMode =
  | 'draw'
  | 'discard'
  | 'tap'
  | 'untap'
  | 'move'
  | 'recycle'
  | 'look'
  | null

export type TurnPhase =
  | 'diceRoll'
  | 'mulligan'
  | 'main'
  | 'waitingOpponent'

export interface GameCardInstance {
  instanceId: string
  cardId: string
  kind: CardKind
  tapped: boolean
}

export interface GameState {
  zones: Record<ZoneId, GameCardInstance[]>
  opponentZones: Record<ZoneId, GameCardInstance[]>
  actionMode: ActionMode
  turnPhase: TurnPhase
  mulliganSelected: string[]
  selectedInstanceIds: string[]
  moveSourceInstanceId: string | null
  roomId: string
  isPlayerTurn: boolean
  statusMessage: string
  lookTargetZone: ZoneId | null
  playerDice: number | null
  opponentDice: number | null
  playerScore: number
  opponentScore: number
  playerBattlefieldOptions: string[]
  opponentBattlefieldOptions: string[]
  playerBattlefieldChoice: string | null
  opponentBattlefieldChoice: string | null
  openingHandsReady: boolean
  playerMulliganDone: boolean
  opponentMulliganDone: boolean
  secondPlayer: 'player' | 'opponent' | null
  firstRoundSecondPlayerBonusPending: boolean
  mana: number
  runeEnergy: Record<RuneColor, number>
}

export interface GameSession {
  deckState: DeckState
  roomId: string
  role: 'host' | 'guest'
}

export const MULLIGAN_LIMIT = 2
export const OPENING_HAND_DRAW = 4
export const TURN_HAND_DRAW = 1
export const TURN_RUNE_DRAW = 2

export const DRAW_SOURCE_ZONES: ZoneId[] = ['mainDeck', 'runeDeck', 'discard']
export const LOOK_ZONES: ZoneId[] = ['discard']
export const MOVE_TARGET_ZONES: ZoneId[] = ['base', 'battlefieldA', 'battlefieldB']
export const TAP_ZONES: ZoneId[] = ['legend', 'hero', 'base', 'runeBoard', 'battlefieldA', 'battlefieldB']
export const DISCARD_ZONES: ZoneId[] = [
  'hero',
  'base',
  'runeBoard',
  'battlefieldA',
  'battlefieldB',
  'hand',
]
