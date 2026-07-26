import type { Card } from '../types'
import { detectCardRoles, type CardRole, CARD_ROLES } from './cardRoles'
import { fitsColorIdentity } from './mtg'
import { getPrimaryType } from './mtg'

/**
 * Query estilo VSCode: `t:ramp owned mv<=3 ci<=wg`
 */
export function parseCardQuery(input: string): {
  text: string
  roles: CardRole[]
  maxCmc: number | null
  minCmc: number | null
  ownedOnly: boolean
  colorIdentity: string[] | null
} {
  const tokens = input.trim().split(/\s+/).filter(Boolean)
  const roles: CardRole[] = []
  let text = ''
  let maxCmc: number | null = null
  let minCmc: number | null = null
  let ownedOnly = false
  let colorIdentity: string[] | null = null

  for (const t of tokens) {
    const lower = t.toLowerCase()
    if (lower === 'owned') {
      ownedOnly = true
      continue
    }
    if (lower.startsWith('t:') || lower.startsWith('role:')) {
      const role = lower.split(':')[1] as CardRole
      if ((CARD_ROLES as readonly string[]).includes(role)) roles.push(role)
      continue
    }
    if (lower.startsWith('mv<=') || lower.startsWith('cmc<=')) {
      maxCmc = Number(lower.split('<=')[1])
      continue
    }
    if (lower.startsWith('mv>=') || lower.startsWith('cmc>=')) {
      minCmc = Number(lower.split('>=')[1])
      continue
    }
    if (lower.startsWith('ci<=') || lower.startsWith('ci:')) {
      const raw = lower.split(/ci<=|ci:/)[1] ?? ''
      colorIdentity = raw.toUpperCase().split('').filter((c) => 'WUBRG'.includes(c))
      continue
    }
    text = text ? `${text} ${t}` : t
  }

  return { text, roles, maxCmc, minCmc, ownedOnly, colorIdentity }
}

export function filterCardsByQuery(
  cards: Card[],
  query: string,
  opts?: { ownedIds?: Set<string> },
): Card[] {
  const q = parseCardQuery(query)
  return cards.filter((card) => {
    if (q.ownedOnly && opts?.ownedIds && !opts.ownedIds.has(card.id)) return false
    if (q.maxCmc != null && card.cmc > q.maxCmc) return false
    if (q.minCmc != null && card.cmc < q.minCmc) return false
    if (q.colorIdentity) {
      if (!fitsColorIdentity(card, q.colorIdentity)) return false
    }
    if (q.roles.length) {
      const roles = detectCardRoles(card)
      if (!q.roles.every((r) => roles.includes(r))) return false
    }
    if (q.text) {
      const blob = `${card.name} ${card.typeLine} ${card.oracleText}`.toLowerCase()
      if (!blob.includes(q.text.toLowerCase())) return false
    }
    return true
  })
}

export function cardTypeLabel(card: Card): string {
  return getPrimaryType(card.typeLine)
}
