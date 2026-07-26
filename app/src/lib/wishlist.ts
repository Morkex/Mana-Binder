import type { Card } from '../types'
import type { SuggestionRow } from './edhrec'
import { detectCardRoles } from './cardRoles'
import { findSubstitutes } from './cardSubstitutes'
import type { DeckHealth } from './deckHealth'

export interface WishlistItem {
  name: string
  impact: number
  reason: string
  replaces?: string
  card?: Card
}

/**
 * Wishlist corta: huecos del dashboard + missing EDHREC de alta sinergia.
 */
export function buildWishlist(params: {
  health: DeckHealth
  suggestions: SuggestionRow[]
  commander: Card
  pool: Card[]
  deckIds: Set<string>
  limit?: number
}): WishlistItem[] {
  const { health, suggestions, commander, pool, deckIds, limit = 8 } = params
  const items: WishlistItem[] = []

  for (const gap of health.gaps.slice(0, 4)) {
    const roleMatch = gap.match(/de (.+) \(/i)
    const label = roleMatch?.[1] ?? 'mejora'
    const missing = suggestions.filter((s) => !s.inCollection && !s.inDeck).slice(0, 3)
    for (const s of missing) {
      if (items.some((i) => i.name === s.name)) continue
      const subs = findSubstitutes({
        missing: { name: s.name, roles: ['ramp', 'draw', 'removal', 'tutor'] },
        commander,
        pool,
        excludeIds: deckIds,
        limit: 1,
      })
      items.push({
        name: s.name,
        impact: Math.round(s.synergy * 10 + s.inclusion * 5),
        reason: `Hueco: ${label}. Meta EDHREC (syn ${s.synergy.toFixed(2)}).`,
        replaces: subs[0]?.card.name,
        card: s.card,
      })
      if (items.length >= limit) return items.sort((a, b) => b.impact - a.impact)
    }
  }

  for (const s of suggestions.filter((x) => !x.inCollection).slice(0, 10)) {
    if (items.some((i) => i.name === s.name)) continue
    items.push({
      name: s.name,
      impact: Math.round(s.synergy * 12 + s.inclusion * 8),
      reason: `${s.header || 'EDHREC'} · no la tienes`,
      card: s.card,
    })
    if (items.length >= limit) break
  }

  return items.sort((a, b) => b.impact - a.impact).slice(0, limit)
}

export function estimatePurchaseImpact(card: Card, health: DeckHealth): string {
  const roles = detectCardRoles(card)
  const helped = health.rows.filter(
    (r) =>
      r.status === 'low' &&
      (roles.includes(r.key as never) ||
        (r.key === 'interaction' &&
          (roles.includes('removal') || roles.includes('counter') || roles.includes('wipe'))) ||
        (r.key === 'lands' && roles.includes('land'))),
  )
  if (!helped.length) return 'Impacto bajo en los huecos actuales del mazo'
  return `Ayuda con: ${helped.map((h) => h.label).join(', ')}`
}
