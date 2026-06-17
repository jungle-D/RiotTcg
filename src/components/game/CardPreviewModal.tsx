import type { BaseCard } from '../../types/cards'
import './CardPreviewModal.css'

interface CardPreviewModalProps {
  open: boolean
  card: BaseCard | null
  onClose: () => void
}

function CardPreviewModal({ open, card, onClose }: CardPreviewModalProps) {
  if (!open || !card) {
    return null
  }

  return (
    <div
      className="card-preview-mask"
      role="presentation"
      onClick={onClose}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          onClose()
        }
      }}
    >
      <div
        className="card-preview-modal"
        role="dialog"
        aria-modal="true"
        aria-label={card.name}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="card-preview-header">
          <h2>{card.name}</h2>
          <button type="button" className="btn ghost" onClick={onClose}>
            关闭
          </button>
        </header>
        <div className="card-preview-image-stage">
          <img src={card.image} alt={card.name} className="card-preview-image" />
        </div>
        <p className="card-preview-meta">卡牌ID：{card.id}</p>
        <p className="card-preview-desc">{card.description}</p>
      </div>
    </div>
  )
}

export default CardPreviewModal
