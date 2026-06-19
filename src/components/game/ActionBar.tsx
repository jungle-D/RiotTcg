import type { ActionMode } from '../../types/game'

interface ActionBarProps {
  actionMode: ActionMode
  turnPhase: string
  isPlayerTurn: boolean
  playerMulliganDone: boolean
  opponentMulliganDone: boolean
  mulliganSelectedCount: number
  onAction: (mode: ActionMode) => void
  onEndTurn: () => void
  onConfirmDiscard: () => void
  onConfirmTap: () => void
  onConfirmUntap: () => void
  onConfirmRecycle: () => void
  onFinishMulligan: () => void
  onUndo: () => void
  selectedActionCount: number
  canUndo: boolean
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
  playerMulliganDone,
  opponentMulliganDone,
  mulliganSelectedCount,
  onAction,
  onEndTurn,
  onConfirmDiscard,
  onConfirmTap,
  onConfirmUntap,
  onConfirmRecycle,
  onFinishMulligan,
  onUndo,
  selectedActionCount,
  canUndo,
}: ActionBarProps) {
  const mainPhase = turnPhase === 'main' && isPlayerTurn
  const mulliganPhase = turnPhase === 'mulligan' && !playerMulliganDone
  const mulliganWaiting = turnPhase === 'mulligan' && playerMulliganDone && !opponentMulliganDone
  const diceWaiting = turnPhase === 'diceRoll'
  const firstPlayerChoiceWaiting = turnPhase === 'firstPlayerChoice'
  const showUndo =
    turnPhase !== 'waitingOpponent' &&
    turnPhase !== 'battlefieldSelect' &&
    turnPhase !== 'diceRoll' &&
    turnPhase !== 'firstPlayerChoice'

  return (
    <footer className="action-bar">
      {showUndo ? (
        <button type="button" className="btn ghost undo-btn" onClick={onUndo} disabled={!canUndo}>
          撤回上一步
        </button>
      ) : null}

      {mulliganPhase ? (
        <>
          <p className="mulligan-hint">
            开局调度：点击手牌选择最多 2 张放回牌堆底部（已选 {mulliganSelectedCount}/2）
          </p>
          <button type="button" className="btn primary" onClick={onFinishMulligan}>
            完成调度
          </button>
        </>
      ) : null}

      {mulliganWaiting ? (
        <p className="waiting-text">调度完成，等待对手调度…</p>
      ) : null}

      {diceWaiting ? (
        <p className="waiting-text">双方调度完成，正在自动投掷骰子…</p>
      ) : null}

      {firstPlayerChoiceWaiting ? (
        <p className="waiting-text">掷骰较高者正在选择先手…</p>
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
          {actionMode === 'recycle' && selectedActionCount > 0 ? (
            <button type="button" className="btn primary" onClick={onConfirmRecycle}>
              确认回收（{selectedActionCount}）
            </button>
          ) : null}
        </>
      ) : null}

      {turnPhase === 'waitingOpponent' && !mulliganWaiting && !diceWaiting && !firstPlayerChoiceWaiting ? (
        <p className="waiting-text">等待对方回合结束…</p>
      ) : null}
    </footer>
  )
}

export default ActionBar
