import type { BaseCard } from '../types/cards'
import { useEffect, useMemo, useState } from 'react'

type CounterMap = Record<string, number>

interface CardSelectModalProps {
  open: boolean
  title: string
  cards: BaseCard[]
  mode: 'single' | 'counter' | 'multi'
  selectedId?: string | null
  selectedCounters?: CounterMap
  selectedIds?: string[]
  disabledCardIds?: string[]
  disabledIncrementCardIds?: string[]
  helperText?: string
  errorText?: string
  maxMulti?: number
  maxCountPerCard?: number
  counterTarget?: number
  previewRotatable?: boolean
  onClose: () => void
  onSingleChoose?: (cardId: string) => void
  onCounterChange?: (cardId: string, nextCount: number) => void
  onMultiToggle?: (cardId: string) => void
  onConfirm: () => void
}

function CardSelectModal(props: CardSelectModalProps) {
  const {
    open,
    title,
    cards,
    mode,
    selectedId,
    selectedCounters = {},
    selectedIds = [],
    disabledCardIds = [],
    disabledIncrementCardIds = [],
    helperText,
    errorText,
    maxMulti,
    maxCountPerCard,
    counterTarget,
    previewRotatable = false,
    onClose,
    onSingleChoose,
    onCounterChange,
    onMultiToggle,
    onConfirm,
  } = props

  const [previewCard, setPreviewCard] = useState<BaseCard | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const defaultPreviewRotation = previewRotatable ? 270 : 0
  const [previewRotation, setPreviewRotation] = useState(defaultPreviewRotation)

  useEffect(() => {
    if (!open) {
      setSearchQuery('')
    }
  }, [open])

  useEffect(() => {
    if (previewCard) {
      setPreviewRotation(previewRotatable ? 270 : 0)
    }
  }, [previewCard?.id, previewRotatable])

  const filteredCards = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) {
      return cards
    }
    return cards.filter(
      (card) =>
        card.name.toLowerCase().includes(query) ||
        card.id.toLowerCase().includes(query) ||
        card.description.toLowerCase().includes(query),
    )
  }, [cards, searchQuery])

  if (!open) {
    return null
  }

  const counterTotal =
    mode === 'counter'
      ? Object.values(selectedCounters).reduce((sum, count) => sum + count, 0)
      : 0
  const counterRemaining =
    typeof counterTarget === 'number' ? Math.max(counterTarget - counterTotal, 0) : 0
  const atTotalLimit =
    typeof counterTarget === 'number' && counterTotal >= counterTarget
  const isPreviewSideways = previewRotation % 180 !== 0

  return (
    <div className="modal-mask" onClick={onClose}>
      <section className="modal" onClick={(event) => event.stopPropagation()}>
        <header className="modal-header">
          <h2>{title}</h2>
          <button type="button" className="btn ghost" onClick={onClose}>
            关闭
          </button>
        </header>

        {helperText ? <p className="helper">{helperText}</p> : null}
        {mode === 'counter' && typeof counterTarget === 'number' ? (
          <p className="counter-progress">
            已选 <strong>{counterTotal}</strong> / {counterTarget} 张，还可选{' '}
            <strong>{counterRemaining}</strong> 张
          </p>
        ) : null}
        {errorText ? <p className="error-text">{errorText}</p> : null}

        <label className="card-search-field">
          <span className="sr-only">搜索卡牌</span>
          <input
            type="search"
            className="card-search-input"
            placeholder="搜索卡牌名称、ID 或描述…"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
          />
        </label>
        {searchQuery.trim() ? (
          <p className="helper card-search-result">找到 {filteredCards.length} 张卡牌</p>
        ) : null}

        <div className="modal-scroll-content">
          <div className="card-grid">
            {filteredCards.map((card) => {
              const disabled = disabledCardIds.includes(card.id)
              const isSingleSelected = selectedId === card.id
              const count = selectedCounters[card.id] ?? 0
              const isMultiSelected = selectedIds.includes(card.id)
              const atCardLimit =
                typeof maxCountPerCard === 'number' && count >= maxCountPerCard
              const atIncrementLimit =
                disabledIncrementCardIds.includes(card.id) || atCardLimit || atTotalLimit

              return (
                <article
                  key={card.id}
                  className={`card-item ${disabled ? 'disabled' : ''} ${
                    isSingleSelected || isMultiSelected || count > 0 ? 'selected' : ''
                  }`}
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
                    onDoubleClick={() => setPreviewCard(card)}
                  >
                    查看大图
                  </button>
                  <h4>{card.name}</h4>
                  <p>{card.description}</p>

                  {mode === 'single' ? (
                    <button
                      type="button"
                      className="btn"
                      disabled={disabled}
                      onClick={() => onSingleChoose?.(card.id)}
                    >
                      {isSingleSelected ? '已选择' : '选择'}
                    </button>
                  ) : null}

                  {mode === 'counter' ? (
                    <div className="counter-row">
                      <button
                        type="button"
                        className="btn ghost"
                        disabled={disabled || count <= 0}
                        onClick={() => onCounterChange?.(card.id, count - 1)}
                      >
                        -
                      </button>
                      <span>{count}</span>
                      <button
                        type="button"
                        className="btn ghost"
                        disabled={disabled || atIncrementLimit}
                        onClick={() => onCounterChange?.(card.id, count + 1)}
                      >
                        +
                      </button>
                    </div>
                  ) : null}

                  {mode === 'multi' ? (
                    <button
                      type="button"
                      className="btn"
                      disabled={disabled}
                      onClick={() => onMultiToggle?.(card.id)}
                    >
                      {isMultiSelected ? '取消' : '加入'}
                    </button>
                  ) : null}
                </article>
              )
            })}
            {filteredCards.length === 0 ? (
              <p className="helper card-search-empty">没有匹配的卡牌，请换个关键词。</p>
            ) : null}
          </div>
        </div>

        <footer className="modal-footer">
          {typeof maxMulti === 'number' ? (
            <p className="helper">
              已选 {selectedIds.length}/{maxMulti}
            </p>
          ) : null}
          {mode === 'counter' && typeof counterTarget === 'number' ? (
            <p className="helper">
              当前进度：{counterTotal}/{counterTarget}
            </p>
          ) : null}
          <button type="button" className="btn primary" onClick={onConfirm}>
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
          <article
            className={`card-preview-modal ${isPreviewSideways ? 'preview-rotated-sideways' : ''}`}
            onClick={(event) => event.stopPropagation()}
          >
            <header className="modal-header">
              <h2>{previewCard.name}</h2>
              <div className="card-preview-actions">
                {previewRotatable ? (
                  <button
                    type="button"
                    className="btn ghost"
                    onClick={() => setPreviewRotation((deg) => (deg + 90) % 360)}
                  >
                    旋转 90°
                  </button>
                ) : null}
                <button type="button" className="btn ghost" onClick={() => setPreviewCard(null)}>
                  关闭
                </button>
              </div>
            </header>
            <div
              className={`card-preview-image-stage ${isPreviewSideways ? 'preview-rotated-sideways' : ''}`}
            >
              <img
                src={previewCard.image}
                alt={previewCard.name}
                className={`card-preview-image ${isPreviewSideways ? 'preview-rotated-sideways' : ''}`}
                style={{ transform: `rotate(${previewRotation}deg)` }}
              />
            </div>
            <p className="helper">卡牌ID：{previewCard.id}</p>
            <p className="helper">{previewCard.description}</p>
          </article>
        </section>
      ) : null}
    </div>
  )
}

export default CardSelectModal
