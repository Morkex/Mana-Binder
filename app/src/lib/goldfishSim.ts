import type { Card } from '../types'
import { detectCardRoles } from './cardRoles'
import { getPrimaryType } from './mtg'
import { isBasicLand } from './basicLands'

export interface HandSimResult {
  keepable: boolean
  lands: number
  ramp: number
  draw: number
  interaction: number
  cmcSum: number
}

export interface GoldfishBatchSummary {
  hands: number
  keepRate: number
  avgLands: number
  avgRamp: number
  zeroLandRate: number
  allLandRate: number
  mulliganLikeRate: number
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function simulateOpeningHand(deck: Card[], size = 7): HandSimResult {
  const library = shuffle(deck.filter((c) => Boolean(c.typeLine?.trim())))
  const hand = library.slice(0, size)
  const lands = hand.filter((c) => getPrimaryType(c.typeLine) === 'Land' || isBasicLand(c)).length
  const ramp = hand.filter((c) => detectCardRoles(c).includes('ramp')).length
  const draw = hand.filter((c) => detectCardRoles(c).includes('draw')).length
  const interaction = hand.filter((c) => {
    const r = detectCardRoles(c)
    return r.includes('removal') || r.includes('counter')
  }).length
  const cmcSum = hand.reduce((s, c) => s + (getPrimaryType(c.typeLine) === 'Land' ? 0 : c.cmc), 0)
  const keepable = lands >= 2 && lands <= 5 && !(lands === 0) && !(lands === 7)
  return { keepable, lands, ramp, draw, interaction, cmcSum }
}

export function runHandBatch(deck: Card[], n = 100): GoldfishBatchSummary {
  let keep = 0
  let landSum = 0
  let rampSum = 0
  let zeroLand = 0
  let allLand = 0
  let mulliganLike = 0
  for (let i = 0; i < n; i++) {
    const h = simulateOpeningHand(deck)
    if (h.keepable) keep += 1
    else mulliganLike += 1
    landSum += h.lands
    rampSum += h.ramp
    if (h.lands === 0) zeroLand += 1
    if (h.lands >= 6) allLand += 1
  }
  return {
    hands: n,
    keepRate: keep / n,
    avgLands: landSum / n,
    avgRamp: rampSum / n,
    zeroLandRate: zeroLand / n,
    allLandRate: allLand / n,
    mulliganLikeRate: mulliganLike / n,
  }
}

const METRICS_KEY = 'mana-binder-goldfish-metrics'

export interface PlayMetricsEvent {
  at: number
  deckKey: string
  mulligans: number
  turnCommander: number | null
  turnFirstRamp: number | null
  turnFirstRemoval: number | null
  turnFirstThreat: number | null
  manaScrew: boolean
  manaFlood: boolean
  notes?: string
}

/** Heurística simple: tierras en mano vs turno (mid-partida). */
export function detectManaIssues(params: {
  turn: number
  landsInHand: number
  landsOnBattle: number
  handSize: number
}): { manaScrew: boolean; manaFlood: boolean } {
  const { turn, landsInHand, landsOnBattle, handSize } = params
  const totalLandsSeen = landsInHand + landsOnBattle
  const manaScrew = turn >= 4 && landsOnBattle <= 2 && landsInHand === 0
  const manaFlood =
    turn >= 5 && landsInHand >= 4 && handSize >= 5 && totalLandsSeen >= turn + 3
  return { manaScrew, manaFlood }
}

export function appendPlayMetrics(ev: PlayMetricsEvent) {
  try {
    const raw = localStorage.getItem(METRICS_KEY)
    const list = raw ? (JSON.parse(raw) as PlayMetricsEvent[]) : []
    list.unshift(ev)
    localStorage.setItem(METRICS_KEY, JSON.stringify(list.slice(0, 200)))
  } catch {
    /* quota */
  }
}

export function loadPlayMetrics(deckKey?: string): PlayMetricsEvent[] {
  try {
    const raw = localStorage.getItem(METRICS_KEY)
    const list = raw ? (JSON.parse(raw) as PlayMetricsEvent[]) : []
    return deckKey ? list.filter((e) => e.deckKey === deckKey) : list
  } catch {
    return []
  }
}
