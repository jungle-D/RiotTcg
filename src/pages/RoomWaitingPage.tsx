import { useEffect, useState } from 'react'
import {
  LOCAL_ROOM_STORAGE_KEY,
  clearLocalRoom,
  getLocalRoom,
} from '../services/roomService'
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

  useEffect(() => {
    const tryEnterAsHost = () => {
      const room = getLocalRoom()
      if (room?.roomId === roomId && room.guestDeck) {
        onEnterGame({
          roomId: room.roomId,
          role: 'host',
          playerDeck: room.hostDeck,
          opponentDeck: room.guestDeck,
        })
        clearLocalRoom()
      }
    }

    const onStorage = (event: StorageEvent) => {
      if (event.key === LOCAL_ROOM_STORAGE_KEY) {
        tryEnterAsHost()
      }
    }

    window.addEventListener('storage', onStorage)
    const timer = window.setInterval(tryEnterAsHost, 400)

    return () => {
      window.removeEventListener('storage', onStorage)
      window.clearInterval(timer)
    }
  }, [onEnterGame, roomId])

  const handleCancel = () => {
    clearLocalRoom()
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
        请另一位玩家在<strong>同一款 Chrome 普通窗口</strong>中打开下方链接（不要用无痕窗口），构筑牌组后输入房间号加入。
      </p>
      <p className="room-waiting-note">
        必须使用完全相同地址（<code>localhost</code> 与 <code>127.0.0.1</code> 不互通；5173 与 5174 不互通）。
      </p>
      <div className="room-waiting-url-row">
        <code className="room-waiting-url">{joinUrl}</code>
        <button type="button" className="btn" onClick={handleCopyUrl}>
          {copied ? '已复制' : '复制链接'}
        </button>
      </div>
      <p className="room-waiting-label">房间号（点击复制）</p>
      <button
        type="button"
        className="room-waiting-code room-waiting-code-copy"
        onClick={handleCopyRoomId}
        title="点击复制房间号"
      >
        {roomId}
      </button>
      {copiedRoomId ? <p className="room-waiting-copied">房间号已复制</p> : null}
      <p className="room-waiting-status">等待中…</p>
      <button type="button" className="btn ghost" onClick={handleCancel}>
        取消并返回构筑
      </button>
    </main>
  )
}

export default RoomWaitingPage
