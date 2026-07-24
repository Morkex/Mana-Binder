import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import type { Card } from '../types'
import { useCollection } from '../context/CollectionContext'
import { CardPreviewModal } from '../components/CardPreviewModal'
import { resolveVirtualBasicFromId } from '../lib/basicLands'
import {
  addToken,
  adjustCounter,
  applyStateBasedActions,
  castSpell,
  clearSavedPlayState,
  createPlayState,
  createTokensFromOracle,
  discardHand,
  drawCards,
  effectivePower,
  effectiveToughness,
  formatManaNeed,
  isLandObject,
  loadPlayState,
  moveObject,
  mulligan,
  nextPhase,
  normalizePlayState,
  objectsIn,
  parseManaCost,
  passPriority,
  phaseLabel,
  resolveCombat,
  resolveEntireStack,
  resolveStackObject,
  resolveTopOfStack,
  savePlayState,
  setMana,
  setResource,
  shuffleLibrary,
  startHand,
  tapForMana,
  toggleAttack,
  toggleTap,
  topOfStack,
  type Phase,
  type PlayObject,
  type PlayState,
  type StackItem,
  type ZoneId,
} from '../lib/playtest'

interface NavState {
  commanderId?: string
  cardIds?: string[]
  deckName?: string
}

const PHASES: Phase[] = ['untap', 'upkeep', 'draw', 'main1', 'combat', 'main2', 'end']
const DRAG_MIME = 'application/x-mana-binder-card'

function isCreatureLike(obj: PlayObject): boolean {
  return obj.power != null && obj.toughness != null
}

function stackItemLabel(item: StackItem, objects: PlayObject[]): string {
  if (item.kind === 'spell') {
    return objects.find((o) => o.id === item.objectId)?.name ?? 'Hechizo'
  }
  return `⚡ ${item.sourceName} (${item.trigger})`
}

function PlayZoom({
  obj,
  onClose,
  actions,
}: {
  obj: PlayObject
  onClose: () => void
  actions?: ReactNode
}) {
  if (obj.card) {
    return (
      <CardPreviewModal
        card={obj.card}
        onClose={onClose}
        actions={actions}
        extraMeta={
          obj.counters.length > 0 ? (
            <p className="pt-zoom__counters">
              Contadores: {obj.counters.map((c) => `${c.amount} ${c.label}`).join(' · ')}
            </p>
          ) : null
        }
      />
    )
  }

  const src = obj.image || ''
  return (
    <dialog className="detail-modal" open onClick={onClose}>
      <div className="detail-modal__panel pt-zoom-panel" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="detail-modal__close" onClick={onClose}>
          ×
        </button>
        <div className="detail-modal__body pt-zoom-body">
          {src ? (
            <img src={src} alt={obj.name} className="detail-modal__art pt-zoom-art" />
          ) : (
            <div className="pt-bf-card__token pt-zoom-token">
              <strong>{obj.name}</strong>
              <span>
                {obj.power}/{obj.toughness}
              </span>
            </div>
          )}
          <div className="detail-modal__info">
            <h2>{obj.name}</h2>
            <p className="detail-modal__type">
              {obj.isToken ? 'Token' : 'Carta'}
              {obj.power != null && obj.toughness != null ? ` · ${obj.power}/${obj.toughness}` : ''}
            </p>
            {actions && <div className="detail-modal__actions">{actions}</div>}
          </div>
        </div>
      </div>
    </dialog>
  )
}

function DropZone({
  zone,
  className,
  children,
  onDropCard,
  label,
}: {
  zone: ZoneId
  className?: string
  children: ReactNode
  onDropCard: (id: string, zone: ZoneId) => void
  label?: string
}) {
  const [over, setOver] = useState(false)

  return (
    <div
      className={`${className ?? ''} ${over ? 'is-drop-target' : ''}`}
      data-zone={zone}
      onDragOver={(e) => {
        e.preventDefault()
        e.dataTransfer.dropEffect = 'move'
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setOver(false)
        const id = e.dataTransfer.getData(DRAG_MIME) || e.dataTransfer.getData('text/plain')
        if (id) onDropCard(id, zone)
      }}
    >
      {label && <span className="pt-drop-label">{label}</span>}
      {children}
    </div>
  )
}

