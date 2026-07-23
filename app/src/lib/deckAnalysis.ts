import type { Card } from '../types'
import { estimateBracket, type BracketEstimate } from './brackets'
import { getPrimaryType } from './mtg'

export interface DeckAnalysis {
  total: number
  avgCmc: number
  medianCmc: number
  lands: number
  nonLands: number
  curve: { label: string; count: number }[]
  byType: { type: string; count: number }[]
  roles: {
    ramp: number
    draw: number
    removal: number
    boardWipe: number
    creatures: number
  }
  colorPips: Record<string, number>
  bracket: BracketEstimate
}

function isLand(card: Card): boolean {
  return getPrimaryType(card.typeLine) === 'Land'
}

function roleFlags(card: Card) {
  const text = `${card.oracleText} ${card.keywords.join(' ')}`.toLowerCase()
  return {
    ramp:
      !isLand(card) &&
      /add \{|search your library for (a|up to).*land|sol ring|signet|talisman|mana rock|cultivate|rampant growth|kodama's reach/i.test(
        text,
      ),
    draw: /draw (a|one|two|three|x) card|scry [2-9]|investigate/i.test(text),
    removal: /destroy target|exile target|deal \d+ damage to (any target|target creature)|counter target/i.test(
      text,
    ),
    boardWipe: /destroy all|each creature gets|all creatures|wrath|board wipe/i.test(text),
  }
}

function countManaPips(manaCost: string): Record<string, number> {
  const pips: Record<string, number> = { W: 0, U: 0, B: 0, R: 0, G: 0 }
  if (!manaCost) return pips
  const re = /\{([^}]+)\}/g
  let m: RegExpExecArray | null
  while ((m = re.exec(manaCost))) {
    const sym = m[1]
    for (const c of ['W', 'U', 'B', 'R', 'G']) {
      if (sym.includes(c)) pips[c] += 1
    }
  }
  return pips
}

export function analyzeDeck(commander: Card | null, deck: Card[]): DeckAnalysis {
  const all = commander ? [commander, ...deck] : deck
  const nonLandCards = all.filter((c) => !isLand(c))
  const cmcs = nonLandCards.map((c) => c.cmc).sort((a, b) => a - b)

  const curveBuckets = [0, 1, 2, 3, 4, 5, 6]
  const curve = curveBuckets.map((n) => ({
    label: String(n),
    count: nonLandCards.filter((c) => Math.floor(c.cmc) === n).length,
  }))
  curve.push({
    label: '7+',
    count: nonLandCards.filter((c) => c.cmc >= 7).length,
  })

  const byTypeMap: Record<string, number> = {}
  for (const card of all) {
    const t = getPrimaryType(card.typeLine)
    byTypeMap[t] = (byTypeMap[t] ?? 0) + 1
  }

  const roles = { ramp: 0, draw: 0, removal: 0, boardWipe: 0, creatures: 0 }
  const colorPips: Record<string, number> = { W: 0, U: 0, B: 0, R: 0, G: 0 }

  for (const card of all) {
    const flags = roleFlags(card)
    if (flags.ramp) roles.ramp += 1
    if (flags.draw) roles.draw += 1
    if (flags.removal) roles.removal += 1
    if (flags.boardWipe) roles.boardWipe += 1
    if (getPrimaryType(card.typeLine) === 'Creature') roles.creatures += 1

    const pips = countManaPips(card.manaCost)
    for (const c of Object.keys(colorPips)) {
      colorPips[c] += pips[c] ?? 0
    }
  }

  const mid = Math.floor(cmcs.length / 2)
  const medianCmc =
    cmcs.length === 0
      ? 0
      : cmcs.length % 2 === 0
        ? Math.round(((cmcs[mid - 1] + cmcs[mid]) / 2) * 100) / 100
        : cmcs[mid]

  const avgCmc = cmcs.length
    ? Math.round((cmcs.reduce((a, b) => a + b, 0) / cmcs.length) * 100) / 100
    : 0

  return {
    total: all.length,
    avgCmc,
    medianCmc,
    lands: all.filter(isLand).length,
    nonLands: nonLandCards.length,
    curve,
    byType: Object.entries(byTypeMap)
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count),
    roles,
    colorPips,
    bracket: estimateBracket(commander, deck),
  }
}

/** @deprecated usar analyzeDeck */
export function deckStats(commander: Card | null, cards: Card[]) {
  const a = analyzeDeck(commander, cards)
  return {
    total: a.total,
    byType: Object.fromEntries(a.byType.map((t) => [t.type, t.count])),
    avgCmc: a.avgCmc,
  }
}
