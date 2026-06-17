import { getBattlefieldCard } from '../../data/loltcgCatalog'
import './BattlefieldOpponentPanel.css'

interface BattlefieldOpponentPanelProps {
  title: string
  battlefieldId: string | null
  waitingText?: string
}

function BattlefieldOpponentPanel({
  title,
  battlefieldId,
  waitingText = '等待对手选择战场…',
}: BattlefieldOpponentPanelProps) {
  const battlefield = battlefieldId ? getBattlefieldCard(battlefieldId) : null

  return (
    <article className="battlefield-opponent-panel">
      <h3>{title}</h3>
      {battlefield ? (
        <div className="battlefield-opponent-preview">
          <img
            src={battlefield.image}
            alt={battlefield.name}
            className="battlefield-thumb-rotated"
          />
          <p className="battlefield-opponent-name">{battlefield.name}</p>
        </div>
      ) : (
        <p className="battlefield-opponent-waiting">{waitingText}</p>
      )}
    </article>
  )
}

export default BattlefieldOpponentPanel