function HandCard({
  obj,
  onPlay,
  onZoom,
}: {
  obj: PlayObject
  onPlay: (id: string) => void
  onZoom: (obj: PlayObject) => void
}) {
  const clickTimer = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (clickTimer.current) window.clearTimeout(clickTimer.current)
    }
  }, [])

  return (
    <button
      type="button"
      className="pt-hand-card"
      draggable
      title="Clic: ampliar · Doble clic: jugar · Arrastra al campo"
      onDragStart={(e) => {
        if (clickTimer.current) {
          window.clearTimeout(clickTimer.current)
          clickTimer.current = null
        }
        e.dataTransfer.setData(DRAG_MIME, obj.id)
        e.dataTransfer.setData('text/plain', obj.id)
        e.dataTransfer.effectAllowed = 'move'
      }}
      onClick={() => {
        if (clickTimer.current) window.clearTimeout(clickTimer.current)
        clickTimer.current = window.setTimeout(() => {
          onZoom(obj)
          clickTimer.current = null
        }, 220)
      }}
      onDoubleClick={() => {
        if (clickTimer.current) {
          window.clearTimeout(clickTimer.current)
          clickTimer.current = null
        }
        onPlay(obj.id)
      }}
    >
      {obj.image ? <img src={obj.image} alt={obj.name} draggable={false} /> : <span>{obj.name}</span>}
      <em>{obj.name}</em>
    </button>
  )
}

function BoardCard({
  obj,
  onTap,
  onMana,
  onAttack,
  onCounter,
  onMove,
  onZoom,
}: {
  obj: PlayObject
  onTap: (id: string) => void
  onMana: (id: string) => void
  onAttack: (id: string) => void
  onCounter: (id: string, label: string, d: number) => void
  onMove: (id: string, z: ZoneId) => void
  onZoom: (obj: PlayObject) => void
}) {
  return (
    <article
      className={`pt-bf-card ${obj.tapped ? 'is-tapped' : ''} ${obj.attacking ? 'is-attacking' : ''}`}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData(DRAG_MIME, obj.id)
        e.dataTransfer.setData('text/plain', obj.id)
        e.dataTransfer.effectAllowed = 'move'
      }}
    >
      <button type="button" className="pt-bf-card__art" onClick={() => onZoom(obj)} title="Ampliar">
        {obj.image ? (
          <img src={obj.image} alt={obj.name} draggable={false} />
        ) : (
          <div className="pt-bf-card__token">
            <strong>{obj.name}</strong>
            <span>
              {obj.power}/{obj.toughness}
            </span>
          </div>
        )}
      </button>
      <div className="pt-bf-card__meta">
        <strong>{obj.name}</strong>
        {isCreatureLike(obj) && (
          <span>
            {effectivePower(obj)}/{effectiveToughness(obj)}
            {(obj.damage ?? 0) > 0 ? ` · dmg ${obj.damage}` : ''}
          </span>
        )}
        {obj.counters.length > 0 && (
          <span>{obj.counters.map((c) => `${c.amount} ${c.label}`).join(' · ')}</span>
        )}
      </div>
      <div className="pt-bf-card__actions">
        <button type="button" className="btn btn--sm" onClick={() => onZoom(obj)}>
          Ampliar
        </button>
        <button type="button" className="btn btn--sm" onClick={() => onMana(obj.id)} title="Tap for mana / tap">
          Mana/Tap
        </button>
        <button type="button" className="btn btn--sm" onClick={() => onTap(obj.id)}>
          {obj.tapped ? 'Untap' : 'Tap'}
        </button>
        <button type="button" className="btn btn--sm" onClick={() => onAttack(obj.id)}>
          {obj.attacking ? 'Unattack' : 'Attack'}
        </button>
        <button type="button" className="btn btn--ghost btn--sm" onClick={() => onCounter(obj.id, '+1/+1', 1)}>
          +1/+1
        </button>
        <select
          aria-label={`Mover ${obj.name}`}
          value="battlefield"
          onChange={(e) => onMove(obj.id, e.target.value as ZoneId)}
        >
          <option value="battlefield">Mover…</option>
          <option value="graveyard">Graveyard</option>
          <option value="exile">Exile</option>
          <option value="hand">Hand</option>
          <option value="library">Library</option>
          <option value="command">Command</option>
          <option value="stack">Stack</option>
        </select>
      </div>
    </article>
  )
}

