import type { Card } from '../types'
import { detectCardRoles, type CardRole } from './cardRoles'
import { fitsColorIdentity } from './mtg'
import { synergyBreakdown, buildCommanderProfile } from './commanderProfile'

const ROLE_PRIORITY: CardRole[] = [
  'tutor',
  'ramp',
  'draw',
  'removal',
  'counter',
  'wipe',
  'protection',
  'reanimation',
  'recursion',
  'sac_outlet',
  'tokens',
  'blink',
  'treasure',
  'anthem',
  'wincon',
]

export interface SubstituteHit {
  card: Card
  sharedRoles: CardRole[]
  score: number
  reasons: string[]
}

/** Alternativas owned con roles solapados + sinergia con el comandante. */
export function findSubstitutes(params: {
  missing: Card | { name: string; roles?: CardRole[]; colorIdentity?: string[] }
  commander: Card
  pool: Card[]
  excludeIds?: Set<string>
  limit?: number
}): SubstituteHit[] {
  const { commander, pool, limit = 8 } = params
  const exclude = params.excludeIds ?? new Set<string>()
  const profile = buildCommanderProfile(commander)

  const targetRoles: CardRole[] =
    'roles' in params.missing && params.missing.roles
      ? params.missing.roles
      : 'oracleText' in params.missing
        ? detectCardRoles(params.missing as Card)
        : ['ramp', 'draw']

  const functional = targetRoles.filter((r) =>
    ROLE_PRIORITY.includes(r),
  )
  const roles = functional.length ? functional : targetRoles

  const hits: SubstituteHit[] = []
  for (const card of pool) {
    if (exclude.has(card.id)) continue
    if (!fitsColorIdentity(card, commander.colorIdentity)) continue
    const cardRoles = detectCardRoles(card)
    const shared = roles.filter((r) => cardRoles.includes(r))
    if (!shared.length) continue
    const syn = synergyBreakdown(card, profile)
    const roleScore = shared.length * 12
    const prio = shared.reduce((s, r) => s + (ROLE_PRIORITY.length - ROLE_PRIORITY.indexOf(r)), 0)
    const score = roleScore + prio + syn.total * 0.4 - card.cmc
    const reasons = [
      `Comparte: ${shared.join(', ')}`,
      ...(syn.notes.slice(0, 2) || []),
    ]
    hits.push({ card, sharedRoles: shared, score, reasons })
  }

  return hits.sort((a, b) => b.score - a.score).slice(0, limit)
}

export function explainCardForCommander(card: Card, commander: Card): string[] {
  const roles = detectCardRoles(card)
  const syn = synergyBreakdown(card, buildCommanderProfile(commander))
  const reasons: string[] = []
  const functional = roles.filter((r) => !['creature', 'artifact', 'enchantment', 'land', 'planeswalker', 'battle'].includes(r))
  if (functional.length) reasons.push(`Roles: ${functional.slice(0, 4).join(', ')}`)
  reasons.push(...syn.notes.slice(0, 2))
  if (!reasons.length) reasons.push('Encaja en la identidad de color del comandante')
  return reasons.slice(0, 3)
}
