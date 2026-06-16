export function createRoom(): string {
  return String(Math.floor(100000 + Math.random() * 900000))
}

export function joinRoom(code: string): boolean {
  const trimmed = code.trim()
  return /^\d{4,8}$/.test(trimmed)
}
