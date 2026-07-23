import type { Card } from '../types'
import { getSubtypes } from './mtg'

export interface CommanderProfile {
  keywords: string[]
  creatureTypes: string[]
  themes: string[]
}

export const COMMANDER_THEME_OPTIONS: { id: string; label: string; re: RegExp }[] = [
  { id: 'tokens', label: 'tokens', re: /create .* token|populate/i },
  { id: 'counters', label: '+1/+1', re: /\+1\/\+1 counter|proliferate/i },
  { id: 'graveyard', label: 'graveyard', re: /from (your |a )?graveyard|mill [0-9]|reanimate|return target .* from (your )?graveyard/i },
  { id: 'artifacts', label: 'artifacts', re: /\bartifact\b|equipment|historic/i },
  { id: 'enchantments', label: 'enchantments', re: /\benchantment\b|aura |constellation/i },
  { id: 'spells', label: 'instant/sorcery', re: /instant or sorcery|magecraft/i },
  { id: 'blink', label: 'blink', re: /exile (target|it|them).{0,40}return|flicker/i },
  { id: 'sacrifice', label: 'sacrifice', re: /sacrifice (a|another) creature|whenever .* dies/i },
  { id: 'lifegain', label: 'lifegain', re: /you gain [0-9]+ life|lifelink/i },
  { id: 'extra-combats', label: 'extra combats', re: /additional combat|extra combat/i },
]

const WEAK_TYPES = new Set([
  'creature',
  'legendary',
  'artifact',
  'enchantment',
  'snow',
  'token',
  'basic',
  'world',
])

/** Keywords demasiado comunes para sinergia automática. */
const WEAK_KEYWORDS = new Set([
  'flying',
  'trample',
  'haste',
  'vigilance',
  'reach',
  'menace',
  'lifelink',
  'deathtouch',
  'first strike',
  'defender',
])

export function buildCommanderProfile(commander: Card): CommanderProfile {
  const keywords = (commander.keywords ?? [])
    .map((k) => k.trim())
    .filter((k) => k && !WEAK_KEYWORDS.has(k.toLowerCase()))

  const creatureTypes = getSubtypes(commander.typeLine).filter(
    (t) => !WEAK_TYPES.has(t.toLowerCase()),
  )

  const blob = `${commander.oracleText} ${commander.typeLine}`
  const themes = COMMANDER_THEME_OPTIONS.filter((t) => t.re.test(blob)).map((t) => t.id)

  if (creatureTypes.length >= 1 && !themes.includes('tribal')) {
    // tribal solo como marca interna
  }

  return { keywords, creatureTypes, themes }
}

export function synergyBreakdown(
  card: Card,
  profile: CommanderProfile,
): { total: number; notes: string[] } {
  let total = 0
  const notes: string[] = []
  const text = card.oracleText
  const cardTypes = getSubtypes(card.typeLine).map((t) => t.toLowerCase())
  const cardKeywords = new Set((card.keywords ?? []).map((k) => k.toLowerCase()))

  for (const kw of profile.keywords) {
    const k = kw.toLowerCase()
    if (cardKeywords.has(k)) {
      total += 12
      notes.push(`keyword ${kw}`)
    }
  }

  for (const type of profile.creatureTypes) {
    const t = type.toLowerCase()
    if (cardTypes.includes(t)) {
      total += 24
      notes.push(`tipo ${type}`)
    }
    const re = new RegExp(`\\b${escapeReg(type)}(s)?\\b`, 'i')
    if (re.test(text)) {
      total += 14
      notes.push(`texto menciona ${type}`)
    }
  }

  for (const theme of profile.themes) {
    const rule = COMMANDER_THEME_OPTIONS.find((r) => r.id === theme)
    if (rule && rule.re.test(`${text} ${card.typeLine}`)) {
      total += 11
      notes.push(`tema ${rule.label}`)
    }
  }

  return { total, notes }
}

/** @deprecated usar synergyBreakdown */
export function synergyScore(card: Card, profile: CommanderProfile): number {
  return synergyBreakdown(card, profile).total
}

function escapeReg(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
