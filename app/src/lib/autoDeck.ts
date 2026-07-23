import type { Card } from '../types'
import {
  type Bracket,
  cardAllowedInBracket,
  maxGameChangersFor,
} from './brackets'
import { buildCommanderProfile, synergyScore } from './commanderProfile'
import { isGameChanger } from './gameChangers'
import {
  isDraw,
  isInteraction,
  isRamp,
  scoreCard,
  scoreCardDetailed,
  type ScoreBreakdown,
} from './cardScore'
import { fitsColorIdentity, getPrimaryType, uniqueByName } from './mtg'
import { isBasicLand, makeBasicLandCopies, withUnlimitedBasics } from './basicLands'

export type { ScoreBreakdown }

const DECK_SIZE = 99
const MAX_PLANESWALKERS = 3
/** Non-basic lands from the collection; the rest of the manabase is basics. */
const MAX_NONBASIC_LANDS: Record<Bracket, number> = {
  1: 8,
  2: 10,
  3: 12,
  4: 14,
  5: 16,
}

interface BracketRecipe {
  lands: number
  ramp: number
  draw: number
  interaction: number
  creatures: number
}

const RECIPES: Record<Bracket, BracketRecipe> = {
  1: { lands: 38, ramp: 6, draw: 6, interaction: 8, creatures: 32 },
  2: { lands: 37, ramp: 8, draw: 8, interaction: 10, creatures: 28 },
  3: { lands: 36, ramp: 10, draw: 10, interaction: 12, creatures: 25 },
  4: { lands: 34, ramp: 12, draw: 11, interaction: 14, creatures: 22 },
  5: { lands: 32, ramp: 12, draw: 12, interaction: 15, creatures: 20 },
}

function pickBest(cards: Card[], n: number, used: Set<string>): Card[] {
  const picked: Card[] = []
  for (const card of cards) {
    if (picked.length >= n) break
    const key = card.name.toLowerCase()
    if (used.has(key)) continue
    used.add(key)
    picked.push(card)
  }
  return picked
}

function isPlaneswalker(card: Card): boolean {
  return getPrimaryType(card.typeLine) === 'Planeswalker'
}

/**
 * Genera un mazo Commander orientado a sinergia del comandante y bracket objetivo.
 * Las basic lands se tratan como ilimitadas y rellenan el manabase.
 */
