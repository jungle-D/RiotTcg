import type { OnlineRoom } from './roomTypes'
import type { GameCardInstance, PlayerRole, RoomGameSyncState, ZoneId } from './gameSyncTypes'
import type { RuneColor } from './runeColors'

export type PublishAction =
  | 'battlefieldChoice'
  | 'openingHandsReady'
  | 'mulliganDone'
  | 'diceRoll'
  | 'diceTieReroll'
  | 'diceWinnerDetermined'
  | 'firstPlayerChoice'
  | 'turnStartComplete'
  | 'turnEnd'
  | 'zonesSnapshot'

export type PublishPayload =
  | { action: 'battlefieldChoice'; role: PlayerRole; battlefieldId: string }
  | {
      action: 'openingHandsReady'
      hostZones: Record<ZoneId, GameCardInstance[]>
      guestZones: Record<ZoneId, GameCardInstance[]>
    }
  | { action: 'mulliganDone'; role: PlayerRole; zones: Record<ZoneId, GameCardInstance[]> }
  | { action: 'diceRoll'; role: PlayerRole; value: number; generation: number }
  | { action: 'diceTieReroll'; generation: number }
  | { action: 'diceWinnerDetermined'; winner: PlayerRole }
  | { action: 'firstPlayerChoice'; firstPlayer: PlayerRole }
  | {
      action: 'turnStartComplete'
      role: PlayerRole
      zones: Record<ZoneId, GameCardInstance[]>
      mana: number
      runeEnergy: Record<RuneColor, number>
    }
  | {
      action: 'turnEnd'
      role: PlayerRole
      zones: Record<ZoneId, GameCardInstance[]>
      mana: number
      runeEnergy: Record<RuneColor, number>
    }
  | {
      action: 'zonesSnapshot'
      role: PlayerRole
      zones: Record<ZoneId, GameCardInstance[]>
      mana: number
      runeEnergy: Record<RuneColor, number>
      score: number
    }

export type ClientMessage =
  | { type: 'subscribe_room'; roomId: string; clientId: string }
  | { type: 'subscribe_sync'; roomId: string }
  | { type: 'init_sync'; roomId: string; shuffleSeed: string }
  | { type: 'publish'; roomId: string; payload: PublishPayload }

export type ServerMessage =
  | { type: 'room_updated'; room: OnlineRoom }
  | { type: 'sync_updated'; state: RoomGameSyncState }
  | { type: 'error'; code: string; message: string }
