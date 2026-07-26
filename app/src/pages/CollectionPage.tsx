import { useMemo, useState } from 'react'
import { useCollection } from '../context/CollectionContext'
import { CardFace } from '../components/CardFace'
import { CardPreviewModal } from '../components/CardPreviewModal'
import { FilterPanel, applyFilters, defaultFilters, type CollectionFilters } from '../components/FilterPanel'
import { rarityLabel, languageLabel } from '../lib/mtg'
import { filterCardsByQuery } from '../lib/cardQuery'
import {
  buildDeckUsage,
  filterOpportunityCards,
  usageLabel,
  type OpportunityView,
} from '../lib/collectionInsights'
import { buildOwnershipIndex, getOwnership } from '../lib/ownership'
import type { Card } from '../types'

const VIEWS: { id: OpportunityView; label: string }[] = [
  { id: 'all', label: 'Todas' },
  { id: 'unused', label: 'Nunca en mazos' },
  { id: 'single-deck', label: 'Solo 1 mazo' },
  { id: 'multi-deck', label: 'Varios mazos' },
  { id: 'staples', label: 'Staples / utilidad' },
  { id: 'commanders', label: 'Comandantes' },
]

export function CollectionPage() {
  const { cards, savedDecks, loading, error } = useCollection()
  const [filters, setFilters] = useState<CollectionFilters>(defaultFilters)
  const [selected, setSelected] = useState<Card | null>(null)
  const [view, setView] = useState<OpportunityView>('all')
  const [advQuery, setAdvQuery] = useState('')

  const sets = useMemo(() => {
    const map = new Map<string, string>()
    for (const c of cards) map.set(c.setCode, c.setName)
    return [...map.entries()]
      .map(([code, name]) => ({ code, name }))
      .sort((a, b) => a.code.localeCompare(b.code))
  }, [cards])

  const usage = useMemo(() => buildDeckUsage(cards, savedDecks), [cards, savedDecks])
  const deckNames = useMemo(
    () => new Map(savedDecks.map((d) => [d.id, d.name])),
    [savedDecks],
  )
  const ownershipIndex = useMemo(
    () => buildOwnershipIndex(cards, savedDecks),
    [cards, savedDecks],
  )

  const opportunityBase = useMemo(
    () => filterOpportunityCards(cards, savedDecks, view),
    [cards, savedDecks, view],
  )

  const filtered = useMemo(() => {
    let list = applyFilters(opportunityBase, filters)
    const q = advQuery.trim()
    if (q && /t:|role:|mv|cmc|owned|ci[=:<]/i.test(q)) {
      list = filterCardsByQuery(list, q, { ownedIds: new Set(cards.map((c) => c.id)) })
    } else if (q) {
      const lower = q.toLowerCase()
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(lower) ||
          c.typeLine.toLowerCase().includes(lower) ||
          c.oracleText.toLowerCase().includes(lower),
      )
    }
    return list
  }, [opportunityBase, filters, advQuery, cards])

  if (loading) return <div className="state">Cargando colección…</div>
  if (error) {
    return (
      <div className="state state--error">
        <p>{error}</p>
        <p className="muted">
          ¿Primera vez? Genera la colección en la raíz del repo con{' '}
          <code>python actualizar_coleccion.py</code> (CSV ManaBox + imágenes Scryfall) y reinicia
          Vite.
        </p>
      </div>
    )
  }
  if (!cards.length) {
    return (
      <div className="state">
        <h1>Colección vacía</h1>
        <p>
          Coloca tu export de ManaBox y ejecuta <code>python actualizar_coleccion.py</code> para
          crear <code>coleccion_organizada/coleccion_maestra.json</code> e imágenes.
        </p>
      </div>
    )
  }

  return (
    <div className="collection-layout">
      <FilterPanel filters={filters} onChange={setFilters} sets={sets} resultCount={filtered.length} />
      <section className="collection-grid-wrap">
        <header className="section-head">
          <h1>Tu colección</h1>
          <p>
            {filtered.length} de {cards.length} entradas
            {view !== 'all' ? ` · vista “${VIEWS.find((v) => v.id === view)?.label}”` : ''}
          </p>
        </header>

        <div className="opp-views">
          {VIEWS.map((v) => (
            <button
              key={v.id}
              type="button"
              className={`btn btn--sm ${view === v.id ? 'btn--primary' : ''}`}
              onClick={() => setView(v.id)}
            >
              {v.label}
            </button>
          ))}
        </div>

        <input
          type="search"
          className="pool-search collection-adv-search"
          placeholder="Búsqueda: texto o t:ramp mv<=3 ci<=wg owned"
          value={advQuery}
          onChange={(e) => setAdvQuery(e.target.value)}
        />

        <div className="card-grid">
          {filtered.map((card) => (
            <CardFace
              key={`${card.id}-${card.foil}-${card.language}-${card.collectorNumber}`}
              card={card}
              badge={view !== 'all' ? usageLabel(card, usage, deckNames) : undefined}
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
            <>
              <p className="ownership-label">{getOwnership(ownershipIndex, selected).label}</p>
              <p className="muted">{usageLabel(selected, usage, deckNames)}</p>
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
            </>
          }
        />
      )}
    </div>
  )
}
