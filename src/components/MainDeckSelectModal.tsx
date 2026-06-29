import { useMemo, useState } from 'react'
import type { MainCard, MainDeckFilterCategory } from '../types/cards'
import { RUNE_COLOR_LABELS, isRuneColor } from '../constants/runeColors'
import MainDeckConfigPanel from './MainDeckConfigPanel'
import {
  ALL_FILTER_CATEGORIES,
  clampRangeValue,
  createDefaultMainDeckFilters,
  filterMainDeckCards,
  getAvailableColors,
  hasNullNumericField,
  type MainDeckFilterBounds,
  type MainDeckFilters,
  type NumericFieldBounds,
  type NumericRangeFilter,
} from '../utils/mainDeckFilters'

interface MainDeckSelectModalProps {
  open: boolean
  title: string
  cards: MainCard[]
  filterBounds: MainDeckFilterBounds
  legendColors: string[]
  selectedCounters: Record<string, number>
  helperText?: string
  errorText?: string
  maxCountPerCard: number
  counterTarget: number
  onClose: () => void
  onCounterChange: (cardId: string, nextCount: number) => void
  onConfirm: () => void
}

const TYPE_LABELS: Record<MainDeckFilterCategory, string> = {
  unit: '单位',
  spell: '法术',
  equipment: '装备',
  hero: '英雄',
}

function formatColorChipLabel(color: string): string {
  if (color === 'colorless') return '无色'
  if (isRuneColor(color)) return RUNE_COLOR_LABELS[color]
  return color
}

function formatCardMeta(card: MainCard): string {
  const parts = [TYPE_LABELS[card.filterCategory]]
  if (card.energy !== null) {
    parts.push(`${card.energy} 费`)
  }
  if (card.returnEnergy !== null) {
    parts.push(`符能 ${card.returnEnergy}`)
  }
  return parts.join(' · ')
}

function toggleSetValue<T>(set: Set<T>, value: T): Set<T> {
  const next = new Set(set)
  if (next.has(value)) {
    next.delete(value)
  } else {
    next.add(value)
  }
  return next
}

interface NumericRangeFilterGroupProps {
  label: string
  bounds: NumericFieldBounds
  unitLabel: string
  nullLabel: string
  showNullOption: boolean
  active: boolean
  range: NumericRangeFilter
  onActivate: () => void
  onReset: () => void
  onChange: (patch: Partial<NumericRangeFilter>) => void
}

