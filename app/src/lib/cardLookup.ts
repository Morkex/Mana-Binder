import type { Card } from '../types'

export function normalizeCardName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/['']/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

export function buildCardIndexes(cards: Card[]): {
  byLower: Map<string, Card>
  byNorm: Map<string, Card>
  all: Card[]
} {
  const byLower = new Map<string, Card>()
  const byNorm = new Map<string, Card>()
  for (const card of cards) {
    byLower.set(card.name.toLowerCase(), card)
    const norm = normalizeCardName(card.name)
    if (!byNorm.has(norm)) byNorm.set(norm, card)
    const front = normalizeCardName(card.name.split('//')[0] ?? card.name)
    if (front && !byNorm.has(front)) byNorm.set(front, card)
  }
  return { byLower, byNorm, all: cards }
}

export function findCardByName(
  rawName: string,
  indexes: ReturnType<typeof buildCardIndexes>,
): Card | undefined {
  const trimmed = rawName.trim()
  if (!trimmed) return undefined

  const exact = indexes.byLower.get(trimmed.toLowerCase())
  if (exact) return exact

  const norm = normalizeCardName(trimmed)
  const byNorm = indexes.byNorm.get(norm)
  if (byNorm) return byNorm

  const front = normalizeCardName(trimmed.split('//')[0] ?? trimmed)
  const byFront = indexes.byNorm.get(front)
  if (byFront) return byFront

  const partial = indexes.all.filter((card) => {
    const cn = normalizeCardName(card.name)
    return cn === norm || cn.startsWith(`${norm} `) || norm.startsWith(cn)
  })
  if (partial.length === 1) return partial[0]

  return undefined
}
