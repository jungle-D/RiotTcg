import { useMemo, useState } from 'react'
import CardSelectModal from '../components/CardSelectModal'
import DeckSectionCard from '../components/DeckSectionCard'
import JoinRoomModal from '../components/game/JoinRoomModal'
import battlefieldCards from '../data/cards.battlefield.json'
import heroCards from '../data/cards.hero.json'
import legendCards from '../data/cards.legend.json'
import mainCards from '../data/cards.main.json'
import runeCards from '../data/cards.rune.json'
import type { BaseCard, DeckState, MainCard, RuneCard } from '../types/cards'
import type { GameSession } from '../types/game'
import { createRoom, joinRoom } from '../services/roomService'
import {
  BATTLEFIELD_TARGET,
  MAIN_DECK_HERO_LIMIT,
  CARD_PER_COPY_LIMIT,
  MAIN_DECK_SAME_NAME_LIMIT,
  MAIN_DECK_TARGET,
  RUNE_DECK_TARGET,
  RUNE_COLOR_LIMIT,
  countFromRecord,
  getActiveRuneColors,
  isDeckComplete,
  isRuneColorAllowed,
  validateDeck,
} from '../utils/deckRules'
import './DeckBuilderPage.css'

const typedMainCards = mainCards as MainCard[]
const typedRuneCards = runeCards as RuneCard[]
const typedLegendCards = legendCards as BaseCard[]
const typedHeroCards = heroCards as BaseCard[]
const typedBattlefieldCards = battlefieldCards as BaseCard[]

type ModalType = 'legend' | 'hero' | 'main' | 'rune' | 'battlefield' | null

function getCardName(cardId: string, cards: BaseCard[]): string {
  return cards.find((card) => card.id === cardId)?.name ?? cardId
}

interface DeckBuilderPageProps {
  onEnterGame: (session: GameSession) => void
}