function NumericRangeFilterGroup(props: NumericRangeFilterGroupProps) {
  const {
    label,
    bounds,
    unitLabel,
    nullLabel,
    showNullOption,
    active,
    range,
    onActivate,
    onReset,
    onChange,
  } = props

  return (
    <div className="filter-group filter-group-energy">
      <span className="filter-group-label">{label}</span>
      <div className="energy-range-controls">
        <button
          type="button"
          className={`filter-chip ${!active ? 'active' : ''}`}
          onClick={onReset}
        >
          全部
        </button>
        <button
          type="button"
          className={`filter-chip ${active ? 'active' : ''}`}
          onClick={onActivate}
        >
          范围
        </button>
        {active ? (
          <>
            <span className="energy-range-hint">
              {bounds.min}–{bounds.max} {unitLabel}
            </span>
            <label className="energy-range-field">
              <span className="energy-range-field-label">最低</span>
              <input
                type="number"
                className="energy-range-input"
                min={bounds.min}
                max={bounds.max}
                value={range.min}
                onChange={(event) => onChange({ min: Number(event.target.value) })}
              />
            </label>
            <span className="energy-range-separator">—</span>
            <label className="energy-range-field">
              <span className="energy-range-field-label">最高</span>
              <input
                type="number"
                className="energy-range-input"
                min={bounds.min}
                max={bounds.max}
                value={range.max}
                onChange={(event) => onChange({ max: Number(event.target.value) })}
              />
            </label>
            {showNullOption ? (
              <label className="energy-range-checkbox">
                <input
                  type="checkbox"
                  checked={range.includeNull}
                  onChange={(event) => onChange({ includeNull: event.target.checked })}
                />
                {nullLabel}
              </label>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  )
}

function MainDeckSelectModal(props: MainDeckSelectModalProps) {
  const {
    open,
    title,
    cards,
    filterBounds,
    legendColors,
    selectedCounters,
    helperText,
    errorText,
    maxCountPerCard,
    counterTarget,
    onClose,
    onCounterChange,
    onConfirm,
  } = props

  const [previewCard, setPreviewCard] = useState<MainCard | null>(null)
  const [filters, setFilters] = useState<MainDeckFilters>(() => createDefaultMainDeckFilters())

  const handleClose = () => {
    setFilters(createDefaultMainDeckFilters())
    setPreviewCard(null)
    onClose()
  }

  const handleConfirm = () => {
    setFilters(createDefaultMainDeckFilters())
    setPreviewCard(null)
    onConfirm()
  }

  const showNoEnergyOption = useMemo(
    () => hasNullNumericField(cards, 'energy'),
    [cards],
  )
  const showNoReturnEnergyOption = useMemo(
    () => hasNullNumericField(cards, 'returnEnergy'),
    [cards],
  )
  const availableColors = useMemo(
    () => getAvailableColors(cards, legendColors),
    [cards, legendColors],
  )

  const filteredCards = useMemo(
    () => filterMainDeckCards(cards, filters),
    [cards, filters],
  )

  const counterTotal = useMemo(
    () => Object.values(selectedCounters).reduce((sum, count) => sum + count, 0),
    [selectedCounters],
  )

  const atTotalLimit = counterTotal >= counterTarget

  if (!open) {
    return null
  }

  const updateFilters = (patch: Partial<MainDeckFilters>) => {
    setFilters((prev) => ({ ...prev, ...patch }))
  }

  const toggleType = (type: MainDeckFilterCategory) => {
    updateFilters({ types: toggleSetValue(filters.types, type) })
  }

  const createDefaultRange = (bounds: NumericFieldBounds): NumericRangeFilter => ({
    min: bounds.min,
    max: bounds.max,
    includeNull: true,
  })

  const updateNumericRange = (
    field: 'energyRange' | 'returnEnergyRange',
    bounds: NumericFieldBounds,
    patch: Partial<NumericRangeFilter>,
  ) => {
    const current = filters[field] ?? createDefaultRange(bounds)
    const next = { ...current, ...patch }
    const rawMin = clampRangeValue(next.min, bounds)
    const rawMax = clampRangeValue(next.max, bounds)
    const min = Math.min(rawMin, rawMax)
    const max = Math.max(rawMin, rawMax)
    updateFilters({ [field]: { ...next, min, max } })
  }

  const toggleColor = (color: string) => {
    if (filters.colors === null) {
      updateFilters({ colors: new Set([color]) })
      return
    }
    updateFilters({ colors: toggleSetValue(filters.colors, color) })
  }

  const resetColors = () => updateFilters({ colors: null })

  const activeEnergyRange =
    filters.energyRange ?? createDefaultRange(filterBounds.energy)
  const activeReturnEnergyRange =
    filters.returnEnergyRange ?? createDefaultRange(filterBounds.returnEnergy)

  return (
    <div className="modal-mask" onClick={handleClose}>
      <section
        className="modal main-deck-modal"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="modal-header">
          <h2>{title}</h2>
          <button type="button" className="btn ghost" onClick={handleClose}>
            关闭
          </button>
        </header>

        {helperText ? <p className="helper">{helperText}</p> : null}
        <p className="counter-progress">
          已选 <strong>{counterTotal}</strong> / {counterTarget} 张，还可选{' '}
          <strong>{Math.max(counterTarget - counterTotal, 0)}</strong> 张
        </p>
        {errorText ? <p className="error-text">{errorText}</p> : null}

        <div className="main-deck-modal-body">
          <div className="main-deck-main-column">
            <div className="main-deck-filters">
              <div className="filter-group">
                <span className="filter-group-label">类型</span>
                <div className="filter-chips">
                  {ALL_FILTER_CATEGORIES.map((type) => (
                    <button
                      key={type}
                      type="button"
                      className={`filter-chip ${filters.types.has(type) ? 'active' : ''}`}
                      onClick={() => toggleType(type)}
                    >
                      {TYPE_LABELS[type]}
                    </button>
                  ))}
                </div>
              </div>

              <NumericRangeFilterGroup
                label="费用"
                bounds={filterBounds.energy}
                unitLabel="费"
                nullLabel="含无费用"
                showNullOption={showNoEnergyOption}
                active={filters.energyRange !== null}
                range={activeEnergyRange}
                onActivate={() =>
                  updateFilters({ energyRange: createDefaultRange(filterBounds.energy) })
                }
                onReset={() => updateFilters({ energyRange: null })}
                onChange={(patch) =>
                  updateNumericRange('energyRange', filterBounds.energy, patch)
                }
              />

              <NumericRangeFilterGroup
                label="符能"
                bounds={filterBounds.returnEnergy}
                unitLabel="符能"
                nullLabel="含无符能"
                showNullOption={showNoReturnEnergyOption}
                active={filters.returnEnergyRange !== null}
                range={activeReturnEnergyRange}
                onActivate={() =>
                  updateFilters({
                    returnEnergyRange: createDefaultRange(filterBounds.returnEnergy),
                  })
                }
                onReset={() => updateFilters({ returnEnergyRange: null })}
                onChange={(patch) =>
                  updateNumericRange('returnEnergyRange', filterBounds.returnEnergy, patch)
                }
              />

              <div className="filter-group">
                <span className="filter-group-label">颜色</span>
                <div className="filter-chips">
                  <button
                    type="button"
                    className={`filter-chip ${filters.colors === null ? 'active' : ''}`}
                    onClick={resetColors}
                  >
                    全部
                  </button>
                  {availableColors.map((color) => (
                    <button
                      key={color}
                      type="button"
                      className={`filter-chip ${
                        filters.colors !== null && filters.colors.has(color) ? 'active' : ''
                      }`}
                      onClick={() => toggleColor(color)}
                    >
                      {formatColorChipLabel(color)}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <label className="card-search-field">
              <span className="sr-only">搜索卡牌</span>
              <input
                type="search"
                className="card-search-input"
                placeholder="搜索卡牌名称、ID 或描述…"
                value={filters.query}
                onChange={(event) => updateFilters({ query: event.target.value })}
              />
            </label>
            {filters.query.trim() ? (
              <p className="helper card-search-result">找到 {filteredCards.length} 张卡牌</p>
            ) : null}

            <div className="modal-scroll-content main-deck-scroll">
              <div className="card-grid">
                {filteredCards.map((card) => {
                  const count = selectedCounters[card.id] ?? 0
                  const atCardLimit = count >= maxCountPerCard
                  const atIncrementLimit = atCardLimit || atTotalLimit

                  return (
                    <article
                      key={card.id}
                      className={`card-item ${count > 0 ? 'selected' : ''}`}
                    >
                      <img
                        src={card.image}
                        alt={card.name}
                        onDoubleClick={() => setPreviewCard(card)}
                      />
                      <button
                        type="button"
                        className="btn ghost card-preview-btn"
                        onClick={() => setPreviewCard(card)}
                      >
                        查看大图
                      </button>
                      <h4>{card.name}</h4>
                      <p className="card-meta">{formatCardMeta(card)}</p>
                      <p>{card.description}</p>

                      <div className="counter-row">
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
                    </article>
                  )
                })}
                {filteredCards.length === 0 ? (
                  <p className="helper card-search-empty">没有匹配的卡牌，请调整筛选条件。</p>
                ) : null}
              </div>
            </div>
          </div>

          <MainDeckConfigPanel
            cards={cards}
            selectedCounters={selectedCounters}
            counterTarget={counterTarget}
            maxCountPerCard={maxCountPerCard}
            atTotalLimit={atTotalLimit}
            onCounterChange={onCounterChange}
          />
        </div>

        <footer className="modal-footer">
          <p className="helper">
            当前进度：{counterTotal}/{counterTarget}
          </p>
          <button type="button" className="btn primary" onClick={handleConfirm}>
            确认保存
          </button>
        </footer>
      </section>

      {previewCard ? (
        <section
          className="card-preview-mask"
          onClick={(event) => {
            event.stopPropagation()
            setPreviewCard(null)
          }}
        >
          <article className="card-preview-modal" onClick={(event) => event.stopPropagation()}>
            <header className="modal-header">
              <h2>{previewCard.name}</h2>
              <button type="button" className="btn ghost" onClick={() => setPreviewCard(null)}>
                关闭
              </button>
            </header>
            <div className="card-preview-image-stage">
              <img
                src={previewCard.image}
                alt={previewCard.name}
                className="card-preview-image"
              />
            </div>
            <p className="helper">{formatCardMeta(previewCard)}</p>
            <p className="helper">卡牌ID：{previewCard.id}</p>
            <p className="helper">{previewCard.description}</p>
          </article>
        </section>
      ) : null}
    </div>
  )
}

export default MainDeckSelectModal
