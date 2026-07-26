import type { Card } from '../types'
import { getPrimaryType } from './mtg'

/**
 * Roles funcionales + tipos básicos para deckbuilding.
 * Detección por Oracle / type line / keywords (sin IA).
 */
export const CARD_ROLES = [
  'land',
  'creature',
  'artifact',
  'enchantment',
  'planeswalker',
  'battle',
  'ramp',
  'draw',
  'tutor',
  'removal',
  'wipe',
  'counter',
  'protection',
  'recursion',
  'reanimation',
  'sac_outlet',
  'tokens',
  'blink',
  'treasure',
  'anthem',
  'lifegain',
  'mill',
  'discard',
  'wincon',
] as const

export type CardRole = (typeof CARD_ROLES)[number]

export const ROLE_META: Record<
  CardRole,
  { label: string; short: string; kind: 'type' | 'function' }
> = {
  land: { label: 'Tierra', short: 'Land', kind: 'type' },
  creature: { label: 'Criatura', short: 'Creature', kind: 'type' },
  artifact: { label: 'Artefacto', short: 'Artifact', kind: 'type' },
  enchantment: { label: 'Encantamiento', short: 'Enchant', kind: 'type' },
  planeswalker: { label: 'Planeswalker', short: 'PW', kind: 'type' },
  battle: { label: 'Battle', short: 'Battle', kind: 'type' },
  ramp: { label: 'Ramp', short: 'Ramp', kind: 'function' },
  draw: { label: 'Robo', short: 'Draw', kind: 'function' },
  tutor: { label: 'Tutor', short: 'Tutor', kind: 'function' },
  removal: { label: 'Removal', short: 'Removal', kind: 'function' },
  wipe: { label: 'Board wipe', short: 'Wipe', kind: 'function' },
  counter: { label: 'Counterspell', short: 'Counter', kind: 'function' },
  protection: { label: 'Protección', short: 'Protect', kind: 'function' },
  recursion: { label: 'Recursión', short: 'Recur', kind: 'function' },
  reanimation: { label: 'Reanimación', short: 'Reanim', kind: 'function' },
  sac_outlet: { label: 'Salida de sacrificio', short: 'Sac', kind: 'function' },
  tokens: { label: 'Tokens', short: 'Tokens', kind: 'function' },
  blink: { label: 'Blink / flicker', short: 'Blink', kind: 'function' },
  treasure: { label: 'Treasures', short: 'Treasure', kind: 'function' },
  anthem: { label: 'Anthem', short: 'Anthem', kind: 'function' },
  lifegain: { label: 'Ganar vidas', short: 'Life', kind: 'function' },
  mill: { label: 'Mill', short: 'Mill', kind: 'function' },
  discard: { label: 'Discard / hand hate', short: 'Discard', kind: 'function' },
  wincon: { label: 'Win condition', short: 'Wincon', kind: 'function' },
}

/** Roles de construcción (excluye tipos de carta). */
export const FUNCTION_ROLES: CardRole[] = CARD_ROLES.filter((r) => ROLE_META[r].kind === 'function')

function blob(card: Card): string {
  const kw = card.keywords?.length ? card.keywords.join(' ') : ''
  return `${card.name}\n${card.typeLine}\n${card.oracleText ?? ''}\n${kw}`
}

function pushUnique(roles: CardRole[], role: CardRole) {
  if (!roles.includes(role)) roles.push(role)
}

/**
 * Detecta roles de una carta. Las lands solo reciben `land` (+ función si aplica, p. ej. ramp lands).
 */
