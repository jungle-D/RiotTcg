import type { MouseEvent } from 'react'
import type { BaseCard } from '../../types/cards'
import type { GameCardInstance } from '../../types/game'

interface CardInstanceViewProps {
  card: GameCardInstance
  meta?: BaseCard | null
  faceDown?: boolean
  selected?: boolean
  onClick?: (event: MouseEvent<HTMLButtonElement>) => void
}

function CardInstanceView({
  card,
  meta,
  faceDown = false,
  selected = false,
  onClick,
}: CardInstanceViewProps) {
  const label = meta?.name ?? card.cardId

  return (
    <button
      type="button"
      className={`game-card ${card.tapped ? 'tapped' : ''} ${selected ? 'selected' : ''} ${
        faceDown ? 'face-down' : ''
      }`}
      onClick={onClick}
      title={label}
    >
      {faceDown ? (
        <span className="card-back">卡背</span>
      ) : (
        <>
          <img src={meta?.image ?? ''} alt={label} />
          <span className="card-label">{label}</span>
        </>
      )}
    </button>
  )
}

export default CardInstanceView
