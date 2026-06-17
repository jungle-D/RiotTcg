import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import ActionBar from '../components/game/ActionBar'
import BattlefieldOpponentPanel from '../components/game/BattlefieldOpponentPanel'
import BattlefieldSelectModal from '../components/game/BattlefieldSelectModal'
import BattlefieldZone from '../components/game/BattlefieldZone'
import CardPreviewModal from '../components/game/CardPreviewModal'
import LookPileModal from '../components/game/LookPileModal'
import ZonePanel from '../components/game/ZonePanel'
import { getCardMeta as lookupCardMeta, getRuneColorById } from '../data/loltcgCatalog'
import {
  clearBattlefieldSync,
  getBattlefieldSync,
  getBattlefieldSyncStorageKey,
  initBattlefieldSync,
  publishBattlefieldChoice,
} from '../services/gameSyncService'
import type { BaseCard } from '../types/cards'
import type { ActionMode, GameCardInstance, GameSession, GameState, RuneColor, ZoneId } from '../types/game'
import {
  adjustMana,
  adjustRuneEnergy,
  adjustScore,
  applyBattlefieldSync,
  clearLookTarget,
  confirmDiscard,
  confirmRecycle,
  confirmTap,
  confirmUntap,
  endTurn,
  findCardZone,
  finishMulligan,
  handleDrawFromZone,
  handleLookZone,
  handleMoveSelect,
  handleMoveToZone,
  initGame,
  isCardSelected,
  pickPlayerBattlefield,
  rollForFirstPlayer,
  setActionMode,
  startOpponentTurnEnd,
  toggleDiscardSelect,
  toggleMulliganSelect,
  toggleRecycleSelect,
  toggleTapSelect,
  toggleUntapSelect,
} from '../utils/gameState'
import './GameBoardPage.css'

