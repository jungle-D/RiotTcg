import { getRuneColorById } from '../data/loltcgCatalog'
import { RUNE_COLOR_LABELS, emptyRuneEnergy } from '../constants/runeColors'
import type { PlayerRole, RoomGameSyncState } from '../services/gameSyncService'
import type { DeckState } from '../types/cards'
import type {
  ActionMode,
  CardKind,
  GameCardInstance,
  GameState,
  RuneColor,
  ZoneId,
} from '../types/game'
import {
  MULLIGAN_LIMIT,
  OPENING_HAND_DRAW,
  TURN_HAND_DRAW,
  TURN_RUNE_DRAW,
} from '../types/game'

type DeckSide = 'host' | 'guest'

const runeColorById = getRuneColorById()
const runeColorLabel = RUNE_COLOR_LABELS

const instanceCounters: Record<DeckSide, number> = { host: 0, guest: 0 }

export function createSeededRng(seed: string): () => number {
  let hash = 2166136261
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return () => {
    hash += 0x6d2b79f5
    let t = hash
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function resetInstanceCounters(): void {
  instanceCounters.host = 0
  instanceCounters.guest = 0
}

function nextInstanceId(side: DeckSide): string {
  instanceCounters[side] += 1
  return `inst_${side}_${instanceCounters[side]}`
}

function shuffleWithRng<T>(items: T[], rng: () => number): T[] {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

export function cloneZones(
  zones: Record<ZoneId, GameCardInstance[]>,
): Record<ZoneId, GameCardInstance[]> {
  const next = {} as Record<ZoneId, GameCardInstance[]>
  for (const zone of Object.keys(zones) as ZoneId[]) {
    next[zone] = zones[zone].map((card) => ({ ...card }))
  }
  return next
}

function emptyZones(): Record<ZoneId, GameCardInstance[]> {
  return {
    legend: [],
    hero: [],
    mainDeck: [],
    runeDeck: [],
    base: [],
    runeBoard: [],
    battlefieldA: [],
    battlefieldB: [],
    hand: [],
    discard: [],
  }
}

function firstThreeBattlefields(deckState: DeckState): string[] {
  return deckState.battlefield.slice(0, 3)
}

function createInstance(cardId: string, kind: CardKind, side: DeckSide): GameCardInstance {
  return {
    instanceId: nextInstanceId(side),
    cardId,
    kind,
    tapped: false,
  }
}

function expandDeck(
  record: Record<string, number>,
  kind: CardKind,
  side: DeckSide,
): GameCardInstance[] {
  const instances: GameCardInstance[] = []
  for (const [cardId, count] of Object.entries(record)) {
    for (let i = 0; i < count; i += 1) {
      instances.push(createInstance(cardId, kind, side))
    }
  }
  return instances
}

export function rollLocalDice(): number {
  return Math.floor(Math.random() * 6) + 1
}

function roleToSecondPlayer(
  secondPlayerRole: PlayerRole | null,
  role: PlayerRole,
): 'player' | 'opponent' | null {
  if (!secondPlayerRole) {
    return null
  }
  return secondPlayerRole === role ? 'player' : 'opponent'
}

export function findCardZone(
  state: GameState,
  instanceId: string,
): ZoneId | null {
  for (const zone of Object.keys(state.zones) as ZoneId[]) {
    if (state.zones[zone].some((card) => card.instanceId === instanceId)) {
      return zone
    }
  }
  return null
}

function removeFromZone(
  zones: Record<ZoneId, GameCardInstance[]>,
  zone: ZoneId,
  instanceId: string,
): { zones: Record<ZoneId, GameCardInstance[]>; card: GameCardInstance | null } {
  const card = zones[zone].find((item) => item.instanceId === instanceId) ?? null
  if (!card) {
    return { zones, card: null }
  }
  return {
    zones: {
      ...zones,
      [zone]: zones[zone].filter((item) => item.instanceId !== instanceId),
    },
    card,
  }
}

function drawFromZone(
  state: GameState,
  fromZone: ZoneId,
  count: number,
  toZone: ZoneId,
): GameState {
  const next = { ...state, zones: { ...state.zones } }
  let drawn = 0

  while (drawn < count && next.zones[fromZone].length > 0) {
    const [card, ...rest] = next.zones[fromZone]
    next.zones[fromZone] = rest
    next.zones[toZone] = [...next.zones[toZone], card]
    drawn += 1
  }

  return next
}

function untapAllFieldCards(state: GameState): GameState {
  const fieldZones: ZoneId[] = [
    'legend',
    'hero',
    'base',
    'runeBoard',
    'battlefieldA',
    'battlefieldB',
  ]
  const zones = { ...state.zones }

  for (const zone of fieldZones) {
    zones[zone] = zones[zone].map((card) => ({ ...card, tapped: false }))
  }

  return { ...state, zones }
}

function untapAllOpponentFieldCards(state: GameState): GameState {
  const fieldZones: ZoneId[] = [
    'legend',
    'hero',
    'base',
    'runeBoard',
    'battlefieldA',
    'battlefieldB',
  ]
  const opponentZones = { ...state.opponentZones }

  for (const zone of fieldZones) {
    opponentZones[zone] = opponentZones[zone].map((card) => ({ ...card, tapped: false }))
  }

  return { ...state, opponentZones }
}

function drawOpeningHands(state: GameState): GameState {
  let next = drawFromZone(state, 'mainDeck', OPENING_HAND_DRAW, 'hand')
  next = drawOpponent(next, 'mainDeck', OPENING_HAND_DRAW, 'hand')
  return next
}

function initZonesFromDeck(
  deckState: DeckState,
  side: DeckSide,
  shuffleSeed: string,
): Record<ZoneId, GameCardInstance[]> {
  const zones = emptyZones()
  const rng = createSeededRng(`${shuffleSeed}_${side}`)

  if (deckState.legend) {
    zones.legend = [createInstance(deckState.legend.id, 'legend', side)]
  }
  if (deckState.hero) {
    zones.hero = [createInstance(deckState.hero.id, 'hero', side)]
  }
  zones.mainDeck = shuffleWithRng(expandDeck(deckState.mainDeck, 'main', side), rng)
  zones.runeDeck = shuffleWithRng(expandDeck(deckState.runeDeck, 'rune', side), rng)

  return zones
}

export function initGame(
  playerDeck: DeckState,
  opponentDeck: DeckState,
  roomId: string,
  shuffleSeed: string,
  role: PlayerRole,
): GameState {
  resetInstanceCounters()
  const playerSide: DeckSide = role
  const opponentSide: DeckSide = role === 'host' ? 'guest' : 'host'
  const zones = initZonesFromDeck(playerDeck, playerSide, shuffleSeed)
  const opponentZones = initZonesFromDeck(opponentDeck, opponentSide, shuffleSeed)

  return {
    zones,
    opponentZones,
    actionMode: null,
    turnPhase: 'battlefieldSelect',
    mulliganSelected: [],
    selectedInstanceIds: [],
    moveSourceInstanceId: null,
    roomId,
    isPlayerTurn: true,
    statusMessage: '请双方先选择战场。战场确定后将自动各抽4张并进入调度。',
    lookTargetZone: null,
    playerDice: null,
    opponentDice: null,
    playerScore: 0,
    opponentScore: 0,
    playerBattlefieldOptions: firstThreeBattlefields(playerDeck),
    opponentBattlefieldOptions: firstThreeBattlefields(opponentDeck),
    playerBattlefieldChoice: null,
    opponentBattlefieldChoice: null,
    openingHandsReady: false,
    playerMulliganDone: false,
    opponentMulliganDone: false,
    secondPlayer: null,
    firstRoundSecondPlayerBonusPending: false,
    mana: 0,
    runeEnergy: emptyRuneEnergy(),
  }
}

/** @deprecated Use initGame instead */
export function initGameFromDeck(deckState: DeckState, roomId: string): GameState {
  return initGame(deckState, deckState, roomId, 'local_seed', 'host')
}

export function getHostGuestZones(
  state: GameState,
  role: PlayerRole,
): {
  hostZones: Record<ZoneId, GameCardInstance[]>
  guestZones: Record<ZoneId, GameCardInstance[]>
} {
  if (role === 'host') {
    return { hostZones: cloneZones(state.zones), guestZones: cloneZones(state.opponentZones) }
  }
  return { hostZones: cloneZones(state.opponentZones), guestZones: cloneZones(state.zones) }
}

export function applyRoomGameSync(
  state: GameState,
  sync: RoomGameSyncState,
  role: PlayerRole,
): GameState {
  const playerMulliganDone = role === 'host' ? sync.hostMulliganDone : sync.guestMulliganDone
  const opponentMulliganDone = role === 'host' ? sync.guestMulliganDone : sync.hostMulliganDone
  const playerDice = role === 'host' ? sync.hostDice : sync.guestDice
  const opponentDice = role === 'host' ? sync.guestDice : sync.hostDice
  const playerScore = role === 'host' ? sync.hostScore : sync.guestScore
  const opponentScore = role === 'host' ? sync.guestScore : sync.hostScore
  const mana = role === 'host' ? sync.hostMana : sync.guestMana
  const runeEnergy =
    role === 'host' ? { ...sync.hostRuneEnergy } : { ...sync.guestRuneEnergy }

  let next: GameState = {
    ...state,
    playerBattlefieldChoice:
      role === 'host' ? sync.hostBattlefieldChoice : sync.guestBattlefieldChoice,
    opponentBattlefieldChoice:
      role === 'host' ? sync.guestBattlefieldChoice : sync.hostBattlefieldChoice,
    playerMulliganDone,
    opponentMulliganDone,
    playerDice,
    opponentDice,
    playerScore,
    opponentScore,
    mana,
    runeEnergy,
    openingHandsReady: sync.openingHandsReady,
    firstRoundSecondPlayerBonusPending: sync.firstRoundSecondPlayerBonusPending,
    secondPlayer: roleToSecondPlayer(sync.secondPlayer, role),
    turnPhase: sync.turnPhase,
    isPlayerTurn: sync.activePlayer === role && sync.turnPhase === 'main',
  }

  if (sync.hostZones && sync.guestZones) {
    const syncPlayerZones = cloneZones(role === 'host' ? sync.hostZones : sync.guestZones)
    const syncOpponentZones = cloneZones(role === 'host' ? sync.guestZones : sync.hostZones)
    const preserveLocalHand =
      sync.turnPhase === 'mulligan' &&
      !playerMulliganDone &&
      state.zones.hand.length > 0

    if (preserveLocalHand) {
      next.zones = { ...syncPlayerZones, hand: state.zones.hand }
    } else {
      next.zones = syncPlayerZones
    }
    next.opponentZones = syncOpponentZones
  }

  next.mulliganSelected =
    sync.turnPhase === 'mulligan' && !playerMulliganDone
      ? state.mulliganSelected
      : []

  if (sync.turnPhase === 'battlefieldSelect') {
    if (next.playerBattlefieldChoice && !next.opponentBattlefieldChoice) {
      next.statusMessage = '已选择战场，等待对手选择…'
    } else if (!next.playerBattlefieldChoice && next.opponentBattlefieldChoice) {
      next.statusMessage = '对手已选择战场，请选择你的战场。'
    } else if (!next.playerBattlefieldChoice && !next.opponentBattlefieldChoice) {
      next.statusMessage = '请双方先选择战场。战场确定后将自动各抽4张并进入调度。'
    }
  }

  if (sync.turnPhase === 'mulligan') {
    if (playerMulliganDone && opponentMulliganDone) {
      next.statusMessage = '双方调度完成，即将自动投掷骰子决定先手。'
    } else if (playerMulliganDone && !opponentMulliganDone) {
      next.statusMessage = '调度完成，等待对手调度…'
    } else if (!playerMulliganDone && opponentMulliganDone) {
      next.statusMessage = '对手已完成调度，请选择最多 2 张手牌完成调度。'
    } else {
      next.statusMessage = `双方战场已确定，已各抽 ${OPENING_HAND_DRAW} 张手牌。请选择最多 ${MULLIGAN_LIMIT} 张手牌完成调度。`
    }
  }

  if (sync.turnPhase === 'diceRoll') {
    if (playerDice !== null && opponentDice !== null) {
      next.statusMessage = `你掷出 ${playerDice}，对手掷出 ${opponentDice}，正在判定掷骰较高者…`
    } else if (playerDice !== null) {
      next.statusMessage = `你掷出 ${playerDice}，等待对手投掷骰子…`
    } else if (opponentDice !== null) {
      next.statusMessage = `对手已掷出 ${opponentDice}，正在投掷你的骰子…`
    } else {
      next.statusMessage = '双方调度完成，正在自动投掷骰子…'
    }
  }

  if (sync.turnPhase === 'firstPlayerChoice') {
    const isDiceWinner = sync.diceWinner === role
    if (isDiceWinner && sync.firstPlayer === null) {
      next.statusMessage = `你掷出了更高的点数（${playerDice} 对 ${opponentDice}），请选择谁先手。`
    } else if (!isDiceWinner && sync.firstPlayer === null) {
      next.statusMessage = `对手掷出了更高的点数，等待对手选择先手…`
    } else if (sync.firstPlayer !== null) {
      const playerFirst = sync.firstPlayer === role
      next.statusMessage = playerFirst
        ? '你获得先手，即将开始回合。'
        : '对手获得先手，等待对手回合开始…'
    }
  }

  if (sync.turnPhase === 'waitingOpponent') {
    if (sync.pendingTurnStartFor === role) {
      next.statusMessage = '轮到你的回合，正在抽取符文与手牌…'
    } else if (sync.activePlayer !== role) {
      next.statusMessage = '对方回合中…'
    }
  }

  if (sync.turnPhase === 'main' && sync.activePlayer === role) {
    next.statusMessage = '主阶段：可使用下方操作按钮。'
  }

  return next
}

export function pickBattlefield(
  state: GameState,
  side: 'player' | 'opponent',
  battlefieldId: string,
): GameState {
  if (state.turnPhase !== 'battlefieldSelect') {
    return state
  }
  const options =
    side === 'player' ? state.playerBattlefieldOptions : state.opponentBattlefieldOptions
  if (!options.includes(battlefieldId)) {
    return state
  }
  let next: GameState =
    side === 'player'
      ? { ...state, playerBattlefieldChoice: battlefieldId }
      : { ...state, opponentBattlefieldChoice: battlefieldId }

  if (
    next.playerBattlefieldChoice &&
    next.opponentBattlefieldChoice &&
    !next.openingHandsReady
  ) {
    next = {
      ...next,
      statusMessage: '双方战场已选定，正在准备起手牌…',
    }
  }

  return next
}

export function pickPlayerBattlefield(state: GameState, battlefieldId: string): GameState {
  if (state.turnPhase !== 'battlefieldSelect') {
    return state
  }
  if (!state.playerBattlefieldOptions.includes(battlefieldId)) {
    return state
  }
  if (state.playerBattlefieldChoice === battlefieldId) {
    return state
  }
  return {
    ...state,
    playerBattlefieldChoice: battlefieldId,
    statusMessage: '已选择战场，等待对手选择…',
  }
}

export function applyBattlefieldSync(
  state: GameState,
  sync: { hostBattlefieldChoice: string | null; guestBattlefieldChoice: string | null },
  role: 'host' | 'guest',
): GameState {
  const playerChoice =
    role === 'host' ? sync.hostBattlefieldChoice : sync.guestBattlefieldChoice
  const opponentChoice =
    role === 'host' ? sync.guestBattlefieldChoice : sync.hostBattlefieldChoice

  let next: GameState = {
    ...state,
    playerBattlefieldChoice: playerChoice,
    opponentBattlefieldChoice: opponentChoice,
  }

  if (next.turnPhase === 'battlefieldSelect') {
    if (playerChoice && !opponentChoice) {
      next = { ...next, statusMessage: '已选择战场，等待对手选择…' }
    } else if (!playerChoice && opponentChoice) {
      next = { ...next, statusMessage: '对手已选择战场，请选择你的战场。' }
    } else if (!playerChoice && !opponentChoice) {
      next = { ...next, statusMessage: '请双方先选择战场。战场确定后将自动各抽4张并进入调度。' }
    } else if (playerChoice && opponentChoice) {
      next = { ...next, statusMessage: '双方战场已选定，正在准备起手牌…' }
    }
  }

  return next
}

/** 双方战场选定后由房主调用一次，抽取起手 4 张并进入调度 */
export function prepareOpeningHands(
  state: GameState,
  sync: { hostBattlefieldChoice: string | null; guestBattlefieldChoice: string | null },
  role: PlayerRole,
): GameState | null {
  if (state.openingHandsReady || state.zones.hand.length > 0) {
    return null
  }
  const playerChoice =
    role === 'host' ? sync.hostBattlefieldChoice : sync.guestBattlefieldChoice
  const opponentChoice =
    role === 'host' ? sync.guestBattlefieldChoice : sync.hostBattlefieldChoice
  if (!playerChoice || !opponentChoice) {
    return null
  }

  let next = applyBattlefieldSync(state, sync, role)
  next = drawOpeningHands(next)
  return {
    ...next,
    turnPhase: 'mulligan',
    openingHandsReady: true,
    playerMulliganDone: false,
    opponentMulliganDone: false,
    statusMessage: `双方战场已确定，已各抽 ${OPENING_HAND_DRAW} 张手牌。请选择最多 ${MULLIGAN_LIMIT} 张手牌完成调度。`,
  }
}

export function resolveDiceWinner(
  hostDice: number,
  guestDice: number,
): { winner: PlayerRole } | 'tie' {
  if (hostDice === guestDice) {
    return 'tie'
  }
  if (hostDice > guestDice) {
    return { winner: 'host' }
  }
  return { winner: 'guest' }
}

export function startRegularPlayerTurn(state: GameState): GameState {
  let next = untapAllFieldCards({
    ...state,
    actionMode: null,
    mulliganSelected: [],
    selectedInstanceIds: [],
    moveSourceInstanceId: null,
    isPlayerTurn: true,
  })

  const bonusRuneDraw =
    next.firstRoundSecondPlayerBonusPending && next.secondPlayer === 'player' ? 3 : TURN_RUNE_DRAW
  next = drawFromZone(next, 'runeDeck', bonusRuneDraw, 'runeBoard')
  next = drawFromZone(next, 'mainDeck', TURN_HAND_DRAW, 'hand')

  return {
    ...next,
    firstRoundSecondPlayerBonusPending:
      bonusRuneDraw === 3 ? false : next.firstRoundSecondPlayerBonusPending,
    turnPhase: 'main',
    statusMessage: `回合开始：已抽 ${TURN_HAND_DRAW} 张手牌、${bonusRuneDraw} 张符文至符文展示区，场上卡牌已回正。`,
  }
}

export function toggleMulliganSelect(state: GameState, instanceId: string): GameState {
  if (state.turnPhase !== 'mulligan' || state.playerMulliganDone) {
    return state
  }

  const inHand = state.zones.hand.some((card) => card.instanceId === instanceId)
  if (!inHand) {
    return state
  }

  const selected = state.mulliganSelected
  if (selected.includes(instanceId)) {
    return {
      ...state,
      mulliganSelected: selected.filter((id) => id !== instanceId),
    }
  }

  if (selected.length >= MULLIGAN_LIMIT) {
    return {
      ...state,
      statusMessage: `调度最多选择 ${MULLIGAN_LIMIT} 张。`,
    }
  }

  return {
    ...state,
    mulliganSelected: [...selected, instanceId],
  }
}

export function finishMulligan(state: GameState): GameState {
  if (state.turnPhase !== 'mulligan' || state.playerMulliganDone) {
    return state
  }

  const toMulligan = state.mulliganSelected
    .map((id) => state.zones.hand.find((card) => card.instanceId === id))
    .filter((card): card is GameCardInstance => card !== undefined)

  let next: GameState = {
    ...state,
    zones: cloneZones(state.zones),
    mulliganSelected: [],
  }

  for (const card of toMulligan) {
    next.zones.hand = next.zones.hand.filter((item) => item.instanceId !== card.instanceId)
    next.zones.mainDeck = [...next.zones.mainDeck, card]
  }

  if (toMulligan.length > 0) {
    next = drawFromZone(next, 'mainDeck', toMulligan.length, 'hand')
  }

  return {
    ...next,
    actionMode: null,
    selectedInstanceIds: [],
    moveSourceInstanceId: null,
    playerMulliganDone: true,
    statusMessage: '调度完成，等待对手调度…',
  }
}

export function setActionMode(state: GameState, mode: ActionMode): GameState {
  if (state.turnPhase !== 'main' || !state.isPlayerTurn) {
    return state
  }

  const hints: Record<NonNullable<ActionMode>, string> = {
    draw: '抽牌：请点击符文堆、主牌堆或废牌堆（符文进入符文展示区）。',
    discard: '弃牌：请选择场上或手牌中的卡（不含传奇），再点「确认弃牌」。',
    tap: '横置：请选择要横置的卡，再点「确认横置」。',
    untap: '回正：请选择已横置的卡，再点「确认回正」。',
    move: '移动：请先选择要移动的卡，再点击目标区域（基地/战场A/战场B）。',
    recycle: '回收：请选择要回收的卡，再点「确认回收」。',
    look: '看牌：请点击废牌堆。',
  }

  return {
    ...state,
    actionMode: mode,
    selectedInstanceIds: [],
    moveSourceInstanceId: null,
    statusMessage: mode ? hints[mode] : '主阶段：可使用下方操作按钮。',
  }
}

function getDrawTargetZone(state: GameState, fromZone: ZoneId): ZoneId {
  if (fromZone === 'runeDeck') {
    return 'runeBoard'
  }
  if (fromZone === 'mainDeck') {
    return 'hand'
  }
  const topCard = state.zones.discard[0]
  return topCard?.kind === 'rune' ? 'runeBoard' : 'hand'
}

export function handleDrawFromZone(state: GameState, zone: ZoneId): GameState {
  if (state.actionMode !== 'draw' || state.turnPhase !== 'main') {
    return state
  }
  if (!['mainDeck', 'runeDeck', 'discard'].includes(zone)) {
    return state
  }
  if (state.zones[zone].length === 0) {
    return { ...state, statusMessage: '该牌堆没有牌可抽。' }
  }

  const toZone = getDrawTargetZone(state, zone)
  const next = drawFromZone(state, zone, 1, toZone)
  return {
    ...next,
    actionMode: null,
    statusMessage:
      toZone === 'runeBoard' ? '抽牌完成，符文已进入符文展示区。' : '抽牌完成。',
  }
}

export function toggleDiscardSelect(state: GameState, instanceId: string): GameState {
  if (state.actionMode !== 'discard' || state.turnPhase !== 'main') {
    return state
  }

  const zone = findCardZone(state, instanceId)
  if (!zone || !['hero', 'base', 'runeBoard', 'battlefieldA', 'battlefieldB', 'hand'].includes(zone)) {
    return state
  }

  const selected = state.selectedInstanceIds
  if (selected.includes(instanceId)) {
    return {
      ...state,
      selectedInstanceIds: selected.filter((id) => id !== instanceId),
    }
  }

  return {
    ...state,
    selectedInstanceIds: [...selected, instanceId],
  }
}

export function confirmDiscard(state: GameState): GameState {
  if (state.actionMode !== 'discard' || state.selectedInstanceIds.length === 0) {
    return { ...state, statusMessage: '请先选择要弃掉的卡。' }
  }

  const next: GameState = { ...state, zones: { ...state.zones } }

  for (const instanceId of state.selectedInstanceIds) {
    const zone = findCardZone(next, instanceId)
    if (!zone) {
      continue
    }
    const { zones, card } = removeFromZone(next.zones, zone, instanceId)
    if (card) {
      next.zones = zones
      next.zones.discard = [...next.zones.discard, card]
    }
  }

  return {
    ...next,
    actionMode: null,
    selectedInstanceIds: [],
    statusMessage: '弃牌完成。',
  }
}

export function toggleTapSelect(state: GameState, instanceId: string): GameState {
  if (state.actionMode !== 'tap' || state.turnPhase !== 'main') {
    return state
  }

  const zone = findCardZone(state, instanceId)
  if (!zone || !['legend', 'hero', 'base', 'runeBoard', 'battlefieldA', 'battlefieldB'].includes(zone)) {
    return state
  }

  const card = state.zones[zone].find((item) => item.instanceId === instanceId)
  if (card?.tapped) {
    return { ...state, statusMessage: '请选择未横置的卡。' }
  }

  const selected = state.selectedInstanceIds
  if (selected.includes(instanceId)) {
    return {
      ...state,
      selectedInstanceIds: selected.filter((id) => id !== instanceId),
    }
  }

  return {
    ...state,
    selectedInstanceIds: [...selected, instanceId],
  }
}

export function confirmTap(state: GameState): GameState {
  if (state.actionMode !== 'tap' || state.selectedInstanceIds.length === 0) {
    return { ...state, statusMessage: '请先选择要横置的卡。' }
  }

  let next = state
  let manaGain = 0
  for (const instanceId of state.selectedInstanceIds) {
    const zone = findCardZone(next, instanceId)
    if (zone === 'runeBoard') {
      manaGain += 1
    }
    next = updateCard(next, instanceId, (card) => ({ ...card, tapped: true }))
  }

  return {
    ...next,
    mana: next.mana + manaGain,
    actionMode: null,
    selectedInstanceIds: [],
    statusMessage:
      manaGain > 0
        ? `横置完成（${state.selectedInstanceIds.length} 张），获得 ${manaGain} 点法力。`
        : `横置完成（${state.selectedInstanceIds.length} 张）。`,
  }
}

export function toggleUntapSelect(state: GameState, instanceId: string): GameState {
  if (state.actionMode !== 'untap' || state.turnPhase !== 'main') {
    return state
  }

  const zone = findCardZone(state, instanceId)
  if (!zone) {
    return state
  }

  const card = state.zones[zone].find((item) => item.instanceId === instanceId)
  if (!card?.tapped) {
    return { ...state, statusMessage: '请选择已横置的卡。' }
  }

  const selected = state.selectedInstanceIds
  if (selected.includes(instanceId)) {
    return {
      ...state,
      selectedInstanceIds: selected.filter((id) => id !== instanceId),
    }
  }

  return {
    ...state,
    selectedInstanceIds: [...selected, instanceId],
  }
}

export function confirmUntap(state: GameState): GameState {
  if (state.actionMode !== 'untap' || state.selectedInstanceIds.length === 0) {
    return { ...state, statusMessage: '请先选择要回正的卡。' }
  }

  let next = state
  for (const instanceId of state.selectedInstanceIds) {
    next = updateCard(next, instanceId, (card) => ({ ...card, tapped: false }))
  }

  return {
    ...next,
    actionMode: null,
    selectedInstanceIds: [],
    statusMessage: `回正完成（${state.selectedInstanceIds.length} 张）。`,
  }
}

export function handleMoveSelect(state: GameState, instanceId: string): GameState {
  if (state.actionMode !== 'move' || state.turnPhase !== 'main') {
    return state
  }

  const zone = findCardZone(state, instanceId)
  if (!zone || ['legend', 'runeDeck', 'discard'].includes(zone)) {
    return state
  }

  if (state.moveSourceInstanceId === instanceId) {
    return { ...state, moveSourceInstanceId: null }
  }

  return {
    ...state,
    moveSourceInstanceId: instanceId,
    statusMessage: '移动：请点击目标区域（基地/战场A/战场B）。',
  }
}

export function handleMoveToZone(state: GameState, targetZone: ZoneId): GameState {
  if (state.actionMode !== 'move' || !state.moveSourceInstanceId) {
    return state
  }
  if (!['base', 'battlefieldA', 'battlefieldB'].includes(targetZone)) {
    return state
  }

  const sourceZone = findCardZone(state, state.moveSourceInstanceId)
  if (!sourceZone || sourceZone === targetZone) {
    return state
  }

  const { zones, card } = removeFromZone(
    state.zones,
    sourceZone,
    state.moveSourceInstanceId,
  )
  if (!card) {
    return state
  }

  return {
    ...state,
    zones: {
      ...zones,
      [targetZone]: [...zones[targetZone], card],
    },
    moveSourceInstanceId: null,
    actionMode: null,
    statusMessage: '移动完成。',
  }
}

export function toggleRecycleSelect(state: GameState, instanceId: string): GameState {
  if (state.actionMode !== 'recycle' || state.turnPhase !== 'main') {
    return state
  }

  const zone = findCardZone(state, instanceId)
  if (!zone || !['hero', 'base', 'runeBoard', 'battlefieldA', 'battlefieldB', 'hand'].includes(zone)) {
    return state
  }

  const card = state.zones[zone].find((item) => item.instanceId === instanceId)
  if (card && card.kind !== 'main' && card.kind !== 'rune') {
    return { ...state, statusMessage: '传奇/英雄卡无法回收至牌堆。' }
  }

  const selected = state.selectedInstanceIds
  if (selected.includes(instanceId)) {
    return {
      ...state,
      selectedInstanceIds: selected.filter((id) => id !== instanceId),
    }
  }

  return {
    ...state,
    selectedInstanceIds: [...selected, instanceId],
  }
}

export function confirmRecycle(state: GameState): GameState {
  if (state.actionMode !== 'recycle' || state.selectedInstanceIds.length === 0) {
    return { ...state, statusMessage: '请先选择要回收的卡。' }
  }

  let next: GameState = { ...state, zones: { ...state.zones } }
  let runeEnergyGain = 0
  const gainedColors: string[] = []
  let recycledCount = 0

  for (const instanceId of state.selectedInstanceIds) {
    const zone = findCardZone(next, instanceId)
    if (!zone || !['hero', 'base', 'runeBoard', 'battlefieldA', 'battlefieldB', 'hand'].includes(zone)) {
      continue
    }

    const { zones, card } = removeFromZone(next.zones, zone, instanceId)
    if (!card) {
      continue
    }

    if (card.kind !== 'main' && card.kind !== 'rune') {
      continue
    }

    const targetZone: ZoneId = card.kind === 'main' ? 'mainDeck' : 'runeDeck'
    next.zones = {
      ...zones,
      [targetZone]: [...zones[targetZone], card],
    }

    if (zone === 'runeBoard' && card.kind === 'rune') {
      const runeColor = runeColorById.get(card.cardId)
      if (runeColor) {
        runeEnergyGain += 1
        gainedColors.push(runeColorLabel[runeColor])
        next = {
          ...next,
          runeEnergy: {
            ...next.runeEnergy,
            [runeColor]: next.runeEnergy[runeColor] + 1,
          },
        }
      }
    }

    recycledCount += 1
  }

  if (recycledCount === 0) {
    return { ...state, statusMessage: '没有可回收的卡牌。' }
  }

  const energyMsg =
    runeEnergyGain > 0 ? `获得 ${runeEnergyGain} 点符能（${gainedColors.join('、')}）。` : ''

  return {
    ...next,
    actionMode: null,
    selectedInstanceIds: [],
    statusMessage: `回收完成（${recycledCount} 张），卡牌已放回对应牌堆底部。${energyMsg}`,
  }
}

/** @deprecated Use toggleRecycleSelect + confirmRecycle */
export function handleRecycle(state: GameState, instanceId: string): GameState {
  const toggled = toggleRecycleSelect(state, instanceId)
  if (toggled.selectedInstanceIds.length === 0) {
    return toggled
  }
  return confirmRecycle(toggled)
}

export function handleLookZone(state: GameState, zone: ZoneId): GameState {
  if (state.actionMode !== 'look' || state.turnPhase !== 'main') {
    return state
  }
  if (zone !== 'discard') {
    return state
  }

  return {
    ...state,
    actionMode: null,
    statusMessage: '查看废牌堆。',
    lookTargetZone: zone,
  }
}

export function adjustMana(state: GameState, delta: number): GameState {
  return {
    ...state,
    mana: Math.max(0, state.mana + delta),
  }
}

export function adjustRuneEnergy(state: GameState, color: RuneColor, delta: number): GameState {
  return {
    ...state,
    runeEnergy: {
      ...state.runeEnergy,
      [color]: Math.max(0, state.runeEnergy[color] + delta),
    },
  }
}

export function clearLookTarget(state: GameState): GameState {
  return {
    ...state,
    lookTargetZone: null,
  }
}

export function endTurn(state: GameState): GameState {
  if (state.turnPhase !== 'main' || !state.isPlayerTurn) {
    return state
  }

  return {
    ...state,
    actionMode: null,
    selectedInstanceIds: [],
    moveSourceInstanceId: null,
    turnPhase: 'waitingOpponent',
    isPlayerTurn: false,
    statusMessage: '对方回合中…',
  }
}

export function startOpponentTurnEnd(state: GameState): GameState {
  const afterOpponent = simulateOpponentTurn(state)
  return startRegularPlayerTurn({
    ...afterOpponent,
    isPlayerTurn: true,
  })
}

function simulateOpponentTurn(state: GameState): GameState {
  let next: GameState = untapAllOpponentFieldCards({
    ...state,
    opponentZones: { ...state.opponentZones },
  })
  const bonusRuneDraw =
    next.firstRoundSecondPlayerBonusPending && next.secondPlayer === 'opponent'
      ? 3
      : TURN_RUNE_DRAW
  next = drawOpponent(next, 'runeDeck', bonusRuneDraw, 'runeBoard')
  next = drawOpponent(next, 'mainDeck', TURN_HAND_DRAW, 'hand')
  next = {
    ...next,
    firstRoundSecondPlayerBonusPending:
      bonusRuneDraw === 3 ? false : next.firstRoundSecondPlayerBonusPending,
  }
  return next
}

function drawOpponent(
  state: GameState,
  fromZone: ZoneId,
  count: number,
  toZone: ZoneId,
): GameState {
  const next = { ...state, opponentZones: { ...state.opponentZones } }
  let drawn = 0
  while (drawn < count && next.opponentZones[fromZone].length > 0) {
    const [card, ...rest] = next.opponentZones[fromZone]
    next.opponentZones[fromZone] = rest
    next.opponentZones[toZone] = [...next.opponentZones[toZone], card]
    drawn += 1
  }
  return next
}

export function adjustScore(
  state: GameState,
  side: 'player' | 'opponent',
  delta: number,
): GameState {
  if (side === 'player') {
    return { ...state, playerScore: state.playerScore + delta }
  }
  return { ...state, opponentScore: state.opponentScore + delta }
}

function updateCard(
  state: GameState,
  instanceId: string,
  updater: (card: GameCardInstance) => GameCardInstance,
): GameState {
  const zone = findCardZone(state, instanceId)
  if (!zone) {
    return state
  }

  return {
    ...state,
    zones: {
      ...state.zones,
      [zone]: state.zones[zone].map((card) =>
        card.instanceId === instanceId ? updater(card) : card,
      ),
    },
  }
}

export function isCardSelected(state: GameState, instanceId: string): boolean {
  return (
    state.mulliganSelected.includes(instanceId) ||
    state.selectedInstanceIds.includes(instanceId) ||
    state.moveSourceInstanceId === instanceId
  )
}
