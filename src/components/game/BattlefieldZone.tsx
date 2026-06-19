import BattlefieldDisplay from './BattlefieldDisplay'
import type { BaseCard } from '../../types/cards'
import type { GameCardInstance, ZoneId } from '../../types/game'
import ZonePanel from './ZonePanel'
import './BattlefieldZone.css'

interface BattlefieldZoneProps {
  zoneId: ZoneId
  title: string
  battlefieldId: string | null
  /** 主要展示的单位（我方战场 = zones.battlefieldA；对手战场 = opponentZones.battlefieldA） */
  unitCards: GameCardInstance[]
  /** 同格上我方额外单位（仅对手战场格可能用到 zones.battlefieldB） */
  extraPlayerCards?: GameCardInstance[]
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
  unitCards,
  extraPlayerCards = [],
  getCardMeta,
  highlight = false,
  onZoneClick,
  onCardClick,
  isCardSelected,
}: BattlefieldZoneProps) {
  const hasExtraPlayerCards = extraPlayerCards.length > 0

  return (
    <article className="battlefield-zone">
      <h3>{title}</h3>
      <div className="battlefield-zone-layout">
        <BattlefieldDisplay battlefieldId={battlefieldId} waitingText="未选择战场" />
        <div className="battlefield-zone-cards">
          <ZonePanel
            zoneId={zoneId}
            title="场上单位"
            cards={unitCards}
            getCardMeta={getCardMeta}
            highlight={highlight}
            onZoneClick={onZoneClick}
            onCardClick={onCardClick}
            isCardSelected={isCardSelected}
            className="battlefield-zone-panel"
          />
          {hasExtraPlayerCards ? (
            <ZonePanel
              zoneId={zoneId}
              title="我方单位（此格）"
              cards={extraPlayerCards}
              getCardMeta={getCardMeta}
              highlight={highlight}
              onZoneClick={onZoneClick}
              onCardClick={onCardClick}
              isCardSelected={isCardSelected}
              className="battlefield-zone-panel battlefield-zone-panel-extra"
            />
          ) : null}
        </div>
      </div>
    </article>
  )
}

export default BattlefieldZone
