import type { Card, SavedDeck } from '../types'
import { isBasicLand } from './basicLands'
import { isPotentialCommander } from './mtg'
import { detectCardRoles } from './cardRoles'

export type OpportunityView =
  | 'all'
  | 'unused'
  | 'single-deck'
  | 'multi-deck'
  | 'staples'
  | 'commanders'

function normName(name: string): string {
  return name.split('//')[0].trim().toLowerCase()
}

/** Nombres de cartas (no básicas) usadas en mazos guardados → set de deck ids. */
export function buildDeckUsage(cards: Card[], savedDecks: SavedDeck[]) {
  const byId = new Map(cards.map((c) => [c.id, c]))
  const decksByName = new Map<string, Set<string>>()

  for (const deck of savedDecks) {
    const seen = new Set<string>()
    for (const id of [...deck.cardIds, deck.commanderId]) {
      const card = byId.get(id)
      if (!card || isBasicLand(card)) continue
      const key = normName(card.name)
      if (seen.has(key)) continue
      seen.add(key)
      const set = decksByName.get(key) ?? new Set()
      set.add(deck.id)
      decksByName.set(key, set)
    }
  }

  return decksByName
}

/** Staples Commander frecuentes (nombres exactos, minúsculas). */
export const COMMANDER_STAPLES = new Set(
  [
    'Sol Ring',
    'Arcane Signet',
    'Command Tower',
    'Exotic Orchard',
    'Path of Ancestry',
    'Reliquary Tower',
    'Cultivate',
    'Kodama\'s Reach',
    'Farseek',
    'Nature\'s Lore',
    'Three Visits',
    'Rampant Growth',
    'Sakura-Tribe Elder',
    'Birds of Paradise',
    'Llanowar Elves',
    'Swords to Plowshares',
    'Path to Exile',
    'Generous Gift',
    'Beast Within',
    'Chaos Warp',
    'Assassin\'s Trophy',
    'Counterspell',
    'Negate',
    'Dovin’s Veto',
    'Fierce Guardianship',
    'Deflecting Swat',
    'Deadly Rollick',
    'Teferi\'s Protection',
    'Heroic Intervention',
    'Cyclonic Rift',
    'Blasphemous Act',
    'Damnation',
    'Wrath of God',
    'Toxic Deluge',
    'Rhystic Study',
    'Mystic Remora',
    'Smothering Tithe',
    'Esper Sentinel',
    'The One Ring',
    'Demonic Tutor',
    'Vampiric Tutor',
    'Worldly Tutor',
    'Enlightened Tutor',
    'Mystical Tutor',
    'Imperial Seal',
    'Dockside Extortionist',
    'Jeska\'s Will',
    'Mana Drain',
    'Force of Will',
    'Force of Negation',
    'Swan Song',
    'Lightning Greaves',
    'Swiftfoot Boots',
    'Shadowspear',
    'Skullclamp',
    'Sensei\'s Divining Top',
    'Scroll Rack',
    'Chromatic Lantern',
    'Fellwar Stone',
    'Mind Stone',
    'Thought Vessel',
    'Talisman of Dominance',
    'Talisman of Progress',
    'Talisman of Creativity',
    'Talisman of Hierarchy',
    'Talisman of Unity',
    'Talisman of Conviction',
    'Talisman of Curiosity',
    'Talisman of Impulse',
    'Talisman of Indulgence',
    'Talisman of Resilience',
    'Beast Whisperer',
    'Guardian Project',
    'Harmonize',
    'Night\'s Whisper',
    'Sign in Blood',
    'Read the Bones',
    'Painful Truths',
    'Fact or Fiction',
    'Brainstorm',
    'Ponder',
    'Preordain',
    'Faithless Looting',
    'Wheel of Fortune',
    'Windfall',
    'Reanimate',
    'Animate Dead',
    'Necromancy',
    'Eternal Witness',
    'Regrowth',
    'Sevinne\'s Reclamation',
    'Anguished Unmaking',
    'Vanish into Memory',
    'Feed the Swarm',
    'Despark',
    'Wear // Tear',
    'Abrade',
    'Terminate',
    'Go for the Throat',
    'Fatal Push',
    'Dismember',
  ].map((n) => normName(n)),
)

export function filterOpportunityCards(
  cards: Card[],
  savedDecks: SavedDeck[],
  view: OpportunityView,
): Card[] {
  const usage = buildDeckUsage(cards, savedDecks)
  const unique = new Map<string, Card>()
  for (const c of cards) {
    const key = normName(c.name)
    if (!unique.has(key)) unique.set(key, c)
  }
  const list = [...unique.values()]

  switch (view) {
    case 'unused':
      return list.filter((c) => !isBasicLand(c) && !usage.has(normName(c.name)))
    case 'single-deck':
      return list.filter((c) => (usage.get(normName(c.name))?.size ?? 0) === 1)
    case 'multi-deck':
      return list.filter((c) => (usage.get(normName(c.name))?.size ?? 0) >= 2)
    case 'staples':
      return list
        .filter((c) => {
          const n = normName(c.name)
          if (COMMANDER_STAPLES.has(n)) return true
          const roles = detectCardRoles(c)
          return (
            (roles.includes('tutor') || roles.includes('wipe') || roles.includes('protection')) &&
            c.cmc <= 4
          )
        })
        .sort((a, b) => {
          const aS = COMMANDER_STAPLES.has(normName(a.name)) ? 0 : 1
          const bS = COMMANDER_STAPLES.has(normName(b.name)) ? 0 : 1
          return aS - bS || a.name.localeCompare(b.name)
        })
    case 'commanders':
      return list.filter(isPotentialCommander)
    default:
      return list
  }
}

export function usageLabel(
  card: Card,
  usage: Map<string, Set<string>>,
  deckNames: Map<string, string>,
): string {
  const set = usage.get(normName(card.name))
  if (!set || set.size === 0) return 'Sin mazos'
  const names = [...set].map((id) => deckNames.get(id) ?? id).slice(0, 2)
  return set.size === 1
    ? `En: ${names[0]}`
    : `${set.size} mazos · ${names.join(', ')}${set.size > 2 ? '…' : ''}`
}
