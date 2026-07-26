import { useEffect, useMemo, useState } from 'react'
import type { Card } from '../types'
import {
  buildSuggestions,
  fetchEdhrecCommander,
  loadEdhrecFromSession,
  type EdhrecCommanderData,
  type SuggestionRow,
} from '../lib/edhrec'
import { explainCardForCommander, findSubstitutes } from '../lib/cardSubstitutes'

export function CommanderSuggestions({
  commander,
  pool,
  deckCards,
  onAdd,
  onMaybe,
  onPreview,
}: {
  commander: Card
  pool: Card[]
  deckCards: Card[]
  onAdd: (card: Card) => void
  onMaybe: (card: Card) => void
  onPreview: (card: Card) => void
}) {
  const [data, setData] = useState<EdhrecCommanderData | null>(() =>
    loadEdhrecFromSession(commander.name),
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [onlyOwned, setOnlyOwned] = useState(true)
  const [open, setOpen] = useState(true)

  const deckNames = useMemo(
    () => new Set(deckCards.map((c) => c.name.toLowerCase())),
    [deckCards],
  )
  const deckIds = useMemo(() => new Set(deckCards.map((c) => c.id)), [deckCards])

  useEffect(() => {
    let cancelled = false
    const cached = loadEdhrecFromSession(commander.name)
    if (cached) setData(cached)

    setLoading(true)
    setError(null)
    fetchEdhrecCommander(commander.name)
      .then((next) => {
        if (!cancelled) setData(next)
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message || 'No se pudo cargar EDHREC')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [commander.name])

  const suggestions = useMemo(() => {
    if (!data) return [] as SuggestionRow[]
    return buildSuggestions({
      edhrec: data,
      pool,
      deckNames,
      onlyOwned,
      prioritizeOwned: true,
      limit: 36,
    })
  }, [data, pool, deckNames, onlyOwned])

  if (!open) {
    return (
      <button type="button" className="btn btn--ghost" onClick={() => setOpen(true)}>
        Mostrar sugerencias EDHREC
      </button>
    )
  }

  return (
    <div className="edhrec-box">
      <div className="edhrec-box__head">
        <p className="export-box__title">Sugerencias (EDHREC híbrido)</p>
        <button type="button" className="btn btn--ghost btn--sm" onClick={() => setOpen(false)}>
          Ocultar
        </button>
      </div>
      <p className="edhrec-box__hint">
        Orden: owned → missing. Cada carta muestra por qué encaja; si falta, sugiere sustituto owned.
      </p>
      {loading && <p className="ai-box__status">Cargando meta de EDHREC…</p>}
      {error && (
        <p className="state state--error" style={{ padding: '0.4rem' }}>
          {error}
        </p>
      )}
      {data && (
        <>
          <p className="edhrec-box__meta">
            {data.numDecks != null ? `${data.numDecks.toLocaleString('en')} mazos` : 'Meta'}
            {data.themes.length > 0 && (
              <> · Temas: {data.themes.slice(0, 4).map((t) => t.name).join(', ')}</>
            )}
          </p>
          <label className="check">
            <input
              type="checkbox"
              checked={onlyOwned}
              onChange={(e) => setOnlyOwned(e.target.checked)}
            />
            Solo cartas de mi colección
          </label>
          <ul className="edhrec-box__list">
            {suggestions.map((row) => {
              const reasons = row.card ? explainCardForCommander(row.card, commander) : []
              const subs = !row.inCollection
                ? findSubstitutes({
                    missing: {
                      name: row.name,
                      roles: ['ramp', 'draw', 'removal', 'tutor', 'protection'],
                    },
                    commander,
                    pool,
                    excludeIds: deckIds,
                    limit: 1,
                  })
                : []
              return (
                <li key={row.name} className={row.inDeck ? 'is-in-deck' : ''}>
                  <button
                    type="button"
                    className="edhrec-box__name"
                    onClick={() => row.card && onPreview(row.card)}
                    disabled={!row.card}
                    title={row.header}
                  >
                    {row.name}
                  </button>
                  <span className="edhrec-box__stats">
                    syn {(row.synergy * 100).toFixed(0)}% · {(row.inclusion * 100).toFixed(0)}%
                    {row.inCollection ? ' · ✔' : ' · ✘'}
                  </span>
                  {reasons.length > 0 && (
                    <p className="edhrec-box__why">{reasons.join(' · ')}</p>
                  )}
                  {subs[0] && (
                    <p className="edhrec-box__sub">
                      Sustituto: {subs[0].card.name}{' '}
                      <button
                        type="button"
                        className="btn btn--ghost btn--sm"
                        onClick={() => onAdd(subs[0].card)}
                      >
                        +
                      </button>
                    </p>
                  )}
                  {row.card && !row.inDeck && (
                    <span className="edhrec-box__btns">
                      <button type="button" className="btn btn--sm" onClick={() => onAdd(row.card!)}>
                        +
                      </button>
                      <button
                        type="button"
                        className="btn btn--ghost btn--sm"
                        onClick={() => onMaybe(row.card!)}
                      >
                        ?
                      </button>
                    </span>
                  )}
                  {row.inDeck && <span className="edhrec-box__badge">Mazo</span>}
                  {!row.inCollection && (
                    <span className="edhrec-box__badge edhrec-box__badge--miss">No</span>
                  )}
                </li>
              )
            })}
            {!suggestions.length && !loading && (
              <li className="edhrec-box__empty">
                {onlyOwned
                  ? 'Ninguna sugerencia top está en tu colección (prueba desmarcar el filtro).'
                  : 'Sin sugerencias.'}
              </li>
            )}
          </ul>
        </>
      )}
    </div>
  )
}
