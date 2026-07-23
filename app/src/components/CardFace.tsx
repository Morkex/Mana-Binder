import type { Card } from '../types'
import { COLOR_META, imageUrl } from '../lib/mtg'
import { isMultiFaceCard } from '../lib/cardFaces'

export function ColorPips({ colors, size = 14 }: { colors: string[]; size?: number }) {
  if (!colors.length) {
    return (
      <span className="pips" title="Colorless">
        <span className="pip" style={{ background: COLOR_META.C.hex, width: size, height: size }} />
      </span>
    )
  }

  return (
    <span className="pips">
      {colors.map((c) => (
        <span
          key={c}
          className="pip"
          title={COLOR_META[c]?.label ?? c}
          style={{
            background: COLOR_META[c]?.hex ?? '#999',
            color: COLOR_META[c]?.ink ?? '#000',
            width: size,
            height: size,
          }}
        />
      ))}
    </span>
  )
}

export function ManaCost({ cost }: { cost: string }) {
  if (!cost) return null
  return <span className="mana-cost">{cost}</span>
}

export function CardFace({
  card,
  selected,
  dimmed,
  badge,
  onClick,
  onDoubleClick,
  onContextMenu,
  onAdd,
  dense,
  title,
}: {
  card: Card
  selected?: boolean
  dimmed?: boolean
  badge?: string
  onClick?: () => void
  onDoubleClick?: () => void
  onContextMenu?: () => void
  onAdd?: () => void
  dense?: boolean
  title?: string
}) {
  const src = imageUrl(card)

  return (
    <article
      className={`card-face ${selected ? 'is-selected' : ''} ${dimmed ? 'is-dimmed' : ''} ${dense ? 'is-dense' : ''}`}
      title={title}
      onClick={onClick}
      onDoubleClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        onDoubleClick?.()
      }}
      onContextMenu={(e) => {
        if (!onContextMenu) return
        e.preventDefault()
        e.stopPropagation()
        onContextMenu()
      }}
      role={onClick || onDoubleClick ? 'button' : undefined}
      tabIndex={onClick || onDoubleClick ? 0 : undefined}
      onKeyDown={(e) => {
        if (onClick && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault()
          onClick()
        }
      }}
    >
      <div className="card-face__img-wrap">
        {src ? (
          <img src={src} alt={card.name} loading="lazy" className="card-face__img" draggable={false} />
        ) : (
          <div className="card-face__placeholder">{card.name}</div>
        )}
        {card.foil && <span className="card-face__foil">Foil</span>}
        {isMultiFaceCard(card) && <span className="card-face__dfc">2F</span>}
        {badge && <span className="card-face__badge">{badge}</span>}
      </div>
      <div className="card-face__meta">
        <h3 className="card-face__name">{card.name}</h3>
        <div className="card-face__row">
          <ColorPips colors={card.colorIdentity} size={10} />
          <span className="card-face__set">{card.setCode}</span>
          {card.quantity > 1 && <span className="card-face__qty">×{card.quantity}</span>}
        </div>
        {!dense && <p className="card-face__type">{card.typeLine}</p>}
      </div>
      {onAdd && (
        <button
          type="button"
          className="card-face__add"
          onClick={(e) => {
            e.stopPropagation()
            onAdd()
          }}
        >
          Añadir
        </button>
      )}
    </article>
  )
}
