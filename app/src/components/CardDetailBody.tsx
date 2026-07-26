import { useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Card } from '../types'
import { getCardFaces, isMultiFaceCard } from '../lib/cardFaces'
import { detectCardRoles, roleShort } from '../lib/cardRoles'
import { ColorPips, ManaCost } from './CardFace'

export function CardDetailBody({
  card,
  artClassName = 'detail-modal__art',
  children,
}: {
  card: Card
  artClassName?: string
  children?: ReactNode
}) {
  const faces = useMemo(() => getCardFaces(card), [card])
  const multi = faces.length > 1
  const [faceIndex, setFaceIndex] = useState(0)
  const active = faces[faceIndex] ?? faces[0]
  const [imgSrc, setImgSrc] = useState(active.imageDetail)
  const roles = useMemo(() => detectCardRoles(card), [card])

  useEffect(() => {
    setFaceIndex(0)
  }, [card.id])

  useEffect(() => {
    setImgSrc(active.imageDetail)
  }, [active.imageDetail])

  const showStats =
    active.power != null ||
    active.toughness != null ||
    active.loyalty != null ||
    /\bcreature\b/i.test(active.typeLine) ||
    /\bplaneswalker\b/i.test(active.typeLine)

  return (
    <>
      <div className="card-detail__art">
        <img
          src={imgSrc}
          alt={active.name}
          className={artClassName}
          onError={() => {
            if (imgSrc !== active.imageDetailFallback && active.imageDetailFallback) {
              setImgSrc(active.imageDetailFallback)
            }
          }}
        />
        {multi && (
          <div className="card-detail__flip">
            <button
              type="button"
              className="btn btn--sm"
              disabled={faceIndex === 0}
              onClick={() => setFaceIndex((i) => Math.max(0, i - 1))}
            >
              ← Anterior
            </button>
            <span className="card-detail__flip-label">
              Cara {faceIndex + 1} / {faces.length}
            </span>
            <button
              type="button"
              className="btn btn--sm"
              disabled={faceIndex >= faces.length - 1}
              onClick={() => setFaceIndex((i) => Math.min(faces.length - 1, i + 1))}
            >
              Siguiente →
            </button>
          </div>
        )}
        {multi && (
          <button
            type="button"
            className="card-detail__flip-main btn btn--ghost btn--sm"
            onClick={() => setFaceIndex((i) => (i + 1) % faces.length)}
          >
            Voltear carta
          </button>
        )}
      </div>

      <div className="detail-modal__info">
        <h2>{active.name}</h2>
        {multi && isMultiFaceCard(card) && (
          <p className="card-detail__faces-hint">Carta de dos caras · usa los botones para ver la otra cara</p>
        )}
        <div className="detail-modal__row">
          <ColorPips colors={card.colorIdentity} />
          <ManaCost cost={active.manaCost} />
        </div>
        <p className="detail-modal__type">{active.typeLine}</p>
        {showStats && (
          <p className="card-detail__stats">
            {active.power != null && active.toughness != null && (
              <span>
                {active.power}/{active.toughness}
              </span>
            )}
            {active.loyalty != null && <span>Loyalty {active.loyalty}</span>}
          </p>
        )}
        {roles.length > 0 && (
          <div className="card-detail__roles" aria-label="Roles de deckbuilding">
            {roles.map((r) => (
              <span key={r} className={`card-role-tag card-role-tag--${r}`}>
                {roleShort(r)}
              </span>
            ))}
          </div>
        )}
        {active.oracleText ? (
          <p className="detail-modal__text">{active.oracleText}</p>
        ) : (
          multi && (
            <p className="detail-modal__text detail-modal__text--muted">
              Sin texto de reglas para esta cara en los datos locales.
            </p>
          )
        )}
        {children}
      </div>
    </>
  )
}
