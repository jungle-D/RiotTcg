import type { RuneColor } from '../constants/runeColors'

export type CardKind = 'legend' | 'hero' | 'main' | 'rune' | 'battlefield'

export interface BaseCard {
  id: string
  name: string
  image: string
  description: string
}

export interface MainCard extends BaseCard {
  type: 'spell' | 'unit' | 'hero' | 'wandering' | 'defense'
}

export interface RuneCard extends BaseCard {
  color: RuneColor
}

export interface DeckState {
  legend: BaseCard | null
  hero: BaseCard | null
  mainDeck: Record<string, number>
  runeDeck: Record<string, number>
  battlefield: string[]
}

export interface DeckValidation {
  isHeroValid: boolean
  mainDeckTotal: number
  mainDeckHeroCount: number
  isMainDeckValid: boolean
  runeTotal: number
  runeColorCount: number
  isRuneColorValid: boolean
  isRuneValid: boolean
  battlefieldTotal: number
  isBattlefieldValid: boolean
  mainDeckNameOverLimit: string[]
}
