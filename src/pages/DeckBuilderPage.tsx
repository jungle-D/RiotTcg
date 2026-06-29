import { useEffect, useMemo, useState } from 'react'
import type { ChangeEvent } from 'react'
import CardSelectModal from '../components/CardSelectModal'
import MainDeckSelectModal from '../components/MainDeckSelectModal'
import DeckSectionCard from '../components/DeckSectionCard'
import JoinRoomModal from '../components/game/JoinRoomModal'
import battlefieldsData from '../../data/imported/loltcg/normalized/battlefields.json'
import equipmentData from '../../data/imported/loltcg/normalized/equipment.json'
import exclusivesData from '../../data/imported/loltcg/normalized/exclusives.json'
import heroesData from '../../data/imported/loltcg/normalized/heroes.json'
import legendsData from '../../data/imported/loltcg/normalized/legends.json'
import legendHeroMappingData from '../../data/imported/loltcg/normalized/legend2hero.json'
import runesData from '../../data/imported/loltcg/normalized/runes.json'
import spellsData from '../../data/imported/loltcg/normalized/spells.json'
import unitsData from '../../data/imported/loltcg/normalized/units.json'
import type { BaseCard, DeckState, MainCard, MainDeckFilterCategory, RuneCard } from '../types/cards'
import type { GameSession } from '../types/game'
import { isRuneColor } from '../constants/runeColors'
import { createRoom, joinRoom } from '../services/roomService'
import { createOnlineRoom, joinOnlineRoom } from '../services/network/roomClient'
import { getOrCreateClientId } from '../utils/clientId'
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
  getDeckValidationMessages,
  isDeckComplete,
  isRuneColorAllowed,
  validateDeck,
} from '../utils/deckRules'
import { loadDeckStateFromStorage, saveDeckStateToStorage } from '../utils/deckBuilderStorage'
import { getMainDeckFilterBounds } from '../utils/mainDeckFilters'
import './DeckBuilderPage.css'

interface ImportedCard {
  id: string
  name: string
  image: string
  description: string
  projectMainType?: string
  official?: {
    cardCategory?: string
    cardColorList?: string[]
    energy?: number | null
    returnEnergy?: number | null
  }
}

const importedLegends = legendsData as ImportedCard[]
const importedHeroes = heroesData as ImportedCard[]
const importedRunes = runesData as ImportedCard[]
const importedBattlefields = battlefieldsData as ImportedCard[]
const importedUnits = unitsData as ImportedCard[]
const importedSpells = spellsData as ImportedCard[]
const importedEquipment = equipmentData as ImportedCard[]
const importedExclusives = exclusivesData as ImportedCard[]

function toBaseCard(card: ImportedCard): BaseCard {
  return {
    id: card.id,
    name: card.name,
    image: card.image,
    description: card.description,
  }
}

function toMainType(card: ImportedCard): MainCard['type'] {
  if (card.official?.cardCategory === 'hero_unit') return 'hero'
  const explicit = card.projectMainType
  if (explicit === 'spell') return 'spell'
  if (explicit === 'hero') return 'hero'
  if (explicit === 'wandering') return 'wandering'
  if (explicit === 'defense') return 'defense'
  if (explicit === 'equipment') return 'defense'
  return 'unit'
}

function toFilterCategory(card: ImportedCard): MainDeckFilterCategory {
  const category = card.official?.cardCategory ?? ''
  if (category === 'hero_unit') return 'hero'
  if (category === 'spell' || category === 'exclusive_spell') return 'spell'
  if (category === 'equipment' || category === 'exclusive_equipment') return 'equipment'
  return 'unit'
}

function toMainCard(card: ImportedCard): MainCard {
  const energy = card.official?.energy
  const returnEnergy = card.official?.returnEnergy
  return {
    ...toBaseCard(card),
    type: toMainType(card),
    category: card.official?.cardCategory ?? '',
    filterCategory: toFilterCategory(card),
    energy: typeof energy === 'number' ? energy : null,
    returnEnergy: typeof returnEnergy === 'number' ? returnEnergy : null,
    colors: card.official?.cardColorList ?? [],
  }
}

function toRuneCard(card: ImportedCard): RuneCard | null {
  const colors = card.official?.cardColorList ?? []
  const color = colors.find(isRuneColor)
  if (!color) {
    return null
  }
  return {
    ...toBaseCard(card),
    color: color as RuneCard['color'],
  }
}

