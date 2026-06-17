import { useCallback, useEffect, useMemo, useState } from 'react'
import ActionBar from '../components/game/ActionBar'
import LookPileModal from '../components/game/LookPileModal'
import ZonePanel from '../components/game/ZonePanel'
import battlefieldCards from '../data/cards.battlefield.json'
import heroCards from '../data/cards.hero.json'
import legendCards from '../data/cards.legend.json'
import mainCards from '../data/cards.main.json'
import runeCards from '../data/cards.rune.json'
import type { BaseCard, MainCard, RuneCard } from '../types/cards'
import type { ActionMode, GameCardInstance, GameSession, RuneColor, ZoneId } from '../types/game'
import {
  adjustMana,
  adjustRuneEnergy,
  adjustScore,
  clearLookTarget,
  confirmDiscard,
  confirmTap,
  confirmUntap,
  endTurn,
  finishMulligan,
  handleDrawFromZone,
  handleLookZone,
  handleMoveSelect,
  handleMoveToZone,
  handleRecycle,
  initGameFromDeck,
  isCardSelected,
  pickBattlefield,
  rollForFirstPlayer,
  setActionMode,
  startOpponentTurnEnd,
  toggleDiscardSelect,
  toggleMulliganSelect,
  toggleTapSelect,
  toggleUntapSelect,
} from '../utils/gameState'
import './GameBoardPage.css'

const typedMainCards = mainCards as MainCard[]
const typedLegendCards = legendCards as BaseCard[]
const typedHeroCards = heroCards as BaseCard[]
const typedRuneCards = runeCards as RuneCard[]
const typedBattlefieldCards = battlefieldCards as BaseCard[]

const cardCatalog = new Map<string, BaseCard>()
for (const card of [
  ...typedLegendCards,
  ...typedHeroCards,
  ...typedMainCards,
  ...typedRuneCards,
]) {
  cardCatalog.set(card.id, card)
}
for (const card of typedBattlefieldCards) {
  cardCatalog.set(card.id, card)
}

interface GameBoardPageProps {
  session: GameSession
  onBack: () => void
}

function getCardMeta(card: GameCardInstance): BaseCard | null {
  return cardCatalog.get(card.cardId) ?? null
}

function getBattlefieldName(id: string | null): string {
  if (!id) {
    return '未选择'
  }
  return cardCatalog.get(id)?.name ?? id
}

