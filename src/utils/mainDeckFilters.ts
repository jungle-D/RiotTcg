import type { MainCard, MainDeckFilterCategory } from '../types/cards'

export const NO_NUMERIC_VALUE = -1

export const ALL_FILTER_CATEGORIES: MainDeckFilterCategory[] = [
  'unit',
  'spell',
  'equipment',
  'hero',
]

export type MainDeckNumericField = 'energy' | 'returnEnergy'

export interface NumericFieldBounds {
  min: number
  max: number
}

export interface MainDeckFilterBounds {
  energy: NumericFieldBounds
  returnEnergy: NumericFieldBounds
}

export interface NumericRangeFilter {
  min: number
  max: number
  includeNull: boolean
}

export interface MainDeckFilters {
  types: Set<MainDeckFilterCategory>
  energyRange: NumericRangeFilter | null
  returnEnergyRange: NumericRangeFilter | null
  colors: Set<string> | null
  query: string
}

export interface SelectedEntry {
  card: MainCard
  count: number
}

export function createDefaultMainDeckFilters(): MainDeckFilters {
  return {
    types: new Set(ALL_FILTER_CATEGORIES),
    energyRange: null,
    returnEnergyRange: null,
    colors: null,
    query: '',
  }
}

export function getNumericFieldBounds(
  cards: MainCard[],
  field: MainDeckNumericField,
): NumericFieldBounds {
  const values = cards
    .map((card) => card[field])
    .filter((value): value is number => value !== null)
  if (values.length === 0) {
    return { min: 0, max: 0 }
  }
  return { min: Math.min(...values), max: Math.max(...values) }
}

export function getMainDeckFilterBounds(cards: MainCard[]): MainDeckFilterBounds {
  return {
    energy: getNumericFieldBounds(cards, 'energy'),
    returnEnergy: getNumericFieldBounds(cards, 'returnEnergy'),
  }
}

export function clampRangeValue(
  value: number,
  bounds: NumericFieldBounds,
): number {
  if (!Number.isFinite(value)) {
    return bounds.min
  }
  return Math.min(bounds.max, Math.max(bounds.min, Math.round(value)))
}

export function hasNullNumericField(
  cards: MainCard[],
  field: MainDeckNumericField,
): boolean {
  return cards.some((card) => card[field] === null)
}

export function matchesNumericRange(
  value: number | null,
  range: NumericRangeFilter,
): boolean {
  if (value === null) {
    return range.includeNull
  }
  return value >= range.min && value <= range.max
}

export function getAvailableColors(cards: MainCard[], legendColors: string[]): string[] {
  const values = new Set<string>(legendColors)
  for (const card of cards) {
    for (const color of card.colors) {
      values.add(color)
    }
  }
  return Array.from(values).sort((a, b) => {
    if (a === 'colorless') return 1
    if (b === 'colorless') return -1
    return a.localeCompare(b)
  })
}

export function filterMainDeckCards(cards: MainCard[], filters: MainDeckFilters): MainCard[] {
  const query = filters.query.trim().toLowerCase()

  return cards.filter((card) => {
    if (!filters.types.has(card.filterCategory)) {
      return false
    }

    if (filters.energyRange !== null) {
      if (!matchesNumericRange(card.energy, filters.energyRange)) {
        return false
      }
    }

    if (filters.returnEnergyRange !== null) {
      if (!matchesNumericRange(card.returnEnergy, filters.returnEnergyRange)) {
        return false
      }
    }

    if (filters.colors !== null) {
      if (filters.colors.size === 0) {
        return false
      }
      const hasMatchingColor = card.colors.some((color) => filters.colors!.has(color))
      if (!hasMatchingColor) {
        return false
      }
    }

    if (query) {
      const matchesQuery =
        card.name.toLowerCase().includes(query) ||
        card.id.toLowerCase().includes(query) ||
        card.description.toLowerCase().includes(query)
      if (!matchesQuery) {
        return false
      }
    }

    return true
  })
}

export function buildCostDistribution(
  cards: MainCard[],
  counters: Record<string, number>,
): { energy: number; count: number }[] {
  const cardById = new Map(cards.map((card) => [card.id, card]))
  const distribution = new Map<number, number>()

  for (const [cardId, count] of Object.entries(counters)) {
    if (count <= 0) continue
    const card = cardById.get(cardId)
    if (!card) continue
    const energy = card.energy ?? NO_NUMERIC_VALUE
    distribution.set(energy, (distribution.get(energy) ?? 0) + count)
  }

  return Array.from(distribution.entries())
    .map(([energy, count]) => ({ energy, count }))
    .sort((a, b) => a.energy - b.energy)
}

export function buildSelectedEntries(
  cards: MainCard[],
  counters: Record<string, number>,
): SelectedEntry[] {
  const cardById = new Map(cards.map((card) => [card.id, card]))
  const entries: SelectedEntry[] = []

  for (const [cardId, count] of Object.entries(counters)) {
    if (count <= 0) continue
    const card = cardById.get(cardId)
    if (!card) continue
    entries.push({ card, count })
  }

  return entries.sort((a, b) => {
    const energyA = a.card.energy ?? NO_NUMERIC_VALUE
    const energyB = b.card.energy ?? NO_NUMERIC_VALUE
    if (energyA !== energyB) return energyA - energyB
    return a.card.name.localeCompare(b.card.name, 'zh-CN')
  })
}

export function countHeroInCounters(
  cards: MainCard[],
  counters: Record<string, number>,
): number {
  return cards.reduce((sum, card) => {
    if (card.filterCategory !== 'hero') return sum
    return sum + (counters[card.id] ?? 0)
  }, 0)
}
