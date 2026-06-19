import { useCallback, useEffect, useMemo, useState } from 'react'
import type { OnlineRoom } from '@shared/roomTypes'
import type { RoomGameSyncState } from '@shared/gameSyncTypes'
import GameBoardPage, { type DevPreviewOptions } from './GameBoardPage'
import { fetchRoomGameSync, subscribeSync } from '../services/gameSyncService'
import {
  fetchOnlineRoom,
  subscribeRoomUpdates,
} from '../services/network/roomClient'
import { snapshotToDeck } from '../services/roomService'
import type { GameSession } from '../types/game'
import { loadDeckStateFromStorage } from '../utils/deckBuilderStorage'
import {
  PREVIEW_SCENARIO_LABELS,
  buildPreviewSession,
  type PreviewScenario,
} from '../utils/roomPreviewState'
import './RoomDevPage.css'

interface RoomDevPageProps {
  onBack: () => void
}

function formatJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

function RoomDevPage({ onBack }: RoomDevPageProps) {
  const [panelOpen, setPanelOpen] = useState(true)
  const [role, setRole] = useState<GameSession['role']>('host')
  const [scenario, setScenario] = useState<PreviewScenario>('main')
  const [previewKey, setPreviewKey] = useState(0)

  const [watchRoomId, setWatchRoomId] = useState('')
  const [watching, setWatching] = useState(false)
  const [liveRoom, setLiveRoom] = useState<OnlineRoom | null>(null)
  const [liveSync, setLiveSync] = useState<RoomGameSyncState | null>(null)
  const [watchError, setWatchError] = useState('')
  const [useLiveSync, setUseLiveSync] = useState(false)

  const playerDeck = useMemo(() => loadDeckStateFromStorage(), [previewKey])

  const previewSession = useMemo(
    () => buildPreviewSession(playerDeck, playerDeck, role),
    [playerDeck, role],
  )

  const devPreview = useMemo((): DevPreviewOptions => {
    if (useLiveSync && liveSync) {
      return { liveSync }
    }
    return { scenario, seed: 'preview_seed_fixed' }
  }, [liveSync, scenario, useLiveSync])

  const liveSession = useMemo((): GameSession | null => {
    if (!liveRoom?.guestDeck) {
      return null
    }
    const hostDeck = snapshotToDeck(liveRoom.hostDeck)
    const guestDeck = snapshotToDeck(liveRoom.guestDeck)
    return {
      roomId: liveRoom.roomId,
      role,
      playerDeck: role === 'host' ? hostDeck : guestDeck,
      opponentDeck: role === 'host' ? guestDeck : hostDeck,
    }
  }, [liveRoom, role])

  const boardSession = useLiveSync && liveSession ? liveSession : previewSession

  const connectWatch = useCallback(async () => {
    const trimmed = watchRoomId.trim()
    if (!trimmed) {
      setWatchError('请输入房间号')
      return
    }
    setWatchError('')
    const room = await fetchOnlineRoom(trimmed)
    if (!room) {
      setWatchError('房间不存在或服务器未启动')
      setLiveRoom(null)
      setLiveSync(null)
      setWatching(false)
      return
    }
    setLiveRoom(room)
    setWatching(true)
    const sync = await fetchRoomGameSync(trimmed)
    setLiveSync(sync)
  }, [watchRoomId])

  const disconnectWatch = useCallback(() => {
    setWatching(false)
    setLiveRoom(null)
    setLiveSync(null)
    setUseLiveSync(false)
    setWatchError('')
  }, [])

  useEffect(() => {
    if (!watching || !watchRoomId.trim()) {
      return
    }
    const roomId = watchRoomId.trim()

    const unsubscribeRoom = subscribeRoomUpdates(roomId, '', (room) => {
      setLiveRoom(room)
    })

    const unsubscribeSync = subscribeSync(roomId, (sync) => {
      setLiveSync(sync)
    })

    const pollRoom = () => {
      void fetchOnlineRoom(roomId).then((room) => {
        if (room) {
          setLiveRoom(room)
        }
      })
      void fetchRoomGameSync(roomId).then((sync) => {
        if (sync) {
          setLiveSync(sync)
        }
      })
    }

    pollRoom()
    const timer = window.setInterval(pollRoom, 1000)

    return () => {
      unsubscribeRoom()
      unsubscribeSync()
      window.clearInterval(timer)
    }
  }, [watchRoomId, watching])

  const applyScenario = (next: PreviewScenario) => {
    setUseLiveSync(false)
    setScenario(next)
    setPreviewKey((value) => value + 1)
  }

  const applyLiveToBoard = () => {
    if (!liveSession || !liveSync) {
      setWatchError('需要房间已有双方卡组且 sync 已初始化')
      return
    }
    setWatchError('')
    setUseLiveSync(true)
    setPreviewKey((value) => value + 1)
  }

  return (
    <div className="room-dev-page">
      <aside className={`room-dev-panel ${panelOpen ? 'open' : 'collapsed'}`}>
        <header className="room-dev-panel-header">
          <h1>房间 UI 预览</h1>
          <button
            type="button"
            className="btn ghost room-dev-toggle"
            onClick={() => setPanelOpen((open) => !open)}
          >
            {panelOpen ? '收起' : '展开'}
          </button>
        </header>

        {panelOpen ? (
          <div className="room-dev-panel-body">
            <section className="room-dev-section">
              <h2>本地预览</h2>
              <p className="room-dev-hint">
                使用构建器中的卡组作为双方牌组，无需第二台设备即可调试对局页 UI。
              </p>

              <label className="room-dev-field">
                <span>视角</span>
                <select
                  value={role}
                  onChange={(event) => {
                    setUseLiveSync(false)
                    setRole(event.target.value as GameSession['role'])
                    setPreviewKey((value) => value + 1)
                  }}
                >
                  <option value="host">房主</option>
                  <option value="guest">加入者</option>
                </select>
              </label>

              <div className="room-dev-scenarios">
                {(Object.keys(PREVIEW_SCENARIO_LABELS) as PreviewScenario[]).map((key) => (
                  <button
                    key={key}
                    type="button"
                    className={`btn ${scenario === key && !useLiveSync ? 'primary' : ''}`}
                    onClick={() => applyScenario(key)}
                  >
                    {PREVIEW_SCENARIO_LABELS[key]}
                  </button>
                ))}
              </div>

              <button
                type="button"
                className="btn"
                onClick={() => {
                  setUseLiveSync(false)
                  setPreviewKey((value) => value + 1)
                }}
              >
                刷新预览
              </button>
            </section>

            <section className="room-dev-section">
              <h2>实时房间观察</h2>
              <p className="room-dev-hint">
                输入真实房间号，实时查看房间与 sync 状态；双方进局后可同步到棋盘预览。
              </p>

              <div className="room-dev-watch-row">
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="房间号"
                  value={watchRoomId}
                  onChange={(event) => setWatchRoomId(event.target.value)}
                />
                {watching ? (
                  <button type="button" className="btn" onClick={disconnectWatch}>
                    断开
                  </button>
                ) : (
                  <button type="button" className="btn primary" onClick={() => void connectWatch()}>
                    连接
                  </button>
                )}
              </div>

              {watchError ? <p className="room-dev-error">{watchError}</p> : null}

              {watching ? (
                <>
                  <div className="room-dev-live-meta">
                    <span>房间：{liveRoom?.roomId ?? '—'}</span>
                    <span>Guest：{liveRoom?.guestDeck ? '已加入' : '等待中'}</span>
                    <span>Sync v{liveSync?.version ?? '—'}</span>
                    <span>阶段：{liveSync?.turnPhase ?? '—'}</span>
                  </div>

                  <button
                    type="button"
                    className="btn primary"
                    disabled={!liveSession || !liveSync}
                    onClick={applyLiveToBoard}
                  >
                    同步到棋盘预览
                  </button>

                  <details className="room-dev-json" open>
                    <summary>房间信息 (room)</summary>
                    <pre>{formatJson(liveRoom)}</pre>
                  </details>

                  <details className="room-dev-json">
                    <summary>对局同步 (sync)</summary>
                    <pre>{formatJson(liveSync)}</pre>
                  </details>
                </>
              ) : null}
            </section>

            <footer className="room-dev-footer">
              <button type="button" className="btn ghost" onClick={onBack}>
                返回构建器
              </button>
            </footer>
          </div>
        ) : null}
      </aside>

      <div className="room-dev-board">
        {useLiveSync && liveSync ? (
          <p className="room-dev-live-badge">实时 sync · 房间 {boardSession.roomId}</p>
        ) : (
          <p className="room-dev-live-badge">本地预览 · {PREVIEW_SCENARIO_LABELS[scenario]}</p>
        )}
        <GameBoardPage
          key={`${previewKey}-${useLiveSync ? liveSync?.version : scenario}-${role}`}
          session={boardSession}
          onBack={onBack}
          devPreview={devPreview}
        />
      </div>
    </div>
  )
}

export default RoomDevPage
