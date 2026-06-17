import { getBattlefieldCard } from '../../data/loltcgCatalog'
import './BattlefieldSelectOption.css'

interface BattlefieldSelectOptionProps {
  battlefieldIds: string[]
  selectedId: string | null
  onSelect: (id: string) => void
  label: string
}

function BattlefieldSelectOption({
  battlefieldIds,
  selectedId,
  onSelect,
  label,
}: BattlefieldSelectOptionProps) {
  return (
    <div className="battlefield-select-panel">
      <h4>{label}</h4>
      <div className="battlefield-select-options">
        {battlefieldIds.map((id) => {
          const card = getBattlefieldCard(id)
          const isSelected = selectedId === id
          return (
            <button
              key={id}
              type="button"
              className={`battlefield-select-option ${isSelected ? 'selected' : ''}`}
              onClick={() => onSelect(id)}
            >
              {card ? (
                <div className="battlefield-thumb-stage">
                  <img
                    src={card.image}
                    alt={card.name}
                    className="battlefield-thumb-rotated"
                  />
                </div>
              ) : (
                <span className="battlefield-select-fallback">{id}</span>
              )}
              <span className="battlefield-select-name">{card?.name ?? id}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default BattlefieldSelectOption
