import { useEffect, useMemo, useRef, useState } from 'react'
import type { Card } from '../types'
import { useCollection } from '../context/CollectionContext'
import { CardFace, ColorPips } from '../components/CardFace'
import { CardPreviewModal } from '../components/CardPreviewModal'
import { CommanderFilterPanel } from '../components/CommanderFilterPanel'
import { DeckAnalyzer } from '../components/DeckAnalyzer'
import { DeckViewer } from '../components/DeckViewer'
import { groupCardsByColorThenType } from '../lib/grouping'
import { autoBuildDeck } from '../lib/autoDeck'
import { agentBuildDeck } from '../lib/agentDeck'
import { analyzeDeck } from '../lib/deckAnalysis'
import { BRACKET_META, type Bracket } from '../lib/brackets'
import {
  applyCommanderFilters,
  commanderCreatureTypeOptions,
  defaultCommanderFilters,
  type CommanderFilters,
} from '../lib/commanderFilters'
import { buildCommanderProfile } from '../lib/commanderProfile'
import { isOllamaAvailable } from '../lib/ollamaClient'
import {
  copyText,
  downloadTextFile,
  safeFilename,
  toMoxfieldList,
} from '../lib/exportDeck'
import {
  fitsColorIdentity,
  identityString,
  isPotentialCommander,
  uniqueByName,
  COLOR_META,
} from '../lib/mtg'
import {
  countByName,
  isBasicLand,
  isBasicLandName,
  makeBasicLandCopies,
  withUnlimitedBasics,
} from '../lib/basicLands'

type Step = 'commander' | 'build'
type PreviewMode = 'commander-pick' | 'pool' | 'maybe' | 'deck' | 'commander-view'

