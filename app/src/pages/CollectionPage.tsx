import { useMemo, useState } from 'react'
import { useCollection } from '../context/CollectionContext'
import { CardFace } from '../components/CardFace'
import { CardPreviewModal } from '../components/CardPreviewModal'
import { FilterPanel, applyFilters, defaultFilters, type CollectionFilters } from '../components/FilterPanel'
import { rarityLabel, languageLabel } from '../lib/mtg'
import type { Card } from '../types'

export function CollectionPage() {
  const { cards, loading, error } = useCollection()
  const [filters, setFilters] = useState<CollectionFilters>(defaultFilters)
  const [selected, setSelected] = useState<Card | null>(null)

  const sets = useMemo(() => {
    const map = new Map<string, string>()
    for (const c of cards) map.set(c.setCode, c.setName)
    return [...map.entries()]
      .map(([code, name]) => ({ code, name }))
      .sort((a, b) => a.code.localeCompare(b.code))
  }, [cards])

  const filtered = useMemo(() => applyFilters(cards, filters), [cards, filters])

  if (loading) return <div className="state">Cargando colección…</div>
  if (error) return <div className="state state--error">{error}</div>

  return (
    <div className="collection-layout">
      <FilterPanel filters={filters} onChange={setFilters} sets={sets} resultCount={filtered.length} />
      <section className="collection-grid-wrap">
        <header className="section-head">
          <h1>Tu colección</h1>
          <p>
            {filtered.length} de {cards.length} entradas
          </p>
        </header>
        <div className="card-grid">
          {filtered.map((card) => (
            <CardFace
              key={`${card.id}-${card.foil}-${card.language}-${card.collectorNumber}`}
              card={card}
              onClick={() => setSelected(card)}
            />
          ))}
        </div>
        {!filtered.length && <p className="empty">Ninguna carta coincide con los filtros.</p>}
      </section>

      {selected && (
        <CardPreviewModal
          card={selected}
          onClose={() => setSelected(null)}
          extraMeta={
            <dl className="detail-meta">
              <div>
                <dt>Set</dt>
                <dd>
                  {selected.setName} ({selected.setCode}) #{selected.collectorNumber}
                </dd>
              </div>
              <div>
                <dt>Rareza</dt>
                <dd>{rarityLabel(selected.rarity)}</dd>
              </div>
              <div>
                <dt>Cantidad</dt>
                <dd>
                  {selected.quantity}
                  {selected.foil ? ' · Foil' : ''}
                </dd>
              </div>
              <div>
                <dt>Idioma</dt>
                <dd>{languageLabel(selected.language)}</dd>
              </div>
              <div>
                <dt>Precio compra</dt>
                <dd>
                  {selected.purchasePrice} {selected.currency}
                </dd>
              </div>
              <div>
                <dt>Commander</dt>
                <dd>{selected.commanderLegal ? 'Legal' : 'No legal'}</dd>
              </div>
            </dl>
          }
        />
      )}
    </div>
  )
}
