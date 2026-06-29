import { useMemo } from 'react'
import type { MainCard } from '../types/cards'
import { MAIN_DECK_HERO_LIMIT } from '../utils/deckRules'
import {
  NO_NUMERIC_VALUE,
  buildCostDistribution,
  buildSelectedEntries,
  countHeroInCounters,
} from '../utils/mainDeckFilters'

interface MainDeckConfigPanelProps {
  cards: MainCard[]
  selectedCounters: Record<string, number>
  counterTarget: number
  maxCountPerCard: number
  atTotalLimit: boolean
  onCounterChange: (cardId: string, nextCount: number) => void
}

function formatEnergyLabel(energy: number): string {
  return energy === NO_NUMERIC_VALUE ? '无' : String(energy)
}

function MainDeckConfigPanel(props: MainDeckConfigPanelProps) {
  const {
    cards,
    selectedCounters,
    counterTarget,
    maxCountPerCard,
    atTotalLimit,
    onCounterChange,
  } = props

  const counterTotal = useMemo(
    () => Object.values(selectedCounters).reduce((sum, count) => sum + count, 0),
    [selectedCounters],
  )

  const heroCount = useMemo(
    () => countHeroInCounters(cards, selectedCounters),
    [cards, selectedCounters],
  )

  const costDistribution = useMemo(
    () => buildCostDistribution(cards, selectedCounters),
    [cards, selectedCounters],
  )

  const selectedEntries = useMemo(
    () => buildSelectedEntries(cards, selectedCounters),
    [cards, selectedCounters],
  )

  const maxBarCount = useMemo(
    () => Math.max(...costDistribution.map((item) => item.count), 1),
    [costDistribution],
  )

  const counterRemaining = Math.max(counterTarget - counterTotal, 0)

  return (
    <aside className="main-deck-config-panel">
      <h3 className="config-panel-title">当前配置</h3>

      <div className="config-panel-summary">
        <p>
          已选 <strong>{counterTotal}</strong> / {counterTarget} 张
        </p>
        <p>
          还可选 <strong>{counterRemaining}</strong> 张
        </p>
        <p>
          英雄 <strong>{heroCount}</strong> / {MAIN_DECK_HERO_LIMIT} 张
        </p>
      </div>

      {costDistribution.length > 0 ? (
        <section className="cost-curve-section">
          <h4>费用分布</h4>
          <div className="cost-curve">
            {costDistribution.map((item) => (
              <div key={item.energy} className="cost-bar-group">
                <div
                  className="cost-bar"
                  style={{ height: `${(item.count / maxBarCount) * 100}%` }}
                  title={`${formatEnergyLabel(item.energy)} 费：${item.count} 张`}
                />
                <span className="cost-bar-count">{item.count}</span>
                <span className="cost-bar-label">{formatEnergyLabel(item.energy)}</span>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="selected-cards-section">
        <h4>已选卡牌 ({selectedEntries.length})</h4>
        {selectedEntries.length === 0 ? (
          <p className="helper config-empty">尚未选择卡牌</p>
        ) : (
          <ul className="selected-card-list">
            {selectedEntries.map(({ card, count }) => {
              const atCardLimit = count >= maxCountPerCard
              const atIncrementLimit = atCardLimit || atTotalLimit

              return (
                <li key={card.id} className="selected-card-row">
                  <img src={card.image} alt={card.name} className="selected-card-thumb" />
                  <div className="selected-card-info">
                    <span className="selected-card-name">{card.name}</span>
                    <span className="selected-card-meta">
                      {card.energy !== null ? `${card.energy} 费` : '无费用'}
                    </span>
                  </div>
                  <div className="counter-row selected-card-counter">
                    <button
                      type="button"
                      className="btn ghost"
                      disabled={count <= 0}
                      onClick={() => onCounterChange(card.id, count - 1)}
                    >
                      -
                    </button>
                    <span>{count}</span>
                    <button
                      type="button"
                      className="btn ghost"
                      disabled={atIncrementLimit}
                      onClick={() => onCounterChange(card.id, count + 1)}
                    >
                      +
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </aside>
  )
}

export default MainDeckConfigPanel
