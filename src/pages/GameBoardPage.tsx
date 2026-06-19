import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import ActionBar from '../components/game/ActionBar'
import BattlefieldOpponentPanel from '../components/game/BattlefieldOpponentPanel'
import BattlefieldSelectModal from '../components/game/BattlefieldSelectModal'
import BattlefieldZone from '../components/game/BattlefieldZone'
import CardPreviewModal from '../components/game/CardPreviewModal'
import DiceRollOverlay from '../components/game/DiceRollOverlay'
import LookPileModal from '../components/game/LookPileModal'
import ZonePanel from '../components/game/ZonePanel'
import { getCardMeta as lookupCardMeta, getRuneColorById } from '../data/loltcgCatalog'
import { RUNE_COLOR_LABELS, RUNE_COLORS } from '../constants/runeColors'
import {
  clearRoomGameSync,
  fetchRoomGameSync,
  generateShuffleSeed,
  getRoomGameSync,
  initRoomGameSync,
  publishBattlefieldChoice,
  publishDiceRoll,
  publishDiceTieReroll,
  publishDiceWinnerDetermined,
  publishFirstPlayerChoice,
  publishMulliganDone,
  publishOpeningHandsReady,
  publishTurnEnd,
  publishTurnStartComplete,
  publishZonesSnapshot,
  subscribeSync,
  type RoomGameSyncState,
} from '../services/gameSyncService'
import { resolveOnlineRole } from '../services/network/roomClient'
import type { BaseCard } from '../types/cards'
import type { ActionMode, GameCardInstance, GameSession, GameState, RuneColor, ZoneId } from '../types/game'
import { saveActiveSession, clearActiveSession } from '../utils/gameSessionStorage'
import { getOrCreateClientId } from '../utils/clientId'
import {
  adjustMana,
  adjustRuneEnergy,
  adjustScore,
  applyBattlefieldSync,
  applyRoomGameSync,
  prepareOpeningHands,
  clearLookTarget,
  confirmDiscard,
  confirmRecycle,
  confirmTap,
  confirmUntap,
  endTurn,
  findCardZone,
  finishMulligan,
  getHostGuestZones,
  handleDrawFromZone,
  handleLookZone,
  handleMoveSelect,
  handleMoveToZone,
  initGame,
  isCardSelected,
  pickPlayerBattlefield,
  resolveDiceWinner,
  startRegularPlayerTurn,
  setActionMode,
  toggleDiscardSelect,
  toggleMulliganSelect,
  toggleRecycleSelect,
  toggleTapSelect,
  toggleUntapSelect,
} from '../utils/gameState'
import {
  buildPreviewState,
  buildPreviewStateFromLiveSync,
  type PreviewScenario,
} from '../utils/roomPreviewState'
import './GameBoardPage.css'

export interface DevPreviewOptions {
  scenario?: PreviewScenario
  seed?: string
  liveSync?: RoomGameSyncState | null
}

interface GameBoardPageProps {
  session: GameSession
  onBack: () => void
  devPreview?: DevPreviewOptions
}

function getCardMeta(card: GameCardInstance): BaseCard | null {
  return lookupCardMeta(card.cardId)
}

function findPlayerCard(state: GameState, instanceId: string): GameCardInstance | null {
  const zone = findCardZone(state, instanceId)
  if (!zone) {
    return null
  }
  return state.zones[zone].find((card) => card.instanceId === instanceId) ?? null
}

function findLegendHeroCard(
  zones: Record<ZoneId, GameCardInstance[]>,
  instanceId: string,
): GameCardInstance | null {
  for (const zone of ['legend', 'hero'] as const) {
    const card = zones[zone].find((item) => item.instanceId === instanceId)
    if (card) {
      return card
    }
  }
  return null
}

