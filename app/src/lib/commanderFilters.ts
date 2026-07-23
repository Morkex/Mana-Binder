import type { Card } from '../types'
import { buildCommanderProfile, COMMANDER_THEME_OPTIONS } from './commanderProfile'

export interface CommanderFilters {
  colors: string[]
  colorMode: 'identity' | 'exact' | 'any'
  themes: string[]
  creatureTypes: string[]
}

export const defaultCommanderFilters: CommanderFilters = {
  colors: [],
  colorMode: 'identity',
  themes: [],
  creatureTypes: [],
}

export function applyCommanderFilters(commanders: Card[], filters: CommanderFilters): Card[] {
  return commanders.filter((card) => {
    if (filters.colors.length) {
      const identity = card.colorIdentity
      if (filters.colorMode === 'exact') {
        const a = [...identity].sort().join('')
        const b = [...filters.colors].sort().join('')
        if (a !== b) return false
      } else if (filters.colorMode === 'any') {
        if (!filters.colors.some((c) => identity.includes(c))) return false
      } else if (!filters.colors.every((c) => identity.includes(c))) {
        return false
      }
    }

    if (filters.themes.length || filters.creatureTypes.length) {
      const profile = buildCommanderProfile(card)

      if (filters.themes.length && !filters.themes.some((t) => profile.themes.includes(t))) {
        return false
      }

      if (filters.creatureTypes.length) {
        const types = new Set(profile.creatureTypes.map((t) => t.toLowerCase()))
        if (!filters.creatureTypes.some((t) => types.has(t.toLowerCase()))) return false
      }
    }

    return true
  })
}

/** Creature types present among commanders in the collection (for filter chips). */
export function commanderCreatureTypeOptions(commanders: Card[]): string[] {
  const types = new Set<string>()
  for (const card of commanders) {
    for (const type of buildCommanderProfile(card).creatureTypes) {
      types.add(type)
    }
  }
  return [...types].sort((a, b) => a.localeCompare(b, 'en'))
}

export { COMMANDER_THEME_OPTIONS }
