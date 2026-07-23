import { COLOR_META } from '../lib/mtg'
import {
  COMMANDER_THEME_OPTIONS,
  defaultCommanderFilters,
  type CommanderFilters,
} from '../lib/commanderFilters'

export function CommanderFilterPanel({
  filters,
  onChange,
  creatureTypes,
  resultCount,
  totalCount,
}: {
  filters: CommanderFilters
  onChange: (next: CommanderFilters) => void
  creatureTypes: string[]
  resultCount: number
  totalCount: number
}) {
  const toggle = (key: 'colors' | 'themes' | 'creatureTypes', value: string) => {
    const list = filters[key]
    const next = list.includes(value) ? list.filter((x) => x !== value) : [...list, value]
    onChange({ ...filters, [key]: next })
  }

  const hasActive =
    filters.colors.length > 0 || filters.themes.length > 0 || filters.creatureTypes.length > 0

  return (
    <aside className="filters commander-filters">
      <div className="filters__head">
        <h2>Filtros</h2>
        <span className="filters__count">{resultCount}</span>
      </div>

      <p className="commander-filters__hint">
        {totalCount} comandantes en colección
        {hasActive ? ` · ${resultCount} coinciden` : ''}
      </p>

      <fieldset className="fieldset">
        <legend>Colores (identidad)</legend>
        <div className="chip-row">
          {(['W', 'U', 'B', 'R', 'G'] as const).map((c) => (
            <button
              key={c}
              type="button"
              className={`chip chip--color ${filters.colors.includes(c) ? 'is-on' : ''}`}
              style={{ ['--chip' as string]: COLOR_META[c].hex }}
              onClick={() => toggle('colors', c)}
            >
              {COLOR_META[c].short}
            </button>
          ))}
        </div>
        <div className="seg">
          {(
            [
              ['identity', 'Incluye'],
              ['exact', 'Exacto'],
              ['any', 'Alguno'],
            ] as const
          ).map(([mode, label]) => (
            <button
              key={mode}
              type="button"
              className={filters.colorMode === mode ? 'is-on' : ''}
              onClick={() => onChange({ ...filters, colorMode: mode })}
            >
              {label}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="fieldset">
        <legend>Arquetipos / temas</legend>
        <div className="chip-row wrap">
          {COMMANDER_THEME_OPTIONS.map((theme) => (
            <button
              key={theme.id}
              type="button"
              className={`chip ${filters.themes.includes(theme.id) ? 'is-on' : ''}`}
              onClick={() => toggle('themes', theme.id)}
            >
              {theme.label}
            </button>
          ))}
        </div>
      </fieldset>

      {creatureTypes.length > 0 && (
        <fieldset className="fieldset">
          <legend>Tribal (tipos de criatura)</legend>
          <div className="chip-row wrap">
            {creatureTypes.map((type) => (
              <button
                key={type}
                type="button"
                className={`chip ${filters.creatureTypes.includes(type) ? 'is-on' : ''}`}
                onClick={() => toggle('creatureTypes', type)}
              >
                {type}
              </button>
            ))}
          </div>
        </fieldset>
      )}

      <button
        type="button"
        className="btn btn--ghost"
        onClick={() => onChange({ ...defaultCommanderFilters })}
        disabled={!hasActive}
      >
        Limpiar filtros
      </button>
    </aside>
  )
}