function DeckBuilderPage({ onEnterGame }: DeckBuilderPageProps) {
  const [deckState, setDeckState] = useState<DeckState>({
    legend: null,
    hero: null,
    mainDeck: {},
    runeDeck: {},
    battlefield: [],
  })
  const [activeModal, setActiveModal] = useState<ModalType>(null)

  const [draftLegendId, setDraftLegendId] = useState<string | null>(null)
  const [draftHeroId, setDraftHeroId] = useState<string | null>(null)
  const [draftMainDeck, setDraftMainDeck] = useState<Record<string, number>>({})
  const [draftRuneDeck, setDraftRuneDeck] = useState<Record<string, number>>({})
  const [draftBattlefield, setDraftBattlefield] = useState<string[]>([])
  const [mainDeckError, setMainDeckError] = useState('')
  const [runeError, setRuneError] = useState('')
  const [battlefieldError, setBattlefieldError] = useState('')
  const [joinModalOpen, setJoinModalOpen] = useState(false)
  const [joinError, setJoinError] = useState('')

  const validation = useMemo(
    () => validateDeck(deckState, typedMainCards, typedRuneCards),
    [deckState],
  )

  const deckComplete = useMemo(
    () => isDeckComplete(validation, deckState),
    [validation, deckState],
  )

  const draftMainDeckTotal = useMemo(
    () => countFromRecord(draftMainDeck),
    [draftMainDeck],
  )

  const draftRuneTotal = useMemo(
    () => countFromRecord(draftRuneDeck),
    [draftRuneDeck],
  )

  const draftRuneColorCount = useMemo(
    () => getActiveRuneColors(draftRuneDeck, typedRuneCards).length,
    [draftRuneDeck],
  )

  const draftRuneDisabledIncrementIds = useMemo(
    () =>
      typedRuneCards
        .filter(
          (card) =>
            (draftRuneDeck[card.id] ?? 0) === 0 &&
            !isRuneColorAllowed(draftRuneDeck, typedRuneCards, card.id),
        )
        .map((card) => card.id),
    [draftRuneDeck],
  )

  const heroCandidates = useMemo(() => {
    if (!deckState.legend) {
      return typedHeroCards
    }
    return typedHeroCards.filter((hero) => hero.name === deckState.legend?.name)
  }, [deckState.legend])

  const openLegendModal = () => {
    setDraftLegendId(deckState.legend?.id ?? null)
    setActiveModal('legend')
  }

  const openHeroModal = () => {
    setDraftHeroId(deckState.hero?.id ?? null)
    setActiveModal('hero')
  }

  const openMainDeckModal = () => {
    setDraftMainDeck(deckState.mainDeck)
    setMainDeckError('')
    setActiveModal('main')
  }

  const openRuneModal = () => {
    setDraftRuneDeck(deckState.runeDeck)
    setRuneError('')
    setActiveModal('rune')
  }

  const openBattlefieldModal = () => {
    setDraftBattlefield(deckState.battlefield)
    setBattlefieldError('')
    setActiveModal('battlefield')
  }

  const handleLegendConfirm = () => {
    const nextLegend = typedLegendCards.find((card) => card.id === draftLegendId) ?? null
    setDeckState((prev) => {
      const shouldClearHero = prev.hero && nextLegend && prev.hero.name !== nextLegend.name
      return {
        ...prev,
        legend: nextLegend,
        hero: shouldClearHero ? null : prev.hero,
      }
    })
    setActiveModal(null)
  }

  const handleHeroConfirm = () => {
    const nextHero = typedHeroCards.find((card) => card.id === draftHeroId) ?? null
    if (nextHero && deckState.legend && nextHero.name !== deckState.legend.name) {
      return
    }
    setDeckState((prev) => ({ ...prev, hero: nextHero }))
    setActiveModal(null)
  }

  const handleMainDeckCounter = (cardId: string, nextCount: number) => {
    const currentCount = draftMainDeck[cardId] ?? 0
    if (nextCount > currentCount && draftMainDeckTotal >= MAIN_DECK_TARGET) {
      return
    }

    const safeNextCount = Math.min(CARD_PER_COPY_LIMIT, Math.max(0, nextCount))
    setDraftMainDeck((prev) => {
      const next = { ...prev }
      if (safeNextCount === 0) {
        delete next[cardId]
      } else {
        next[cardId] = safeNextCount
      }
      return next
    })
  }

  const handleRuneCounter = (cardId: string, nextCount: number) => {
    const currentCount = draftRuneDeck[cardId] ?? 0
    const safeNextCount = Math.max(0, nextCount)

    if (safeNextCount > currentCount) {
      if (draftRuneTotal >= RUNE_DECK_TARGET) {
        return
      }
      if (
        currentCount === 0 &&
        !isRuneColorAllowed(draftRuneDeck, typedRuneCards, cardId)
      ) {
        return
      }
    }

    setDraftRuneDeck((prev) => {
      const next = { ...prev }
      if (safeNextCount === 0) {
        delete next[cardId]
      } else {
        next[cardId] = safeNextCount
      }
      return next
    })
  }

  const handleMainDeckConfirm = () => {
    const candidate: DeckState = {
      ...deckState,
      mainDeck: draftMainDeck,
    }
    const candidateValidation = validateDeck(candidate, typedMainCards, typedRuneCards)

    if (candidateValidation.mainDeckTotal !== MAIN_DECK_TARGET) {
      setMainDeckError(`主牌堆需要 ${MAIN_DECK_TARGET} 张，当前 ${candidateValidation.mainDeckTotal} 张。`)
      return
    }
    if (candidateValidation.mainDeckHeroCount > MAIN_DECK_HERO_LIMIT) {
      setMainDeckError(
        `主牌堆英雄单位最多 ${MAIN_DECK_HERO_LIMIT} 张，当前 ${candidateValidation.mainDeckHeroCount} 张。`,
      )
      return
    }
    if (candidateValidation.mainDeckNameOverLimit.length > 0) {
      setMainDeckError(
        `同名卡最多 ${MAIN_DECK_SAME_NAME_LIMIT} 张，超限：${candidateValidation.mainDeckNameOverLimit.join(', ')}`,
      )
      return
    }

    setDeckState((prev) => ({ ...prev, mainDeck: draftMainDeck }))
    setActiveModal(null)
  }

  const handleRuneConfirm = () => {
    const total = countFromRecord(draftRuneDeck)
    const colorCount = getActiveRuneColors(draftRuneDeck, typedRuneCards).length

    if (colorCount > RUNE_COLOR_LIMIT) {
      setRuneError(`符文堆最多选择 ${RUNE_COLOR_LIMIT} 种颜色，当前 ${colorCount} 种。`)
      return
    }
    if (total !== RUNE_DECK_TARGET) {
      setRuneError(`符文堆需要 ${RUNE_DECK_TARGET} 张，当前 ${total} 张。`)
      return
    }
    setDeckState((prev) => ({ ...prev, runeDeck: draftRuneDeck }))
    setActiveModal(null)
  }

  const handleBattlefieldToggle = (cardId: string) => {
    setDraftBattlefield((prev) => {
      if (prev.includes(cardId)) {
        return prev.filter((id) => id !== cardId)
      }
      if (prev.length >= BATTLEFIELD_TARGET) {
        return prev
      }
      return [...prev, cardId]
    })
  }

  const handleBattlefieldConfirm = () => {
    if (draftBattlefield.length !== BATTLEFIELD_TARGET) {
      setBattlefieldError(`战场卡必须选择 ${BATTLEFIELD_TARGET} 张，当前 ${draftBattlefield.length} 张。`)
      return
    }
    setDeckState((prev) => ({ ...prev, battlefield: draftBattlefield }))
    setActiveModal(null)
  }

  const mainDeckSummary = `${validation.mainDeckTotal}/${MAIN_DECK_TARGET}，英雄 ${
    validation.mainDeckHeroCount
  }/${MAIN_DECK_HERO_LIMIT}`
  const runeSummary = `${validation.runeTotal}/${RUNE_DECK_TARGET}，${validation.runeColorCount}/${RUNE_COLOR_LIMIT} 色`
  const battlefieldSummary = `${validation.battlefieldTotal}/${BATTLEFIELD_TARGET}`

  const handleCreateRoom = () => {
    if (!deckComplete) {
      return
    }
    const roomId = createRoom()
    onEnterGame({ deckState, roomId, role: 'host' })
  }

  const handleJoinRoom = (roomId: string) => {
    if (!deckComplete) {
      return
    }
    if (!joinRoom(roomId)) {
      setJoinError('房间号格式无效，请输入 4-8 位数字。')
      return
    }
    setJoinError('')
    setJoinModalOpen(false)
    onEnterGame({ deckState, roomId: roomId.trim(), role: 'guest' })
  }

  return (
    <main className="deck-page">
      <header>
        <h1>卡组构建</h1>
        <p>先用本地 JSON 模拟数据打通流程，后续可切到联网获取数据。</p>
      </header>

      <section className="section-grid">
        <DeckSectionCard
          title="Legend 传奇卡"
          subtitle="先选择传奇卡，再进行后续搭建。"
          valueText={deckState.legend ? `已选：${deckState.legend.name}` : '尚未选择'}
          statusText={deckState.legend ? '已完成' : '待选择'}
          statusType={deckState.legend ? 'ok' : 'warn'}
          onClick={openLegendModal}
        />

        <DeckSectionCard
          title="Hero 英雄单位"
          subtitle="只能选择与传奇卡同名的英雄卡。"
          valueText={deckState.hero ? `已选：${deckState.hero.name}` : '尚未选择'}
          statusText={
            !deckState.hero
              ? '待选择'
              : validation.isHeroValid
                ? '规则通过'
                : '与传奇不匹配'
          }
          statusType={deckState.hero && validation.isHeroValid ? 'ok' : 'warn'}
          disabled={!deckState.legend}
          onClick={openHeroModal}
        />

        <DeckSectionCard
          title="主牌堆"
          subtitle="选择 39 张；英雄单位最多 5；单卡最多 3。"
          valueText={mainDeckSummary}
          statusText={validation.isMainDeckValid ? '规则通过' : '未达标'}
          statusType={validation.isMainDeckValid ? 'ok' : 'warn'}
          onClick={openMainDeckModal}
        />

        <DeckSectionCard
          title="符文堆"
          subtitle={`最多 ${RUNE_COLOR_LIMIT} 种颜色，合计 ${RUNE_DECK_TARGET} 张。`}
          valueText={runeSummary}
          statusText={validation.isRuneValid ? '规则通过' : '未达标'}
          statusType={validation.isRuneValid ? 'ok' : 'warn'}
          onClick={openRuneModal}
        />

        <DeckSectionCard
          title="战场区"
          subtitle="选择 3 张战场卡，且不能重复。"
          valueText={battlefieldSummary}
          statusText={validation.isBattlefieldValid ? '规则通过' : '未达标'}
          statusType={validation.isBattlefieldValid ? 'ok' : 'warn'}
          onClick={openBattlefieldModal}
        />
      </section>

      <section className="summary">
        <h2>当前卡组概览</h2>
        <ul>
          <li>传奇卡：{deckState.legend?.name ?? '未选择'}</li>
          <li>英雄卡：{deckState.hero?.name ?? '未选择'}</li>
          <li>主牌堆总数：{validation.mainDeckTotal}</li>
          <li>符文堆总数：{validation.runeTotal}（{validation.runeColorCount} 种颜色）</li>
          <li>
            战场卡：
            {deckState.battlefield.length > 0
              ? deckState.battlefield
                  .map((id) => getCardName(id, typedBattlefieldCards))
                  .join('、')
              : '未选择'}
          </li>
        </ul>
      </section>

      <CardSelectModal
        open={activeModal === 'legend'}
        title="选择传奇卡（Legend）"
        cards={typedLegendCards}
        mode="single"
        selectedId={draftLegendId}
        helperText="请选择 1 张传奇卡。"
        onSingleChoose={setDraftLegendId}
        onClose={() => setActiveModal(null)}
        onConfirm={handleLegendConfirm}
      />

      <CardSelectModal
        open={activeModal === 'hero'}
        title="选择英雄单位（Hero）"
        cards={heroCandidates}
        mode="single"
        selectedId={draftHeroId}
        helperText={
          deckState.legend
            ? `当前传奇为 ${deckState.legend.name}，仅展示同名英雄。`
            : '请先选择传奇卡。'
        }
        onSingleChoose={setDraftHeroId}
        onClose={() => setActiveModal(null)}
        onConfirm={handleHeroConfirm}
      />

      <CardSelectModal
        open={activeModal === 'main'}
        title="主牌堆选择（39 张）"
        cards={typedMainCards}
        mode="counter"
        selectedCounters={draftMainDeck}
        helperText={`规则：总计 ${MAIN_DECK_TARGET} 张；英雄最多 ${MAIN_DECK_HERO_LIMIT} 张；单卡最多 ${CARD_PER_COPY_LIMIT} 张。`}
        errorText={mainDeckError}
        maxCountPerCard={CARD_PER_COPY_LIMIT}
        counterTarget={MAIN_DECK_TARGET}
        onCounterChange={handleMainDeckCounter}
        onClose={() => setActiveModal(null)}
        onConfirm={handleMainDeckConfirm}
      />

      <CardSelectModal
        open={activeModal === 'rune'}
        title="符文堆选择（12 张）"
        cards={typedRuneCards}
        mode="counter"
        selectedCounters={draftRuneDeck}
        helperText={`最多选择 ${RUNE_COLOR_LIMIT} 种颜色，合计 ${RUNE_DECK_TARGET} 张，每种颜色数量不限。当前已选 ${draftRuneColorCount} 种颜色。`}
        errorText={runeError}
        counterTarget={RUNE_DECK_TARGET}
        disabledIncrementCardIds={draftRuneDisabledIncrementIds}
        onCounterChange={handleRuneCounter}
        onClose={() => setActiveModal(null)}
        onConfirm={handleRuneConfirm}
      />

      <CardSelectModal
        open={activeModal === 'battlefield'}
        title="战场卡选择（3 张，不重复）"
        cards={typedBattlefieldCards}
        mode="multi"
        selectedIds={draftBattlefield}
        disabledCardIds={
          draftBattlefield.length >= BATTLEFIELD_TARGET
            ? typedBattlefieldCards
                .filter((card) => !draftBattlefield.includes(card.id))
                .map((card) => card.id)
            : []
        }
        maxMulti={BATTLEFIELD_TARGET}
        helperText="选择 3 张不同的战场卡。"
        errorText={battlefieldError}
        onMultiToggle={handleBattlefieldToggle}
        onClose={() => setActiveModal(null)}
        onConfirm={handleBattlefieldConfirm}
      />

      <footer className="lobby-bar">
        <p>
          {deckComplete
            ? '卡组已达标，可创建或加入房间进入对战。'
            : '请完成全部卡组区域配置后，方可进入对战房间。'}
        </p>
        <div className="lobby-actions">
          <button
            type="button"
            className="btn primary"
            disabled={!deckComplete}
            onClick={handleCreateRoom}
          >
            创建房间
          </button>
          <button
            type="button"
            className="btn"
            disabled={!deckComplete}
            onClick={() => {
              setJoinError('')
              setJoinModalOpen(true)
            }}
          >
            加入房间
          </button>
        </div>
      </footer>

      <JoinRoomModal
        open={joinModalOpen}
        onClose={() => setJoinModalOpen(false)}
        onConfirm={handleJoinRoom}
      />
      {joinError ? <p className="join-error">{joinError}</p> : null}
    </main>
  )
}

export default DeckBuilderPage
