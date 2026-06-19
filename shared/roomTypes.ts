export interface DeckSnapshot {
  legendId: string | null
  heroId: string | null
  mainDeck: Record<string, number>
  runeDeck: Record<string, number>
  battlefield: string[]
}

export interface OnlineRoom {
  roomId: string
  hostDeck: DeckSnapshot
  guestDeck: DeckSnapshot | null
  hostClientId: string
  guestClientId: string | null
  createdAt: number
}

export type JoinRoomReason = 'not_found' | 'already_joined' | 'id_mismatch'
