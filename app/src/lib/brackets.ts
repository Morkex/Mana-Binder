import type { Card } from '../types'
import { findGameChangers, isGameChanger } from './gameChangers'
import { getPrimaryType } from './mtg'

export type Bracket = 1 | 2 | 3 | 4 | 5

export const BRACKET_META: Record<
  Bracket,
  { name: string; nameEs: string; turns: string; maxGameChangers: number | null; blurb: string }
> = {
  1: {
    name: 'Exhibition',
    nameEs: 'Exhibición',
    turns: '≥ 9 turnos',
    maxGameChangers: 0,
    blurb: 'Tema y creatividad por encima del poder.',
  },
  2: {
    name: 'Core',
    nameEs: 'Núcleo',
    turns: '≥ 8 turnos',
    maxGameChangers: 0,
    blurb: 'Juego social, planes telegráficos y disrumpibles.',
  },
  3: {
    name: 'Upgraded',
    nameEs: 'Mejorado',
    turns: '≥ 6 turnos',
    maxGameChangers: 3,
    blurb: 'Buena sinergia y calidad; hasta 3 Game Changers.',
  },
  4: {
    name: 'Optimized',
    nameEs: 'Optimizado',
    turns: '≥ 4 turnos',
    maxGameChangers: null,
    blurb: 'Rápido, consistente y letal (no metagame cEDH).',
  },
  5: {
    name: 'cEDH',
    nameEs: 'cEDH',
    turns: 'Cualquier turno',
    maxGameChangers: null,
    blurb: 'Metagame competitivo; victoria prioritaria.',
  },
}

export interface BracketEstimate {
  bracket: Bracket
  floor: Bracket
  soft: Bracket
  gameChangers: string[]
  gameChangerCount: number
  reasons: string[]
  confidence: 'alta' | 'media' | 'baja'
}

function softPowerSignals(commander: Card | null, deck: Card[]): { score: number; notes: string[] } {
  const all = commander ? [commander, ...deck] : deck
  let score = 0
  const notes: string[] = []

  const nonLands = all.filter((c) => getPrimaryType(c.typeLine) !== 'Land')
  const avgCmc =
    nonLands.length === 0
      ? 0
      : nonLands.reduce((s, c) => s + c.cmc, 0) / nonLands.length

  if (avgCmc > 0 && avgCmc < 2.6) {
    score += 2
    notes.push(`CMC medio bajo (${avgCmc.toFixed(2)})`)
  } else if (avgCmc >= 3.8) {
    score -= 1
    notes.push(`CMC medio alto (${avgCmc.toFixed(2)})`)
  }

  const textBlob = all.map((c) => c.oracleText).join('\n')
  const extraTurns = all.filter((c) => /extra turn|additional turn/i.test(c.oracleText)).length
  if (extraTurns >= 3) {
    score += 2
    notes.push(`${extraTurns} efectos de turno extra`)
  } else if (extraTurns >= 1) {
    score += 1
    notes.push(`${extraTurns} efecto(s) de turno extra`)
  }

  const mld = all.filter((c) =>
    /destroy all lands|each player sacrifices .* lands|all lands|Armageddon|Ravages of War|Wildfire|Obliterate/i.test(
      c.name + ' ' + c.oracleText,
    ),
  ).length
  if (mld >= 1) {
    score += 2
    notes.push('Posible denegación masiva de tierras')
  }

  const freeSpells = all.filter((c) =>
    /cast (this|~) (spell )?without paying|alternative cost|if you control a commander/i.test(c.oracleText),
  ).length
  if (freeSpells >= 3) {
    score += 1
    notes.push('Varios hechizos con coste alternativo/gratis')
  }

  // Señales cEDH clásicas (aunque no todas sean GC)
  const cedhish = all.filter((c) =>
    /Demonic Consultation|Tainted Pact|Thassa's Oracle|Ad Nauseam|Underworld Breach|Dockside Extortionist|Mana Crypt|Jeweled Lotus/i.test(
      c.name,
    ),
  ).length
  if (cedhish >= 2) {
    score += 3
    notes.push('Piezas típicas de cEDH')
  } else if (cedhish === 1) {
    score += 1
  }

  void textBlob
  return { score, notes }
}

/**
 * Estima bracket según reglas duras de Game Changers + señales blandas.
 * Floor duro: 0 GC → mín. 1; 1–3 → mín. 3; 4+ → mín. 4.
 */
export function estimateBracket(commander: Card | null, deck: Card[]): BracketEstimate {
  const names = [
    ...(commander ? [commander.name] : []),
    ...deck.map((c) => c.name),
  ]
  const gameChangers = findGameChangers(names)
  const n = gameChangers.length

  let floor: Bracket = 1
  const reasons: string[] = []

  if (n === 0) {
    floor = 1
    reasons.push('0 Game Changers (válido para brackets 1–2)')
  } else if (n <= 3) {
    floor = 3
    reasons.push(`${n} Game Changer(s) → mínimo bracket 3`)
  } else {
    floor = 4
    reasons.push(`${n} Game Changers → mínimo bracket 4`)
  }

  const soft = softPowerSignals(commander, deck)
  reasons.push(...soft.notes)

  let softBracket: Bracket = floor
  if (n === 0) {
    softBracket = soft.score >= 3 ? 3 : soft.score >= 1 ? 2 : 1
  } else if (n <= 3) {
    softBracket = soft.score >= 4 ? 4 : 3
  } else {
    softBracket = soft.score >= 5 ? 5 : 4
  }

  const bracket = (Math.max(floor, softBracket) as Bracket)

  let confidence: BracketEstimate['confidence'] = 'media'
  if (n > 0 || soft.notes.length >= 2) confidence = 'alta'
  if (n === 0 && soft.notes.length === 0) confidence = 'baja'

  return {
    bracket,
    floor,
    soft: softBracket,
    gameChangers,
    gameChangerCount: n,
    reasons,
    confidence,
  }
}

export function maxGameChangersFor(bracket: Bracket): number {
  const max = BRACKET_META[bracket].maxGameChangers
  return max === null ? Infinity : max
}

export function cardAllowedInBracket(card: Card, bracket: Bracket, alreadyGcInDeck: number): boolean {
  if (!isGameChanger(card.name)) return true
  const max = maxGameChangersFor(bracket)
  if (max === Infinity) return true
  return alreadyGcInDeck < max
}
