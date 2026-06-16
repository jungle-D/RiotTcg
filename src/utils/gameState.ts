import type { DeckState } from '../types/cards'
import type {
  ActionMode,
  CardKind,
  GameCardInstance,
  GameState,
  ZoneId,
} from '../types/game'
import {
  MULLIGAN_LIMIT,
  OPENING_HAND_DRAW,
  TURN_HAND_DRAW,
  TURN_RUNE_DRAW,
} from '../types/game'

let instanceCounter = 0

function nextInstanceId(): string {
  instanceCounter += 1
  return `inst_${instanceCounter}_${Date.now()}`
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
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

function createInstance(cardId: string, kind: CardKind): GameCardInstance {
  return {
    instanceId: nextInstanceId(),
    cardId,
    kind,
    tapped: false,
  }
}

function expandDeck(
  record: Record<string, number>,
  kind: CardKind,
): GameCardInstance[] {
  const instances: GameCardInstance[] = []
  for (const [cardId, count] of Object.entries(record)) {
    for (let i = 0; i < count; i += 1) {
      instances.push(createInstance(cardId, kind))
    }
  }
  return instances
}

function rollDice(): number {
  return Math.floor(Math.random() * 6) + 1
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

export function initGameFromDeck(deckState: DeckState, roomId: string): GameState {
  instanceCounter = 0
  const zones = emptyZones()

  if (deckState.legend) {
    zones.legend = [createInstance(deckState.legend.id, 'legend')]
  }
  if (deckState.hero) {
    zones.hero = [createInstance(deckState.hero.id, 'hero')]
  }
  zones.mainDeck = shuffle(expandDeck(deckState.mainDeck, 'main'))
  zones.runeDeck = shuffle(expandDeck(deckState.runeDeck, 'rune'))
  const opponentZones = emptyZones()
  if (deckState.legend) {
    opponentZones.legend = [createInstance(deckState.legend.id, 'legend')]
  }
  if (deckState.hero) {
    opponentZones.hero = [createInstance(deckState.hero.id, 'hero')]
  }
  opponentZones.mainDeck = shuffle(expandDeck(deckState.mainDeck, 'main'))
  opponentZones.runeDeck = shuffle(expandDeck(deckState.runeDeck, 'rune'))
  const battlefieldOptions = firstThreeBattlefields(deckState)

  return {
    zones,
    opponentZones,
    actionMode: null,
    turnPhase: 'diceRoll',
    mulliganSelected: [],
    selectedInstanceIds: [],
    moveSourceInstanceId: null,
    roomId,
    isPlayerTurn: true,
    statusMessage: '请投掷骰子决定先手（点数大者先手）。',
    lookTargetZone: null,
    playerDice: null,
    opponentDice: null,
    playerScore: 0,
    opponentScore: 0,
    playerBattlefieldOptions: battlefieldOptions,
    opponentBattlefieldOptions: battlefieldOptions,
    playerBattlefieldChoice: null,
    opponentBattlefieldChoice: null,
  }
}

export function pickBattlefield(
  state: GameState,
  side: 'player' | 'opponent',
  battlefieldId: string,
): GameState {
  if (state.turnPhase !== 'diceRoll') {
    return state
  }
  const options =
    side === 'player' ? state.playerBattlefieldOptions : state.opponentBattlefieldOptions
  if (!options.includes(battlefieldId)) {
    return state
  }
  if (side === 'player') {
    return { ...state, playerBattlefieldChoice: battlefieldId }
  }
  return { ...state, opponentBattlefieldChoice: battlefieldId }
}

export function rollForFirstPlayer(state: GameState): GameState {
  if (state.turnPhase !== 'diceRoll' || state.playerDice !== null) {
    return state
  }
  if (!state.playerBattlefieldChoice || !state.opponentBattlefieldChoice) {
    return { ...state, statusMessage: '请先完成双方战场选择，再投掷骰子。' }
  }

  const playerDice = rollDice()
  let opponentDice = rollDice()
  while (playerDice === opponentDice) {
    opponentDice = rollDice()
  }

  const playerFirst = playerDice > opponentDice

  if (playerFirst) {
    const afterOpening = drawFromZone(
      {
        ...state,
        playerDice,
        opponentDice,
        actionMode: null,
        mulliganSelected: [],
        selectedInstanceIds: [],
        moveSourceInstanceId: null,
      },
      'mainDeck',
      OPENING_HAND_DRAW,
      'hand',
    )

    return {
      ...afterOpening,
      turnPhase: 'mulligan',
      statusMessage: `你掷出 ${playerDice}，对手掷出 ${opponentDice}，你获得先手。已抽 ${OPENING_HAND_DRAW} 张手牌，可进行最多 ${MULLIGAN_LIMIT} 张调度。`,
    }
  }

  return {
    ...state,
    playerDice,
    opponentDice,
    turnPhase: 'waitingOpponent',
    isPlayerTurn: false,
    statusMessage: `你掷出 ${playerDice}，对手掷出 ${opponentDice}，对手获得先手。对手正在开局…`,
  }
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

  next = drawFromZone(next, 'mainDeck', TURN_HAND_DRAW, 'hand')
  next = drawFromZone(next, 'runeDeck', TURN_RUNE_DRAW, 'runeBoard')

  return {
    ...next,
    turnPhase: 'main',
    statusMessage: `回合开始：已抽 ${TURN_HAND_DRAW} 张手牌、${TURN_RUNE_DRAW} 张符文至符文展示区，场上卡牌已回正。`,
  }
}

export function toggleMulliganSelect(state: GameState, instanceId: string): GameState {
  if (state.turnPhase !== 'mulligan') {
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
  if (state.turnPhase !== 'mulligan') {
    return state
  }

  let next: GameState = {
    ...state,
    zones: { ...state.zones },
    mulliganSelected: [],
  }

  const toMulligan = state.mulliganSelected
    .map((id) => state.zones.hand.find((card) => card.instanceId === id))
    .filter((card): card is GameCardInstance => card !== undefined)

  for (const card of toMulligan) {
    next.zones.hand = next.zones.hand.filter((item) => item.instanceId !== card.instanceId)
    next.zones.mainDeck = [...next.zones.mainDeck, card]
  }

  next = drawFromZone(next, 'mainDeck', toMulligan.length, 'hand')

  return {
    ...next,
    turnPhase: 'main',
    actionMode: null,
    selectedInstanceIds: [],
    moveSourceInstanceId: null,
    statusMessage: '主阶段：可使用下方操作按钮。',
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
    recycle: '回收：请选择要回收的卡。',
    look: '看牌：请点击主牌堆或废牌堆。',
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
  for (const instanceId of state.selectedInstanceIds) {
    next = updateCard(next, instanceId, (card) => ({ ...card, tapped: true }))
  }

  return {
    ...next,
    actionMode: null,
    selectedInstanceIds: [],
    statusMessage: `横置完成（${state.selectedInstanceIds.length} 张）。`,
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

export function handleRecycle(state: GameState, instanceId: string): GameState {
  if (state.actionMode !== 'recycle' || state.turnPhase !== 'main') {
    return state
  }

  const zone = findCardZone(state, instanceId)
  if (!zone || !['hero', 'base', 'runeBoard', 'battlefieldA', 'battlefieldB', 'hand'].includes(zone)) {
    return state
  }

  const { zones, card } = removeFromZone(state.zones, zone, instanceId)
  if (!card) {
    return state
  }

  if (card.kind !== 'main' && card.kind !== 'rune') {
    return {
      ...state,
      statusMessage: '传奇/英雄卡无法回收至牌堆。',
    }
  }

  const targetZone: ZoneId = card.kind === 'main' ? 'mainDeck' : 'runeDeck'

  return {
    ...state,
    zones: {
      ...zones,
      [targetZone]: [...zones[targetZone], card],
    },
    actionMode: null,
    statusMessage: '回收完成，卡牌已放回对应牌堆底部。',
  }
}

export function handleLookZone(state: GameState, zone: ZoneId): GameState {
  if (state.actionMode !== 'look' || state.turnPhase !== 'main') {
    return state
  }
  if (!['mainDeck', 'discard'].includes(zone)) {
    return state
  }

  return {
    ...state,
    actionMode: null,
    statusMessage: zone === 'mainDeck' ? '查看主牌堆。' : '查看废牌堆。',
    lookTargetZone: zone,
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
  let next: GameState = { ...state, opponentZones: { ...state.opponentZones } }
  next = drawOpponent(next, 'mainDeck', TURN_HAND_DRAW, 'hand')
  next = drawOpponent(next, 'runeDeck', TURN_RUNE_DRAW, 'runeBoard')
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
