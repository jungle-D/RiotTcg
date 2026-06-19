import { useEffect, useRef, useState } from 'react'
import './DiceRollOverlay.css'

interface DiceRollOverlayProps {
  open: boolean
  playerDice: number | null
  opponentDice: number | null
  diceRollGeneration: number
  onRollComplete: (value: number) => void
  showFirstPlayerChoice?: boolean
  waitingForWinnerChoice?: boolean
  onChooseSelf?: () => void
  onChooseOpponent?: () => void
}

const FACE_ROTATIONS: Record<number, string> = {
  1: 'rotateX(0deg) rotateY(0deg)',
  2: 'rotateX(0deg) rotateY(180deg)',
  3: 'rotateX(0deg) rotateY(-90deg)',
  4: 'rotateX(0deg) rotateY(90deg)',
  5: 'rotateX(-90deg) rotateY(0deg)',
  6: 'rotateX(90deg) rotateY(0deg)',
}

interface DiceCubeProps {
  label: string
  value: number | null
  autoRoll: boolean
  generation: number
  onRollComplete?: (value: number) => void
  variant: 'player' | 'opponent'
}

function DiceCube({
  label,
  value,
  autoRoll,
  generation,
  onRollComplete,
  variant,
}: DiceCubeProps) {
  const [rolling, setRolling] = useState(false)
  const [localValue, setLocalValue] = useState<number | null>(null)
  const rolledGenerationsRef = useRef(new Set<string>())
  const onRollCompleteRef = useRef(onRollComplete)

  useEffect(() => {
    onRollCompleteRef.current = onRollComplete
  }, [onRollComplete])

  useEffect(() => {
    if (!autoRoll || value !== null) {
      return
    }

    const rollKey = `${generation}:${variant}`
    if (rolledGenerationsRef.current.has(rollKey)) {
      return
    }
    rolledGenerationsRef.current.add(rollKey)

    const rolled = Math.floor(Math.random() * 6) + 1
    setRolling(true)
    setLocalValue(null)

    window.setTimeout(() => {
      setRolling(false)
      setLocalValue(rolled)
      if (variant === 'player') {
        onRollCompleteRef.current?.(rolled)
      }
    }, 1400)
  }, [autoRoll, generation, value, variant])

  useEffect(() => {
    if (value === null) {
      setLocalValue(null)
    }
  }, [generation, value])

  const shownValue = value ?? localValue
  const rotation = shownValue ? FACE_ROTATIONS[shownValue] : undefined

  return (
    <div className={`dice-result-block dice-result-block-${variant}`}>
      <span className="dice-result-label">{label}</span>
      <div className={`dice-scene ${rolling ? 'is-rolling' : ''}`}>
        <div
          className="dice-cube"
          style={rotation ? { transform: rotation } : undefined}
        >
          <div className="dice-face dice-face-1">1</div>
          <div className="dice-face dice-face-2">2</div>
          <div className="dice-face dice-face-3">3</div>
          <div className="dice-face dice-face-4">4</div>
          <div className="dice-face dice-face-5">5</div>
          <div className="dice-face dice-face-6">6</div>
        </div>
      </div>
      <span className="dice-result-value dice-result-value-primary">
        {shownValue !== null ? `点数：${shownValue}` : rolling ? '投掷中…' : '等待中…'}
      </span>
    </div>
  )
}

function DiceRollOverlay({
  open,
  playerDice,
  opponentDice,
  diceRollGeneration,
  onRollComplete,
  showFirstPlayerChoice = false,
  waitingForWinnerChoice = false,
  onChooseSelf,
  onChooseOpponent,
}: DiceRollOverlayProps) {
  if (!open) {
    return null
  }

  const bothDiceReady = playerDice !== null && opponentDice !== null
  const isRollingPhase = !showFirstPlayerChoice && !waitingForWinnerChoice

  let heading = '投掷骰子'
  let hint = '双方调度完成，正在自动投掷骰子…'
  if (showFirstPlayerChoice) {
    heading = '选择先手玩家'
    hint = `你掷出了更高的点数（${playerDice} 对 ${opponentDice}），请选择谁先手。`
  } else if (waitingForWinnerChoice) {
    heading = '掷骰结果'
    hint = `你掷出 ${playerDice}，对手掷出 ${opponentDice}。对手点数更高，等待对手选择先手…`
  } else if (bothDiceReady) {
    hint = '双方点数已揭晓，正在判定掷骰较高者…'
  }

  return (
    <div className="dice-overlay-mask">
      <div className="dice-overlay-panel">
        <h2>{heading}</h2>
        <p className="dice-overlay-hint">{hint}</p>

        <div className="dice-results-row">
          <DiceCube
            label="你的骰子"
            value={playerDice}
            autoRoll={isRollingPhase && open}
            generation={diceRollGeneration}
            onRollComplete={onRollComplete}
            variant="player"
          />
          <DiceCube
            label="对手骰子"
            value={opponentDice}
            autoRoll={false}
            generation={diceRollGeneration}
            variant="opponent"
          />
        </div>

        {bothDiceReady ? (
          <p className="dice-final-summary">
            你的点数：{playerDice} · 对手点数：{opponentDice}
          </p>
        ) : null}

        {showFirstPlayerChoice && bothDiceReady ? (
          <div className="dice-first-player-actions">
            <button type="button" className="btn primary" onClick={onChooseSelf}>
              我先手
            </button>
            <button type="button" className="btn ghost" onClick={onChooseOpponent}>
              对手先手
            </button>
          </div>
        ) : null}
      </div>
    </div>
  )
}

export default DiceRollOverlay
