import type { Card, PrimaryType } from '../types'

export const COLOR_META: Record<
  string,
  { label: string; short: string; hex: string; ink: string }
> = {
  W: { label: 'White', short: 'W', hex: '#f0e6d0', ink: '#5c4a1f' },
  U: { label: 'Blue', short: 'U', hex: '#0e68ab', ink: '#ffffff' },
  B: { label: 'Black', short: 'B', hex: '#150b00', ink: '#c9b37c' },
  R: { label: 'Red', short: 'R', hex: '#d3202a', ink: '#ffffff' },
  G: { label: 'Green', short: 'G', hex: '#00733e', ink: '#ffffff' },
  C: { label: 'Colorless', short: 'C', hex: '#cbc2bf', ink: '#2a2a2a' },
  M: { label: 'Multicolor', short: 'M', hex: '#c9a227', ink: '#1a1200' },
}

export const PRIMARY_TYPE_ORDER: PrimaryType[] = [
  'Creature',
  'Planeswalker',
  'Artifact',
  'Enchantment',
  'Instant',
  'Sorcery',
  'Battle',
  'Land',
  'Other',
]

const TYPE_PATTERNS: { type: PrimaryType; re: RegExp }[] = [
  { type: 'Planeswalker', re: /\bPlaneswalker\b/i },
  { type: 'Battle', re: /\bBattle\b/i },
  { type: 'Land', re: /\bLand\b/i },
  { type: 'Creature', re: /\bCreature\b/i },
  { type: 'Instant', re: /\bInstant\b/i },
  { type: 'Sorcery', re: /\bSorcery\b/i },
  { type: 'Artifact', re: /\bArtifact\b/i },
  { type: 'Enchantment', re: /\bEnchantment\b/i },
]

export function getPrimaryType(typeLine: string): PrimaryType {
  const front = typeLine.split('//')[0].trim()
  for (const { type, re } of TYPE_PATTERNS) {
    if (re.test(front)) return type
  }
  return 'Other'
}

export function getSubtypes(typeLine: string): string[] {
  const front = typeLine.split('//')[0].trim()
  const parts = front.split(/[—–-]/).map((p) => p.trim())
  if (parts.length < 2) return []
  return parts[1]
    .split(/\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
}

export function colorGroupKey(colorIdentity: string[]): string {
  if (!colorIdentity.length) return 'C'
  if (colorIdentity.length === 1) return colorIdentity[0]
  return 'M'
}

export function colorGroupLabel(key: string): string {
  return COLOR_META[key]?.label ?? key
}

/** La carta cabe en la identidad del comandante (subset). */
export function fitsColorIdentity(card: Card, commanderIdentity: string[]): boolean {
  return card.colorIdentity.every((c) => commanderIdentity.includes(c))
}

export function isPotentialCommander(card: Card): boolean {
  if (!card.commanderLegal) return false
  const tl = card.typeLine
  if (/\bLegendary\b/i.test(tl) && /\bCreature\b/i.test(tl)) return true
  if (/can be your commander/i.test(card.oracleText ?? '')) return true
  return false
}

function collectionPath(rel: string | undefined | null): string {
  if (!rel) return ''
  return `/collection/${rel.replace(/^\/+/, '')}`
}

/** Imagen para rejillas / miniaturas: normal local. */
export function imageUrl(card: Card): string {
  return (
    collectionPath(card.images?.local) ||
    card.images?.normal ||
    card.images?.small ||
    ''
  )
}

/** Imagen de detalle: PNG HQ local, o fallback a large/normal. */
export function detailImageUrl(card: Card): string {
  return (
    collectionPath(card.images?.localHq) ||
    card.images?.png ||
    card.images?.large ||
    collectionPath(card.images?.local) ||
    card.images?.normal ||
    ''
  )
}

export function artUrl(card: Card): string {
  return card.images?.art || detailImageUrl(card)
}

export function rarityLabel(rarity: string): string {
  const map: Record<string, string> = {
    common: 'Común',
    uncommon: 'Infrecuente',
    rare: 'Rara',
    mythic: 'Mítica',
    special: 'Especial',
  }
  return map[rarity] ?? rarity
}

export function languageLabel(lang: string): string {
  return lang === 'es' ? 'Español' : lang === 'en' ? 'Inglés' : lang
}

export function identityString(colors: string[]): string {
  if (!colors.length) return 'C'
  return [...colors].sort((a, b) => 'WUBRG'.indexOf(a) - 'WUBRG'.indexOf(b)).join('')
}

export function uniqueByName(cards: Card[]): Card[] {
  const seen = new Set<string>()
  const out: Card[] = []
  for (const card of cards) {
    const key = card.name.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(card)
  }
  return out
}