export function detectCardRoles(card: Card): CardRole[] {
  const type = getPrimaryType(card.typeLine)
  const text = card.oracleText ?? ''
  const name = card.name
  const hay = blob(card)
  const roles: CardRole[] = []

  if (type === 'Land') {
    pushUnique(roles, 'land')
    // Utility lands that ramp / fix
    const landUtility = new RegExp(
      String.raw`\{T\}: add \{[WUBRGC2]\}|search your library for .{0,60}land|creates? .* treasure`,
      'i',
    )
    if (landUtility.test(text)) {
      const landRamp = new RegExp(
        String.raw`search your library for .{0,60}land|\{T\}: add \{[WUBRG]\}.*\{T\}: add`,
        'i',
      )
      if (landRamp.test(text)) pushUnique(roles, 'ramp')
      if (/treasure/i.test(text)) pushUnique(roles, 'treasure')
    }
    return roles
  }

  if (type === 'Creature') pushUnique(roles, 'creature')
  if (type === 'Planeswalker') pushUnique(roles, 'planeswalker')
  if (type === 'Battle') pushUnique(roles, 'battle')
  if (type === 'Artifact') pushUnique(roles, 'artifact')
  if (type === 'Enchantment') pushUnique(roles, 'enchantment')

  // —— Ramp (no lands) ——
  const rampRe = new RegExp(
    [
      String.raw`\{T\}: add \{`,
      String.raw`adds? \{[WUBRGC0-9/]+\}`,
      String.raw`search your library for (a |up to \w+ )?basic land`,
      String.raw`search your library for .{0,40}land card`,
      String.raw`put (a|one|two|up to \w+) land .+ onto the battlefield`,
      String.raw`sol ring|arcane signet|talisman of |cultivate|kodama's reach|rampant growth`,
      String.raw`farseek|nature's lore|three visits|sakura-tribe elder|wood elves`,
      String.raw`birds of paradise|llanowar elves|elvish mystic|paradise|mana dork|treasure token`,
    ].join('|'),
    'i',
  )
  if (rampRe.test(`${text} ${name}`) && !/whenever .+ deals combat damage .+ add \{/i.test(text)) {
    pushUnique(roles, 'ramp')
  }

  // —— Draw ——
  if (
    /draw (a|one|two|three|four|x|\d+) cards?|draw a card|investigate|cantrip/i.test(text) &&
    !/^enchant /i.test(text)
  ) {
    // Exclude pure cantrips on auras? Still draw.
    pushUnique(roles, 'draw')
  } else if (/scry [2-9]|surveil [2-9]/i.test(text)) {
    pushUnique(roles, 'draw')
  }

  // —— Tutor ——
  if (
    /search your library for (a |an |up to .{0,20} )?(card|creature|artifact|enchantment|instant|sorcery|planeswalker|permanent|land)/i.test(
      text,
    ) &&
    !/search your library for .{0,40}basic land/i.test(text)
  ) {
    pushUnique(roles, 'tutor')
  }

  // —— Spot removal ——
  if (
    /destroy target (creature|permanent|artifact|enchantment|planeswalker)|exile target (creature|permanent|artifact|enchantment|planeswalker)|deal \d+ damage to (any target|target creature|target planeswalker)|fights? target creature| -[\dX]+\/-[\dX]+ to target/i.test(
      text,
    )
  ) {
    pushUnique(roles, 'removal')
  }

  // —— Board wipes ——
  if (
    /destroy all (creatures|permanents|artifacts|enchantments)|exile all creatures|each creature (gets|gains|loses)|all creatures get -|damage to each creature|wrath|damnation|blasphemous act|toxic deluge|farewell|cyclonic rift/i.test(
      `${text} ${name}`,
    )
  ) {
    pushUnique(roles, 'wipe')
  }

  // —— Counterspells ——
  if (/counter target (spell|activated ability|triggered ability)/i.test(text)) {
    pushUnique(roles, 'counter')
  }

  // —— Protection ——
  if (
    /hexproof|indestructible|protection from|shroud|ward \{|can't be countered|phase out|prevent all (combat )?damage|redirect|with hexproof|gains? hexproof|gains? indestructible|teferi's protection|silence|grand abolisher/i.test(
      hay,
    )
  ) {
    pushUnique(roles, 'protection')
  }

  // —— Recursion (grave → hand / library) ——
  if (
    /return .{0,40} from (your )?graveyard to (your )?hand|return target .+ card from your graveyard to your hand|regrowth|eternal witness|pull from .*(graveyard)/i.test(
      text,
    )
  ) {
    pushUnique(roles, 'recursion')
  }

  // —— Reanimation (grave → battlefield) ——
  if (
    /return .{0,60} from (your )?graveyard to the battlefield|put .{0,40} from .{0,20}graveyard onto the battlefield|reanimate|animate dead|necromancy|living death|rise of the dark realms/i.test(
      `${text} ${name}`,
    )
  ) {
    pushUnique(roles, 'reanimation')
  }

  // —— Sac outlet ——
  if (
    /sacrifice (a |another )?creature|: sacrifice |sac outlet|ashnod's altar|phyrexian altar|viscera seer|carrion feeder|yawgmoth/i.test(
      `${text} ${name}`,
    ) &&
    /sacrifice/i.test(text)
  ) {
    // Prefer activated costs / repeatable
    if (/\{[^}]*\},? sacrifice|sacrifice a creature:|sacrifice another/i.test(text)) {
      pushUnique(roles, 'sac_outlet')
    }
  }

  // —— Tokens ——
  if (/create .{0,80}token/i.test(text)) {
    pushUnique(roles, 'tokens')
  }

  // —— Blink / flicker ——
  if (
    /exile .{0,50}(,| then) .{0,40}return .{0,40} to the battlefield|flicker|blink|teleportation|ephemerate|ghostly flicker|displace/i.test(
      `${text} ${name}`,
    )
  ) {
    pushUnique(roles, 'blink')
  }

  // —— Treasure ——
  if (/treasure token|creates? .* treasure|golden egg/i.test(`${text} ${name}`)) {
    pushUnique(roles, 'treasure')
  }

  // —— Anthem ——
  if (
    /creatures you control get \+\d+\+\d+|other creatures you control get|lord|anthem|\+1\/\+1 to each creature you control/i.test(
      text,
    )
  ) {
    pushUnique(roles, 'anthem')
  }

  // —— Lifegain ——
  if (/you gain \d+ life|gain life equal|lifelink/i.test(hay) && !/^trample, lifelink$/i.test(text)) {
    // Keyword-only creatures still count as lifegain package
    if (/you gain \d+ life|gain life equal/i.test(text) || /\blifelink\b/i.test(hay)) {
      pushUnique(roles, 'lifegain')
    }
  }

  // —— Mill ——
  if (/mills? \d+|put the top \d+ cards? of (target|each|their) library into .{0,20}graveyard/i.test(text)) {
    pushUnique(roles, 'mill')
  }

  // —— Discard / hand hate ——
  if (
    /target player discards|each opponent discards|discard (a|one|two) cards?|thoughtseize|duress|inquisition of kozilek/i.test(
      `${text} ${name}`,
    )
  ) {
    pushUnique(roles, 'discard')
  }

  // —— Wincon (heurística fina) ——
  if (
    /you win the game|wins the game|extra turn|take an extra turn|infect|toxic \d|commander damage|thassa's oracle|laboratory maniac|jace,? wielner|approach of the second sun|craterhoof|triumph of the hordes|exsanguinate|torment of hailfire|finishing move/i.test(
      `${text} ${name}`,
    )
  ) {
    pushUnique(roles, 'wincon')
  }

  return roles
}

export function hasRole(card: Card, role: CardRole): boolean {
  return detectCardRoles(card).includes(role)
}

export function roleLabel(role: string): string {
  if (role in ROLE_META) return ROLE_META[role as CardRole].label
  return role
}

export function roleShort(role: string): string {
  if (role in ROLE_META) return ROLE_META[role as CardRole].short
  return role
}

/** Cuenta cuántas cartas del mazo tienen cada rol funcional. */
export function countFunctionalRoles(cards: Card[]): Record<CardRole, number> {
  const counts = {} as Record<CardRole, number>
  for (const role of CARD_ROLES) counts[role] = 0
  for (const card of cards) {
    for (const role of detectCardRoles(card)) {
      counts[role] += 1
    }
  }
  return counts
}
