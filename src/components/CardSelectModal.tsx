import type { BaseCard } from '../types/cards'

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
    onClose,
    onSingleChoose,
    onCounterChange,
    onMultiToggle,
    onConfirm,
  } = props

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

        <div className="card-grid">
          {cards.map((card) => {
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
                <img src={card.image} alt={card.name} />
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
    </div>
  )
}

export default CardSelectModal
