import { useEffect, useState } from 'react'
import type { GameSession } from './types/game'
import { fetchRoomGameSync, hasRoomGameSync } from './services/gameSyncService'
import {
  clearActiveSession,
  loadStoredSession,
  saveActiveSession,
} from './utils/gameSessionStorage'
import { getOrCreateClientId } from './utils/clientId'
import { hydrateSessionFromRoom } from './services/network/roomClient'
import DeckBuilderPage from './pages/DeckBuilderPage'
import GameBoardPage from './pages/GameBoardPage'
import LegendHeroMappingPage from './pages/LegendHeroMappingPage'
import RoomWaitingPage from './pages/RoomWaitingPage'
import RoomDevPage from './pages/RoomDevPage'
import './App.css'

function getInitialPage(): 'builder' | 'restoring' | 'room-dev' {
  if (typeof window !== 'undefined' && window.location.hash.includes('room-dev')) {
    return 'room-dev'
  }
  return loadStoredSession() ? 'restoring' : 'builder'
}

function App() {
  const [page, setPage] = useState<'builder' | 'mapping' | 'game' | 'waiting' | 'restoring' | 'room-dev'>(
    getInitialPage,
  )
  const [session, setSession] = useState<GameSession | null>(null)
  const [waitingRoomId, setWaitingRoomId] = useState<string | null>(null)
  const [restoreError, setRestoreError] = useState('')

  useEffect(() => {
    const stored = loadStoredSession()
    if (!stored || page !== 'restoring') {
      return
    }

    let cancelled = false

    const restore = async () => {
      const syncExists = await hasRoomGameSync(stored.roomId)
      if (cancelled) {
        return
      }
      if (!syncExists) {
        clearActiveSession()
        setPage('builder')
        setRestoreError('对局已结束或服务器已重启，请重新创建房间。')
        return
      }

      if (stored.playerDeck && stored.opponentDeck) {
        setSession({
          roomId: stored.roomId,
          role: stored.role,
          playerDeck: stored.playerDeck,
          opponentDeck: stored.opponentDeck,
        })
        setPage('game')
        return
      }

      const hydrated = await hydrateSessionFromRoom(
        stored.roomId,
        stored.clientId,
        stored.playerDeck ?? { legend: null, hero: null, mainDeck: {}, runeDeck: {}, battlefield: [] },
      )
      if (cancelled) {
        return
      }
      if (!hydrated) {
        clearActiveSession()
        setPage('builder')
        setRestoreError('无法恢复对局，请重新加入房间。')
        return
      }

      const nextSession: GameSession = {
        roomId: stored.roomId,
        role: hydrated.role,
        playerDeck: hydrated.playerDeck,
        opponentDeck: hydrated.opponentDeck,
      }
      saveActiveSession(nextSession, stored.clientId)
      setSession(nextSession)
      setPage('game')
    }

    void restore()
    void fetchRoomGameSync(stored.roomId)

    return () => {
      cancelled = true
    }
  }, [page])

  useEffect(() => {
    if (page === 'game' && session) {
      saveActiveSession(session, getOrCreateClientId())
    }
  }, [page, session])

  const handleEnterGame = (nextSession: GameSession) => {
    saveActiveSession(nextSession, getOrCreateClientId())
    setSession(nextSession)
    setWaitingRoomId(null)
    setPage('game')
  }

  const handleHostWaiting = (roomId: string) => {
    setWaitingRoomId(roomId)
    setPage('waiting')
  }

  const handleBack = () => {
    clearActiveSession()
    setPage('builder')
    setSession(null)
    setWaitingRoomId(null)
  }

  if (page === 'restoring') {
    return (
      <main className="app-restoring">
        <p>正在恢复对局…</p>
      </main>
    )
  }

  if (page === 'mapping') {
    return <LegendHeroMappingPage onBack={handleBack} />
  }

  if (page === 'waiting' && waitingRoomId) {
    return (
      <RoomWaitingPage
        roomId={waitingRoomId}
        onEnterGame={handleEnterGame}
        onBack={handleBack}
      />
    )
  }

  if (page === 'room-dev') {
    return <RoomDevPage onBack={handleBack} />
  }

  if (page === 'game' && session) {
    return <GameBoardPage session={session} onBack={handleBack} />
  }

  return (
    <>
      {restoreError ? <p className="app-restore-error">{restoreError}</p> : null}
      <DeckBuilderPage
        onEnterGame={handleEnterGame}
        onHostWaiting={handleHostWaiting}
        onOpenLegendHeroMapping={() => setPage('mapping')}
        onOpenRoomDev={() => setPage('room-dev')}
      />
    </>
  )
}

export default App
