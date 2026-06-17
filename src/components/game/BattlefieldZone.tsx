import { getBattlefieldCard } from '../../data/loltcgCatalog'
import type { BaseCard } from '../../types/cards'
import type { GameCardInstance, ZoneId } from '../../types/game'
import ZonePanel from './ZonePanel'
import './BattlefieldZone.css'

interface BattlefieldZoneProps {
  zoneId: ZoneId
  title: string
  battlefieldId: string | null
  cards: GameCardInstance[]
  getCardMeta: (card: GameCardInstance) => BaseCard | null
  highlight?: boolean
  onZoneClick?: () => void
  onCardClick?: (instanceId: string) => void
  isCardSelected?: (instanceId: string) => boolean
}

function BattlefieldZone({
  zoneId,
  title,
  battlefieldId,
  cards,
  getCardMeta,
  highlight = false,
  onZoneClick,
  onCardClick,
  isCardSelected,
}: BattlefieldZoneProps) {
  const battlefield = battlefieldId ? getBattlefieldCard(battlefieldId) : null

  return (
    <article className="battlefield-zone">
      <h3>{title}</h3>
      <div className="battlefield-zone-body">
        {battlefield ? (
          <img
            src={battlefield.image}
            alt={battlefield.name}
            className="battlefield-zone-bg"
          />
        ) : null}
        <div className="battlefield-zone-overlay">
          <ZonePanel
            zoneId={zoneId}
            title={battlefield?.name ?? '未选择'}
            cards={cards}
            getCardMeta={getCardMeta}
            highlight={highlight}
            onZoneClick={onZoneClick}
            onCardClick={onCardClick}
            isCardSelected={isCardSelected}
            className="battlefield-zone-panel"
          />
        </div>
      </div>
    </article>
  )
}

export default BattlefieldZone
