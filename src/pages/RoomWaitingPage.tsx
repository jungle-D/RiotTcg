import { useCallback, useEffect, useState } from 'react'
import type { OnlineRoom } from '@shared/roomTypes'
import { snapshotToDeck } from '../services/roomService'
import { subscribeRoomUpdates, deleteOnlineRoom } from '../services/network/roomClient'
import { getOrCreateClientId } from '../utils/clientId'
import type { GameSession } from '../types/game'
import './RoomWaitingPage.css'

interface RoomWaitingPageProps {
  roomId: string
  onEnterGame: (session: GameSession) => void
  onBack: () => void
}

function RoomWaitingPage({ roomId, onEnterGame, onBack }: RoomWaitingPageProps) {
  const [joinUrl] = useState(() => window.location.origin)
  const [copied, setCopied] = useState(false)
  const [copiedRoomId, setCopiedRoomId] = useState(false)
  const clientId = getOrCreateClientId()

  const tryEnterAsHost = useCallback(
    (room: OnlineRoom) => {
      if (room.roomId === roomId && room.guestDeck) {
        onEnterGame({
          roomId: room.roomId,
          role: 'host',
          playerDeck: snapshotToDeck(room.hostDeck),
          opponentDeck: snapshotToDeck(room.guestDeck),
        })
      }
    },
    [onEnterGame, roomId],
  )

  useEffect(() => {
    const unsubscribe = subscribeRoomUpdates(roomId, clientId, tryEnterAsHost)
    return unsubscribe
  }, [clientId, roomId, tryEnterAsHost])

  const handleCancel = () => {
    void deleteOnlineRoom(roomId)
    onBack()
  }

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(joinUrl)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  const handleCopyRoomId = async () => {
    try {
      await navigator.clipboard.writeText(roomId)
      setCopiedRoomId(true)
      window.setTimeout(() => setCopiedRoomId(false), 2000)
    } catch {
      setCopiedRoomId(false)
    }
  }

  return (
    <main className="room-waiting-page">
      <h1>等待对手加入</h1>
      <p className="room-waiting-hint">
        请另一位玩家在<strong>另一台设备或浏览器</strong>中打开下方链接，构筑牌组后输入房间号加入。
        局域网对战请使用 <strong>{joinUrl}</strong>（需与房主在同一 Wi-Fi，且 Mac 上运行{' '}
        <code>npm run dev</code>）。
      </p>
      <div className="room-waiting-card">
        <p className="room-id-label">房间号</p>
        <p className="room-id-value">{roomId}</p>
        <div className="room-waiting-actions">
          <button type="button" className="btn" onClick={handleCopyRoomId}>
            {copiedRoomId ? '已复制房间号' : '复制房间号'}
          </button>
          <button type="button" className="btn ghost" onClick={handleCopyUrl}>
            {copied ? '已复制链接' : '复制加入链接'}
          </button>
        </div>
        <p className="room-waiting-url">{joinUrl}</p>
      </div>
      <button type="button" className="btn ghost room-waiting-back" onClick={handleCancel}>
        取消并返回
      </button>
    </main>
  )
}

export default RoomWaitingPage