export function DeckBuilderPage() {
  const { cards, savedDecks, saveDeck, deleteDeck, loading, error } = useCollection()
  const [step, setStep] = useState<Step>('commander')
  const [commander, setCommander] = useState<Card | null>(null)
  const [deckCards, setDeckCards] = useState<Card[]>([])
  const [maybeCards, setMaybeCards] = useState<Card[]>([])
  const [query, setQuery] = useState('')
  const [deckName, setDeckName] = useState('')
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [cmdQuery, setCmdQuery] = useState('')
  const [cmdFilters, setCmdFilters] = useState<CommanderFilters>(defaultCommanderFilters)
  const [showAiTools, setShowAiTools] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [targetBracket, setTargetBracket] = useState<Bracket>(3)
  const [showViewer, setShowViewer] = useState(false)
  const [playstyle, setPlaystyle] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiStrategy, setAiStrategy] = useState<string | null>(null)
  const [deckNotes, setDeckNotes] = useState('')
  const [ollamaOk, setOllamaOk] = useState<boolean | null>(null)
  const [preview, setPreview] = useState<{ card: Card; mode: PreviewMode } | null>(null)
  const clickTimer = useRef<number | null>(null)

  useEffect(() => {
    let cancelled = false
    isOllamaAvailable().then((ok) => {
      if (!cancelled) setOllamaOk(ok)
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    return () => {
      if (clickTimer.current) window.clearTimeout(clickTimer.current)
    }
  }, [])

  const allCommanders = useMemo(
    () => uniqueByName(cards.filter(isPotentialCommander)).sort((a, b) => a.name.localeCompare(b.name, 'en')),
    [cards],
  )

  const commanderTypeOptions = useMemo(
    () => commanderCreatureTypeOptions(allCommanders),
    [allCommanders],
  )

  const commanders = useMemo(() => {
    let list = applyCommanderFilters(allCommanders, cmdFilters)
    const q = cmdQuery.trim().toLowerCase()
    if (q) {
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.typeLine.toLowerCase().includes(q) ||
          c.oracleText.toLowerCase().includes(q),
      )
    }
    return list
  }, [allCommanders, cmdFilters, cmdQuery])

  const legalPool = useMemo(() => {
    if (!commander) return []
    return uniqueByName(
      withUnlimitedBasics(
        cards.filter(
          (c) =>
            c.commanderLegal &&
            fitsColorIdentity(c, commander.colorIdentity) &&
            c.name.toLowerCase() !== commander.name.toLowerCase(),
        ),
        commander.colorIdentity,
      ),
    )
  }, [cards, commander])

  const filteredPool = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return legalPool
    return legalPool.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.typeLine.toLowerCase().includes(q) ||
        c.oracleText.toLowerCase().includes(q),
    )
  }, [legalPool, query])

  const sections = useMemo(
    () => groupCardsByColorThenType(filteredPool, commander?.colorIdentity ?? []),
    [filteredPool, commander],
  )

  const inDeck = useMemo(() => new Set(deckCards.map((c) => c.name.toLowerCase())), [deckCards])
  const deckCounts = useMemo(() => countByName(deckCards), [deckCards])
  const inMaybe = useMemo(() => new Set(maybeCards.map((c) => c.name.toLowerCase())), [maybeCards])
  const analysis = useMemo(() => analyzeDeck(commander, deckCards), [commander, deckCards])
  const canExport = Boolean(commander && deckCards.length > 0)
  const cmdProfile = useMemo(
    () => (commander ? buildCommanderProfile(commander) : null),
    [commander],
  )

  const showToast = (msg: string) => {
    setToast(msg)
    window.setTimeout(() => setToast(null), 2800)
  }

  const schedulePreview = (card: Card, mode: PreviewMode) => {
    if (clickTimer.current) window.clearTimeout(clickTimer.current)
    clickTimer.current = window.setTimeout(() => {
      setPreview({ card, mode })
      clickTimer.current = null
    }, 220)
  }

  const cancelScheduledPreview = () => {
    if (clickTimer.current) {
      window.clearTimeout(clickTimer.current)
      clickTimer.current = null
    }
  }

  const selectCommander = (card: Card) => {
    cancelScheduledPreview()
    setCommander(card)
    setDeckCards([])
    setMaybeCards([])
    setDeckName(`Mazo ${card.name}`)
    setAiStrategy(null)
    setDeckNotes('')
    setPreview(null)
    setStep('build')
    setQuery('')
  }

  const addCard = (card: Card, opts?: { fromMaybe?: boolean }) => {
    cancelScheduledPreview()
    const key = card.name.toLowerCase()
    const basic = isBasicLand(card) || isBasicLandName(card.name)

    if (!basic && inDeck.has(key)) {
      showToast('Ya está en el mazo (singleton)')
      return
    }
    if (deckCards.length >= 99) {
      showToast('El mazo ya tiene 99 cartas (+ comandante)')
      return
    }

    if (basic) {
      const copy = makeBasicLandCopies(commander?.colorIdentity ?? card.colorIdentity, 1, cards)[0]
      const toAdd =
        copy && copy.name === card.name
          ? { ...copy, id: `${card.id}-${deckCards.length + 1}` }
          : { ...card, id: `${card.id}-${deckCards.length + 1}`, quantity: 9999 }
      setDeckCards((prev) => [...prev, toAdd])
    } else {
      setDeckCards((prev) => [...prev, card])
    }

    if (opts?.fromMaybe || inMaybe.has(key)) {
      setMaybeCards((prev) => prev.filter((c) => c.name.toLowerCase() !== key))
    }
    showToast(basic ? `+1 ${card.name}` : `Añadida: ${card.name}`)
  }

  const addToMaybe = (card: Card) => {
    cancelScheduledPreview()
    const key = card.name.toLowerCase()
    if (!isBasicLand(card) && inDeck.has(key)) {
      showToast('Ya está en el mazo principal')
      return
    }
    if (inMaybe.has(key)) {
      showToast('Ya está en Consideraciones')
      return
    }
    setMaybeCards((prev) => [...prev, card])
    showToast(`Consideraciones: ${card.name}`)
  }

  const removeFromMaybe = (name: string) => {
    setMaybeCards((prev) => prev.filter((c) => c.name !== name))
  }

  const promoteFromMaybe = (card: Card) => {
    addCard(card, { fromMaybe: true })
  }

  const removeCard = (name: string) => {
    // Quita una copia (útil para básicas); si no hay nombre exacto, no hace nada
    setDeckCards((prev) => {
      const idx = prev.findIndex((c) => c.name === name)
      if (idx < 0) return prev
      return [...prev.slice(0, idx), ...prev.slice(idx + 1)]
    })
  }

  const removeAllCopies = (name: string) => {
    setDeckCards((prev) => prev.filter((c) => c.name !== name))
  }

  const runAuto = () => {
    if (!commander) return
    setAiStrategy(null)
    const built = autoBuildDeck(commander, cards, targetBracket)
    setDeckCards(built)
    const est = analyzeDeck(commander, built).bracket
    showToast(
      `Mazo B${targetBracket} · estimado B${est.bracket} (${est.gameChangerCount} GC) · ${built.length + 1} cartas`,
    )
  }

  const runAi = async () => {
    if (!commander || aiLoading) return
    setAiLoading(true)
    showToast('Ollama pensando estrategia + núcleo del mazo…')
    try {
      const available = await isOllamaAvailable()
      setOllamaOk(available)
      if (!available) {
        showToast('Ollama no está en marcha. Ábrelo o ejecuta ollama serve.')
        return
      }
      const result = await agentBuildDeck(commander, cards, targetBracket, {
        playstyle,
      })
      setDeckCards(result.deck)
      setAiStrategy(result.strategy)
      setDeckNotes(result.strategy)
      const est = analyzeDeck(commander, result.deck).bracket
      const tag =
        result.source === 'agent' ? 'IA' : result.source === 'hybrid' ? 'IA+heurística' : 'fallback'
      showToast(
        `${tag} · núcleo ${result.pickedByAgent} cartas · B${est.bracket} · ${result.deck.length + 1} total`,
      )
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Error al generar con IA')
    } finally {
      setAiLoading(false)
    }
  }

  const handleSave = () => {
    if (!commander) return
    saveDeck({
      name: deckName || `Mazo ${commander.name}`,
      commanderId: commander.id,
      cardIds: deckCards.map((c) => c.id),
      notes: deckNotes,
    })
    showToast('Guardado en el navegador (local)')
  }

  const handleCopyMoxfield = async () => {
    if (!commander || !deckCards.length) {
      showToast('Añade cartas al mazo antes de exportar')
      return
    }
    const ok = await copyText(toMoxfieldList(commander, deckCards))
    showToast(ok ? 'Lista copiada — pégala en Moxfield' : 'No se pudo copiar')
  }

  const handleDownloadTxt = () => {
    if (!commander || !deckCards.length) {
      showToast('Añade cartas al mazo antes de exportar')
      return
    }
    downloadTextFile(safeFilename(deckName || commander.name), toMoxfieldList(commander, deckCards))
    showToast('Archivo .txt descargado')
  }

  const exportSaved = async (id: string, mode: 'copy' | 'download') => {
    const saved = savedDecks.find((d) => d.id === id)
    if (!saved) return
    const cmd = cards.find((c) => c.id === saved.commanderId)
    if (!cmd) {
      showToast('No se encontró el comandante')
      return
    }
    const list = saved.cardIds
      .map((cid) => cards.find((c) => c.id === cid))
      .filter((c): c is Card => Boolean(c))
    const text = toMoxfieldList(cmd, uniqueByName(list))
    if (mode === 'copy') {
      showToast((await copyText(text)) ? `Copiado: ${saved.name}` : 'No se pudo copiar')
    } else {
      downloadTextFile(safeFilename(saved.name), text)
      showToast(`Descargado: ${saved.name}.txt`)
    }
  }

  const loadSaved = (id: string) => {
    const saved = savedDecks.find((d) => d.id === id)
    if (!saved) return
    const cmd = cards.find((c) => c.id === saved.commanderId)
    if (!cmd) {
      showToast('No se encontró el comandante en la colección')
      return
    }
    const loaded = saved.cardIds
      .map((cid) => cards.find((c) => c.id === cid))
      .filter((c): c is Card => Boolean(c))
    setCommander(cmd)
    setDeckCards(loaded)
    setMaybeCards([])
    setDeckName(saved.name)
    setDeckNotes(saved.notes ?? '')
    setAiStrategy(saved.notes ?? null)
    setStep('build')
    showToast(`Cargado: ${saved.name}`)
  }

  const toggle = (key: string) => {
    setCollapsed((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  if (loading) return <div className="state">Cargando colección…</div>
  if (error) return <div className="state state--error">{error}</div>

  if (step === 'commander') {
    return (
      <div className="deck-page deck-page--pick">
        <CommanderFilterPanel
          filters={cmdFilters}
          onChange={setCmdFilters}
          creatureTypes={commanderTypeOptions}
          resultCount={commanders.length}
          totalCount={allCommanders.length}
        />

        <div className="deck-page__main">
          <header className="section-head">
            <h1>Elige tu comandante</h1>
            <p>
              Clic para ampliar · Doble clic para elegir · Legendary creatures (y cartas que pueden ser
              commander) de tu colección.
            </p>
          </header>

          {savedDecks.length > 0 && (
            <section className="saved-decks">
              <h2>Mazos guardados</h2>
              <p className="saved-decks__hint">
                “Guardar” solo queda en este PC/navegador. Usa Copiar o .txt para Moxfield.
              </p>
              <ul>
                {savedDecks.map((d) => {
                  const cmd = cards.find((c) => c.id === d.commanderId)
                  return (
                    <li key={d.id}>
                      <button type="button" className="saved-deck" onClick={() => loadSaved(d.id)}>
                        <strong>{d.name}</strong>
                        <span>
                          {cmd?.name ?? 'Comandante desconocido'} · {d.cardIds.length + 1} cartas
                        </span>
                      </button>
                      <button type="button" className="btn btn--sm" onClick={() => exportSaved(d.id, 'copy')}>
                        Copiar
                      </button>
                      <button type="button" className="btn btn--sm" onClick={() => exportSaved(d.id, 'download')}>
                        .txt
                      </button>
                      <button type="button" className="btn btn--ghost btn--sm" onClick={() => deleteDeck(d.id)}>
                        Borrar
                      </button>
                    </li>
                  )
                })}
              </ul>
            </section>
          )}

          <div className="toolbar">
            <input
              type="search"
              placeholder="Buscar por nombre, tipo o texto…"
              value={cmdQuery}
              onChange={(e) => setCmdQuery(e.target.value)}
            />
            <span className="muted">{commanders.length} candidatos</span>
          </div>

          {commanders.length > 0 ? (
            <div className="card-grid card-grid--cmd">
              {commanders.map((card) => (
                <CardFace
                  key={card.id}
                  card={card}
                  badge={identityString(card.colorIdentity)}
                  title="Clic: ampliar · Doble clic: elegir comandante"
                  onClick={() => schedulePreview(card, 'commander-pick')}
                  onDoubleClick={() => selectCommander(card)}
                />
              ))}
            </div>
          ) : (
            <p className="empty">Ningún comandante coincide con los filtros o la búsqueda.</p>
          )}
        </div>

        {preview?.mode === 'commander-pick' && (
          <CardPreviewModal
            card={preview.card}
            onClose={() => setPreview(null)}
            actions={
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => selectCommander(preview.card)}
              >
                Usar como comandante
              </button>
            }
          />
        )}
        {toast && <div className="toast">{toast}</div>}
      </div>
    )
  }

  if (!commander) return null

  if (showViewer && deckCards.length > 0) {
    return (
      <DeckViewer
        commander={commander}
        deck={deckCards}
        deckName={deckName}
        targetBracket={targetBracket}
        notes={deckNotes}
        onNotesChange={setDeckNotes}
        onClose={() => setShowViewer(false)}
        onRemove={(name) => {
          removeCard(name)
        }}
      />
    )
  }

  return (
    <div className="deck-build">
      <aside className="deck-side">
        <button type="button" className="btn btn--ghost" onClick={() => setStep('commander')}>
          ← Cambiar comandante
        </button>

        <div className="commander-panel">
          <CardFace
            card={commander}
            dense
            title="Clic para ampliar"
            onClick={() => setPreview({ card: commander, mode: 'commander-view' })}
          />
          <div>
            <p className="label">Identidad</p>
            <ColorPips colors={commander.colorIdentity} size={16} />
            <p className="identity-str">{identityString(commander.colorIdentity) || 'C'}</p>
          </div>
        </div>

        <label className="field">
          <span>Nombre del mazo</span>
          <input value={deckName} onChange={(e) => setDeckName(e.target.value)} />
        </label>

        <div className="bracket-picker">
          <p className="bracket-picker__title">Bracket objetivo</p>
          <div className="bracket-picker__grid">
            {([1, 2, 3, 4, 5] as Bracket[]).map((b) => (
              <button
                key={b}
                type="button"
                className={`bracket-picker__btn ${targetBracket === b ? 'is-on' : ''}`}
                onClick={() => setTargetBracket(b)}
                title={BRACKET_META[b].blurb}
              >
                <strong>B{b}</strong>
                <span>{BRACKET_META[b].nameEs}</span>
              </button>
            ))}
          </div>
          <p className="bracket-picker__hint">
            {BRACKET_META[targetBracket].blurb} · {BRACKET_META[targetBracket].turns}
            {BRACKET_META[targetBracket].maxGameChangers === 0 && ' · 0 Game Changers'}
            {BRACKET_META[targetBracket].maxGameChangers === 3 && ' · máx. 3 Game Changers'}
            {BRACKET_META[targetBracket].maxGameChangers === null && ' · Game Changers libres'}
          </p>
        </div>

        {cmdProfile && (
          <div className="cmd-profile">
            <p className="label">Perfil del comandante</p>
            {cmdProfile.creatureTypes.length > 0 && (
              <p>
                <strong>Tipos:</strong> {cmdProfile.creatureTypes.join(', ')}
              </p>
            )}
            {cmdProfile.keywords.length > 0 && (
              <p>
                <strong>Keywords:</strong> {cmdProfile.keywords.slice(0, 8).join(', ')}
                {cmdProfile.keywords.length > 8 ? '…' : ''}
              </p>
            )}
            {cmdProfile.themes.length > 0 && (
              <p>
                <strong>Temas:</strong> {cmdProfile.themes.join(', ')}
              </p>
            )}
          </div>
        )}

        <div className="deck-stats">
          <div>
            <strong>{analysis.total}</strong>
            <span>/ 100</span>
          </div>
          <div>
            <strong>B{analysis.bracket.bracket}</strong>
            <span>estimado</span>
          </div>
        </div>

        <div className="export-box">
          <p className="export-box__title">Exportar mazo</p>
          <div className="deck-actions">
            <button type="button" className="btn btn--primary" onClick={handleCopyMoxfield} disabled={!canExport}>
              Copiar para Moxfield
            </button>
            <button type="button" className="btn btn--primary" onClick={handleDownloadTxt} disabled={!canExport}>
              Descargar .txt
            </button>
          </div>
          {!canExport && (
            <p className="export-box__hint">Genera o añade cartas al mazo para poder exportar.</p>
          )}
        </div>

        <div className="deck-actions">
          <button type="button" className="btn btn--primary" onClick={runAuto} disabled={aiLoading}>
            Auto-generar mazo (B{targetBracket})
          </button>
        </div>

        <div className="ai-panel">
          <button
            type="button"
            className="ai-panel__toggle"
            onClick={() => setShowAiTools((open) => !open)}
            aria-expanded={showAiTools}
          >
            <span>Asistente IA (experimental)</span>
            <span className="ai-panel__chevron" aria-hidden>
              {showAiTools ? '▾' : '▸'}
            </span>
          </button>
          {!showAiTools && (
            <p className="ai-panel__hint">
              Ollama local · resultados variables. El generador heurístico de arriba suele ser más fiable.
            </p>
          )}
          {showAiTools && (
            <div className="ai-box">
              <p className="ai-box__status">
                {ollamaOk === null
                  ? 'Comprobando Ollama…'
                  : ollamaOk
                    ? 'Ollama listo · qwen2.5:14b'
                    : 'Ollama no detectado en :11434'}
              </p>
              <textarea
                className="ai-box__input"
                rows={2}
                value={playstyle}
                onChange={(e) => setPlaystyle(e.target.value)}
                placeholder="Estilo opcional: más aggro, sin combos, tribal tokens…"
                disabled={aiLoading}
              />
              <button
                type="button"
                className="btn"
                onClick={() => void runAi()}
                disabled={aiLoading}
              >
                {aiLoading ? 'Generando con IA…' : `Generar con IA (B${targetBracket})`}
              </button>
              {aiStrategy && (
                <div className="ai-box__strategy">
                  <strong>Plan de la IA</strong>
                  <p>{aiStrategy}</p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="deck-actions">
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => setShowViewer(true)}
            disabled={!deckCards.length}
          >
            Ver mazo / scores
          </button>
          <button type="button" className="btn" onClick={handleSave} disabled={!deckCards.length}>
            Guardar en app
          </button>
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => {
              setDeckCards([])
              setMaybeCards([])
              setAiStrategy(null)
              setDeckNotes('')
            }}
          >
            Vaciar
          </button>
        </div>

        {deckCards.length > 0 && (
          <DeckAnalyzer analysis={analysis} targetBracket={targetBracket} />
        )}

        <div className="deck-list">
          <h3>Lista ({deckCards.length + 1})</h3>
          <ul>
            <li className="deck-list__cmd">
              <button
                type="button"
                onClick={() => setPreview({ card: commander, mode: 'commander-view' })}
                title="Ampliar comandante"
              >
                ★ {commander.name}
              </button>
            </li>
            {deckCounts.map(({ name, count, card }) => (
              <li key={name}>
                <button
                  type="button"
                  onClick={() => setPreview({ card, mode: 'deck' })}
                  title="Ampliar"
                >
                  {count > 1 ? `${count} ${name}` : name}
                </button>
                <button
                  type="button"
                  className="deck-list__remove"
                  onClick={() => (count > 1 ? removeCard(name) : removeAllCopies(name))}
                  title={count > 1 ? 'Quitar una copia' : 'Quitar del mazo'}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="maybe-list">
          <h3>Consideraciones ({maybeCards.length})</h3>
          <p className="maybe-list__hint">
            Clic derecho en el pool para añadir · Clic aquí para pasar al mazo
          </p>
          {maybeCards.length === 0 ? (
            <p className="maybe-list__empty">Sin cartas en duda</p>
          ) : (
            <ul>
              {maybeCards
                .slice()
                .sort((a, b) => a.name.localeCompare(b.name, 'es'))
                .map((card) => (
                  <li key={card.name}>
                    <button
                      type="button"
                      onClick={() => promoteFromMaybe(card)}
                      title="Pasar al mazo principal"
                    >
                      {card.name}
                    </button>
                    <button
                      type="button"
                      className="deck-list__remove"
                      onClick={() => removeFromMaybe(card.name)}
                      title="Quitar de consideraciones"
                    >
                      ×
                    </button>
                  </li>
                ))}
            </ul>
          )}
        </div>
      </aside>

      <section className="deck-pool">
        <header className="section-head">
          <div>
            <h1>Cartas legales</h1>
            <p>
              {legalPool.length} cartas · <strong>Clic</strong> ampliar · <strong>Doble clic</strong>{' '}
              al mazo · <strong>Clic derecho</strong> a Consideraciones
            </p>
          </div>
          <input
            type="search"
            className="pool-search"
            placeholder="Filtrar pool…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </header>

        <div className="color-sections">
          {sections.map((section) => {
            const colorKey = `color-${section.key}`
            const colorCollapsed = collapsed[colorKey]
            const meta = COLOR_META[section.key]

            return (
              <div key={section.key} className="color-section" style={{ ['--accent' as string]: meta?.hex ?? '#888' }}>
                <button type="button" className="color-section__head" onClick={() => toggle(colorKey)}>
                  <span className="color-section__swatch" />
                  <h2>
                    {section.label}
                    <em>{section.cards.length}</em>
                  </h2>
                  <span>{colorCollapsed ? '+' : '−'}</span>
                </button>

                {!colorCollapsed &&
                  section.types.map((typeGroup) => {
                    const typeKey = `${colorKey}-${typeGroup.type}`
                    const typeCollapsed = collapsed[typeKey]
                    return (
                      <div key={typeGroup.type} className="type-section">
                        <button type="button" className="type-section__head" onClick={() => toggle(typeKey)}>
                          <h3>
                            {typeGroup.type}
                            <em>{typeGroup.cards.length}</em>
                          </h3>
                          <span>{typeCollapsed ? '+' : '−'}</span>
                        </button>

                        {!typeCollapsed &&
                          typeGroup.subtypes.map((sub) => {
                            const subKey = `${typeKey}-${sub.subtype}`
                            const subCollapsed = collapsed[subKey] ?? true
                            return (
                              <div key={sub.subtype} className="subtype-section">
                                <button
                                  type="button"
                                  className="subtype-section__head"
                                  onClick={() => toggle(subKey)}
                                >
                                  <h4>
                                    {sub.subtype}
                                    <em>{sub.cards.length}</em>
                                  </h4>
                                  <span>{subCollapsed ? '+' : '−'}</span>
                                </button>
                                {!subCollapsed && (
                                  <div className="card-grid card-grid--pool">
                                    {sub.cards.map((card) => {
                                      const key = card.name.toLowerCase()
                                      const inMain = inDeck.has(key)
                                      const inSide = inMaybe.has(key)
                                      const basic = isBasicLand(card)
                                      return (
                                        <CardFace
                                          key={card.id}
                                          card={card}
                                          dense
                                          selected={inMain || inSide}
                                          dimmed={inMain && !basic}
                                          badge={
                                            basic
                                              ? '∞ básica'
                                              : inMain
                                                ? 'Mazo'
                                                : inSide
                                                  ? 'Maybe'
                                                  : undefined
                                          }
                                          title={
                                            basic
                                              ? 'Basic land ilimitada · Doble clic / clic derecho añade copias'
                                              : 'Clic: ampliar · Doble clic: mazo · Derecho: consideraciones'
                                          }
                                          onClick={() => schedulePreview(card, 'pool')}
                                          onDoubleClick={() => addCard(card)}
                                          onContextMenu={() => addToMaybe(card)}
                                        />
                                      )
                                    })}
                                  </div>
                                )}
                              </div>
                            )
                          })}
                      </div>
                    )
                  })}
              </div>
            )
          })}
        </div>
      </section>

      {preview && preview.mode !== 'commander-pick' && (
        <CardPreviewModal
          card={preview.card}
          onClose={() => setPreview(null)}
          actions={
            preview.mode === 'pool' ? (
              <>
                <button
                  type="button"
                  className="btn btn--primary"
                  onClick={() => {
                    addCard(preview.card)
                    setPreview(null)
                  }}
                >
                  Añadir al mazo
                </button>
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    addToMaybe(preview.card)
                    setPreview(null)
                  }}
                >
                  A Consideraciones
                </button>
              </>
            ) : preview.mode === 'maybe' ? (
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => {
                  promoteFromMaybe(preview.card)
                  setPreview(null)
                }}
              >
                Pasar al mazo
              </button>
            ) : preview.mode === 'deck' ? (
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => {
                  removeCard(preview.card.name)
                  setPreview(null)
                }}
              >
                Quitar del mazo
              </button>
            ) : null
          }
        />
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
