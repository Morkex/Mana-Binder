import type { DeckAnalysis } from '../lib/deckAnalysis'
import { BRACKET_META } from '../lib/brackets'
import { COLOR_META } from '../lib/mtg'
import {
  analyzeDeckHealth,
  type DeckGoal,
  type DeckHealth,
} from '../lib/deckHealth'

export function DeckAnalyzer({
  analysis,
  targetBracket,
  health,
  goal,
  onGoalChange,
}: {
  analysis: DeckAnalysis
  targetBracket?: number
  health?: DeckHealth
  goal?: DeckGoal
  onGoalChange?: (g: DeckGoal) => void
}) {
  const maxCurve = Math.max(1, ...analysis.curve.map((c) => c.count))
  const pipColors = (['W', 'U', 'B', 'R', 'G'] as const).filter((c) => analysis.colorPips[c] > 0)
  const b = analysis.bracket
  const meta = BRACKET_META[b.bracket]
  const overTarget = targetBracket != null && b.bracket > targetBracket
  const healthView = health ?? analyzeDeckHealth(null, [], goal ?? 'casual')

  return (
    <div className="analyzer">
      <h3>Análisis</h3>

      {onGoalChange && (
        <label className="analyzer__goal">
          Perfil
          <select value={goal ?? 'casual'} onChange={(e) => onGoalChange(e.target.value as DeckGoal)}>
            <option value="casual">Casual</option>
            <option value="power7">Power ~7</option>
            <option value="high">High power</option>
            <option value="tribal">Tribal</option>
            <option value="combo">Combo</option>
            <option value="budget">Budget</option>
          </select>
        </label>
      )}

      <div className={`bracket-badge ${overTarget ? 'is-warn' : ''}`}>
        <div className="bracket-badge__main">
          <span className="bracket-badge__num">B{b.bracket}</span>
          <div>
            <strong>
              {meta.nameEs} · {meta.name}
            </strong>
            <p>
              Estimado ({b.confidence}) · {meta.turns}
              {targetBracket != null && (
                <>
                  {' '}
                  · objetivo B{targetBracket}
                  {overTarget ? ' ⚠ por encima' : ''}
                </>
              )}
            </p>
          </div>
        </div>
        <p className="bracket-badge__gc">
          Game Changers: <strong>{b.gameChangerCount}</strong>
          {b.gameChangers.length > 0 && (
            <span>
              {' '}
              — {b.gameChangers.slice(0, 4).join(', ')}
              {b.gameChangers.length > 4 ? '…' : ''}
            </span>
          )}
        </p>
        {b.reasons.length > 0 && (
          <ul className="bracket-badge__reasons">
            {b.reasons.slice(0, 4).map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        )}
      </div>

      <div className="analyzer__stats">
        <div>
          <strong>{analysis.lands}</strong>
          <span>Lands</span>
        </div>
        <div>
          <strong>{analysis.nonLands}</strong>
          <span>Hechizos</span>
        </div>
        <div>
          <strong>{analysis.avgCmc}</strong>
          <span>CMC medio</span>
        </div>
        <div>
          <strong>{analysis.medianCmc}</strong>
          <span>CMC mediana</span>
        </div>
      </div>

      <p className="analyzer__label">Salud del mazo</p>
      <ul className="analyzer__health">
        {healthView.rows.map((row) => (
          <li key={row.key} className={`is-${row.status}`}>
            <span>
              {row.label}{' '}
              <em>
                ({row.min}–{row.max})
              </em>
            </span>
            <strong>{row.count}</strong>
          </li>
        ))}
      </ul>
      {healthView.gaps.length > 0 && (
        <ul className="analyzer__gaps">
          {healthView.gaps.map((g) => (
            <li key={g}>{g}</li>
          ))}
        </ul>
      )}

      <p className="analyzer__label">Mana curve (non-lands)</p>
      <div className="curve" role="img" aria-label="Curva de maná">
        {analysis.curve.map((bucket) => (
          <div key={bucket.label} className="curve__col">
            <div className="curve__bar-wrap">
              <div
                className="curve__bar"
                style={{ height: `${(bucket.count / maxCurve) * 100}%` }}
                title={`${bucket.count} cartas`}
              />
            </div>
            <span className="curve__count">{bucket.count || ''}</span>
            <span className="curve__cmc">{bucket.label}</span>
          </div>
        ))}
      </div>

      <p className="analyzer__label">Roles (conteo)</p>
      <ul className="analyzer__roles">
        <li>
          <span>Ramp</span>
          <strong>{analysis.roles.ramp}</strong>
        </li>
        <li>
          <span>Robo</span>
          <strong>{analysis.roles.draw}</strong>
        </li>
        <li>
          <span>Tutor</span>
          <strong>{analysis.roles.tutor}</strong>
        </li>
        <li>
          <span>Removal</span>
          <strong>{analysis.roles.removal}</strong>
        </li>
        <li>
          <span>Counters</span>
          <strong>{analysis.roles.counter}</strong>
        </li>
        <li>
          <span>Wipes</span>
          <strong>{analysis.roles.boardWipe}</strong>
        </li>
        <li>
          <span>Protección</span>
          <strong>{analysis.roles.protection}</strong>
        </li>
        <li>
          <span>Recursión</span>
          <strong>{analysis.roles.recursion}</strong>
        </li>
        <li>
          <span>Tokens</span>
          <strong>{analysis.roles.tokens}</strong>
        </li>
        <li>
          <span>Creatures</span>
          <strong>{analysis.roles.creatures}</strong>
        </li>
      </ul>

      <p className="analyzer__label">Por tipo</p>
      <ul className="analyzer__types">
        {analysis.byType.map((t) => (
          <li key={t.type}>
            <span>{t.type}</span>
            <strong>{t.count}</strong>
          </li>
        ))}
      </ul>

      {pipColors.length > 0 && (
        <>
          <p className="analyzer__label">Pips de color (costes)</p>
          <ul className="analyzer__pips">
            {pipColors.map((c) => (
              <li key={c} style={{ borderColor: COLOR_META[c]?.hex }}>
                <span>{COLOR_META[c]?.short ?? c}</span>
                <strong>{analysis.colorPips[c]}</strong>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