function GameBoardPage({ session, onBack }: GameBoardPageProps) {
  const [game, setGame] = useState(() =>
    initGameFromDeck(session.deckState, session.roomId),
  )

  useEffect(() => {
    if (game.turnPhase !== 'waitingOpponent') {
      return
    }

    const timer = window.setTimeout(() => {
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

  const handleAction = useCallback((mode: ActionMode) => {
    setGame((prev) => setActionMode(prev, mode))
  }, [])

  const handleZoneClick = useCallback((zoneId: ZoneId) => {
    setGame((prev) => {
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
  }, [])

  const handleCardClick = useCallback((instanceId: string) => {
    setGame((prev) => {
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
        return handleRecycle(prev, instanceId)
      }
      return prev
    })
  }, [])

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
  const runeColorById = useMemo(
    () =>
      new Map<string, RuneColor>(
        typedRuneCards.map((card) => [card.id, card.color]),
      ),
    [],
  )
  const activeRuneColors = useMemo(() => {
    const colorSet = new Set<RuneColor>()
    for (const [cardId, count] of Object.entries(session.deckState.runeDeck)) {
      if (count <= 0) {
        continue
      }
      const color = runeColorById.get(cardId)
      if (color) {
        colorSet.add(color)
      }
    }
    return [...colorSet]
  }, [session.deckState.runeDeck, runeColorById])

  return (
    <main className="game-board">
      <header className="game-header">
        <div>
          <h1>对战房间</h1>
          <p>
            房间号：{session.roomId} · {session.role === 'host' ? '房主' : '加入者'}
          </p>
        </div>
        <button type="button" className="btn ghost" onClick={onBack}>
          返回构建
        </button>
      </header>

      <div className="status-bar">{game.statusMessage}</div>

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
            <h3>战场A（我方）</h3>
            {game.turnPhase === 'diceRoll' ? (
              <div className="battlefield-options">
                {(game.playerBattlefieldChoice
                  ? [game.playerBattlefieldChoice]
                  : game.playerBattlefieldOptions
                ).map((id) => (
                  <button
                    key={id}
                    type="button"
                    className={`btn ${game.playerBattlefieldChoice === id ? 'active' : ''}`}
                    onClick={() => setGame((prev) => pickBattlefield(prev, 'player', id))}
                  >
                    {cardCatalog.get(id)?.name ?? id}
                  </button>
                ))}
              </div>
            ) : (
              <ZonePanel
                zoneId="battlefieldA"
                title={getBattlefieldName(game.playerBattlefieldChoice)}
                cards={game.zones.battlefieldA}
                getCardMeta={getCardMeta}
                highlight={zoneHighlight.has('battlefieldA')}
                onZoneClick={() => handleZoneClick('battlefieldA')}
                onCardClick={handleCardClick}
                isCardSelected={isSelected}
              />
            )}
          </article>

          <article className="score-center">
            <div className="score-compact-row">
              <button
                type="button"
                className="btn score-btn"
                onClick={() => setGame((prev) => adjustScore(prev, 'opponent', -1))}
                aria-label="对手减分"
              >
                −
              </button>
              <div className="score-number opponent">{game.opponentScore}</div>
              <button
                type="button"
                className="btn score-btn"
                onClick={() => setGame((prev) => adjustScore(prev, 'opponent', 1))}
                aria-label="对手加分"
              >
                +
              </button>
            </div>
            <div className="score-compact-row">
              <button
                type="button"
                className="btn score-btn"
                onClick={() => setGame((prev) => adjustScore(prev, 'player', -1))}
                aria-label="我方减分"
              >
                −
              </button>
              <div className="score-number player">{game.playerScore}</div>
              <button
                type="button"
                className="btn score-btn"
                onClick={() => setGame((prev) => adjustScore(prev, 'player', 1))}
                aria-label="我方加分"
              >
                +
              </button>
            </div>
          </article>

          <article className="battlefield-card">
            <h3>战场B（对手）</h3>
            {game.turnPhase === 'diceRoll' ? (
              <div className="battlefield-options">
                {(game.opponentBattlefieldChoice
                  ? [game.opponentBattlefieldChoice]
                  : game.opponentBattlefieldOptions
                ).map((id) => (
                  <button
                    key={id}
                    type="button"
                    className={`btn ${game.opponentBattlefieldChoice === id ? 'active' : ''}`}
                    onClick={() => setGame((prev) => pickBattlefield(prev, 'opponent', id))}
                  >
                    {cardCatalog.get(id)?.name ?? id}
                  </button>
                ))}
              </div>
            ) : (
              <ZonePanel
                zoneId="battlefieldB"
                title={getBattlefieldName(game.opponentBattlefieldChoice)}
                cards={game.zones.battlefieldB}
                getCardMeta={getCardMeta}
                highlight={zoneHighlight.has('battlefieldB')}
                onZoneClick={() => handleZoneClick('battlefieldB')}
                onCardClick={handleCardClick}
                isCardSelected={isSelected}
              />
            )}
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
          className="zone-slot-fixed zone-main-deck"
        />
        <ZonePanel
          zoneId="runeDeck"
          title="符文堆"
          cards={game.zones.runeDeck}
          getCardMeta={getCardMeta}
          faceDown
          highlight={zoneHighlight.has('runeDeck')}
          onZoneClick={() => handleZoneClick('runeDeck')}
          className="zone-slot-fixed zone-rune-deck"
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
                    setGame((prev) => adjustMana(prev, -1))
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
                    setGame((prev) => adjustMana(prev, 1))
                  }}
                  aria-label="法力增加1"
                >
                  +
                </button>
              </span>
              {(activeRuneColors.length > 0 ? activeRuneColors : runeColors).map((color) => (
                <span key={color} className="rune-resource-group">
                  <span className="rune-resource">{runeColorLabel[color]}符能 {game.runeEnergy[color]}</span>
                  <button
                    type="button"
                    className="btn rune-adjust-btn"
                    onClick={(event) => {
                      event.stopPropagation()
                      setGame((prev) => adjustRuneEnergy(prev, color, -1))
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
                      setGame((prev) => adjustRuneEnergy(prev, color, 1))
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
          onEndTurn={() => setGame((prev) => endTurn(prev))}
          onConfirmDiscard={() => setGame((prev) => confirmDiscard(prev))}
          onConfirmTap={() => setGame((prev) => confirmTap(prev))}
          onConfirmUntap={() => setGame((prev) => confirmUntap(prev))}
          onFinishMulligan={() => setGame((prev) => finishMulligan(prev))}
          onRollDice={() => setGame((prev) => rollForFirstPlayer(prev))}
          selectedActionCount={game.selectedInstanceIds.length}
          canRollDice={canRollDice}
        />
      </section>

      <LookPileModal
        open={lookOpen}
        title="废牌堆"
        cards={game.lookTargetZone ? game.zones[game.lookTargetZone] : []}
        getCardMeta={getCardMeta}
        onClose={() => setGame((prev) => clearLookTarget(prev))}
      />
    </main>
  )
}

export default GameBoardPage
