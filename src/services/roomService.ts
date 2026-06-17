import { getCardMeta } from '../data/loltcgCatalog'
import type { DeckState } from '../types/cards'

export const LOCAL_ROOM_STORAGE_KEY = 'riottcg.localRoom'
const ROOM_TTL_MS = 2 * 60 * 60 * 1000

export function createRoom(): string {
  return String(Math.floor(100000 + Math.random() * 900000))
}

export function joinRoom(code: string): boolean {
  const trimmed = code.trim()
  return /^\d{4,8}$/.test(trimmed)
}

/** 仅存 ID 与计数，避免 localStorage 写入失败 */
export interface DeckSnapshot {
  legendId: string | null
  heroId: string | null
  mainDeck: Record<string, number>
  runeDeck: Record<string, number>
  battlefield: string[]
}

export interface LocalRoom {
  roomId: string
  hostDeck: DeckSnapshot
  guestDeck: DeckSnapshot | null
  createdAt: number
}

export type JoinLocalRoomResult =
  | { ok: true }
  | { ok: false; reason: 'not_found' | 'id_mismatch' | 'already_joined' | 'write_failed' }

export type CreateLocalRoomResult = { ok: true } | { ok: false; reason: 'write_failed' }

function normalizeRoomId(roomId: string): string {
  return roomId.trim()
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

function readLocalRoom(): LocalRoom | null {
  try {
    const raw = localStorage.getItem(LOCAL_ROOM_STORAGE_KEY)
    if (!raw) {
      return null
    }
    const parsed = JSON.parse(raw) as LocalRoom
    if (
      !parsed.roomId ||
      !parsed.hostDeck ||
      typeof parsed.createdAt !== 'number' ||
      typeof parsed.hostDeck.mainDeck !== 'object'
    ) {
      localStorage.removeItem(LOCAL_ROOM_STORAGE_KEY)
      return null
    }
    if (Date.now() - parsed.createdAt > ROOM_TTL_MS) {
      localStorage.removeItem(LOCAL_ROOM_STORAGE_KEY)
      return null
    }
    return parsed
  } catch {
    return null
  }
}

function writeLocalRoom(room: LocalRoom | null): boolean {
  try {
    if (!room) {
      localStorage.removeItem(LOCAL_ROOM_STORAGE_KEY)
      return true
    }
    const json = JSON.stringify(room)
    localStorage.setItem(LOCAL_ROOM_STORAGE_KEY, json)
    const readBack = localStorage.getItem(LOCAL_ROOM_STORAGE_KEY)
    if (!readBack || readBack !== json) {
      return false
    }
    return true
  } catch {
    return false
  }
}

export function createLocalRoom(roomId: string, hostDeck: DeckState): CreateLocalRoomResult {
  const ok = writeLocalRoom({
    roomId: normalizeRoomId(roomId),
    hostDeck: deckToSnapshot(hostDeck),
    guestDeck: null,
    createdAt: Date.now(),
  })
  return ok ? { ok: true } : { ok: false, reason: 'write_failed' }
}

export function joinLocalRoom(roomId: string, guestDeck: DeckState): JoinLocalRoomResult {
  const room = readLocalRoom()
  const trimmedId = normalizeRoomId(roomId)

  if (!room) {
    return { ok: false, reason: 'not_found' }
  }
  if (normalizeRoomId(room.roomId) !== trimmedId) {
    return { ok: false, reason: 'id_mismatch' }
  }
  if (room.guestDeck) {
    return { ok: false, reason: 'already_joined' }
  }

  const ok = writeLocalRoom({
    ...room,
    guestDeck: deckToSnapshot(guestDeck),
  })
  return ok ? { ok: true } : { ok: false, reason: 'write_failed' }
}

export function getLocalRoom(): { roomId: string; hostDeck: DeckState; guestDeck: DeckState | null } | null {
  const room = readLocalRoom()
  if (!room) {
    return null
  }
  return {
    roomId: room.roomId,
    hostDeck: snapshotToDeck(room.hostDeck),
    guestDeck: room.guestDeck ? snapshotToDeck(room.guestDeck) : null,
  }
}

export function clearLocalRoom(): void {
  writeLocalRoom(null)
}

export function hasGuestJoined(): boolean {
  return readLocalRoom()?.guestDeck != null
}

export function getJoinRoomHint(): string {
  const room = readLocalRoom()
  if (!room) {
    return `当前页面（${typeof window !== 'undefined' ? window.location.origin : ''}）未检测到房主创建的房间。`
  }
  return `已检测到房间 ${room.roomId}，但房间号不匹配或已被其他玩家加入。`
}
