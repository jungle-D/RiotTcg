import { getCardMeta } from '../data/loltcgCatalog'
import type { DeckState } from '../types/cards'
import type { DeckSnapshot } from '@shared/roomTypes'

export type { DeckSnapshot } from '@shared/roomTypes'

export function createRoom(): string {
  return String(Math.floor(100000 + Math.random() * 900000))
}

export function joinRoom(code: string): boolean {
  const trimmed = code.trim()
  return /^\d{4,8}$/.test(trimmed)
}

export function deckToSnapshot(deck: DeckState): DeckSnapshot {
  return {
    legendId: deck.legend?.id ?? null,
    heroId: deck.hero?.id ?? null,
    mainDeck: deck.mainDeck,
    runeDeck: deck.runeDeck,
    battlefield: deck.battlefield,
  }
}

export function snapshotToDeck(snapshot: DeckSnapshot): DeckState {
  return {
    legend: snapshot.legendId ? getCardMeta(snapshot.legendId) : null,
    hero: snapshot.heroId ? getCardMeta(snapshot.heroId) : null,
    mainDeck: snapshot.mainDeck,
    runeDeck: snapshot.runeDeck,
    battlefield: snapshot.battlefield,
  }
}
