import type { ActionMode } from '../../types/game'

interface ActionBarProps {
  actionMode: ActionMode
  turnPhase: string
  isPlayerTurn: boolean
  playerDice: number | null
  opponentDice: number | null
  onAction: (mode: ActionMode) => void
  onEndTurn: () => void
  onConfirmDiscard: () => void
  onConfirmTap: () => void
  onConfirmUntap: () => void
  onFinishMulligan: () => void
  onRollDice: () => void
  selectedActionCount: number
  canRollDice: boolean
}

const ACTIONS: { mode: NonNullable<ActionMode>; label: string }[] = [
  { mode: 'draw', label: '抽牌' },
  { mode: 'discard', label: '弃牌' },
  { mode: 'tap', label: '横置' },
  { mode: 'untap', label: '回正' },
  { mode: 'move', label: '移动' },
  { mode: 'recycle', label: '回收' },
  { mode: 'look', label: '看牌' },
]

function ActionBar({
  actionMode,
  turnPhase,
  isPlayerTurn,
  playerDice,
  opponentDice,
  onAction,
  onEndTurn,
  onConfirmDiscard,
  onConfirmTap,
  onConfirmUntap,
  onFinishMulligan,
  onRollDice,
  selectedActionCount,
  canRollDice,
}: ActionBarProps) {
  const mainPhase = turnPhase === 'main' && isPlayerTurn
  const mulliganPhase = turnPhase === 'mulligan' && isPlayerTurn
  const dicePhase = turnPhase === 'diceRoll'

  return (
    <footer className="action-bar">
      {dicePhase ? (
        <div className="dice-panel">
          <p className="dice-hint">投掷骰子决定先手，点数大者先手。</p>
          {playerDice !== null && opponentDice !== null ? (
            <p className="dice-result">
              你的点数：{playerDice} · 对手点数：{opponentDice}
            </p>
          ) : null}
          <button
            type="button"
            className="btn primary"
            onClick={onRollDice}
            disabled={!canRollDice}
          >
            投掷骰子
          </button>
        </div>
      ) : null}

      {mulliganPhase ? (
        <button type="button" className="btn primary" onClick={onFinishMulligan}>
          完成调度
        </button>
      ) : null}

      {mainPhase ? (
        <>
          <div className="action-buttons">
            {ACTIONS.map(({ mode, label }) => (
              <button
                key={mode}
                type="button"
                className={`btn ${actionMode === mode ? 'active' : ''}`}
                onClick={() => onAction(mode)}
              >
                {label}
              </button>
            ))}
            <button type="button" className="btn danger" onClick={onEndTurn}>
              回合结束
            </button>
          </div>
          {actionMode === 'discard' && selectedActionCount > 0 ? (
            <button type="button" className="btn primary" onClick={onConfirmDiscard}>
              确认弃牌（{selectedActionCount}）
            </button>
          ) : null}
          {actionMode === 'tap' && selectedActionCount > 0 ? (
            <button type="button" className="btn primary" onClick={onConfirmTap}>
              确认横置（{selectedActionCount}）
            </button>
          ) : null}
          {actionMode === 'untap' && selectedActionCount > 0 ? (
            <button type="button" className="btn primary" onClick={onConfirmUntap}>
              确认回正（{selectedActionCount}）
            </button>
          ) : null}
        </>
      ) : null}

      {turnPhase === 'waitingOpponent' ? (
        <p className="waiting-text">等待对方回合结束…</p>
      ) : null}
    </footer>
  )
}

export default ActionBar
