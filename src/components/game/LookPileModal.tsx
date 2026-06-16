import type { BaseCard } from '../../types/cards'
import type { GameCardInstance } from '../../types/game'

interface LookPileModalProps {
  open: boolean
  title: string
  cards: GameCardInstance[]
  getCardMeta: (card: GameCardInstance) => BaseCard | null
  onClose: () => void
}

function LookPileModal({
  open,
  title,
  cards,
  getCardMeta,
  onClose,
}: LookPileModalProps) {
  if (!open) {
    return null
  }

  return (
    <div className="modal-mask" onClick={onClose}>
      <section className="modal look-modal" onClick={(e) => e.stopPropagation()}>
        <header className="modal-header">
          <h2>{title}</h2>
          <button type="button" className="btn ghost" onClick={onClose}>
            关闭
          </button>
        </header>
        <p className="helper">共 {cards.length} 张（从上到下为抽牌顺序）</p>
        <div className="look-card-list">
          {cards.length === 0 ? (
            <p className="zone-empty">牌堆为空</p>
          ) : (
            cards.map((card, index) => {
              const meta = getCardMeta(card)
              return (
                <article key={card.instanceId} className="look-card-item">
                  <span className="look-index">#{index + 1}</span>
                  <img src={meta?.image ?? ''} alt={meta?.name ?? card.cardId} />
                  <span>{meta?.name ?? card.cardId}</span>
                </article>
              )
            })
          )}
        </div>
      </section>
    </div>
  )
}

export default LookPileModal