const MAIN_DECK_SOURCE_CARDS = [
  ...importedUnits,
  ...importedSpells,
  ...importedEquipment,
  ...importedHeroes,
  ...importedExclusives,
]

const GLOBAL_MAIN_DECK_FILTER_BOUNDS = getMainDeckFilterBounds(
  MAIN_DECK_SOURCE_CARDS.map(toMainCard),
)

function allowByLegendColors(colors: string[], selectedLegendColors: Set<string>): boolean {
  if (colors.includes('colorless')) {
    return true
  }
  if (selectedLegendColors.size === 0) {
    return false
  }
  return colors.some((color) => selectedLegendColors.has(color))
}

function buildMainDeckCandidates(selectedLegendColors: Set<string>): MainCard[] {
  return MAIN_DECK_SOURCE_CARDS.filter((card) => {
    const category = card.official?.cardCategory ?? ''
    if (
      category === 'legendary' ||
      category === 'rune' ||
      category === 'battlefield' ||
      category.startsWith('indicator_')
    ) {
      return false
    }
    const colors = card.official?.cardColorList ?? []
    if (category.startsWith('exclusive_')) {
      const nonColorless = colors.filter((color) => color !== 'colorless')
      if (nonColorless.length === 0) {
        return true
      }
      if (selectedLegendColors.size === 0) {
        return false
      }
      return nonColorless.every((color) => selectedLegendColors.has(color))
    }
    return allowByLegendColors(colors, selectedLegendColors)
  }).map(toMainCard)
}

function buildRuneCards(selectedLegendColors: Set<string>): RuneCard[] {
  return importedRunes
    .map(toRuneCard)
    .filter((card): card is RuneCard => card !== null)
    .filter((card) => selectedLegendColors.has(card.color))
}

type ModalType = 'legend' | 'hero' | 'main' | 'rune' | 'battlefield' | null
interface DeckExportPayload {
  version: 1
  exportedAt: string
  deck: {
    legendId: string | null
    heroId: string | null
    mainDeck: Record<string, number>
    runeDeck: Record<string, number>
    battlefield: string[]
  }
}
const MAIN_DECK_DRAFT_STORAGE_KEY = 'riottcg.mainDeckDraft'
const LEGEND_DRAFT_STORAGE_KEY = 'riottcg.legendDraftId'
const HERO_DRAFT_STORAGE_KEY = 'riottcg.heroDraftId'
const RUNE_DECK_DRAFT_STORAGE_KEY = 'riottcg.runeDeckDraft'
const BATTLEFIELD_DRAFT_STORAGE_KEY = 'riottcg.battlefieldDraft'

function loadDraftIdFromStorage(storageKey: string): string | null {
  try {
    const raw = window.localStorage.getItem(storageKey)
    return raw && raw.trim().length > 0 ? raw : null
  } catch {
    return null
  }
}

function loadMainDeckDraftFromStorage(): Record<string, number> {
  try {
    const raw = window.localStorage.getItem(MAIN_DECK_DRAFT_STORAGE_KEY)
    if (!raw) {
      return {}
    }
    const parsed = JSON.parse(raw) as Record<string, unknown>
    const filtered = Object.fromEntries(
      Object.entries(parsed).filter(
        ([, value]) => Number.isFinite(value) && Number(value) > 0,
      ),
    )
    return filtered as Record<string, number>
  } catch {
    return {}
  }
}

function loadCounterDraftFromStorage(storageKey: string): Record<string, number> {
  try {
    const raw = window.localStorage.getItem(storageKey)
    if (!raw) {
      return {}
    }
    const parsed = JSON.parse(raw) as Record<string, unknown>
    return Object.fromEntries(
      Object.entries(parsed).filter(([, value]) => Number.isFinite(value) && Number(value) > 0),
    ) as Record<string, number>
  } catch {
    return {}
  }
}

function loadArrayDraftFromStorage(storageKey: string): string[] {
  try {
    const raw = window.localStorage.getItem(storageKey)
    if (!raw) {
      return []
    }
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) {
      return []
    }
    return parsed.filter((item): item is string => typeof item === 'string' && item.length > 0)
  } catch {
    return []
  }
}

function getCardName(cardId: string, cards: BaseCard[]): string {
  return cards.find((card) => card.id === cardId)?.name ?? cardId
}

interface DeckBuilderPageProps {
  onEnterGame: (session: GameSession) => void
  onHostWaiting: (roomId: string) => void
  onOpenLegendHeroMapping: () => void
  onOpenRoomDev: () => void
}

