import battlefieldsData from '../../data/imported/loltcg/normalized/battlefields.json'
import equipmentData from '../../data/imported/loltcg/normalized/equipment.json'
import exclusivesData from '../../data/imported/loltcg/normalized/exclusives.json'
import heroesData from '../../data/imported/loltcg/normalized/heroes.json'
import legendsData from '../../data/imported/loltcg/normalized/legends.json'
import runesData from '../../data/imported/loltcg/normalized/runes.json'
import spellsData from '../../data/imported/loltcg/normalized/spells.json'
import unitsData from '../../data/imported/loltcg/normalized/units.json'
import type { BaseCard, MainCard, MainDeckFilterCategory, RuneCard } from '../types/cards'
import type { RuneColor } from '../constants/runeColors'
import { isRuneColor } from '../constants/runeColors'

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

const importedLegends = legendsData as ImportedCard[]
const importedHeroes = heroesData as ImportedCard[]
const importedRunes = runesData as ImportedCard[]
const importedBattlefields = battlefieldsData as ImportedCard[]
const importedUnits = unitsData as ImportedCard[]
const importedSpells = spellsData as ImportedCard[]
const importedEquipment = equipmentData as ImportedCard[]
const importedExclusives = exclusivesData as ImportedCard[]

const mainDeckSource = [
  ...importedUnits,
  ...importedSpells,
  ...importedEquipment,
  ...importedHeroes,
  ...importedExclusives,
]

let catalogCache: Map<string, BaseCard> | null = null
let runeColorCache: Map<string, RuneColor> | null = null

export function getCardCatalog(): Map<string, BaseCard> {
  if (catalogCache) {
    return catalogCache
  }

  const catalog = new Map<string, BaseCard>()
  for (const card of importedLegends) {
    catalog.set(card.id, toBaseCard(card))
  }
  for (const card of importedHeroes) {
    catalog.set(card.id, toBaseCard(card))
  }
  for (const card of mainDeckSource) {
    catalog.set(card.id, toMainCard(card))
  }
  for (const card of importedRunes) {
    const rune = toRuneCard(card)
    if (rune) {
      catalog.set(card.id, rune)
    }
  }
  for (const card of importedBattlefields) {
    catalog.set(card.id, toBaseCard(card))
  }

  catalogCache = catalog
  return catalog
}

export function getRuneColorById(): Map<string, RuneColor> {
  if (runeColorCache) {
    return runeColorCache
  }

  const map = new Map<string, RuneColor>()
  for (const card of importedRunes) {
    const rune = toRuneCard(card)
    if (rune) {
      map.set(card.id, rune.color)
    }
  }

  runeColorCache = map
  return map
}

export function getBattlefieldCard(id: string): BaseCard | null {
  return getCardCatalog().get(id) ?? null
}

export function getCardMeta(cardId: string): BaseCard | null {
  return getCardCatalog().get(cardId) ?? null
}
