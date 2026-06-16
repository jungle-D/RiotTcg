import { useState } from 'react'
import type { GameSession } from './types/game'
import DeckBuilderPage from './pages/DeckBuilderPage'
import GameBoardPage from './pages/GameBoardPage'
import './App.css'

type AppPage = 'builder' | 'game'

function App() {
  const [page, setPage] = useState<AppPage>('builder')
  const [session, setSession] = useState<GameSession | null>(null)

  const handleEnterGame = (nextSession: GameSession) => {
    setSession(nextSession)
    setPage('game')
  }

  const handleBack = () => {
    setPage('builder')
  }

  if (page === 'game' && session) {
    return <GameBoardPage session={session} onBack={handleBack} />
  }

  return <DeckBuilderPage onEnterGame={handleEnterGame} />
}

export default App
