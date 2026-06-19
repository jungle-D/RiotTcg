import './FirstPlayerChoiceModal.css'

interface FirstPlayerChoiceModalProps {
  open: boolean
  playerDice: number
  opponentDice: number
  onChooseSelf: () => void
  onChooseOpponent: () => void
}

function FirstPlayerChoiceModal({
  open,
  playerDice,
  opponentDice,
  onChooseSelf,
  onChooseOpponent,
}: FirstPlayerChoiceModalProps) {
  if (!open) {
    return null
  }

  return (
    <div className="modal-mask">
      <div className="modal first-player-choice-modal">
        <header className="modal-header">
          <h2>选择先手玩家</h2>
        </header>
        <p className="first-player-choice-hint">
          你掷出了更高的点数（{playerDice} 对 {opponentDice}），请选择谁先手。
        </p>
        <div className="first-player-choice-actions">
          <button type="button" className="btn primary" onClick={onChooseSelf}>
            我先手
          </button>
          <button type="button" className="btn ghost" onClick={onChooseOpponent}>
            对手先手
          </button>
        </div>
      </div>
    </div>
  )
}

export default FirstPlayerChoiceModal
