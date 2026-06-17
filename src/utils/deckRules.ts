import type { BaseCard, DeckState, DeckValidation, MainCard, RuneCard } from '../types/cards'

export const MAIN_DECK_TARGET = 39
export const MAIN_DECK_HERO_LIMIT = 5
export const MAIN_DECK_SAME_NAME_LIMIT = 3
export const CARD_PER_COPY_LIMIT = 3
export const RUNE_DECK_TARGET = 12
export const RUNE_COLOR_LIMIT = 2
export const BATTLEFIELD_TARGET = 3

export function countFromRecord(record: Record<string, number>): number {
  return Object.values(record).reduce((sum, count) => sum + count, 0)
}

export function getMainDeckNameOverLimit(
  state: DeckState,
  mainCards: MainCard[],
): string[] {
  const nameMap = new Map<string, number>()

  for (const card of mainCards) {
    const count = state.mainDeck[card.id] ?? 0
    const current = nameMap.get(card.name) ?? 0
    nameMap.set(card.name, current + count)
  }

  return Array.from(nameMap.entries())
    .filter(([, count]) => count > MAIN_DECK_SAME_NAME_LIMIT)
    .map(([name]) => name)
}

export function countMainDeckHero(
  state: DeckState,
  mainCards: MainCard[],
): number {
  return mainCards.reduce((sum, card) => {
    if (card.type !== 'hero') {
      return sum
    }
    return sum + (state.mainDeck[card.id] ?? 0)
  }, 0)
}

export function countRuneColors(
  runeDeck: Record<string, number>,
  runeCards: RuneCard[],
): number {
  const activeColors = new Set<string>()

  for (const card of runeCards) {
    if ((runeDeck[card.id] ?? 0) > 0) {
      activeColors.add(card.color)
    }
  }

  return activeColors.size
}

export function getActiveRuneColors(
  runeDeck: Record<string, number>,
  runeCards: RuneCard[],
): string[] {
  const colors = new Set<string>()

  for (const card of runeCards) {
    if ((runeDeck[card.id] ?? 0) > 0) {
      colors.add(card.color)
    }
  }

  return Array.from(colors)
}

export function isRuneColorAllowed(
  runeDeck: Record<string, number>,
  runeCards: RuneCard[],
  cardId: string,
): boolean {
  const card = runeCards.find((item) => item.id === cardId)
  if (!card) {
    return false
  }

  const currentCount = runeDeck[cardId] ?? 0
  if (currentCount > 0) {
    return true
  }

  const activeColors = getActiveRuneColors(runeDeck, runeCards)
  return activeColors.length < RUNE_COLOR_LIMIT || activeColors.includes(card.color)
}

export function isHeroMatchedLegend(
  hero: BaseCard | null,
  legend: BaseCard | null,
  legendHeroMapping: Record<string, string[]>,
): boolean {
  if (!hero) {
    return false
  }
  if (!legend) {
    return false
  }
  const allowedHeroIds = legendHeroMapping[legend.id] ?? []
  return allowedHeroIds.includes(hero.id)
}

export function validateDeck(
  state: DeckState,
  mainCards: MainCard[],
  runeCards: RuneCard[],
  legendHeroMapping: Record<string, string[]>,
): DeckValidation {
  const mainDeckTotal = countFromRecord(state.mainDeck)
  const runeTotal = countFromRecord(state.runeDeck)
  const runeColorCount = countRuneColors(state.runeDeck, runeCards)
  const battlefieldTotal = state.battlefield.length
  const mainDeckHeroCount = countMainDeckHero(state, mainCards)
  const mainDeckNameOverLimit = getMainDeckNameOverLimit(state, mainCards)
  const isHeroValid = isHeroMatchedLegend(state.hero, state.legend, legendHeroMapping)
  const isRuneColorValid = runeColorCount <= RUNE_COLOR_LIMIT

  return {
    isHeroValid,
    mainDeckTotal,
    mainDeckHeroCount,
    isMainDeckValid:
      mainDeckTotal === MAIN_DECK_TARGET &&
      mainDeckHeroCount <= MAIN_DECK_HERO_LIMIT &&
      mainDeckNameOverLimit.length === 0,
    runeTotal,
    runeColorCount,
    isRuneColorValid,
    isRuneValid:
      runeTotal === RUNE_DECK_TARGET && isRuneColorValid,
    battlefieldTotal,
    isBattlefieldValid: battlefieldTotal === BATTLEFIELD_TARGET,
    mainDeckNameOverLimit,
  }
}

export function isDeckComplete(
  validation: DeckValidation,
  state: DeckState,
): boolean {
  return (
    state.legend !== null &&
    state.hero !== null &&
    validation.isHeroValid &&
    validation.isMainDeckValid &&
    validation.isRuneValid &&
    validation.isBattlefieldValid
  )
}

export function getDeckValidationMessages(
  validation: DeckValidation,
  state: DeckState,
): string[] {
  const messages: string[] = []

  if (!state.legend) {
    messages.push('传奇卡：尚未选择或导入的传奇 ID 无效')
  }

  if (!state.hero) {
    messages.push('英雄单位：尚未选择或导入的英雄 ID 无效')
  } else if (!validation.isHeroValid) {
    messages.push('英雄单位：与当前传奇不匹配')
  }

  if (!validation.isMainDeckValid) {
    if (validation.mainDeckTotal !== MAIN_DECK_TARGET) {
      messages.push(`主牌堆：需要 ${MAIN_DECK_TARGET} 张，当前 ${validation.mainDeckTotal} 张`)
    }
    if (validation.mainDeckHeroCount > MAIN_DECK_HERO_LIMIT) {
      messages.push(
        `主牌堆：英雄单位最多 ${MAIN_DECK_HERO_LIMIT} 张，当前 ${validation.mainDeckHeroCount} 张`,
      )
    }
    if (validation.mainDeckNameOverLimit.length > 0) {
      messages.push(
        `主牌堆：同名卡超过 ${MAIN_DECK_SAME_NAME_LIMIT} 张（${validation.mainDeckNameOverLimit.join('、')}）`,
      )
    }
  }

  if (!validation.isRuneValid) {
    if (validation.runeTotal !== RUNE_DECK_TARGET) {
      messages.push(`符文堆：需要 ${RUNE_DECK_TARGET} 张，当前 ${validation.runeTotal} 张`)
    }
    if (!validation.isRuneColorValid) {
      messages.push(`符文堆：最多 ${RUNE_COLOR_LIMIT} 种颜色，当前 ${validation.runeColorCount} 种`)
    }
  }

  if (!validation.isBattlefieldValid) {
    messages.push(`战场区：需要 ${BATTLEFIELD_TARGET} 张，当前 ${validation.battlefieldTotal} 张`)
  }

  return messages
}
