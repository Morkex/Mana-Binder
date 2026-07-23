import type { Card } from '../types'
import { COLOR_META, getPrimaryType, languageLabel, rarityLabel } from '../lib/mtg'

export interface CollectionFilters {
  query: string
  colors: string[]
  colorMode: 'any' | 'exact' | 'identity'
  rarities: string[]
  types: string[]
  languages: string[]
  foil: 'all' | 'foil' | 'normal'
  commanderLegal: boolean
  setCode: string
}

export const defaultFilters: CollectionFilters = {
  query: '',
  colors: [],
  colorMode: 'identity',
  rarities: [],
  types: [],
  languages: [],
  foil: 'all',
  commanderLegal: false,
  setCode: '',
}

export function applyFilters(cards: Card[], f: CollectionFilters): Card[] {
  const q = f.query.trim().toLowerCase()

  return cards.filter((card) => {
    if (q) {
      const hay = `${card.name} ${card.typeLine} ${card.oracleText} ${card.setName}`.toLowerCase()
      if (!hay.includes(q)) return false
    }

    if (f.rarities.length && !f.rarities.includes(card.rarity)) return false
    if (f.languages.length && !f.languages.includes(card.language)) return false
    if (f.foil === 'foil' && !card.foil) return false
    if (f.foil === 'normal' && card.foil) return false
    if (f.commanderLegal && !card.commanderLegal) return false
    if (f.setCode && card.setCode !== f.setCode) return false

    if (f.types.length) {
      const primary = getPrimaryType(card.typeLine)
      if (!f.types.includes(primary)) return false
    }

    if (f.colors.length) {
      const pool = f.colorMode === 'any' ? card.colors : card.colorIdentity
      if (f.colorMode === 'exact') {
        const a = [...pool].sort().join('')
        const b = [...f.colors].sort().join('')
        if (a !== b) return false
      } else {
        if (!f.colors.every((c) => pool.includes(c))) return false
      }
    }

    return true
  })
}

export function FilterPanel({
  filters,
  onChange,
  sets,
  resultCount,
}: {
  filters: CollectionFilters
  onChange: (next: CollectionFilters) => void
  sets: { code: string; name: string }[]
  resultCount: number
}) {
  const toggle = (key: 'colors' | 'rarities' | 'types' | 'languages', value: string) => {
    const list = filters[key]
    const next = list.includes(value) ? list.filter((x) => x !== value) : [...list, value]
    onChange({ ...filters, [key]: next })
  }

  return (
    <aside className="filters">
      <div className="filters__head">
        <h2>Filtros</h2>
        <span className="filters__count">{resultCount}</span>
      </div>

      <label className="field">
        <span>Buscar</span>
        <input
          type="search"
          placeholder="Nombre, tipo, texto…"
          value={filters.query}
          onChange={(e) => onChange({ ...filters, query: e.target.value })}
        />
      </label>

      <fieldset className="fieldset">
        <legend>Colores</legend>
        <div className="chip-row">
          {(['W', 'U', 'B', 'R', 'G'] as const).map((c) => (
            <button
              key={c}
              type="button"
              className={`chip chip--color ${filters.colors.includes(c) ? 'is-on' : ''}`}
              style={{ ['--chip' as string]: COLOR_META[c].hex }}
              onClick={() => toggle('colors', c)}
            >
              {COLOR_META[c].label}
            </button>
          ))}
        </div>
        <div className="seg">
          {(
            [
              ['identity', 'Identidad'],
              ['any', 'Coste'],
              ['exact', 'Exacto'],
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
        <legend>Tipo</legend>
        <div className="chip-row wrap">
          {['Creature', 'Planeswalker', 'Artifact', 'Enchantment', 'Instant', 'Sorcery', 'Land'].map(
            (t) => (
              <button
                key={t}
                type="button"
                className={`chip ${filters.types.includes(t) ? 'is-on' : ''}`}
                onClick={() => toggle('types', t)}
              >
                {t}
              </button>
            ),
          )}
        </div>
      </fieldset>

      <fieldset className="fieldset">
        <legend>Rareza</legend>
        <div className="chip-row wrap">
          {['common', 'uncommon', 'rare', 'mythic'].map((r) => (
            <button
              key={r}
              type="button"
              className={`chip ${filters.rarities.includes(r) ? 'is-on' : ''}`}
              onClick={() => toggle('rarities', r)}
            >
              {rarityLabel(r)}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="fieldset">
        <legend>Idioma / Foil</legend>
        <div className="chip-row">
          {['es', 'en'].map((l) => (
            <button
              key={l}
              type="button"
              className={`chip ${filters.languages.includes(l) ? 'is-on' : ''}`}
              onClick={() => toggle('languages', l)}
            >
              {languageLabel(l)}
            </button>
          ))}
        </div>
        <div className="seg">
          {(
            [
              ['all', 'Todos'],
              ['foil', 'Foil'],
              ['normal', 'Normal'],
            ] as const
          ).map(([mode, label]) => (
            <button
              key={mode}
              type="button"
              className={filters.foil === mode ? 'is-on' : ''}
              onClick={() => onChange({ ...filters, foil: mode })}
            >
              {label}
            </button>
          ))}
        </div>
      </fieldset>

      <label className="check">
        <input
          type="checkbox"
          checked={filters.commanderLegal}
          onChange={(e) => onChange({ ...filters, commanderLegal: e.target.checked })}
        />
        Solo legales en Commander
      </label>

      <label className="field">
        <span>Expansión</span>
        <select
          value={filters.setCode}
          onChange={(e) => onChange({ ...filters, setCode: e.target.value })}
        >
          <option value="">Todas</option>
          {sets.map((s) => (
            <option key={s.code} value={s.code}>
              {s.code} — {s.name}
            </option>
          ))}
        </select>
      </label>

      <button type="button" className="btn btn--ghost" onClick={() => onChange({ ...defaultFilters })}>
        Limpiar filtros
      </button>
    </aside>
  )
}
