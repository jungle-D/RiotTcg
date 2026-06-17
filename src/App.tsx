import { useState } from 'react'
import type { GameSession } from './types/game'
import DeckBuilderPage from './pages/DeckBuilderPage'
import GameBoardPage from './pages/GameBoardPage'
import LegendHeroMappingPage from './pages/LegendHeroMappingPage'
import RoomWaitingPage from './pages/RoomWaitingPage'
import './App.css'

type AppPage = 'builder' | 'mapping' | 'game' | 'waiting'

function App() {
  const [page, setPage] = useState<AppPage>('builder')
  const [session, setSession] = useState<GameSession | null>(null)
  const [waitingRoomId, setWaitingRoomId] = useState<string | null>(null)

  const handleEnterGame = (nextSession: GameSession) => {
    setSession(nextSession)
    setWaitingRoomId(null)
    setPage('game')
  }

  const handleHostWaiting = (roomId: string) => {
    setWaitingRoomId(roomId)
    setPage('waiting')
  }

  const handleBack = () => {
    setPage('builder')
    setSession(null)
    setWaitingRoomId(null)
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

  if (page === 'game' && session) {
    return <GameBoardPage session={session} onBack={handleBack} />
  }

  return (
    <DeckBuilderPage
      onEnterGame={handleEnterGame}
      onHostWaiting={handleHostWaiting}
      onOpenLegendHeroMapping={() => setPage('mapping')}
    />
  )
}

export default App
