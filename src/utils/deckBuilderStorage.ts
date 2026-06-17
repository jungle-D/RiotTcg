import { getCardMeta } from '../data/loltcgCatalog'
import type { DeckState } from '../types/cards'

export const DECK_STATE_STORAGE_KEY = 'riottcg.deckState'

interface DeckSnapshot {
  legendId: string | null
  heroId: string | null
  mainDeck: Record<string, number>
  runeDeck: Record<string, number>
  battlefield: string[]
}

function deckToSnapshot(deck: DeckState): DeckSnapshot {
  return {
    legendId: deck.legend?.id ?? null,
    heroId: deck.hero?.id ?? null,
    mainDeck: deck.mainDeck,
    runeDeck: deck.runeDeck,
    battlefield: deck.battlefield,
  }
}

function snapshotToDeck(snapshot: DeckSnapshot): DeckState {
  return {
    legend: snapshot.legendId ? getCardMeta(snapshot.legendId) : null,
    hero: snapshot.heroId ? getCardMeta(snapshot.heroId) : null,
    mainDeck: snapshot.mainDeck,
    runeDeck: snapshot.runeDeck,
    battlefield: snapshot.battlefield,
  }
}

function isEmptyDeck(snapshot: DeckSnapshot): boolean {
  return (
    !snapshot.legendId &&
    !snapshot.heroId &&
    Object.keys(snapshot.mainDeck).length === 0 &&
    Object.keys(snapshot.runeDeck).length === 0 &&
    snapshot.battlefield.length === 0
  )
}

export function loadDeckStateFromStorage(): DeckState {
  try {
    const raw = window.localStorage.getItem(DECK_STATE_STORAGE_KEY)
    if (!raw) {
      return emptyDeckState()
    }
    const parsed = JSON.parse(raw) as DeckSnapshot
    if (isEmptyDeck(parsed)) {
      return emptyDeckState()
    }
    return snapshotToDeck(parsed)
  } catch {
    return emptyDeckState()
  }
}

export function saveDeckStateToStorage(deck: DeckState): void {
  try {
    const snapshot = deckToSnapshot(deck)
    if (isEmptyDeck(snapshot)) {
      window.localStorage.removeItem(DECK_STATE_STORAGE_KEY)
      return
    }
    window.localStorage.setItem(DECK_STATE_STORAGE_KEY, JSON.stringify(snapshot))
  } catch {
    // ignore storage errors
  }
}

function emptyDeckState(): DeckState {
  return {
    legend: null,
    hero: null,
    mainDeck: {},
    runeDeck: {},
    battlefield: [],
  }
}
