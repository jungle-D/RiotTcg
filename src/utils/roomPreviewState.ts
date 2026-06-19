import { createEmptySync, type RoomGameSyncState } from '@shared/gameSyncTypes'
import type { GameSession, GameState } from '../types/game'
import {
  applyRoomGameSync,
  getHostGuestZones,
  initGame,
  prepareOpeningHands,
  startRegularPlayerTurn,
} from './gameState'

export type PreviewScenario =
  | 'battlefieldSelect'
  | 'opponentPickedBattlefield'
  | 'mulligan'
  | 'diceRoll'
  | 'firstPlayerChoice'
  | 'main'

export const PREVIEW_SCENARIO_LABELS: Record<PreviewScenario, string> = {
  battlefieldSelect: '选战场（初始）',
  opponentPickedBattlefield: '对手已选战场',
  mulligan: '开局调度',
  diceRoll: '掷骰决定先手',
  firstPlayerChoice: '选择先手',
  main: '主阶段',
}

const PREVIEW_ROOM_ID = 'preview-local'
const DEFAULT_PREVIEW_SEED = 'preview_seed_fixed'

export function buildPreviewSession(
  playerDeck: GameSession['playerDeck'],
  opponentDeck?: GameSession['opponentDeck'],
  role: GameSession['role'] = 'host',
): GameSession {
  return {
    roomId: PREVIEW_ROOM_ID,
    role,
    playerDeck,
    opponentDeck: opponentDeck ?? playerDeck,
  }
}

function resolveBattlefieldChoices(session: GameSession): {
  hostBattlefieldChoice: string
  guestBattlefieldChoice: string
} {
  const playerBf =
    session.playerDeck.battlefield[0] ?? session.playerDeck.battlefield[1] ?? 'battlefield_unknown'
  const opponentBf =
    session.opponentDeck.battlefield[0] ??
    session.opponentDeck.battlefield[1] ??
    playerBf

  if (session.role === 'host') {
    return {
      hostBattlefieldChoice: playerBf,
      guestBattlefieldChoice: opponentBf,
    }
  }
  return {
    hostBattlefieldChoice: opponentBf,
    guestBattlefieldChoice: playerBf,
  }
}

export function buildPreviewState(
  session: GameSession,
  scenario: PreviewScenario,
  seed: string = DEFAULT_PREVIEW_SEED,
): { game: GameState; roomSync: RoomGameSyncState } {
  let game = initGame(
    session.playerDeck,
    session.opponentDeck,
    session.roomId,
    seed,
    session.role,
  )
  let sync = createEmptySync(session.roomId, seed)
  const battlefields = resolveBattlefieldChoices(session)

  if (scenario === 'battlefieldSelect') {
    return { game, roomSync: sync }
  }

  if (scenario === 'opponentPickedBattlefield') {
    if (session.role === 'host') {
      sync = {
        ...sync,
        guestBattlefieldChoice: battlefields.guestBattlefieldChoice,
        version: 1,
      }
    } else {
      sync = {
        ...sync,
        hostBattlefieldChoice: battlefields.hostBattlefieldChoice,
        version: 1,
      }
    }
    game = applyRoomGameSync(game, sync, session.role)
    return { game, roomSync: sync }
  }

  sync = {
    ...sync,
    hostBattlefieldChoice: battlefields.hostBattlefieldChoice,
    guestBattlefieldChoice: battlefields.guestBattlefieldChoice,
    version: 1,
  }
  const prepared = prepareOpeningHands(game, sync, session.role)
  if (prepared) {
    game = prepared
    const { hostZones, guestZones } = getHostGuestZones(game, session.role)
    sync = {
      ...sync,
      openingHandsReady: true,
      turnPhase: 'mulligan',
      hostZones,
      guestZones,
      version: 2,
    }
    game = applyRoomGameSync(game, sync, session.role)
  }

  if (scenario === 'mulligan') {
    return { game, roomSync: sync }
  }

  sync = {
    ...sync,
    hostMulliganDone: true,
    guestMulliganDone: true,
    turnPhase: 'diceRoll',
    version: 3,
  }
  game = applyRoomGameSync(game, sync, session.role)

  if (scenario === 'diceRoll') {
    return { game, roomSync: sync }
  }

  sync = {
    ...sync,
    hostDice: 5,
    guestDice: 3,
    diceWinner: 'host',
    turnPhase: 'firstPlayerChoice',
    version: 4,
  }
  game = applyRoomGameSync(game, sync, session.role)

  if (scenario === 'firstPlayerChoice') {
    return { game, roomSync: sync }
  }

  sync = {
    ...sync,
    firstPlayer: 'host',
    secondPlayer: 'guest',
    activePlayer: 'host',
    turnPhase: 'main',
    pendingTurnStartFor: null,
    version: 5,
  }
  game = applyRoomGameSync(game, sync, session.role)
  if (session.role === 'host') {
    game = startRegularPlayerTurn(game)
    const { hostZones, guestZones } = getHostGuestZones(game, session.role)
    sync = {
      ...sync,
      hostZones,
      guestZones,
      hostMana: game.mana,
      hostRuneEnergy: { ...game.runeEnergy },
      version: 6,
    }
  }

  return { game, roomSync: sync }
}

export function buildPreviewStateFromLiveSync(
  session: GameSession,
  liveSync: RoomGameSyncState,
): { game: GameState; roomSync: RoomGameSyncState } {
  const initialGame = initGame(
    session.playerDeck,
    session.opponentDeck,
    session.roomId,
    liveSync.shuffleSeed,
    session.role,
  )
  const game = applyRoomGameSync(initialGame, liveSync, session.role)
  return { game, roomSync: liveSync }
}
