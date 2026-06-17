export const GAME_SYNC_STORAGE_KEY_PREFIX = 'riottcg.gameSync.'

export interface BattlefieldSyncState {
  roomId: string
  hostBattlefieldChoice: string | null
  guestBattlefieldChoice: string | null
  updatedAt: number
}

function storageKey(roomId: string): string {
  return `${GAME_SYNC_STORAGE_KEY_PREFIX}${roomId.trim()}`
}

function readSync(roomId: string): BattlefieldSyncState | null {
  try {
    const raw = window.localStorage.getItem(storageKey(roomId))
    if (!raw) {
      return null
    }
    const parsed = JSON.parse(raw) as BattlefieldSyncState
    if (parsed.roomId !== roomId.trim()) {
      return null
    }
    return parsed
  } catch {
    return null
  }
}

function writeSync(state: BattlefieldSyncState): boolean {
  try {
    const json = JSON.stringify(state)
    window.localStorage.setItem(storageKey(state.roomId), json)
    return localStorage.getItem(storageKey(state.roomId)) === json
  } catch {
    return false
  }
}

export function initBattlefieldSync(roomId: string): void {
  const trimmed = roomId.trim()
  const existing = readSync(trimmed)
  if (existing) {
    return
  }
  writeSync({
    roomId: trimmed,
    hostBattlefieldChoice: null,
    guestBattlefieldChoice: null,
    updatedAt: Date.now(),
  })
}

export function publishBattlefieldChoice(
  roomId: string,
  role: 'host' | 'guest',
  battlefieldId: string,
): boolean {
  const trimmed = roomId.trim()
  const current =
    readSync(trimmed) ??
    ({
      roomId: trimmed,
      hostBattlefieldChoice: null,
      guestBattlefieldChoice: null,
      updatedAt: Date.now(),
    } satisfies BattlefieldSyncState)

  const next: BattlefieldSyncState = {
    ...current,
    updatedAt: Date.now(),
    hostBattlefieldChoice:
      role === 'host' ? battlefieldId : current.hostBattlefieldChoice,
    guestBattlefieldChoice:
      role === 'guest' ? battlefieldId : current.guestBattlefieldChoice,
  }
  return writeSync(next)
}

export function getBattlefieldSync(roomId: string): BattlefieldSyncState | null {
  return readSync(roomId.trim())
}

export function clearBattlefieldSync(roomId: string): void {
  try {
    window.localStorage.removeItem(storageKey(roomId.trim()))
  } catch {
    // ignore
  }
}

export function getBattlefieldSyncStorageKey(roomId: string): string {
  return storageKey(roomId.trim())
}
