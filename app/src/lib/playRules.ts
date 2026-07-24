import { getPrimaryType } from './mtg'
import { parseCreateTokens, type ParsedToken } from './playTokens'

/** Minimal permanent shape — avoids circular import with playtest. */
export interface RulesObject {
  id: string
  name: string
  card: { typeLine: string; oracleText: string; name: string } | null
  isToken: boolean
  power: string | null
  toughness: string | null
  counters: { label: string; amount: number }[]
  damage?: number
}

export type TriggerKind = 'etb' | 'dies' | 'combat_damage' | 'other'

export interface DetectedTrigger {
  kind: TriggerKind
  text: string
  /** Auto-resolvable hints for goldfish. */
  effects: TriggerEffect[]
}

export type TriggerEffect =
  | { type: 'draw'; n: number }
  | { type: 'gain_life'; n: number }
  | { type: 'damage_opponent'; n: number }
  | { type: 'create_tokens'; tokens: ParsedToken[] }
  | { type: 'manual'; note: string }

function sentences(oracle: string): string[] {
  return oracle
    .replace(/\n+/g, ' ')
    .split(/(?<=\.)\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
}

function parseEffectsFromClause(clause: string): TriggerEffect[] {
  const effects: TriggerEffect[] = []
  const draw = clause.match(/draw (a card|one card|two cards|three cards|\d+ cards?)/i)
  if (draw) {
    const raw = draw[1].toLowerCase()
    let n = 1
    if (raw.includes('two')) n = 2
    else if (raw.includes('three')) n = 3
    else {
      const num = raw.match(/\d+/)
      if (num) n = Number(num[0])
    }
    effects.push({ type: 'draw', n })
  }
  const life = clause.match(/gain (\d+) life/i)
  if (life) effects.push({ type: 'gain_life', n: Number(life[1]) })
  const dmg = clause.match(/deals? (\d+) damage to (?:any target|target player|each opponent|opponent)/i)
  if (dmg) effects.push({ type: 'damage_opponent', n: Number(dmg[1]) })
  const tokens = parseCreateTokens(clause)
  if (tokens.length) effects.push({ type: 'create_tokens', tokens })
  if (!effects.length) effects.push({ type: 'manual', note: clause.slice(0, 160) })
  return effects
}

/** Detect ETB-style triggered abilities on a card. */
export function detectEtbTriggers(obj: RulesObject): DetectedTrigger[] {
  const text = obj.card?.oracleText ?? ''
  if (!text) return []
  const out: DetectedTrigger[] = []
  for (const s of sentences(text)) {
    if (
      /when .+ enters(?: the battlefield)?/i.test(s) ||
      /when this (?:creature|artifact|enchantment|permanent) enters/i.test(s) ||
      /^enters the battlefield/i.test(s)
    ) {
      out.push({ kind: 'etb', text: s, effects: parseEffectsFromClause(s) })
    }
  }
  return out
}

/** Detect dies / leaves-battlefield death triggers. */
export function detectDiesTriggers(obj: RulesObject): DetectedTrigger[] {
  const text = obj.card?.oracleText ?? ''
  if (!text) return []
  const out: DetectedTrigger[] = []
  for (const s of sentences(text)) {
    if (/when .+ dies/i.test(s) || /when this creature dies/i.test(s)) {
      out.push({ kind: 'dies', text: s, effects: parseEffectsFromClause(s) })
    }
  }
  return out
}

/** Combat-damage-to-player triggers on an attacking creature. */
export function detectCombatDamageTriggers(obj: RulesObject): DetectedTrigger[] {
  const text = obj.card?.oracleText ?? ''
  if (!text) return []
  const out: DetectedTrigger[] = []
  for (const s of sentences(text)) {
    if (/deals combat damage to a player/i.test(s) || /deals combat damage to an opponent/i.test(s)) {
      out.push({ kind: 'combat_damage', text: s, effects: parseEffectsFromClause(s) })
    }
  }
  return out
}

export function isLegendary(obj: RulesObject): boolean {
  return /\bLegendary\b/i.test(obj.card?.typeLine ?? obj.name)
}

export function isCreature(obj: RulesObject): boolean {
  if (obj.isToken && obj.power != null) return true
  if (!obj.card) return obj.power != null && obj.toughness != null
  return getPrimaryType(obj.card.typeLine) === 'Creature'
}

export function effectivePower(obj: RulesObject): number {
  const base = Number.parseInt(obj.power ?? '0', 10)
  const p = Number.isFinite(base) ? base : 0
  const plus = obj.counters.filter((c) => c.label === '+1/+1').reduce((s, c) => s + c.amount, 0)
  const minus = obj.counters.filter((c) => c.label === '-1/-1').reduce((s, c) => s + c.amount, 0)
  return p + plus - minus
}

export function effectiveToughness(obj: RulesObject): number {
  const base = Number.parseInt(obj.toughness ?? '0', 10)
  const t = Number.isFinite(base) ? base : 0
  const plus = obj.counters.filter((c) => c.label === '+1/+1').reduce((s, c) => s + c.amount, 0)
  const minus = obj.counters.filter((c) => c.label === '-1/-1').reduce((s, c) => s + c.amount, 0)
  const dmg = obj.damage ?? 0
  return t + plus - minus - dmg
}

export function legendNameKey(obj: RulesObject): string {
  return (obj.card?.name ?? obj.name).split('//')[0].trim().toLowerCase()
}
