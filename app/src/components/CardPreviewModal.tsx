import type { ReactNode } from 'react'
import type { Card } from '../types'
import { CardDetailBody } from './CardDetailBody'

export function CardPreviewModal({
  card,
  onClose,
  actions,
  extraMeta,
}: {
  card: Card
  onClose: () => void
  actions?: ReactNode
  extraMeta?: ReactNode
}) {
  return (
    <dialog className="detail-modal" open onClick={onClose}>
      <div className="detail-modal__panel" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="detail-modal__close" onClick={onClose}>
          ×
        </button>
        <div className="detail-modal__body">
          <CardDetailBody card={card}>
            {extraMeta}
            {actions && <div className="detail-modal__actions">{actions}</div>}
          </CardDetailBody>
        </div>
      </div>
    </dialog>
  )
}