function GameBoardPage({ session: rawSession, onBack, devPreview }: GameBoardPageProps) {
  const isDevPreview = Boolean(devPreview)
  const [session, setSession] = useState(rawSession)
  const [game, setGame] = useState<GameState | null>(null)
  const [roomSync, setRoomSync] = useState<RoomGameSyncState | null>(null)
  const [loading, setLoading] = useState(true)
  const [history, setHistory] = useState<GameState[]>([])
  const [previewCard, setPreviewCard] = useState<BaseCard | null>(null)
  const skipHistoryRef = useRef(false)
  const lastSyncVersionRef = useRef(-1)
  const turnStartHandledRef = useRef<number | null>(null)
  const diceResolvedGenerationRef = useRef(-1)
  const pendingDiceRollRef = useRef<number | null>(null)
  const inGameSyncTimerRef = useRef<number | null>(null)
  const openingHandsStartedRef = useRef(false)
  const pendingSyncPayloadRef = useRef<{
    zones: GameState['zones']
    mana: number
    runeEnergy: GameState['runeEnergy']
    playerScore: number
  } | null>(null)
  const roleRef = useRef(rawSession.role)

  useEffect(() => {
    roleRef.current = session.role
  }, [session.role])

  useEffect(() => {
    document.documentElement.classList.add('game-board-active')
    return () => document.documentElement.classList.remove('game-board-active')
  }, [])

  useEffect(() => {
    if (isDevPreview) {
      return
    }
    saveActiveSession(session, getOrCreateClientId())
  }, [session, isDevPreview])

  const applySyncToGame = useCallback(
    (sync: RoomGameSyncState, role: GameSession['role']) => {
      if (sync.version === lastSyncVersionRef.current) {
        return
      }
      lastSyncVersionRef.current = sync.version
      setRoomSync(sync)
      setGame((prev) => {
        if (!prev) {
          return prev
        }
        skipHistoryRef.current = true
        return applyRoomGameSync(prev, sync, role)
      })
    },
    [],
  )

  const tryPublishDiceRoll = useCallback(
    async (value: number, role: GameSession['role']) => {
      for (let attempt = 0; attempt < 8; attempt += 1) {
        const sync = getRoomGameSync(session.roomId) ?? (await fetchRoomGameSync(session.roomId))
        if (!sync) {
          return
        }
        const myDice = role === 'host' ? sync.hostDice : sync.guestDice
        if (myDice !== null) {
          pendingDiceRollRef.current = null
          lastSyncVersionRef.current = -1
          applySyncToGame(sync, role)
          return
        }
        await publishDiceRoll(session.roomId, role, value, sync.diceRollGeneration)
        const latest = getRoomGameSync(session.roomId) ?? (await fetchRoomGameSync(session.roomId))
        if (!latest) {
          continue
        }
        const written = role === 'host' ? latest.hostDice : latest.guestDice
        if (written === value) {
          pendingDiceRollRef.current = null
          lastSyncVersionRef.current = -1
          applySyncToGame(latest, role)
          return
        }
      }
    },
    [applySyncToGame, session.roomId],
  )

  const runSyncOrchestration = useCallback(
    (sync: RoomGameSyncState, role: GameSession['role']) => {
      if (
        sync.hostBattlefieldChoice &&
        sync.guestBattlefieldChoice &&
        !sync.openingHandsReady &&
        role === 'host' &&
        !openingHandsStartedRef.current
      ) {
        setGame((prev) => {
          if (!prev || prev.zones.hand.length > 0 || prev.openingHandsReady) {
            return prev
          }
          const prepared = prepareOpeningHands(prev, sync, role)
          if (!prepared) {
            return prev
          }
          openingHandsStartedRef.current = true
          skipHistoryRef.current = true
          const { hostZones, guestZones } = getHostGuestZones(prepared, role)
          void publishOpeningHandsReady(session.roomId, hostZones, guestZones)
          return prepared
        })
      }

      if (sync.turnPhase === 'diceRoll' && pendingDiceRollRef.current !== null) {
        const myDice = role === 'host' ? sync.hostDice : sync.guestDice
        if (myDice === null) {
          void tryPublishDiceRoll(pendingDiceRollRef.current, role)
        } else {
          pendingDiceRollRef.current = null
        }
      }

      if (sync.turnPhase === 'diceRoll') {
        if (sync.hostDice !== null && sync.guestDice !== null && sync.diceWinner === null) {
          const result = resolveDiceWinner(sync.hostDice, sync.guestDice)
          if (result === 'tie') {
            if (role === 'host' && diceResolvedGenerationRef.current !== sync.diceRollGeneration) {
              void publishDiceTieReroll(session.roomId, sync.diceRollGeneration)
              diceResolvedGenerationRef.current = sync.diceRollGeneration
            }
          } else if (role === 'host') {
            void publishDiceWinnerDetermined(session.roomId, result.winner)
            diceResolvedGenerationRef.current = sync.diceRollGeneration
          }
        }
      } else if (sync.turnPhase !== 'firstPlayerChoice') {
        diceResolvedGenerationRef.current = -1
      }

      if (sync.pendingTurnStartFor === role && sync.version !== turnStartHandledRef.current) {
        turnStartHandledRef.current = sync.version
        setGame((prev) => {
          if (!prev) {
            return prev
          }
          skipHistoryRef.current = true
          const started = startRegularPlayerTurn(prev)
          void publishTurnStartComplete(
            session.roomId,
            role,
            started.zones,
            started.mana,
            started.runeEnergy,
          )
          const latest = getRoomGameSync(session.roomId)
          if (latest) {
            return applyRoomGameSync(started, latest, role)
          }
          return started
        })
      }
    },
    [session.roomId, tryPublishDiceRoll],
  )

  useEffect(() => {
    if (isDevPreview) {
      let cancelled = false
      const seed = devPreview?.seed ?? 'preview_seed_fixed'

      if (devPreview?.liveSync) {
        const { game, roomSync } = buildPreviewStateFromLiveSync(rawSession, devPreview.liveSync)
        if (!cancelled) {
          setSession(rawSession)
          setGame(game)
          setRoomSync(roomSync)
          setLoading(false)
          lastSyncVersionRef.current = roomSync.version
        }
      } else {
        const { game, roomSync } = buildPreviewState(
          rawSession,
          devPreview?.scenario ?? 'battlefieldSelect',
          seed,
        )
        if (!cancelled) {
          setSession(rawSession)
          setGame(game)
          setRoomSync(roomSync)
          setLoading(false)
          lastSyncVersionRef.current = roomSync.version
        }
      }

      return () => {
        cancelled = true
      }
    }

    let cancelled = false

    const setup = async () => {
      const clientId = getOrCreateClientId()
      const resolvedRole = (await resolveOnlineRole(session.roomId, clientId)) ?? rawSession.role
      const nextSession = { ...rawSession, role: resolvedRole }
      if (!cancelled) {
        setSession(nextSession)
      }

      let sync = await fetchRoomGameSync(session.roomId)
      let shuffleSeed = sync?.shuffleSeed
      if (resolvedRole === 'host' && !sync) {
        sync = await initRoomGameSync(session.roomId, generateShuffleSeed())
        shuffleSeed = sync.shuffleSeed
      }
      if (!shuffleSeed) {
        shuffleSeed = sync?.shuffleSeed ?? generateShuffleSeed()
      }

      const initialGame = initGame(
        nextSession.playerDeck,
        nextSession.opponentDeck,
        nextSession.roomId,
        shuffleSeed,
        resolvedRole,
      )
      const applied = sync ? applyRoomGameSync(initialGame, sync, resolvedRole) : initialGame

      if (!cancelled) {
        setGame(applied)
        setRoomSync(sync)
        setLoading(false)
        if (sync) {
          lastSyncVersionRef.current = sync.version
        }
      }
    }

    void setup()

    const unsubscribe = subscribeSync(session.roomId, (sync) => {
      applySyncToGame(sync, roleRef.current)
      runSyncOrchestration(sync, roleRef.current)
    })

    const pollSync = () => {
      void fetchRoomGameSync(session.roomId).then((sync) => {
        if (!sync || cancelled) {
          return
        }
        applySyncToGame(sync, roleRef.current)
        runSyncOrchestration(sync, roleRef.current)
      })
    }

    pollSync()
    const pollTimer = window.setInterval(pollSync, 400)

    return () => {
      cancelled = true
      unsubscribe()
      window.clearInterval(pollTimer)
      if (inGameSyncTimerRef.current !== null) {
        window.clearTimeout(inGameSyncTimerRef.current)
      }
    }
  }, [applySyncToGame, devPreview, isDevPreview, rawSession, runSyncOrchestration, session.roomId])

  const scheduleInGameSync = useCallback(
    (state: GameState) => {
      if (isDevPreview) {
        return
      }
      if (state.turnPhase !== 'main' || !state.isPlayerTurn) {
        return
      }
      pendingSyncPayloadRef.current = {
        zones: state.zones,
        mana: state.mana,
        runeEnergy: state.runeEnergy,
        playerScore: state.playerScore,
      }
      if (inGameSyncTimerRef.current !== null) {
        window.clearTimeout(inGameSyncTimerRef.current)
      }
      inGameSyncTimerRef.current = window.setTimeout(() => {
        const payload = pendingSyncPayloadRef.current
        if (!payload) {
          return
        }
        void publishZonesSnapshot(
          session.roomId,
          session.role,
          payload.zones,
          payload.mana,
          payload.runeEnergy,
          payload.playerScore,
        )
      }, 200)
    },
    [isDevPreview, session.roomId, session.role],
  )

  const applyGame = useCallback(
    (updater: (prev: GameState) => GameState) => {
      setGame((prev) => {
        if (!prev) {
          return prev
        }
        if (!skipHistoryRef.current) {
          setHistory((stack) => [...stack.slice(-49), prev])
        }
        skipHistoryRef.current = false
        const next = updater(prev)
        scheduleInGameSync(next)
        return next
      })
    },
    [scheduleInGameSync],
  )

  const undo = useCallback(() => {
    setHistory((stack) => {
      const last = stack[stack.length - 1]
      if (last) {
        skipHistoryRef.current = true
        setGame(last)
      }
      return stack.slice(0, -1)
    })
  }, [])

  const handlePickPlayerBattlefield = useCallback(
    (battlefieldId: string) => {
      if (isDevPreview) {
        applyGame((prev) => pickPlayerBattlefield(prev, battlefieldId))
        return
      }
      void (async () => {
        await publishBattlefieldChoice(session.roomId, session.role, battlefieldId)
        applyGame((prev) => {
          const afterPick = pickPlayerBattlefield(prev, battlefieldId)
          const sync = getRoomGameSync(session.roomId)
          if (!sync) {
            return afterPick
          }
          const synced = applyBattlefieldSync(afterPick, sync, session.role)
          const latestSync = getRoomGameSync(session.roomId)
          if (latestSync) {
            return applyRoomGameSync(synced, latestSync, session.role)
          }
          return synced
        })
      })()
    },
    [applyGame, isDevPreview, session.roomId, session.role],
  )

  const handleFinishMulligan = useCallback(() => {
    applyGame((prev) => {
      const afterMulligan = finishMulligan(prev)
      if (!isDevPreview) {
        void publishMulliganDone(session.roomId, session.role, afterMulligan.zones)
      }
      const sync = getRoomGameSync(session.roomId)
      if (sync) {
        return applyRoomGameSync(afterMulligan, sync, session.role)
      }
      return afterMulligan
    })
  }, [applyGame, isDevPreview, session.roomId, session.role])

  const handleDiceRollComplete = useCallback(
    (value: number) => {
      if (isDevPreview) {
        setRoomSync((prev) => {
          if (!prev) {
            return prev
          }
          const diceKey = session.role === 'host' ? 'hostDice' : 'guestDice'
          return { ...prev, [diceKey]: value, turnPhase: 'diceRoll' }
        })
        setGame((prev) => {
          if (!prev) {
            return prev
          }
          skipHistoryRef.current = true
          const playerDice = session.role === 'host' ? value : prev.playerDice
          const opponentDice = session.role === 'guest' ? value : prev.opponentDice
          return {
            ...prev,
            playerDice: session.role === 'host' ? value : prev.playerDice,
            opponentDice: session.role === 'guest' ? value : prev.opponentDice,
            statusMessage:
              playerDice !== null && opponentDice !== null
                ? `你掷出 ${prev.playerDice ?? value}，对手掷出 ${prev.opponentDice ?? value}`
                : `你掷出 ${value}，等待对手投掷骰子…`,
          }
        })
        return
      }
      pendingDiceRollRef.current = value
      void tryPublishDiceRoll(value, session.role)
    },
    [session.role, isDevPreview, tryPublishDiceRoll],
  )

  const handleEndTurn = useCallback(() => {
    applyGame((prev) => {
      const afterEnd = endTurn(prev)
      if (!isDevPreview) {
        void publishTurnEnd(
          session.roomId,
          session.role,
          afterEnd.zones,
          afterEnd.mana,
          afterEnd.runeEnergy,
        )
      }
      const sync = getRoomGameSync(session.roomId)
      if (sync) {
        return applyRoomGameSync(afterEnd, sync, session.role)
      }
      return afterEnd
    })
  }, [applyGame, isDevPreview, session.roomId, session.role])

  const handleFirstPlayerChoice = useCallback(
    (choice: 'self' | 'opponent') => {
      const chosenRole =
        choice === 'self'
          ? session.role
          : session.role === 'host'
            ? 'guest'
            : 'host'
      if (isDevPreview) {
        setRoomSync((prev) => {
          if (!prev) {
            return prev
          }
          return {
            ...prev,
            firstPlayer: chosenRole,
            secondPlayer: chosenRole === 'host' ? 'guest' : 'host',
            turnPhase: 'main',
            activePlayer: chosenRole,
          }
        })
        setGame((prev) => {
          if (!prev) {
            return prev
          }
          skipHistoryRef.current = true
          const nextSync: RoomGameSyncState = {
            ...(roomSync ?? ({} as RoomGameSyncState)),
            firstPlayer: chosenRole,
            secondPlayer: chosenRole === 'host' ? 'guest' : 'host',
            turnPhase: 'main',
            activePlayer: chosenRole,
          }
          let next = applyRoomGameSync(prev, nextSync, session.role)
          if (chosenRole === session.role) {
            next = startRegularPlayerTurn(next)
          }
          return next
        })
        return
      }
      void (async () => {
        await publishFirstPlayerChoice(session.roomId, chosenRole)
        const latest = getRoomGameSync(session.roomId) ?? (await fetchRoomGameSync(session.roomId))
        if (latest) {
          applySyncToGame(latest, session.role)
        }
      })()
    },
    [applySyncToGame, isDevPreview, roomSync, session.role, session.roomId],
  )

  const handleBack = useCallback(() => {
    if (!isDevPreview) {
      void clearRoomGameSync(session.roomId)
      clearActiveSession()
    }
    onBack()
  }, [isDevPreview, onBack, session.roomId])

  const handleAction = useCallback(
    (mode: ActionMode) => {
      applyGame((prev) => setActionMode(prev, mode))
    },
    [applyGame],
  )

  const handleZoneClick = useCallback(
    (zoneId: ZoneId) => {
      applyGame((prev) => {
        if (prev.actionMode === 'draw') {
          return handleDrawFromZone(prev, zoneId)
        }
        if (prev.actionMode === 'look') {
          return handleLookZone(prev, zoneId)
        }
        if (prev.actionMode === 'move' && prev.moveSourceInstanceId) {
          return handleMoveToZone(prev, zoneId)
        }
        return prev
      })
    },
    [applyGame],
  )

  const handleCardClick = useCallback(
    (instanceId: string) => {
      if (game) {
        const legendHeroCard =
          findLegendHeroCard(game.zones, instanceId) ??
          findLegendHeroCard(game.opponentZones, instanceId)
        if (legendHeroCard) {
          setPreviewCard(getCardMeta(legendHeroCard))
          return
        }
      }

      let previewMeta: BaseCard | null = null

      applyGame((prev) => {
        if (prev.turnPhase === 'mulligan' && !prev.playerMulliganDone) {
          return toggleMulliganSelect(prev, instanceId)
        }
        if (prev.actionMode === 'discard') {
          return toggleDiscardSelect(prev, instanceId)
        }
        if (prev.actionMode === 'tap') {
          return toggleTapSelect(prev, instanceId)
        }
        if (prev.actionMode === 'untap') {
          return toggleUntapSelect(prev, instanceId)
        }
        if (prev.actionMode === 'move') {
          return handleMoveSelect(prev, instanceId)
        }
        if (prev.actionMode === 'recycle') {
          return toggleRecycleSelect(prev, instanceId)
        }
        if (prev.actionMode === null && prev.turnPhase === 'main') {
          const card = findPlayerCard(prev, instanceId)
          if (card) {
            previewMeta = getCardMeta(card)
          }
        }
        return prev
      })

      if (previewMeta) {
        setPreviewCard(previewMeta)
      }
    },
    [applyGame, game],
  )

  const zoneHighlight = useMemo(() => {
    if (!game) {
      return new Set<ZoneId>()
    }
    if (game.turnPhase === 'mulligan' && !game.playerMulliganDone) {
      return new Set<ZoneId>(['hand'])
    }
    if (!game.actionMode) {
      return new Set<ZoneId>()
    }
    if (game.actionMode === 'draw') {
      return new Set<ZoneId>(['mainDeck', 'runeDeck', 'discard'])
    }
    if (game.actionMode === 'look') {
      return new Set<ZoneId>(['discard'])
    }
    if (game.actionMode === 'move' && game.moveSourceInstanceId) {
      return new Set<ZoneId>(['base', 'battlefieldA', 'battlefieldB'])
    }
    return new Set<ZoneId>()
  }, [game])

  const isSelected = useCallback(
    (instanceId: string) => (game ? isCardSelected(game, instanceId) : false),
    [game],
  )

  const runeColors = RUNE_COLORS
  const runeColorLabel = RUNE_COLOR_LABELS
  const runeColorById = useMemo(() => getRuneColorById(), [])
  const activeRuneColors = useMemo(() => {
    const colorSet = new Set<RuneColor>()
    for (const [cardId, count] of Object.entries(session.playerDeck.runeDeck)) {
      if (count <= 0) {
        continue
      }
      const color = runeColorById.get(cardId)
      if (color) {
        colorSet.add(color)
      }
    }
    return [...colorSet]
  }, [session.playerDeck.runeDeck, runeColorById])

  const opponentBattlefieldUnits = useMemo(() => {
    if (!game) {
      return []
    }
    return [...game.opponentZones.battlefieldA, ...game.opponentZones.battlefieldB]
  }, [game?.opponentZones.battlefieldA, game?.opponentZones.battlefieldB])

  if (loading || !game) {
    return (
      <main className="game-board">
        <p>正在加载对局…</p>
      </main>
    )
  }

  const showBattlefieldSelect = game.turnPhase === 'battlefieldSelect'
  const showBattlefieldZones = !showBattlefieldSelect
  const needsPlayerBattlefieldPick =
    showBattlefieldSelect && game.playerBattlefieldChoice === null
  const showMulliganBanner = game.turnPhase === 'mulligan'
  const diceResultsReady =
    game.playerDice !== null && game.opponentDice !== null
  const isFirstPlayerPending =
    game.turnPhase === 'firstPlayerChoice' &&
    roomSync?.firstPlayer === null &&
    diceResultsReady
  const isDiceWinnerChoosing =
    isFirstPlayerPending && roomSync?.diceWinner === session.role
  const isDiceLoserWaiting =
    isFirstPlayerPending && roomSync?.diceWinner !== session.role
  const showDiceOverlay =
    game.turnPhase === 'diceRoll' || isFirstPlayerPending

  return (
    <main className="game-board">
      <header className="game-header">
        <div>
          <h1>对战房间</h1>
          <p>
            房间号：{session.roomId} · {session.role === 'host' ? '房主' : '加入者'}
          </p>
        </div>
        <button type="button" className="btn ghost" onClick={handleBack}>
          返回构建
        </button>
      </header>

      <div
        className={`status-bar ${
          needsPlayerBattlefieldPick || showMulliganBanner ? 'status-bar-prompt' : ''
        }`}
      >
        {game.statusMessage}
      </div>

      {showMulliganBanner ? (
        <div className="phase-banner mulligan-banner">
          开局调度：点击手牌区选择最多 2 张放回牌堆底部（已选 {game.mulliganSelected.length}/2）
          {game.opponentMulliganDone ? ' · 对手已完成调度' : ''}
        </div>
      ) : null}

      <section className="mirror-board">
        <div className="board-side opponent-side">
          <header className="opponent-side-header">
            <h2>对手区域</h2>
            <span className="opponent-meta">
              主牌堆剩余：{game.opponentZones.mainDeck.length} · 手牌数量：{game.opponentZones.hand.length}
            </span>
          </header>
          <section className="opponent-legend-hero-row">
            <ZonePanel
              zoneId="legend"
              title="对手传奇区"
              cards={game.opponentZones.legend}
              getCardMeta={getCardMeta}
              onCardClick={handleCardClick}
              className="zone-slot-fixed zone-legend"
            />
            <ZonePanel
              zoneId="hero"
              title="对手 Hero 区"
              cards={game.opponentZones.hero}
              getCardMeta={getCardMeta}
              onCardClick={handleCardClick}
              className="zone-slot-fixed zone-hero"
            />
          </section>
          <section className="top-zones opponent-top-zones">
            <ZonePanel
              zoneId="discard"
              title="对手废牌堆"
              cards={game.opponentZones.discard}
              getCardMeta={getCardMeta}
              className="zone-slot-fixed"
            />
            <ZonePanel
              zoneId="runeBoard"
              title="对手符文展示区"
              cards={game.opponentZones.runeBoard}
              getCardMeta={getCardMeta}
              className="zone-slot-rune-board opponent-rune-board"
            />
          </section>
          <section className="opponent-second-row">
            <ZonePanel
              zoneId="base"
              title="对手基地区"
              cards={game.opponentZones.base}
              getCardMeta={getCardMeta}
              className="zone-slot-base opponent-base-zone"
            />
          </section>
        </div>

        <div className="battleline">
          <article className="battlefield-card">
            {showBattlefieldSelect ? (
              <BattlefieldOpponentPanel
                title="战场A（我方）"
                battlefieldId={game.playerBattlefieldChoice}
                waitingText="尚未选择战场"
              />
            ) : showBattlefieldZones ? (
              <BattlefieldZone
                zoneId="battlefieldA"
                title="战场A（我方）"
                battlefieldId={game.playerBattlefieldChoice}
                unitCards={game.zones.battlefieldA}
                getCardMeta={getCardMeta}
                highlight={zoneHighlight.has('battlefieldA')}
                onZoneClick={() => handleZoneClick('battlefieldA')}
                onCardClick={handleCardClick}
                isCardSelected={isSelected}
              />
            ) : null}
          </article>

          <article className="score-center">
            <div className="score-compact-row">
              <button
                type="button"
                className="btn score-btn"
                onClick={() => applyGame((prev) => adjustScore(prev, 'opponent', -1))}
                aria-label="对手减分"
              >
                −
              </button>
              <div className="score-number opponent">{game.opponentScore}</div>
              <button
                type="button"
                className="btn score-btn"
                onClick={() => applyGame((prev) => adjustScore(prev, 'opponent', 1))}
                aria-label="对手加分"
              >
                +
              </button>
            </div>
            <div className="score-compact-row">
              <button
                type="button"
                className="btn score-btn"
                onClick={() => applyGame((prev) => adjustScore(prev, 'player', -1))}
                aria-label="我方减分"
              >
                −
              </button>
              <div className="score-number player">{game.playerScore}</div>
              <button
                type="button"
                className="btn score-btn"
                onClick={() => applyGame((prev) => adjustScore(prev, 'player', 1))}
                aria-label="我方加分"
              >
                +
              </button>
            </div>
          </article>

          <article className="battlefield-card">
            {showBattlefieldSelect ? (
              <BattlefieldOpponentPanel
                title="战场B（对手）"
                battlefieldId={game.opponentBattlefieldChoice}
              />
            ) : showBattlefieldZones ? (
              <BattlefieldZone
                zoneId="battlefieldB"
                title="战场B（对手）"
                battlefieldId={game.opponentBattlefieldChoice}
                unitCards={opponentBattlefieldUnits}
                extraPlayerCards={game.zones.battlefieldB}
                getCardMeta={getCardMeta}
                highlight={zoneHighlight.has('battlefieldB')}
                onZoneClick={() => handleZoneClick('battlefieldB')}
                onCardClick={handleCardClick}
                isCardSelected={isSelected}
              />
            ) : null}
          </article>
        </div>
      </section>

      <section className="player-board">
        <ZonePanel
          zoneId="legend"
          title="Legend 传奇区"
          cards={game.zones.legend}
          getCardMeta={getCardMeta}
          onCardClick={handleCardClick}
          isCardSelected={isSelected}
          className="zone-slot-fixed zone-legend"
        />
        <ZonePanel
          zoneId="hero"
          title="Hero 英雄单位区"
          cards={game.zones.hero}
          getCardMeta={getCardMeta}
          onCardClick={handleCardClick}
          isCardSelected={isSelected}
          className="zone-slot-fixed zone-hero"
        />
        <ZonePanel
          zoneId="base"
          title="基地区"
          cards={game.zones.base}
          getCardMeta={getCardMeta}
          highlight={zoneHighlight.has('base')}
          onZoneClick={() => handleZoneClick('base')}
          onCardClick={handleCardClick}
          isCardSelected={isSelected}
          className="zone-slot-base"
        />
        <ZonePanel
          zoneId="mainDeck"
          title="主牌堆"
          cards={game.zones.mainDeck}
          getCardMeta={getCardMeta}
          faceDown
          highlight={zoneHighlight.has('mainDeck')}
          onZoneClick={() => handleZoneClick('mainDeck')}
          className="zone-slot-fixed zone-main-deck zone-pile"
        />
        <ZonePanel
          zoneId="runeDeck"
          title="符文堆"
          cards={game.zones.runeDeck}
          getCardMeta={getCardMeta}
          faceDown
          highlight={zoneHighlight.has('runeDeck')}
          onZoneClick={() => handleZoneClick('runeDeck')}
          className="zone-slot-fixed zone-rune-deck zone-pile"
        />
        <ZonePanel
          zoneId="runeBoard"
          title={
            <span className="rune-board-title">
              符文展示区
              <span className="rune-resource-group">
                <span className="rune-resource">法力 {game.mana}</span>
                <button
                  type="button"
                  className="btn rune-adjust-btn"
                  onClick={(event) => {
                    event.stopPropagation()
                    applyGame((prev) => adjustMana(prev, -1))
                  }}
                  aria-label="法力减少1"
                >
                  −
                </button>
                <button
                  type="button"
                  className="btn rune-adjust-btn"
                  onClick={(event) => {
                    event.stopPropagation()
                    applyGame((prev) => adjustMana(prev, 1))
                  }}
                  aria-label="法力增加1"
                >
                  +
                </button>
              </span>
              {(activeRuneColors.length > 0 ? activeRuneColors : runeColors).map((color) => (
                <span key={color} className="rune-resource-group">
                  <span className="rune-resource">
                    {runeColorLabel[color]}符能 {game.runeEnergy[color]}
                  </span>
                  <button
                    type="button"
                    className="btn rune-adjust-btn"
                    onClick={(event) => {
                      event.stopPropagation()
                      applyGame((prev) => adjustRuneEnergy(prev, color, -1))
                    }}
                    aria-label={`${runeColorLabel[color]}符能减少1`}
                  >
                    −
                  </button>
                  <button
                    type="button"
                    className="btn rune-adjust-btn"
                    onClick={(event) => {
                      event.stopPropagation()
                      applyGame((prev) => adjustRuneEnergy(prev, color, 1))
                    }}
                    aria-label={`${runeColorLabel[color]}符能增加1`}
                  >
                    +
                  </button>
                </span>
              ))}
            </span>
          }
          cards={game.zones.runeBoard}
          getCardMeta={getCardMeta}
          onCardClick={handleCardClick}
          isCardSelected={isSelected}
          className="zone-slot-rune-board"
        />
        <ZonePanel
          zoneId="discard"
          title="废牌堆"
          cards={game.zones.discard}
          getCardMeta={getCardMeta}
          pileDisplay="faceUpTop"
          highlight={zoneHighlight.has('discard')}
          onZoneClick={() => handleZoneClick('discard')}
          onCardClick={handleCardClick}
          isCardSelected={isSelected}
          className="zone-slot-fixed zone-discard zone-pile zone-discard-pile"
        />
      </section>

      <section className="player-bottom-row">
        <ZonePanel
          zoneId="hand"
          title="手牌区"
          cards={game.zones.hand}
          getCardMeta={getCardMeta}
          highlight={zoneHighlight.has('hand')}
          onZoneClick={() => handleZoneClick('hand')}
          onCardClick={handleCardClick}
          isCardSelected={isSelected}
          className={`zone-slot-hand ${showMulliganBanner && !game.playerMulliganDone ? 'mulligan-active' : ''}`}
        />
        <ActionBar
          actionMode={game.actionMode}
          turnPhase={game.turnPhase}
          isPlayerTurn={game.isPlayerTurn}
          playerMulliganDone={game.playerMulliganDone}
          opponentMulliganDone={game.opponentMulliganDone}
          mulliganSelectedCount={game.mulliganSelected.length}
          onAction={handleAction}
          onEndTurn={handleEndTurn}
          onConfirmDiscard={() => applyGame((prev) => confirmDiscard(prev))}
          onConfirmTap={() => applyGame((prev) => confirmTap(prev))}
          onConfirmUntap={() => applyGame((prev) => confirmUntap(prev))}
          onConfirmRecycle={() => applyGame((prev) => confirmRecycle(prev))}
          onFinishMulligan={handleFinishMulligan}
          onUndo={undo}
          selectedActionCount={game.selectedInstanceIds.length}
          canUndo={history.length > 0}
        />
      </section>

      <LookPileModal
        open={game.lookTargetZone !== null}
        title="废牌堆"
        cards={game.lookTargetZone ? game.zones[game.lookTargetZone] : []}
        getCardMeta={getCardMeta}
        onClose={() => applyGame((prev) => clearLookTarget(prev))}
      />

      <BattlefieldSelectModal
        open={needsPlayerBattlefieldPick}
        battlefieldIds={game.playerBattlefieldOptions}
        selectedId={game.playerBattlefieldChoice}
        statusMessage={game.statusMessage}
        opponentLegend={session.opponentDeck.legend}
        onSelect={handlePickPlayerBattlefield}
      />

      <DiceRollOverlay
        open={showDiceOverlay}
        playerDice={game.playerDice}
        opponentDice={game.opponentDice}
        diceRollGeneration={roomSync?.diceRollGeneration ?? 0}
        onRollComplete={handleDiceRollComplete}
        showFirstPlayerChoice={isDiceWinnerChoosing}
        waitingForWinnerChoice={isDiceLoserWaiting}
        onChooseSelf={() => handleFirstPlayerChoice('self')}
        onChooseOpponent={() => handleFirstPlayerChoice('opponent')}
      />

      <CardPreviewModal
        open={previewCard !== null}
        card={previewCard}
        onClose={() => setPreviewCard(null)}
      />
    </main>
  )
}

export default GameBoardPage
