interface DeckSectionCardProps {
  title: string
  subtitle: string
  valueText: string
  statusText: string
  statusType: 'ok' | 'warn'
  disabled?: boolean
  onClick: () => void
}

function DeckSectionCard({
  title,
  subtitle,
  valueText,
  statusText,
  statusType,
  disabled = false,
  onClick,
}: DeckSectionCardProps) {
  return (
    <button
      type="button"
      className={`section-card ${disabled ? 'disabled' : ''}`}
      onClick={onClick}
      disabled={disabled}
    >
      <div className="section-top">
        <h3>{title}</h3>
        <span className={`status ${statusType}`}>{statusText}</span>
      </div>
      <p className="subtitle">{subtitle}</p>
      <p className="value">{valueText}</p>
    </button>
  )
}

export default DeckSectionCard
