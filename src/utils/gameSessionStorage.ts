import type { GameSession } from '../types/game'

const ACTIVE_SESSION_KEY = 'riottcg.activeSession'

export interface StoredSession {
  roomId: string
  role: 'host' | 'guest'
  clientId: string
  playerDeck?: GameSession['playerDeck']
  opponentDeck?: GameSession['opponentDeck']
}

export function saveActiveSession(session: GameSession, clientId: string): void {
  try {
    const stored: StoredSession = {
      roomId: session.roomId,
      role: session.role,
      clientId,
      playerDeck: session.playerDeck,
      opponentDeck: session.opponentDeck,
    }
    window.sessionStorage.setItem(ACTIVE_SESSION_KEY, JSON.stringify(stored))
  } catch {
    // ignore storage write errors
  }
}

export function loadStoredSession(): StoredSession | null {
  try {
    const raw = window.sessionStorage.getItem(ACTIVE_SESSION_KEY)
    if (!raw) {
      return null
    }
    const parsed = JSON.parse(raw) as StoredSession
    if (!parsed.roomId || !parsed.role || !parsed.clientId) {
      return null
    }
    return parsed
  } catch {
    return null
  }
}

export function clearActiveSession(): void {
  try {
    window.sessionStorage.removeItem(ACTIVE_SESSION_KEY)
  } catch {
    // ignore
  }
}

/** @deprecated use saveActiveSession with clientId */
export function loadActiveSession(): GameSession | null {
  const stored = loadStoredSession()
  if (!stored?.playerDeck || !stored.opponentDeck) {
    return null
  }
  return {
    roomId: stored.roomId,
    role: stored.role,
    playerDeck: stored.playerDeck,
    opponentDeck: stored.opponentDeck,
  }
}
