import BattlefieldDisplay from './BattlefieldDisplay'
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
  return (
    <article className="battlefield-opponent-panel">
      <h3>{title}</h3>
      <BattlefieldDisplay battlefieldId={battlefieldId} waitingText={waitingText} />
    </article>
  )
}

export default BattlefieldOpponentPanel