function DeckBuilderPage({
  onEnterGame,
  onHostWaiting,
  onOpenLegendHeroMapping,
  onOpenRoomDev,
}: DeckBuilderPageProps) {
  const [deckState, setDeckState] = useState<DeckState>(() => loadDeckStateFromStorage())
  const [activeModal, setActiveModal] = useState<ModalType>(null)

  useEffect(() => {
    saveDeckStateToStorage(deckState)
  }, [deckState])

  const [draftLegendId, setDraftLegendId] = useState<string | null>(() =>
    loadDraftIdFromStorage(LEGEND_DRAFT_STORAGE_KEY),
  )
  const [legendDraftInitialized, setLegendDraftInitialized] = useState(
    () => loadDraftIdFromStorage(LEGEND_DRAFT_STORAGE_KEY) !== null,
  )
  const [draftHeroId, setDraftHeroId] = useState<string | null>(() =>
    loadDraftIdFromStorage(HERO_DRAFT_STORAGE_KEY),
  )
  const [heroDraftInitialized, setHeroDraftInitialized] = useState(
    () => loadDraftIdFromStorage(HERO_DRAFT_STORAGE_KEY) !== null,
  )
  const [draftMainDeck, setDraftMainDeck] = useState<Record<string, number>>(() =>
    loadMainDeckDraftFromStorage(),
  )
  const [mainDeckDraftInitialized, setMainDeckDraftInitialized] = useState(
    () => Object.keys(loadMainDeckDraftFromStorage()).length > 0,
  )
  const [draftRuneDeck, setDraftRuneDeck] = useState<Record<string, number>>(() =>
    loadCounterDraftFromStorage(RUNE_DECK_DRAFT_STORAGE_KEY),
  )
  const [runeDeckDraftInitialized, setRuneDeckDraftInitialized] = useState(
    () => Object.keys(loadCounterDraftFromStorage(RUNE_DECK_DRAFT_STORAGE_KEY)).length > 0,
  )
  const [draftBattlefield, setDraftBattlefield] = useState<string[]>(() =>
    loadArrayDraftFromStorage(BATTLEFIELD_DRAFT_STORAGE_KEY),
  )
  const [battlefieldDraftInitialized, setBattlefieldDraftInitialized] = useState(
    () => loadArrayDraftFromStorage(BATTLEFIELD_DRAFT_STORAGE_KEY).length > 0,
  )
  const [mainDeckError, setMainDeckError] = useState('')
  const [runeError, setRuneError] = useState('')
  const [battlefieldError, setBattlefieldError] = useState('')
  const [joinModalOpen, setJoinModalOpen] = useState(false)
  const [joinError, setJoinError] = useState('')
  const [lobbyError, setLobbyError] = useState('')
  const [importError, setImportError] = useState('')

  useEffect(() => {
    try {
      if (Object.keys(draftMainDeck).length === 0) {
        window.localStorage.removeItem(MAIN_DECK_DRAFT_STORAGE_KEY)
        return
      }
      window.localStorage.setItem(
        MAIN_DECK_DRAFT_STORAGE_KEY,
        JSON.stringify(draftMainDeck),
      )
    } catch {
      // ignore storage write errors
    }
  }, [draftMainDeck])

  useEffect(() => {
    try {
      if (!draftLegendId) {
        window.localStorage.removeItem(LEGEND_DRAFT_STORAGE_KEY)
        return
      }
      window.localStorage.setItem(LEGEND_DRAFT_STORAGE_KEY, draftLegendId)
    } catch {
      // ignore storage write errors
    }
  }, [draftLegendId])

  useEffect(() => {
    try {
      if (!draftHeroId) {
        window.localStorage.removeItem(HERO_DRAFT_STORAGE_KEY)
        return
      }
      window.localStorage.setItem(HERO_DRAFT_STORAGE_KEY, draftHeroId)
    } catch {
      // ignore storage write errors
    }
  }, [draftHeroId])

  useEffect(() => {
    try {
      if (Object.keys(draftRuneDeck).length === 0) {
        window.localStorage.removeItem(RUNE_DECK_DRAFT_STORAGE_KEY)
        return
      }
      window.localStorage.setItem(RUNE_DECK_DRAFT_STORAGE_KEY, JSON.stringify(draftRuneDeck))
    } catch {
      // ignore storage write errors
    }
  }, [draftRuneDeck])

  useEffect(() => {
    try {
      if (draftBattlefield.length === 0) {
        window.localStorage.removeItem(BATTLEFIELD_DRAFT_STORAGE_KEY)
        return
      }
      window.localStorage.setItem(BATTLEFIELD_DRAFT_STORAGE_KEY, JSON.stringify(draftBattlefield))
    } catch {
      // ignore storage write errors
    }
  }, [draftBattlefield])

  const legendHeroMapping = legendHeroMappingData.mapping as Record<string, string[]>
  const isLegendHeroMappingEnabled =
    String(import.meta.env.VITE_ENABLE_LEGEND_HERO_MAPPING ?? '').toLowerCase() === 'true'
  const typedLegendCards = useMemo(() => importedLegends.map(toBaseCard), [])
  const typedHeroCards = useMemo(() => importedHeroes.map(toBaseCard), [])
  const typedBattlefieldCards = useMemo(() => importedBattlefields.map(toBaseCard), [])

  const legendColorMap = useMemo(() => {
    const map = new Map<string, Set<string>>()
    for (const legend of importedLegends) {
      map.set(legend.id, new Set(legend.official?.cardColorList ?? []))
    }
    return map
  }, [])

  const selectedLegendColors = useMemo(
    () => (deckState.legend ? legendColorMap.get(deckState.legend.id) ?? new Set<string>() : new Set<string>()),
    [deckState.legend, legendColorMap],
  )

  const mainDeckCandidates = useMemo(
    () => buildMainDeckCandidates(selectedLegendColors),
    [selectedLegendColors],
  )

  const typedRuneCards = useMemo(
    () => buildRuneCards(selectedLegendColors),
    [selectedLegendColors],
  )

  const typedMainCards = useMemo(() => mainDeckCandidates, [mainDeckCandidates])
  const legendById = useMemo(
    () => new Map(typedLegendCards.map((card) => [card.id, card])),
    [typedLegendCards],
  )
  const heroById = useMemo(
    () => new Map(typedHeroCards.map((card) => [card.id, card])),
    [typedHeroCards],
  )
  const battlefieldCardIdSet = useMemo(
    () => new Set(typedBattlefieldCards.map((card) => card.id)),
    [typedBattlefieldCards],
  )

  const validation = useMemo(
    () => validateDeck(deckState, typedMainCards, typedRuneCards, legendHeroMapping),
    [deckState, typedMainCards, typedRuneCards, legendHeroMapping],
  )

  const deckValidationMessages = useMemo(
    () => getDeckValidationMessages(validation, deckState),
    [validation, deckState],
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
      return []
    }
    const allowedIds = legendHeroMapping[deckState.legend.id] ?? []
    return typedHeroCards.filter((hero) => allowedIds.includes(hero.id))
  }, [deckState.legend, legendHeroMapping])

  const openLegendModal = () => {
    if (!legendDraftInitialized) {
      setDraftLegendId(deckState.legend?.id ?? null)
      setLegendDraftInitialized(true)
    }
    setActiveModal('legend')
  }

  const openHeroModal = () => {
    if (!heroDraftInitialized) {
      setDraftHeroId(deckState.hero?.id ?? null)
      setHeroDraftInitialized(true)
    }
    setActiveModal('hero')
  }

  const openMainDeckModal = () => {
    if (!mainDeckDraftInitialized) {
      setDraftMainDeck(deckState.mainDeck)
      setMainDeckDraftInitialized(true)
    }
    setMainDeckError('')
    setActiveModal('main')
  }

  const openRuneModal = () => {
    if (!runeDeckDraftInitialized) {
      setDraftRuneDeck(deckState.runeDeck)
      setRuneDeckDraftInitialized(true)
    }
    setRuneError('')
    setActiveModal('rune')
  }

  const openBattlefieldModal = () => {
    if (!battlefieldDraftInitialized) {
      setDraftBattlefield(deckState.battlefield)
      setBattlefieldDraftInitialized(true)
    }
    setBattlefieldError('')
    setActiveModal('battlefield')
  }

  const handleLegendConfirm = () => {
    const nextLegend = typedLegendCards.find((card) => card.id === draftLegendId) ?? null
    const legendChanged = deckState.legend?.id !== nextLegend?.id

    setDeckState((prev) => {
      const changed = prev.legend?.id !== nextLegend?.id
      if (changed) {
        return {
          legend: nextLegend,
          hero: null,
          mainDeck: {},
          runeDeck: {},
          battlefield: [],
        }
      }
      return { ...prev, legend: nextLegend }
    })

    if (legendChanged) {
      setDraftHeroId(null)
      setHeroDraftInitialized(false)
      setDraftMainDeck({})
      setMainDeckDraftInitialized(false)
      setDraftRuneDeck({})
      setRuneDeckDraftInitialized(false)
      setDraftBattlefield([])
      setBattlefieldDraftInitialized(false)
    }

    setDraftLegendId(null)
    setLegendDraftInitialized(false)
    setActiveModal(null)
  }

  const handleHeroConfirm = () => {
    const nextHero = typedHeroCards.find((card) => card.id === draftHeroId) ?? null
    if (
      nextHero &&
      deckState.legend &&
      !(legendHeroMapping[deckState.legend.id] ?? []).includes(nextHero.id)
    ) {
      return
    }
    setDeckState((prev) => ({ ...prev, hero: nextHero }))
    setDraftHeroId(null)
    setHeroDraftInitialized(false)
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
    const candidateValidation = validateDeck(
      candidate,
      typedMainCards,
      typedRuneCards,
      legendHeroMapping,
    )

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
    setDraftMainDeck({})
    setMainDeckDraftInitialized(false)
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
    setDraftRuneDeck({})
    setRuneDeckDraftInitialized(false)
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
    setDraftBattlefield([])
    setBattlefieldDraftInitialized(false)
    setActiveModal(null)
  }

  const mainDeckSummary = `${validation.mainDeckTotal}/${MAIN_DECK_TARGET}，英雄 ${
    validation.mainDeckHeroCount
  }/${MAIN_DECK_HERO_LIMIT}`
  const runeSummary = `${validation.runeTotal}/${RUNE_DECK_TARGET}，${validation.runeColorCount}/${RUNE_COLOR_LIMIT} 色`
  const battlefieldSummary = `${validation.battlefieldTotal}/${BATTLEFIELD_TARGET}`

  const handleCreateRoom = async () => {
    if (!deckComplete) {
      setLobbyError(deckValidationMessages.join('；'))
      return
    }
    setLobbyError('')
    const roomId = createRoom()
    const created = await createOnlineRoom(roomId, deckState, getOrCreateClientId())
    if (!created.ok) {
      setLobbyError(
        created.reason === 'room_exists'
          ? '房间号冲突，请重试。'
          : '创建房间失败：无法连接游戏服务器，请确认已运行 npm run dev。',
      )
      return
    }
    onHostWaiting(roomId)
  }

  const handleJoinRoom = async (roomId: string) => {
    if (!deckComplete) {
      setLobbyError(deckValidationMessages.join('；'))
      return
    }
    if (!joinRoom(roomId)) {
      setJoinError('房间号格式无效，请输入 4-8 位数字。')
      return
    }
    const joined = await joinOnlineRoom(roomId, deckState, getOrCreateClientId())
    if (!joined.ok) {
      const hints: Record<typeof joined.reason, string> = {
        not_found: `未找到房间 ${roomId.trim()}。请确认房主已创建房间且双方都能访问 ${window.location.origin}。`,
        already_joined: '该房间已有玩家加入，请让房主重新创建房间。',
        network_error: '加入失败：无法连接游戏服务器，请确认已运行 npm run dev。',
      }
      setJoinError(hints[joined.reason])
      return
    }
    setJoinError('')
    setJoinModalOpen(false)
    onEnterGame({
      roomId: roomId.trim(),
      role: 'guest',
      playerDeck: deckState,
      opponentDeck: joined.hostDeck,
    })
  }

  const handleExportDeck = () => {
    const payload: DeckExportPayload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      deck: {
        legendId: deckState.legend?.id ?? null,
        heroId: deckState.hero?.id ?? null,
        mainDeck: deckState.mainDeck,
        runeDeck: deckState.runeDeck,
        battlefield: deckState.battlefield,
      },
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `deck-${Date.now()}.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  const resetDraftState = () => {
    setDraftLegendId(null)
    setLegendDraftInitialized(false)
    setDraftHeroId(null)
    setHeroDraftInitialized(false)
    setDraftMainDeck({})
    setMainDeckDraftInitialized(false)
    setDraftRuneDeck({})
    setRuneDeckDraftInitialized(false)
    setDraftBattlefield([])
    setBattlefieldDraftInitialized(false)
    setMainDeckError('')
    setRuneError('')
    setBattlefieldError('')
    setLobbyError('')
  }

  const handleImportDeck = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as DeckExportPayload
        const incoming = parsed.deck
        if (!incoming) {
          throw new Error('文件缺少 deck 字段')
        }
        const legend = incoming.legendId ? legendById.get(incoming.legendId) ?? null : null
        const hero = incoming.heroId ? heroById.get(incoming.heroId) ?? null : null
        const importLegendColors = legend
          ? legendColorMap.get(legend.id) ?? new Set<string>()
          : new Set<string>()
        const importMainCards = buildMainDeckCandidates(importLegendColors)
        const importRuneCards = buildRuneCards(importLegendColors)
        const importMainCardIdSet = new Set(importMainCards.map((card) => card.id))
        const importRuneCardIdSet = new Set(importRuneCards.map((card) => card.id))
        const mainDeck = Object.fromEntries(
          Object.entries(incoming.mainDeck ?? {}).filter(
            ([id, count]) => importMainCardIdSet.has(id) && Number(count) > 0,
          ),
        )
        const runeDeck = Object.fromEntries(
          Object.entries(incoming.runeDeck ?? {}).filter(
            ([id, count]) => importRuneCardIdSet.has(id) && Number(count) > 0,
          ),
        )
        const battlefield = (incoming.battlefield ?? []).filter((id) => battlefieldCardIdSet.has(id))
        const nextDeckState: DeckState = {
          legend,
          hero,
          mainDeck,
          runeDeck,
          battlefield,
        }
        const nextValidation = validateDeck(
          nextDeckState,
          importMainCards,
          importRuneCards,
          legendHeroMapping,
        )
        const validationMessages = getDeckValidationMessages(nextValidation, nextDeckState)

        resetDraftState()
        setDeckState(nextDeckState)
        if (validationMessages.length > 0) {
          setImportError(`导入完成，但卡组未达标：${validationMessages.join('；')}`)
        } else {
          setImportError('')
        }
      } catch (error) {
        setImportError(`导入失败：${error instanceof Error ? error.message : 'JSON 格式错误'}`)
      } finally {
        event.target.value = ''
      }
    }
    reader.readAsText(file, 'utf8')
  }

  return (
    <main className="deck-page">
      <header>
        <h1>卡组构建</h1>
        <p>先用本地 JSON 模拟数据打通流程，后续可切到联网获取数据。</p>
        <button
          type="button"
          className="btn ghost"
          onClick={onOpenLegendHeroMapping}
          disabled={!isLegendHeroMappingEnabled}
          title={
            isLegendHeroMappingEnabled
              ? '打开传奇-英雄映射配置'
              : '默认禁用，可通过 VITE_ENABLE_LEGEND_HERO_MAPPING=true 启用'
          }
        >
          配置传奇-英雄映射
        </button>
        <button type="button" className="btn ghost" onClick={onOpenRoomDev}>
          房间 UI 预览
        </button>
      </header>
      <section className="deck-file-actions">
        <button type="button" className="btn" onClick={handleExportDeck}>
          保存当前卡组 JSON
        </button>
        <label className="btn ghost deck-import-btn">
          导入卡组 JSON
          <input type="file" accept="application/json,.json" onChange={handleImportDeck} />
        </label>
      </section>
      {importError ? <p className="join-error">{importError}</p> : null}

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
          subtitle="仅可选择当前传奇映射的英雄单位。"
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
          subtitle="仅传奇支持颜色，且不含传奇/符文/战场/指示物。"
          valueText={mainDeckSummary}
          statusText={validation.isMainDeckValid ? '规则通过' : '未达标'}
          statusType={validation.isMainDeckValid ? 'ok' : 'warn'}
          onClick={openMainDeckModal}
        />

        <DeckSectionCard
          title="符文堆"
          subtitle="仅可选择传奇支持颜色的符文。"
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
            ? `当前传奇为 ${deckState.legend.name}，仅展示已映射英雄。`
            : '请先选择传奇卡。'
        }
        onSingleChoose={setDraftHeroId}
        onClose={() => setActiveModal(null)}
        onConfirm={handleHeroConfirm}
      />

      <MainDeckSelectModal
        open={activeModal === 'main'}
        title="主牌堆选择（39 张）"
        cards={typedMainCards}
        filterBounds={GLOBAL_MAIN_DECK_FILTER_BOUNDS}
        legendColors={Array.from(selectedLegendColors)}
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
        previewRotatable
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
            : deckValidationMessages.length > 0
              ? `卡组未达标：${deckValidationMessages.join('；')}`
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
              setLobbyError('')
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
      {lobbyError ? <p className="join-error">{lobbyError}</p> : null}
      {joinError ? <p className="join-error">{joinError}</p> : null}
    </main>
  )
}

export default DeckBuilderPage
