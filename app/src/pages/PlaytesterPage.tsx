import { useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import type { Card } from '../types'
import { useCollection } from '../context/CollectionContext'
import {
  addToken,
  adjustCounter,
  createPlayState,
  drawCards,
  moveObject,
  nextPhase,
  objectsIn,
  phaseLabel,
  setMana,
  setResource,
  shuffleLibrary,
  startHand,
  toggleTap,
  type PlayObject,
  type PlayState,
  type ZoneId,
} from '../lib/playtest'

interface NavState {
  commanderId?: string
  cardIds?: string[]
  deckName?: string
}

function ZoneColumn({
  title,
  zone,
  objects,
  onMove,
  onTap,
  onCounter,
  compact,
}: {
  title: string
  zone: ZoneId
  objects: PlayObject[]
  onMove: (id: string, z: ZoneId) => void
  onTap?: (id: string) => void
  onCounter?: (id: string, label: string, delta: number) => void
  compact?: boolean
}) {
  const zones: ZoneId[] = ['hand', 'battlefield', 'graveyard', 'exile', 'library', 'command']

  return (
    <section className={`pt-zone ${compact ? 'is-compact' : ''}`}>
      <header className="pt-zone__head">
        <h3>
          {title} <em>{objects.length}</em>
        </h3>
      </header>
      <ul className="pt-zone__list">
        {objects.map((o) => (
          <li key={o.id} className={o.tapped ? 'is-tapped' : ''}>
            <div className="pt-card">
              {o.image && !compact ? (
                <img src={o.image} alt="" className="pt-card__img" draggable={false} />
              ) : null}
              <div className="pt-card__body">
                <strong>
                  {o.name}
                  {o.isToken ? ' (token)' : ''}
                  {o.power != null && o.toughness != null ? ` ${o.power}/${o.toughness}` : ''}
                </strong>
                {o.counters.length > 0 && (
                  <span className="pt-card__counters">
                    {o.counters.map((c) => `${c.amount} ${c.label}`).join(' · ')}
                  </span>
                )}
                <div className="pt-card__actions">
                  {zone === 'battlefield' && onTap && (
                    <button type="button" className="btn btn--sm" onClick={() => onTap(o.id)}>
                      {o.tapped ? 'Untap' : 'Tap'}
                    </button>
                  )}
                  {zone === 'battlefield' && onCounter && (
                    <>
                      <button
                        type="button"
                        className="btn btn--sm"
                        onClick={() => onCounter(o.id, '+1/+1', 1)}
                      >
                        +1/+1
                      </button>
                      <button
                        type="button"
                        className="btn btn--ghost btn--sm"
                        onClick={() => onCounter(o.id, '+1/+1', -1)}
                      >
                        −1
                      </button>
                    </>
                  )}
                  <select
                    aria-label={`Mover ${o.name}`}
                    value={zone}
                    onChange={(e) => onMove(o.id, e.target.value as ZoneId)}
                  >
                    {zones.map((z) => (
                      <option key={z} value={z}>
                        → {z}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </li>
        ))}
        {!objects.length && <li className="pt-zone__empty">Vacío</li>}
      </ul>
    </section>
  )
}

export function PlaytesterPage() {
  const { cards, loading, error } = useCollection()
  const location = useLocation()
  const navigate = useNavigate()
  const nav = (location.state ?? {}) as NavState

  const setup = useMemo(() => {
    if (!nav.commanderId || !nav.cardIds?.length) return null
    const commander = cards.find((c) => c.id === nav.commanderId)
    if (!commander) return null
    const deck = nav.cardIds
      .map((id) => {
        const found = cards.find((c) => c.id === id)
        if (found) return found
        // Virtual basics from deck builder
        const m = id.match(/virtual-basic-([a-z]+)/i)
        if (!m) return undefined
        const names: Record<string, string> = {
          plains: 'Plains',
          island: 'Island',
          swamp: 'Swamp',
          mountain: 'Mountain',
          forest: 'Forest',
          wastes: 'Wastes',
        }
        const name = names[m[1].toLowerCase()]
        if (!name) return undefined
        return {
          ...commander,
          id,
          name,
          typeLine: name === 'Wastes' ? 'Basic Land' : `Basic Land — ${name}`,
          oracleText: '',
          manaCost: '',
          cmc: 0,
          colors: [],
          colorIdentity: [],
          power: null,
          toughness: null,
          loyalty: null,
          keywords: [],
          images: commander.images,
        } as Card
      })
      .filter((c): c is Card => Boolean(c))
    if (deck.length < 10) return null
    return { commander, deck, name: nav.deckName ?? commander.name }
  }, [cards, nav.commanderId, nav.cardIds, nav.deckName])

  const [state, setState] = useState<PlayState | null>(null)
  const [tokenName, setTokenName] = useState('Creature')
  const [tokenPT, setTokenPT] = useState('1/1')

  if (loading) return <div className="state">Cargando…</div>
  if (error) return <div className="state state--error">{error}</div>

  if (!setup) {
    return (
      <div className="state">
        <p>Abre el constructor, monta un mazo y pulsa <strong>Probar mazo</strong>.</p>
        <Link className="btn btn--primary" to="/mazos">
          Ir al constructor
        </Link>
      </div>
    )
  }

  if (!state) {
    return (
      <div className="playtest-start">
        <header className="section-head">
          <div>
            <h1>Probador · {setup.name}</h1>
            <p>
              Goldfish solitario — zonas, maná, vida, tokens y contadores. Sin motor de reglas completo
              (stack/triggers llegan en una versión posterior).
            </p>
          </div>
        </header>
        <div className="deck-actions" style={{ maxWidth: 320 }}>
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => setState(startHand(createPlayState(setup.commander, setup.deck)))}
          >
            Empezar (mano de 7)
          </button>
          <button type="button" className="btn btn--ghost" onClick={() => navigate('/mazos')}>
            Volver al constructor
          </button>
        </div>
      </div>
    )
  }

  const bf = objectsIn(state, 'battlefield')
  const hand = objectsIn(state, 'hand')
  const gy = objectsIn(state, 'graveyard')
  const ex = objectsIn(state, 'exile')
  const lib = objectsIn(state, 'library')
  const cmd = objectsIn(state, 'command')

  const [p, t] = tokenPT.split('/').map((x) => x.trim())

  return (
    <div className="playtest">
      <header className="playtest__bar">
        <div>
          <strong>{setup.name}</strong>
          <span>
            Turno {state.turn} · {phaseLabel(state.phase)}
          </span>
        </div>
        <div className="playtest__bar-actions">
          <button type="button" className="btn btn--primary" onClick={() => setState(nextPhase(state))}>
            Siguiente fase
          </button>
          <button type="button" className="btn" onClick={() => setState(drawCards(state, 1))}>
            Robar
          </button>
          <button type="button" className="btn" onClick={() => setState(shuffleLibrary(state))}>
            Barajar
          </button>
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => setState(startHand(createPlayState(setup.commander, setup.deck)))}
          >
            Reiniciar
          </button>
          <button type="button" className="btn btn--ghost" onClick={() => navigate('/mazos')}>
            Salir
          </button>
        </div>
      </header>

      <div className="playtest__resources">
        {(
          [
            ['life', 'Vida', state.life],
            ['poison', 'Veneno', state.poison],
            ['energy', 'Energy', state.energy],
            ['experience', 'Experience', state.experience],
          ] as const
        ).map(([key, label, value]) => (
          <div key={key} className="playtest__stat">
            <span>{label}</span>
            <strong>{value}</strong>
            <div>
              <button type="button" onClick={() => setState(setResource(state, key, -1))}>
                −
              </button>
              <button type="button" onClick={() => setState(setResource(state, key, 1))}>
                +
              </button>
            </div>
          </div>
        ))}
        <div className="playtest__stat">
          <span>Commander tax</span>
          <strong>{state.commanderTax}</strong>
        </div>
        <div className="playtest__mana">
          <span>Maná</span>
          {(['W', 'U', 'B', 'R', 'G', 'C'] as const).map((c) => (
            <button
              key={c}
              type="button"
              className="playtest__pip"
              onClick={() => setState(setMana(state, c, 1))}
              onContextMenu={(e) => {
                e.preventDefault()
                setState(setMana(state, c, -1))
              }}
              title="Clic +1 · Derecho −1"
            >
              {c} {state.mana[c]}
            </button>
          ))}
        </div>
        <div className="playtest__token">
          <input value={tokenName} onChange={(e) => setTokenName(e.target.value)} placeholder="Token" />
          <input value={tokenPT} onChange={(e) => setTokenPT(e.target.value)} placeholder="1/1" />
          <button
            type="button"
            className="btn btn--sm"
            onClick={() => setState(addToken(state, tokenName, p || '1', t || '1'))}
          >
            + Token
          </button>
        </div>
      </div>

      <div className="playtest__board">
        <ZoneColumn
          title="Command"
          zone="command"
          objects={cmd}
          compact
          onMove={(id, z) => setState(moveObject(state, id, z))}
        />
        <ZoneColumn
          title="Battlefield"
          zone="battlefield"
          objects={bf}
          onMove={(id, z) => setState(moveObject(state, id, z))}
          onTap={(id) => setState(toggleTap(state, id))}
          onCounter={(id, label, d) => setState(adjustCounter(state, id, label, d))}
        />
        <ZoneColumn
          title="Hand"
          zone="hand"
          objects={hand}
          onMove={(id, z) => setState(moveObject(state, id, z))}
        />
        <div className="playtest__side">
          <ZoneColumn
            title="Graveyard"
            zone="graveyard"
            objects={gy}
            compact
            onMove={(id, z) => setState(moveObject(state, id, z))}
          />
          <ZoneColumn
            title="Exile"
            zone="exile"
            objects={ex}
            compact
            onMove={(id, z) => setState(moveObject(state, id, z))}
          />
          <ZoneColumn
            title="Library"
            zone="library"
            objects={lib}
            compact
            onMove={(id, z) => setState(moveObject(state, id, z))}
          />
        </div>
      </div>

      <aside className="playtest__log">
        <h3>Log</h3>
        <ul>
          {state.log.map((line, i) => (
            <li key={`${i}-${line}`}>{line}</li>
          ))}
        </ul>
      </aside>
    </div>
  )
}
