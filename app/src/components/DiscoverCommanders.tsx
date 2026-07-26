import { useEffect, useState } from 'react'
import type { Card } from '../types'
import {
  edhrecOwnedBoost,
  rankCommanders,
  scoreCommanderSuitability,
  type CommanderSuitability,
} from '../lib/commanderSuitability'
import { fetchEdhrecCommander, loadEdhrecFromSession } from '../lib/edhrec'
import { ColorPips } from './CardFace'

export function DiscoverCommanders({
  cards,
  onSelect,
  onPreview,
}: {
  cards: Card[]
  onSelect: (card: Card) => void
  onPreview: (card: Card) => void
}) {
  const [limit, setLimit] = useState(20)
  const [ranked, setRanked] = useState<CommanderSuitability[]>(() => rankCommanders(cards, 60))
  const [boosting, setBoosting] = useState(false)
  const [boostNote, setBoostNote] = useState<string | null>(null)

  useEffect(() => {
    setRanked(rankCommanders(cards, 60))
    setBoostNote(null)
  }, [cards])

  const visible = ranked.slice(0, limit)

  const refineTop20 = async () => {
    if (boosting || !ranked.length) return
    setBoosting(true)
    setBoostNote('Consultando EDHREC (top 20)…')
    const top = ranked.slice(0, 20)
    const next: CommanderSuitability[] = []
    let ok = 0
    let fail = 0
    for (let i = 0; i < top.length; i++) {
      const row = top[i]
      try {
        const edh =
          loadEdhrecFromSession(row.commander.name) ??
          (await fetchEdhrecCommander(row.commander.name))
        const boost = edhrecOwnedBoost(edh.cards, cards, 40)
        next.push(scoreCommanderSuitability(row.commander, cards, { edhrecBoost: boost }))
        ok += 1
      } catch {
        next.push(row)
        fail += 1
      }
      setBoostNote(`EDHREC ${i + 1}/${top.length}…`)
      await new Promise((r) => setTimeout(r, 120))
    }
    const rest = ranked.slice(20)
    const merged = [...next, ...rest].sort(
      (a, b) => b.score - a.score || b.poolSize - a.poolSize,
    )
    setRanked(merged)
    setBoostNote(`Listo · ${ok} con meta${fail ? ` · ${fail} sin red` : ''}`)
    setBoosting(false)
  }

  if (!ranked.length) {
    return (
      <section className="discover-cmd">
        <h2>Descubrir comandantes</h2>
        <p className="muted">No hay comandantes legales detectados en la colección.</p>
      </section>
    )
  }

  return (
    <section className="discover-cmd">
      <header className="discover-cmd__head">
        <div>
          <h2>Descubrir comandantes</h2>
          <p className="muted">
            Ranking local (pool, sinergia, roles). Opcional: refinar top 20 con overlap EDHREC.
          </p>
        </div>
        <div className="discover-cmd__actions">
          <span className="muted">{ranked.length} candidatos</span>
          <button
            type="button"
            className="btn btn--sm"
            disabled={boosting}
            onClick={() => void refineTop20()}
          >
            {boosting ? 'Refinando…' : 'Refinar top 20 (EDHREC)'}
          </button>
        </div>
      </header>
      {boostNote && <p className="muted discover-cmd__boost">{boostNote}</p>}
      <ol className="discover-cmd__list">
        {visible.map((row) => (
          <DiscoverRow
            key={row.commander.id}
            row={row}
            onSelect={onSelect}
            onPreview={onPreview}
          />
        ))}
      </ol>
      {limit < ranked.length && (
        <button type="button" className="btn" onClick={() => setLimit((n) => n + 20)}>
          Ver más
        </button>
      )}
    </section>
  )
}

function DiscoverRow({
  row,
  onSelect,
  onPreview,
}: {
  row: CommanderSuitability
  onSelect: (card: Card) => void
  onPreview: (card: Card) => void
}) {
  return (
    <li className="discover-cmd__row">
      <button type="button" className="discover-cmd__score" title={row.reasons.join(' · ')}>
        {row.score}%
      </button>
      <div className="discover-cmd__info">
        <button type="button" className="discover-cmd__name" onClick={() => onPreview(row.commander)}>
          {row.commander.name}
        </button>
        <div className="discover-cmd__meta">
          <ColorPips colors={row.commander.colorIdentity} />
          <span>
            {row.poolSize} pool · {row.synergistic} sinergia · core {row.coreOwned}/{row.coreTotal}
            {row.edhrecBoost ? ` · +${row.edhrecBoost} EDH` : ''}
          </span>
        </div>
        <p className="discover-cmd__why">{row.reasons[0]}</p>
      </div>
      <button type="button" className="btn btn--primary btn--sm" onClick={() => onSelect(row.commander)}>
        Elegir
      </button>
    </li>
  )
}