export function autoBuildDeck(
  commander: Card,
  pool: Card[],
  targetBracket: Bracket = 3,
  options: { edhrecBoost?: Map<string, number> } = {},
): Card[] {
  const recipe = RECIPES[targetBracket]
  const profile = buildCommanderProfile(commander)
  const boost = options.edhrecBoost

  let legal = uniqueByName(
    withUnlimitedBasics(
      pool.filter(
        (c) =>
          c.commanderLegal &&
          fitsColorIdentity(c, commander.colorIdentity) &&
          c.name.toLowerCase() !== commander.name.toLowerCase(),
      ),
      commander.colorIdentity,
    ),
  )

  if (maxGameChangersFor(targetBracket) === 0) {
    legal = legal.filter((c) => !isGameChanger(c.name))
  }

  const scored = legal
    .map((card) => {
      const base = scoreCard(card, commander, targetBracket, profile)
      const syn = synergyScore(card, profile)
      const meta = boost?.get(card.name.toLowerCase()) ?? 0
      // EDHREC: synergy ~0.05–0.35 and inclusion; boost is precomputed 0–40
      return { card, score: base + meta, syn: syn + meta * 0.5 }
    })
    .sort((a, b) => b.score - a.score || b.syn - a.syn)

  const used = new Set<string>([commander.name.toLowerCase()])
  const deck: Card[] = []
  let gcCount = isGameChanger(commander.name) ? 1 : 0
  let pwCount = 0

  const canTake = (card: Card) => {
    if (isBasicLand(card)) return false // basics se añaden al final de forma controlada
    if (!cardAllowedInBracket(card, targetBracket, gcCount)) return false
    if (isPlaneswalker(card)) {
      if (pwCount >= MAX_PLANESWALKERS) return false
      const syn = synergyScore(card, profile)
      const detail = scoreCardDetailed(card, commander, targetBracket, profile)
      if (syn < 12 && detail.utility < 8) return false
    }
    return true
  }

  const takeFrom = (list: Card[], n: number) => {
    const need = Math.max(0, n)
    const filtered = list.filter(canTake)
    const picked = pickBest(filtered, need, used)
    for (const c of picked) {
      if (isGameChanger(c.name)) gcCount += 1
      if (isPlaneswalker(c)) pwCount += 1
    }
    deck.push(...picked)
  }

  const nonBasicLands = scored
    .filter((s) => getPrimaryType(s.card.typeLine) === 'Land' && !isBasicLand(s.card))
    .map((s) => s.card)
  const creatures = scored
    .filter((s) => getPrimaryType(s.card.typeLine) === 'Creature')
    .map((s) => s.card)
  const ramp = scored.filter((s) => isRamp(s.card)).map((s) => s.card)
  const draw = scored.filter((s) => isDraw(s.card)).map((s) => s.card)
  const interaction = scored.filter((s) => isInteraction(s.card)).map((s) => s.card)

  const tribalCreatures = creatures.filter((c) => synergyScore(c, profile) >= 20)
  const otherCreatures = creatures.filter((c) => !tribalCreatures.includes(c))

  const rest = scored
    .filter((s) => {
      if (isBasicLand(s.card)) return false
      if (getPrimaryType(s.card.typeLine) === 'Land') return false
      if (isPlaneswalker(s.card) && s.syn < 12) return false
      if (targetBracket <= 2) return s.syn >= 8 || isRamp(s.card) || isDraw(s.card) || isInteraction(s.card)
      return s.score > 0
    })
    .map((s) => s.card)

  // Manabase: unas cuantas lands de la colección + el resto básicas ilimitadas
  takeFrom(nonBasicLands, Math.min(MAX_NONBASIC_LANDS[targetBracket], recipe.lands))
  const landsSoFar = deck.filter((c) => getPrimaryType(c.typeLine) === 'Land').length
  const basicsNeeded = Math.max(0, recipe.lands - landsSoFar)
  deck.push(...makeBasicLandCopies(commander.colorIdentity, basicsNeeded, pool))

  takeFrom(ramp, recipe.ramp)
  takeFrom(draw, recipe.draw)
  takeFrom(interaction, recipe.interaction)
  takeFrom(tribalCreatures, Math.min(recipe.creatures, tribalCreatures.length))
  const creaturesSoFar = deck.filter((c) => getPrimaryType(c.typeLine) === 'Creature').length
  takeFrom(otherCreatures, recipe.creatures - creaturesSoFar)
  takeFrom(rest, DECK_SIZE - deck.length)

  // Completar huecos con básicas (nunca con lands raras sin sentido)
  if (deck.length < DECK_SIZE) {
    const stillNeed = DECK_SIZE - deck.length
    deck.push(...makeBasicLandCopies(commander.colorIdentity, stillNeed, pool))
  }

  return deck.slice(0, DECK_SIZE)
}

/** Desglose de puntuación de todas las cartas del mazo (comandante incluido). */
export function scoreDeckCards(
  commander: Card,
  deck: Card[],
  bracket: Bracket,
): { card: Card; score: ScoreBreakdown; isCommander: boolean }[] {
  const profile = buildCommanderProfile(commander)
  return [
    {
      card: commander,
      score: scoreCardDetailed(commander, commander, bracket, profile),
      isCommander: true,
    },
    ...deck.map((card) => ({
      card,
      score: scoreCardDetailed(card, commander, bracket, profile),
      isCommander: false,
    })),
  ]
}

export { deckStats, analyzeDeck } from './deckAnalysis'
export type { DeckAnalysis } from './deckAnalysis'