function Pile({
  title,
  zone,
  objects,
  onDropCard,
  onDrawTop,
  hideTop = false,
  onToggleReveal,
  onZoom,
}: {
  title: string
  zone: ZoneId
  objects: PlayObject[]
  onDropCard: (id: string, zone: ZoneId) => void
  onDrawTop?: () => void
  /** When true, show card back instead of top card art. */
  hideTop?: boolean
  onToggleReveal?: () => void
  onZoom?: (obj: PlayObject) => void
}) {
  const top = objects[0]
  const showFace = Boolean(top?.image) && !hideTop

  return (
    <DropZone zone={zone} className="pt-pile" onDropCard={onDropCard} label={`${title} (${objects.length})`}>
      {showFace ? (
        <button
          type="button"
          className="pt-pile__face-btn"
          onClick={() => top && onZoom?.(top)}
          title="Ampliar top"
        >
          <img src={top!.image} alt="" className="pt-pile__art" draggable={false} />
        </button>
      ) : objects.length > 0 ? (
        <div className={`pt-pile__back ${hideTop ? 'is-hidden-top' : ''}`} aria-hidden>
          <span>{hideTop ? 'Top oculto' : top?.name}</span>
        </div>
      ) : (
        <div className="pt-pile__empty">—</div>
      )}
      {zone === 'library' && onToggleReveal && (
        <button type="button" className="btn btn--ghost btn--sm" onClick={onToggleReveal}>
          {hideTop ? 'Revelar top' : 'Ocultar top'}
        </button>
      )}
      {showFace && top && onZoom && (
        <button type="button" className="btn btn--ghost btn--sm" onClick={() => onZoom(top)}>
          Ampliar
        </button>
      )}
      {zone === 'library' && onDrawTop && (
        <button type="button" className="btn btn--sm" onClick={onDrawTop}>
          Robar top
        </button>
      )}
      {top && zone !== 'library' && (
        <button
          type="button"
          className="btn btn--ghost btn--sm"
          draggable
          onDragStart={(e) => {
            e.dataTransfer.setData(DRAG_MIME, top.id)
            e.dataTransfer.setData('text/plain', top.id)
          }}
        >
          Arrastrar top
        </button>
      )}
    </DropZone>
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
      .map((id) => cards.find((c) => c.id === id) ?? resolveVirtualBasicFromId(id, cards))
      .filter((c): c is Card => Boolean(c))
    if (deck.length < 10) return null
    return { commander, deck, name: nav.deckName ?? commander.name, cardIds: nav.cardIds }
  }, [cards, nav.commanderId, nav.cardIds, nav.deckName])

  const [state, setState] = useState<PlayState | null>(null)
  const [tokenName, setTokenName] = useState('Creature')
  const [tokenPT, setTokenPT] = useState('1/1')
  const [mullCount, setMullCount] = useState(0)
  const [libraryTopHidden, setLibraryTopHidden] = useState(true)
  const [zoom, setZoom] = useState<PlayObject | null>(null)

  useEffect(() => {
    if (!state || !setup) return
    const t = window.setTimeout(() => {
      savePlayState(state, {
        commanderId: setup.commander.id,
        deckName: setup.name,
        cardIds: setup.cardIds,
      })
    }, 400)
    return () => window.clearTimeout(t)
  }, [state, setup])

  const onDropCard = useCallback((id: string, zone: ZoneId) => {
    setState((prev) => {
      if (!prev) return prev
      const obj = prev.objects.find((o) => o.id === id)
      if (
        (zone === 'battlefield' || zone === 'stack') &&
        obj &&
        (obj.zone === 'hand' || obj.zone === 'command')
      ) {
        return castSpell(prev, id)
      }
      return moveObject(prev, id, zone)
    })
  }, [])

  const begin = (resume?: PlayState) => {
    if (resume) {
      setState(normalizePlayState(resume))
      return
    }
    if (!setup) return
    setMullCount(0)
    setState(startHand(createPlayState(setup.commander, setup.deck)))
  }

  if (loading) return <div className="state">Cargando…</div>
  if (error) return <div className="state state--error">{error}</div>

  if (!setup) {
    const saved = loadPlayState()
    return (
      <div className="state">
        <p>Abre el constructor, monta un mazo y pulsa <strong>Probar mazo</strong>.</p>
        <div className="deck-actions" style={{ maxWidth: 360, margin: '1rem auto' }}>
          <Link className="btn btn--primary" to="/mazos">
            Ir al constructor
          </Link>
          {saved && (
            <button
              type="button"
              className="btn"
              onClick={() =>
                navigate('/probar', {
                  state: {
                    commanderId: saved.commanderId,
                    cardIds: saved.cardIds,
                    deckName: saved.deckName,
                  },
                })
              }
            >
              Retomar partida guardada
            </button>
          )}
        </div>
      </div>
    )
  }

  if (!state) {
    const saved = loadPlayState()
    const canResume = saved && saved.commanderId === setup.commander.id
    return (
      <div className="playtest-start">
        <header className="section-head">
          <div>
            <h1>Partida solitaria · {setup.name}</h1>
            <p>
              Arrastra cartas de la mano al campo · Doble clic para jugar · Tap lands para maná.
              Motor de reglas completo (stack/triggers) llega más adelante.
            </p>
          </div>
        </header>
        <div className="deck-actions" style={{ maxWidth: 360 }}>
          <button type="button" className="btn btn--primary" onClick={() => begin()}>
            Nueva partida (mano de 7)
          </button>
          {canResume && saved && (
            <button type="button" className="btn" onClick={() => begin(saved.state)}>
              Continuar partida guardada
            </button>
          )}
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
  const spellObjs = objectsIn(state, 'stack')
  const stackItems = state.stack
  const stackTop = topOfStack(state)
  const attackers = bf.filter((o) => o.attacking)
  const [p, t] = tokenPT.split('/').map((x) => x.trim())

  return (
    <div className="playtest playtest--solo">
      <header className="playtest__bar">
        <div>
          <strong>{setup.name}</strong>
          <span>
            Turno {state.turn} · {phaseLabel(state.phase)} · Lib {lib.length} · GY {gy.length}
            {stackItems.length ? ` · Stack ${stackItems.length}` : ''}
          </span>
        </div>
        <div className="playtest__phases">
          {PHASES.map((ph) => (
            <span key={ph} className={state.phase === ph ? 'is-on' : ''}>
              {phaseLabel(ph)}
            </span>
          ))}
        </div>
        <div className="playtest__bar-actions">
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => setState(passPriority(state))}
            title="Con ítems en el stack, resuelve el de arriba (LIFO)"
          >
            Pass / Resolver
          </button>
          <button
            type="button"
            className="btn"
            disabled={!stackItems.length}
            onClick={() => setState(resolveEntireStack(state))}
          >
            Resolver todo
          </button>
          <button
            type="button"
            className="btn"
            disabled={!attackers.length}
            onClick={() => setState(resolveCombat(state, 'noBlocks'))}
            title="Atacantes hacen daño al dummy (sin bloqueo)"
          >
            Combate → dummy
          </button>
          <button
            type="button"
            className="btn"
            disabled={!attackers.length}
            onClick={() => setState(resolveCombat(state, 'blocks'))}
            title="Cada atacante pelea vs un 2/2 dummy"
          >
            Dummy bloquea
          </button>
          <button type="button" className="btn" onClick={() => setState(nextPhase(state))}>
            Siguiente fase
          </button>
          <button type="button" className="btn" onClick={() => setState(drawCards(state, 1))}>
            Robar
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => {
              const nextKeep = Math.max(0, 7 - (mullCount + 1))
              setMullCount((n) => n + 1)
              setState(mulligan(state, nextKeep))
            }}
            disabled={hand.length === 0}
          >
            Mulligan
          </button>
          <button type="button" className="btn" onClick={() => setState(shuffleLibrary(state))}>
            Barajar
          </button>
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => {
              clearSavedPlayState()
              begin()
            }}
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
            ['opponentLife', 'Dummy', state.opponentLife],
            ['poison', 'Veneno', state.poison],
            ['energy', 'Energy', state.energy],
            ['experience', 'XP', state.experience],
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
          <span>Tax</span>
          <strong>{state.commanderTax}</strong>
        </div>
        <div className="playtest__mana">
          <span>Maná (clic + · derecho −) · se gasta al lanzar</span>
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
          <button
            type="button"
            className="btn btn--sm"
            onClick={() => setState(applyStateBasedActions(state))}
            title="0 toughness · legend rule"
          >
            SBA
          </button>
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => setState(discardHand(state))}>
            Descartar mano
          </button>
        </div>
      </div>

      <div className="playtest__solo-grid">
        <DropZone zone="command" className="pt-cmd-rail" onDropCard={onDropCard} label="Command">
          {cmd.map((o) => (
            <button
              key={o.id}
              type="button"
              className="pt-cmd-card"
              draggable
              title="Clic: ampliar · Doble clic / arrastra: lanzar al stack"
              onDragStart={(e) => {
                e.dataTransfer.setData(DRAG_MIME, o.id)
                e.dataTransfer.setData('text/plain', o.id)
              }}
              onClick={() => setZoom(o)}
              onDoubleClick={(e) => {
                e.preventDefault()
                setZoom(null)
                setState(castSpell(state, o.id))
              }}
            >
              {o.image ? <img src={o.image} alt={o.name} draggable={false} /> : o.name}
              <span>Tax {state.commanderTax}</span>
            </button>
          ))}
        </DropZone>

        <div className="pt-board-col">
          <DropZone
            zone="stack"
            className={`pt-stack ${stackItems.length ? 'has-items' : ''}`}
            onDropCard={onDropCard}
            label={`Stack (${stackItems.length}) · hechizos + triggers · Pass = top`}
          >
            <div className="pt-stack__row">
              {stackItems.map((item, i) => {
                const isTop = stackTop?.id === item.id
                if (item.kind === 'spell') {
                  const o = spellObjs.find((x) => x.id === item.objectId)
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className={`pt-stack-card ${isTop ? 'is-top' : ''}`}
                      style={{ zIndex: i + 1 }}
                      draggable={Boolean(o)}
                      title={isTop ? 'Top — Pass lo resuelve' : stackItemLabel(item, state.objects)}
                      onDragStart={(e) => {
                        if (!o) return
                        e.dataTransfer.setData(DRAG_MIME, o.id)
                        e.dataTransfer.setData('text/plain', o.id)
                      }}
                      onClick={() => o && setZoom(o)}
                      onDoubleClick={(e) => {
                        e.preventDefault()
                        if (isTop) setState(resolveTopOfStack(state))
                      }}
                    >
                      {o?.image ? (
                        <img src={o.image} alt={o.name} draggable={false} />
                      ) : (
                        <span>{o?.name ?? 'Hechizo'}</span>
                      )}
                      {isTop && <em>TOP</em>}
                    </button>
                  )
                }
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={`pt-stack-card pt-stack-card--abi ${isTop ? 'is-top' : ''}`}
                    style={{ zIndex: i + 1 }}
                    title={item.text}
                    onDoubleClick={(e) => {
                      e.preventDefault()
                      if (isTop) setState(resolveTopOfStack(state))
                    }}
                  >
                    <span className="pt-stack-abi">
                      <strong>{item.trigger}</strong>
                      {item.sourceName}
                    </span>
                    {isTop && <em>TOP</em>}
                  </button>
                )
              })}
              {!stackItems.length && (
                <p className="pt-stack__hint">Hechizos y triggers · tierras van directo al campo</p>
              )}
            </div>
          </DropZone>

          <DropZone
            zone="battlefield"
            className="pt-battlefield"
            onDropCard={onDropCard}
            label={`Battlefield · suelta aquí (${bf.length}) · clic en carta para ampliar`}
          >
            <div className="pt-battlefield__grid">
              {bf.map((o) => (
                <BoardCard
                  key={o.id}
                  obj={o}
                  onTap={(id) => setState(toggleTap(state, id))}
                  onMana={(id) => setState(tapForMana(state, id))}
                  onAttack={(id) => setState(toggleAttack(state, id))}
                  onCounter={(id, label, d) => setState(adjustCounter(state, id, label, d))}
                  onMove={(id, z) => setState(moveObject(state, id, z))}
                  onZoom={setZoom}
                />
              ))}
              {!bf.length && <p className="pt-battlefield__hint">Arrastra cartas desde la mano</p>}
            </div>
          </DropZone>
        </div>

        <aside className="pt-piles">
          <Pile
            title="Library"
            zone="library"
            objects={lib}
            onDropCard={onDropCard}
            onDrawTop={() => setState(drawCards(state, 1))}
            hideTop={libraryTopHidden}
            onToggleReveal={() => setLibraryTopHidden((h) => !h)}
            onZoom={setZoom}
          />
          <Pile title="Graveyard" zone="graveyard" objects={gy} onDropCard={onDropCard} onZoom={setZoom} />
          <Pile title="Exile" zone="exile" objects={ex} onDropCard={onDropCard} onZoom={setZoom} />
        </aside>
      </div>

      <DropZone
        zone="hand"
        className="pt-hand"
        onDropCard={onDropCard}
        label={`Hand (${hand.length}) · clic ampliar · doble clic lanzar · tierras → campo · resto → stack`}
      >
        <div className="pt-hand__row">
          {hand.map((o) => (
            <HandCard
              key={o.id}
              obj={o}
              onPlay={(id) => setState(castSpell(state, id))}
              onZoom={setZoom}
            />
          ))}
          {!hand.length && <p className="pt-hand__empty">Mano vacía</p>}
        </div>
      </DropZone>

      <aside className="playtest__log">
        <h3>Log</h3>
        <ul>
          {state.log.map((line, i) => (
            <li key={`${i}-${line}`}>{line}</li>
          ))}
        </ul>
      </aside>

      {zoom && (
        <PlayZoom
          obj={zoom}
          onClose={() => setZoom(null)}
          actions={
            zoom.zone === 'hand' || zoom.zone === 'command' ? (
              <>
                <button
                  type="button"
                  className="btn btn--primary"
                  onClick={() => {
                    setState(castSpell(state, zoom.id))
                    setZoom(null)
                  }}
                >
                  {isLandObject(zoom)
                    ? 'Jugar tierra'
                    : `Lanzar ${formatManaNeed(parseManaCost(zoom.card?.manaCost ?? '', zoom.zone === 'command' ? state.commanderTax : 0))}`}
                </button>
                {zoom.card?.oracleText && /create .+\btokens?/i.test(zoom.card.oracleText) && (
                  <button
                    type="button"
                    className="btn"
                    onClick={() => {
                      void createTokensFromOracle(state, zoom.card!.oracleText).then((next) => {
                        setState(next)
                        setZoom(null)
                      })
                    }}
                  >
                    Crear tokens (oracle)
                  </button>
                )}
              </>
            ) : zoom.zone === 'stack' ? (
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => {
                  setState(resolveStackObject(state, zoom.id))
                  setZoom(null)
                }}
              >
                Resolver
              </button>
            ) : zoom.zone === 'battlefield' ? (
              <>
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    setState(tapForMana(state, zoom.id))
                    setZoom(null)
                  }}
                >
                  Mana / Tap
                </button>
                {zoom.card?.oracleText && /create .+\btokens?/i.test(zoom.card.oracleText) && (
                  <button
                    type="button"
                    className="btn"
                    onClick={() => {
                      void createTokensFromOracle(state, zoom.card!.oracleText).then((next) => {
                        setState(next)
                        setZoom(null)
                      })
                    }}
                  >
                    Crear tokens (oracle)
                  </button>
                )}
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={() => {
                    setState(moveObject(state, zoom.id, 'graveyard'))
                    setZoom(null)
                  }}
                >
                  Al cementerio
                </button>
              </>
            ) : null
          }
        />
      )}
    </div>
  )
}
