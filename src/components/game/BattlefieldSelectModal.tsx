import type { BaseCard } from '../../types/cards'
import BattlefieldSelectOption from './BattlefieldSelectOption'
import './BattlefieldSelectModal.css'

interface BattlefieldSelectModalProps {
  open: boolean
  battlefieldIds: string[]
  selectedId: string | null
  statusMessage: string
  opponentLegend: BaseCard | null
  onSelect: (id: string) => void
}

function BattlefieldSelectModal({
  open,
  battlefieldIds,
  selectedId,
  statusMessage,
  opponentLegend,
  onSelect,
}: BattlefieldSelectModalProps) {
  if (!open) {
    return null
  }

  return (
    <div className="battlefield-select-mask" role="presentation">
      <div
        className="battlefield-select-modal"
        role="dialog"
        aria-modal="true"
        aria-label="选择战场"
      >
        <h2>选择战场</h2>
        <p className="battlefield-select-modal-hint">{statusMessage}</p>
        {opponentLegend ? (
          <div className="opponent-legend-banner">
            <span className="opponent-legend-label">对手传奇</span>
            <img
              src={opponentLegend.image}
              alt={opponentLegend.name}
              className="opponent-legend-thumb"
            />
            <span className="opponent-legend-name">{opponentLegend.name}</span>
          </div>
        ) : null}
        <p className="battlefield-select-modal-sub">
          请从下列战场中选择一张；双方选定后将进入调度环节。
        </p>
        <BattlefieldSelectOption
          label="你的战场"
          battlefieldIds={battlefieldIds}
          selectedId={selectedId}
          onSelect={onSelect}
        />
      </div>
    </div>
  )
}

export default BattlefieldSelectModal
