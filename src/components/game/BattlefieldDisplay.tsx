import { useState } from 'react'
import { getBattlefieldCard } from '../../data/loltcgCatalog'
import CardPreviewModal from './CardPreviewModal'
import './BattlefieldDisplay.css'

interface BattlefieldDisplayProps {
  battlefieldId: string | null
  waitingText?: string
}

function BattlefieldDisplay({
  battlefieldId,
  waitingText = '等待选择战场…',
}: BattlefieldDisplayProps) {
  const [previewOpen, setPreviewOpen] = useState(false)
  const battlefield = battlefieldId ? getBattlefieldCard(battlefieldId) : null

  if (!battlefield) {
    return <p className="battlefield-display-waiting">{waitingText}</p>
  }

  return (
    <>
      <div className="battlefield-display">
        <img
          src={battlefield.image}
          alt={battlefield.name}
          className="battlefield-display-thumb"
        />
        <button
          type="button"
          className="battlefield-display-name"
          onClick={() => setPreviewOpen(true)}
          title="点击查看战场大图"
        >
          {battlefield.name}
        </button>
      </div>
      <CardPreviewModal
        open={previewOpen}
        card={battlefield}
        rotateImage
        onClose={() => setPreviewOpen(false)}
      />
    </>
  )
}

export default BattlefieldDisplay
