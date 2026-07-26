import { useState } from 'react'
import type { Card } from '../types'
import type { Bracket } from '../lib/brackets'

type QuickStep = 0 | 1 | 2 | 3 | 4

export function QuickBuildBar({
  commander,
  deckCount,
  targetBracket,
  healthGaps,
  handSimNote,
  wishlistNote,
  onAuto,
  onManabase,
  onWishlist,
  onHands,
  onSave,
  onPlaytest,
  busy,
}: {
  commander: Card | null
  deckCount: number
  targetBracket: Bracket
  healthGaps?: string[]
  handSimNote?: string | null
  wishlistNote?: string | null
  onAuto: () => void
  onManabase: () => void
  onWishlist: () => void
  onHands: () => void
  onSave?: () => void
  onPlaytest?: () => void
  busy?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<QuickStep>(0)

  if (!commander) return null

  const steps = [
    {
      title: '1 · Núcleo owned',
      hint: `Auto-generar B${targetBracket} priorizando tu colección + meta EDHREC.`,
      action: 'Generar núcleo',
      run: onAuto,
      done: deckCount >= 40,
    },
    {
      title: '2 · Manabase',
      hint: 'Ajusta tierras básicas + nonbasics según pips y curva.',
      action: 'Aplicar manabase',
      run: onManabase,
      done: deckCount >= 90,
    },
    {
      title: '3 · Huecos / wishlist',
      hint: 'Lista corta de compras de alto impacto (con precios si hay red).',
      action: 'Ver wishlist',
      run: onWishlist,
      done: Boolean(wishlistNote),
    },
    {
      title: '4 · Validar manos',
      hint: 'Simula 100 manos de apertura (keep / screw / flood).',
      action: 'Simular 100 manos',
      run: onHands,
      done: Boolean(handSimNote),
    },
    {
      title: '5 · Listo',
      hint: 'Revisa salud, guarda snapshot y prueba en goldfish.',
      action: null,
      run: null,
      done: deckCount >= 99,
    },
  ] as const

  const current = steps[step]

  return (
    <>
      <div className="quick-build">
        <div className="quick-build__head">
          <p className="export-box__title">Quick Build</p>
          <button type="button" className="btn btn--primary btn--sm" onClick={() => setOpen(true)}>
            Abrir wizard
          </button>
        </div>
        <p className="muted">Flujo guiado a pantalla completa: núcleo → lands → wishlist → manos.</p>
      </div>

      {open && (
        <div className="quick-build-fs" role="dialog" aria-modal="true" aria-label="Quick Build">
          <div className="quick-build-fs__panel">
            <header className="quick-build-fs__head">
              <div>
                <p className="eyebrow">Quick Build</p>
                <h2>{commander.name}</h2>
                <p className="muted">
                  {deckCount}/99 cartas · B{targetBracket}
                  {healthGaps?.length ? ` · ${healthGaps.length} huecos` : ''}
                </p>
              </div>
              <button type="button" className="btn btn--ghost" onClick={() => setOpen(false)}>
                Cerrar
              </button>
            </header>

            <nav className="quick-build-fs__steps" aria-label="Pasos">
              {steps.map((s, i) => (
                <button
                  key={s.title}
                  type="button"
                  className={`quick-build-fs__step ${i === step ? 'is-on' : ''} ${s.done ? 'is-done' : ''}`}
                  onClick={() => setStep(i as QuickStep)}
                >
                  {s.title}
                </button>
              ))}
            </nav>

            <div className="quick-build-fs__body">
              <h3>{current.title}</h3>
              <p>{current.hint}</p>
              {step === 2 && wishlistNote && <pre className="wishlist-box">{wishlistNote}</pre>}
              {step === 3 && handSimNote && <p className="export-box__hint">{handSimNote}</p>}
              {step === 4 && healthGaps && healthGaps.length > 0 && (
                <ul className="analyzer__gaps">
                  {healthGaps.map((g) => (
                    <li key={g}>{g}</li>
                  ))}
                </ul>
              )}
              <div className="deck-actions">
                {current.action && current.run && (
                  <button
                    type="button"
                    className="btn btn--primary"
                    disabled={busy || (step === 3 && deckCount < 20)}
                    onClick={() => {
                      current.run?.()
                      if (step < 4) setStep((s) => (s + 1) as QuickStep)
                    }}
                  >
                    {current.action}
                  </button>
                )}
                {step === 4 && (
                  <>
                    {onSave && (
                      <button type="button" className="btn btn--primary" onClick={onSave}>
                        Guardar mazo
                      </button>
                    )}
                    {onPlaytest && (
                      <button
                        type="button"
                        className="btn"
                        disabled={deckCount < 20}
                        onClick={onPlaytest}
                      >
                        Probar goldfish
                      </button>
                    )}
                    <button type="button" className="btn" onClick={() => setOpen(false)}>
                      Seguir en constructor
                    </button>
                  </>
                )}
                {step > 0 && (
                  <button
                    type="button"
                    className="btn btn--ghost"
                    onClick={() => setStep((s) => (s - 1) as QuickStep)}
                  >
                    Atrás
                  </button>
                )}
                {step < 4 && (
                  <button
                    type="button"
                    className="btn btn--ghost"
                    onClick={() => setStep((s) => (s + 1) as QuickStep)}
                  >
                    Saltar
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
