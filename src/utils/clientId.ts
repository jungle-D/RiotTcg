const CLIENT_ID_KEY = 'riottcg.clientId'

export function getOrCreateClientId(): string {
  try {
    const existing = window.sessionStorage.getItem(CLIENT_ID_KEY)
    if (existing) {
      return existing
    }
    const created = `client_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
    window.sessionStorage.setItem(CLIENT_ID_KEY, created)
    return created
  } catch {
    return `client_${Date.now()}`
  }
}