interface GameBoardPageProps {
  session: GameSession
  onBack: () => void
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

function GameBoardPage({ session, onBack }: GameBoardPageProps) {
  const [game, setGame] = useState(() =>
    initGame(session.playerDeck, session.opponentDeck, session.roomId),
  )
  const [history, setHistory] = useState<GameState[]>([])
  const [previewCard, setPreviewCard] = useState<BaseCard | null>(null)
  const skipHistoryRef = useRef(false)

  const applyGame = useCallback((updater: (prev: GameState) => GameState) => {
    setGame((prev) => {
      if (!skipHistoryRef.current) {
        setHistory((stack) => [...stack.slice(-49), prev])
      }
      skipHistoryRef.current = false
      return updater(prev)
    })
  }, [])

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
      publishBattlefieldChoice(session.roomId, session.role, battlefieldId)
      applyGame((prev) => {
        const afterPick = pickPlayerBattlefield(prev, battlefieldId)
        const sync = getBattlefieldSync(session.roomId)
        if (!sync) {
          return afterPick
        }
        return applyBattlefieldSync(afterPick, sync, session.role)
      })
    },
    [applyGame, session.roomId, session.role],
  )

  const handleBack = useCallback(() => {
    clearBattlefieldSync(session.roomId)
    onBack()
  }, [onBack, session.roomId])

  useEffect(() => {
    initBattlefieldSync(session.roomId)

    const applyRemoteSync = () => {
      const sync = getBattlefieldSync(session.roomId)
      if (!sync) {
        return
      }
      setGame((prev) => {
        if (prev.turnPhase !== 'battlefieldSelect') {
          return prev
        }
        skipHistoryRef.current = true
        return applyBattlefieldSync(prev, sync, session.role)
      })
    }

    applyRemoteSync()

    const onStorage = (event: StorageEvent) => {
      if (event.key === getBattlefieldSyncStorageKey(session.roomId)) {
        applyRemoteSync()
      }
    }

    window.addEventListener('storage', onStorage)
    const timer = window.setInterval(applyRemoteSync, 400)

    return () => {
      window.removeEventListener('storage', onStorage)
      window.clearInterval(timer)
    }
  }, [session.roomId, session.role])

  useEffect(() => {
    if (game.turnPhase !== 'waitingOpponent') {
      return
    }

    const timer = window.setTimeout(() => {
      skipHistoryRef.current = true
      setGame((prev) => startOpponentTurnEnd(prev))
    }, 2000)

    return () => window.clearTimeout(timer)
  }, [game.turnPhase])

  const lookOpen = game.lookTargetZone !== null
  const canRollDice =
    game.turnPhase === 'diceRoll' &&
    game.playerBattlefieldChoice !== null &&
    game.opponentBattlefieldChoice !== null &&
    game.openingHandsReady &&
    game.playerMulliganDone &&
    game.opponentMulliganDone &&
    game.playerDice === null

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
      let previewMeta: BaseCard | null = null

      applyGame((prev) => {
        if (prev.turnPhase === 'mulligan') {
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
    [applyGame],
  )

  const zoneHighlight = useMemo(() => {
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
  }, [game.actionMode, game.moveSourceInstanceId])

  const isSelected = useCallback(
    (instanceId: string) => isCardSelected(game, instanceId),
    [game],
  )

  const runeColors: RuneColor[] = ['red', 'blue', 'green', 'purple']
  const runeColorLabel: Record<RuneColor, string> = {
    red: '红',
    blue: '蓝',
    green: '绿',
    purple: '紫',
  }
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

  const showBattlefieldSelect = game.turnPhase === 'battlefieldSelect'
  const showBattlefieldZones = !showBattlefieldSelect
  const needsPlayerBattlefieldPick =
    showBattlefieldSelect && game.playerBattlefieldChoice === null

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
        className={`status-bar ${needsPlayerBattlefieldPick ? 'status-bar-prompt' : ''}`}
      >
        {game.statusMessage}
      </div>

      <section className="mirror-board">
        <div className="board-side opponent-side">
          <h2>对手区域</h2>
          <section className="top-zones">
            <ZonePanel
              zoneId="legend"
              title="对手传奇区"
              cards={game.opponentZones.legend}
              getCardMeta={getCardMeta}
            />
            <ZonePanel
              zoneId="hero"
              title="对手 Hero 区"
              cards={game.opponentZones.hero}
              getCardMeta={getCardMeta}
            />
            <ZonePanel
              zoneId="base"
              title="对手基地区"
              cards={game.opponentZones.base}
              getCardMeta={getCardMeta}
              className="field-zone"
            />
            <ZonePanel
              zoneId="runeBoard"
              title="对手符文展示区"
              cards={game.opponentZones.runeBoard}
              getCardMeta={getCardMeta}
              className="field-zone"
            />
          </section>
          <section className="top-zones opponent-compact-row">
            <ZonePanel
              zoneId="discard"
              title="对手废牌堆"
              cards={game.opponentZones.discard}
              getCardMeta={getCardMeta}
            />
            <div className="opponent-counts">
              <h3>对手隐藏信息</h3>
              <p>主牌堆剩余：{game.opponentZones.mainDeck.length}</p>
              <p>手牌数量：{game.opponentZones.hand.length}</p>
            </div>
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
                cards={game.zones.battlefieldA}
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
                cards={game.zones.battlefieldB}
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
          highlight={zoneHighlight.has('discard')}
          onZoneClick={() => handleZoneClick('discard')}
          onCardClick={handleCardClick}
          isCardSelected={isSelected}
          className="zone-slot-fixed zone-discard"
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
          className="zone-slot-hand"
        />
        <ActionBar
          actionMode={game.actionMode}
          turnPhase={game.turnPhase}
          isPlayerTurn={game.isPlayerTurn}
          playerDice={game.playerDice}
          opponentDice={game.opponentDice}
          onAction={handleAction}
          onEndTurn={() => applyGame((prev) => endTurn(prev))}
          onConfirmDiscard={() => applyGame((prev) => confirmDiscard(prev))}
          onConfirmTap={() => applyGame((prev) => confirmTap(prev))}
          onConfirmUntap={() => applyGame((prev) => confirmUntap(prev))}
          onConfirmRecycle={() => applyGame((prev) => confirmRecycle(prev))}
          onFinishMulligan={() => applyGame((prev) => finishMulligan(prev))}
          onRollDice={() => applyGame((prev) => rollForFirstPlayer(prev))}
          onUndo={undo}
          selectedActionCount={game.selectedInstanceIds.length}
          canRollDice={canRollDice}
          canUndo={history.length > 0}
        />
      </section>

      <LookPileModal
        open={lookOpen}
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
        onSelect={handlePickPlayerBattlefield}
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
