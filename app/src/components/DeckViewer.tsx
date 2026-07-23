import { useEffect, useMemo, useState } from 'react'
import type { Card } from '../types'
import type { Bracket } from '../lib/brackets'
import { BRACKET_META } from '../lib/brackets'
import { analyzeDeck } from '../lib/deckAnalysis'
import { scoreDeckCards } from '../lib/autoDeck'
import type { ScoreBreakdown } from '../lib/cardScore'
import { detailImageUrl, imageUrl, getPrimaryType, rarityLabel } from '../lib/mtg'
import { CardDetailBody } from './CardDetailBody'
import { DeckAnalyzer } from './DeckAnalyzer'
import { isGameChanger } from '../lib/gameChangers'

type SortKey = 'score' | 'name' | 'cmc' | 'type' | 'synergy'
type ViewMode = 'grid' | 'list'

export function DeckViewer({
  commander,
  deck,
  deckName,
  targetBracket,
  notes = '',
  onNotesChange,
  onClose,
  onRemove,
}: {
  commander: Card
  deck: Card[]
  deckName: string
  targetBracket: Bracket
  notes?: string
  onNotesChange?: (notes: string) => void
  onClose: () => void
  onRemove?: (name: string) => void
}) {
  const [sort, setSort] = useState<SortKey>('score')
  const [view, setView] = useState<ViewMode>('grid')
  const [filterRole, setFilterRole] = useState<string>('all')
  const [selected, setSelected] = useState<Card | null>(null)
  const [query, setQuery] = useState('')
  const [localNotes, setLocalNotes] = useState(notes)

  useEffect(() => {
    setLocalNotes(notes)
  }, [notes])

  const updateNotes = (value: string) => {
    setLocalNotes(value)
    onNotesChange?.(value)
  }

  const analysis = useMemo(() => analyzeDeck(commander, deck), [commander, deck])
  const scored = useMemo(
    () => scoreDeckCards(commander, deck, targetBracket),
    [commander, deck, targetBracket],
  )

  const filtered = useMemo(() => {
    let rows = scored
    const q = query.trim().toLowerCase()
    if (q) {
      rows = rows.filter(
        (r) =>
          r.card.name.toLowerCase().includes(q) ||
          r.card.typeLine.toLowerCase().includes(q) ||
          r.score.roles.some((role) => role.includes(q)),
      )
    }
    if (filterRole !== 'all') {
      rows = rows.filter((r) => r.score.roles.includes(filterRole) || (filterRole === 'gc' && isGameChanger(r.card.name)))
    }

    const copy = [...rows]
    copy.sort((a, b) => {
      if (a.isCommander !== b.isCommander) return a.isCommander ? -1 : 1
      switch (sort) {
        case 'name':
          return a.card.name.localeCompare(b.card.name, 'es')
        case 'cmc':
          return a.card.cmc - b.card.cmc || a.card.name.localeCompare(b.card.name)
        case 'type':
          return getPrimaryType(a.card.typeLine).localeCompare(getPrimaryType(b.card.typeLine)) ||
            a.card.name.localeCompare(b.card.name)
        case 'synergy':
          return b.score.synergy - a.score.synergy
        case 'score':
        default:
          return b.score.total - a.score.total
      }
    })
    return copy
  }, [scored, sort, filterRole, query])

  const avgScore =
    scored.length === 0
      ? 0
      : Math.round((scored.reduce((s, r) => s + r.score.total, 0) / scored.length) * 10) / 10

  return (
    <div className="deck-viewer">
      <header className="deck-viewer__top">
        <div>
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            ← Volver al constructor
          </button>
          <h1>{deckName || `Mazo ${commander.name}`}</h1>
          <p>
            Comandante: <strong>{commander.name}</strong> · Objetivo B{targetBracket} (
            {BRACKET_META[targetBracket].nameEs}) · Score medio {avgScore}
          </p>
        </div>
        <div className="deck-viewer__cmd-art">
          <img src={detailImageUrl(commander)} alt={commander.name} />
        </div>
      </header>

      <div className="deck-viewer__layout">
        <aside className="deck-viewer__side">
          <div className="deck-notes">
            <div className="deck-notes__head">
              <h3>Comentarios del mazo</h3>
              <span>IA o notas propias</span>
            </div>
            <textarea
              className="deck-notes__input"
              rows={8}
              value={localNotes}
              onChange={(e) => updateNotes(e.target.value)}
              placeholder="Aquí aparecerá la estrategia de la IA. También puedes escribir tus propias notas…"
            />
          </div>
          <DeckAnalyzer analysis={analysis} targetBracket={targetBracket} />
          <div className="score-legend">
            <h3>Cómo se puntúa</h3>
            <ul>
              <li>
                <strong>Sinergia</strong> — tipos, keywords útiles y temas del comandante
              </li>
              <li>
                <strong>Utilidad</strong> — ramp, robo, removal, wipes (detección estricta)
              </li>
              <li>
                <strong>Curva</strong> — favorece CMC bajo según bracket
              </li>
              <li>
                <strong>Rareza</strong> — peso bajo (ya no usa foil ni precio)
              </li>
              <li>
                <strong>Game Changer</strong> — bonus/penalización según bracket
              </li>
            </ul>
          </div>
        </aside>

        <section className="deck-viewer__main">
          <div className="deck-viewer__toolbar">
            <input
              type="search"
              placeholder="Buscar en el mazo…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
              <option value="score">Orden: score</option>
              <option value="synergy">Orden: sinergia</option>
              <option value="cmc">Orden: CMC</option>
              <option value="type">Orden: tipo</option>
              <option value="name">Orden: nombre</option>
            </select>
            <select value={filterRole} onChange={(e) => setFilterRole(e.target.value)}>
              <option value="all">Todos los roles</option>
              <option value="ramp">Ramp</option>
              <option value="draw">Robo</option>
              <option value="removal">Removal</option>
              <option value="wipe">Wipes</option>
              <option value="creature">Creatures</option>
              <option value="planeswalker">Planeswalkers</option>
              <option value="land">Lands</option>
              <option value="artifact">Artifacts</option>
              <option value="enchantment">Enchantments</option>
              <option value="gc">Game Changers</option>
            </select>
            <div className="seg">
              <button type="button" className={view === 'grid' ? 'is-on' : ''} onClick={() => setView('grid')}>
                Grid
              </button>
              <button type="button" className={view === 'list' ? 'is-on' : ''} onClick={() => setView('list')}>
                Lista
              </button>
            </div>
          </div>

          {view === 'grid' ? (
            <div className="deck-viewer__grid">
              {filtered.map((row) => (
                <button
                  key={`${row.card.id}-${row.isCommander}`}
                  type="button"
                  className={`viewer-card ${row.isCommander ? 'is-cmd' : ''}`}
                  onClick={() => setSelected(row.card)}
                >
                  <img src={imageUrl(row.card)} alt={row.card.name} loading="lazy" />
                  <div className="viewer-card__meta">
                    <strong>{row.isCommander ? `★ ${row.card.name}` : row.card.name}</strong>
                    <span className="viewer-card__score">{row.score.total}</span>
                  </div>
                  <div className="viewer-card__tags">
                    {row.score.roles.slice(0, 3).map((r) => (
                      <em key={r}>{r}</em>
                    ))}
                    {isGameChanger(row.card.name) && <em className="is-gc">GC</em>}
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="deck-viewer__table-wrap">
              <table className="deck-viewer__table">
                <thead>
                  <tr>
                    <th></th>
                    <th>Carta</th>
                    <th>CMC</th>
                    <th>Total</th>
                    <th>Sinergia</th>
                    <th>Utilidad</th>
                    <th>Curva</th>
                    <th>Roles</th>
                    <th>Notas</th>
                    {onRemove && <th></th>}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((row) => (
                    <tr key={`${row.card.id}-${row.isCommander}`} className={row.isCommander ? 'is-cmd' : ''}>
                      <td>
                        <button type="button" className="thumb-btn" onClick={() => setSelected(row.card)}>
                          <img src={imageUrl(row.card)} alt="" />
                        </button>
                      </td>
                      <td>
                        <button type="button" className="linkish" onClick={() => setSelected(row.card)}>
                          {row.isCommander ? `★ ${row.card.name}` : row.card.name}
                        </button>
                        <div className="muted">{getPrimaryType(row.card.typeLine)}</div>
                      </td>
                      <td>{row.card.cmc}</td>
                      <td>
                        <strong>{row.score.total}</strong>
                      </td>
                      <td>{row.score.synergy}</td>
                      <td>{row.score.utility}</td>
                      <td>{row.score.curve}</td>
                      <td>{row.score.roles.join(', ') || '—'}</td>
                      <td className="notes-cell">
                        {row.score.synergyNotes.slice(0, 2).join(' · ') || '—'}
                        {isGameChanger(row.card.name) ? ' · GC' : ''}
                      </td>
                      {onRemove && (
                        <td>
                          {!row.isCommander && (
                            <button
                              type="button"
                              className="btn btn--ghost btn--sm"
                              onClick={() => onRemove(row.card.name)}
                            >
                              Quitar
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {selected && (
        <CardLightbox
          card={selected}
          score={scored.find((r) => r.card.name === selected.name)?.score}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  )
}

function CardLightbox({
  card,
  score,
  onClose,
}: {
  card: Card
  score?: ScoreBreakdown
  onClose: () => void
}) {
  return (
    <dialog className="detail-modal" open onClick={onClose}>
      <div className="detail-modal__panel lightbox-panel" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="detail-modal__close" onClick={onClose}>
          ×
        </button>
        <div className="lightbox-body">
          <CardDetailBody card={card} artClassName="lightbox-art">
            {score && (
              <div className="score-box">
                <h3>
                  Score total <strong>{score.total}</strong>
                </h3>
                <ul>
                  <li>
                    Sinergia: <strong>{score.synergy}</strong>
                  </li>
                  <li>
                    Utilidad: <strong>{score.utility}</strong>
                  </li>
                  <li>
                    Curva: <strong>{score.curve}</strong>
                  </li>
                  <li>
                    Rareza: <strong>{score.rarity}</strong>
                  </li>
                  <li>
                    Game Changer: <strong>{score.gameChanger}</strong>
                  </li>
                </ul>
                {score.roles.length > 0 && <p>Roles: {score.roles.join(', ')}</p>}
                {score.synergyNotes.length > 0 && <p>Notas: {score.synergyNotes.join(' · ')}</p>}
              </div>
            )}
            <dl className="detail-meta">
              <div>
                <dt>Set</dt>
                <dd>
                  {card.setName} ({card.setCode})
                </dd>
              </div>
              <div>
                <dt>Rareza</dt>
                <dd>{rarityLabel(card.rarity)}</dd>
              </div>
              <div>
                <dt>CMC</dt>
                <dd>{card.cmc}</dd>
              </div>
              <div>
                <dt>Foil</dt>
                <dd>{card.foil ? 'Sí' : 'No'}</dd>
              </div>
            </dl>
          </CardDetailBody>
        </div>
      </div>
    </dialog>
  )
}
