import type { ReactNode } from 'react'
import type { BaseCard } from '../../types/cards'
import type { GameCardInstance, ZoneId } from '../../types/game'
import CardInstanceView from './CardInstanceView'

interface ZonePanelProps {
  zoneId: ZoneId
  title: ReactNode
  cards: GameCardInstance[]
  getCardMeta: (card: GameCardInstance) => BaseCard | null
  faceDown?: boolean
  highlight?: boolean
  onZoneClick?: () => void
  onCardClick?: (instanceId: string) => void
  isCardSelected?: (instanceId: string) => boolean
  className?: string
}

function ZonePanel({
  zoneId,
  title,
  cards,
  getCardMeta,
  faceDown = false,
  highlight = false,
  onZoneClick,
  onCardClick,
  isCardSelected,
  className = '',
}: ZonePanelProps) {
  const showStackOnly = faceDown && cards.length > 0

  return (
    <section
      className={`zone-panel ${className} ${highlight ? 'highlight' : ''}`}
      data-zone={zoneId}
      onClick={onZoneClick}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          onZoneClick?.()
        }
      }}
      role={onZoneClick ? 'button' : undefined}
      tabIndex={onZoneClick ? 0 : undefined}
    >
      <header className="zone-header">
        <h3>{title}</h3>
        <span className="zone-count">{cards.length}</span>
      </header>

      <div className="zone-body">
        {showStackOnly ? (
          <div className="pile-stack">
            <span className="pile-back">牌堆</span>
            <span className="pile-count">{cards.length} 张</span>
          </div>
        ) : cards.length === 0 ? (
          <p className="zone-empty">空</p>
        ) : (
          <div className="zone-cards">
            {cards.map((card) => (
              <CardInstanceView
                key={card.instanceId}
                card={card}
                meta={getCardMeta(card)}
                faceDown={faceDown}
                selected={isCardSelected?.(card.instanceId)}
                onClick={(event) => {
                  event.stopPropagation()
                  onCardClick?.(card.instanceId)
                }}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

export default ZonePanel
