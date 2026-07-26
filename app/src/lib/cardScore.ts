import type { Card } from '../types'
import type { Bracket } from './brackets'
import {
  buildCommanderProfile,
  type CommanderProfile,
  synergyBreakdown,
} from './commanderProfile'
import { detectCardRoles, hasRole, type CardRole } from './cardRoles'
import { isGameChanger } from './gameChangers'
import { getPrimaryType } from './mtg'

export interface ScoreBreakdown {
  total: number
  synergy: number
  utility: number
  curve: number
  rarity: number
  gameChanger: number
  roles: string[]
  synergyNotes: string[]
}

/** @deprecated Prefer detectCardRoles from cardRoles — kept for callers. */
export function detectRoles(card: Card): string[] {
  return detectCardRoles(card)
}

export function isRamp(card: Card): boolean {
  return hasRole(card, 'ramp')
}

export function isDraw(card: Card): boolean {
  return hasRole(card, 'draw')
}

export function isInteraction(card: Card): boolean {
  return hasRole(card, 'removal') || hasRole(card, 'wipe') || hasRole(card, 'counter')
}

interface BracketWeights {
  synergyWeight: number
  utilityWeight: number
  rarityWeight: number
  preferLowCmc: number
}

const WEIGHTS: Record<Bracket, BracketWeights> = {
  1: { synergyWeight: 1.8, utilityWeight: 0.55, rarityWeight: 0.15, preferLowCmc: 0.5 },
  2: { synergyWeight: 1.45, utilityWeight: 0.85, rarityWeight: 0.25, preferLowCmc: 0.8 },
  3: { synergyWeight: 1.2, utilityWeight: 1.0, rarityWeight: 0.35, preferLowCmc: 1.0 },
  4: { synergyWeight: 0.95, utilityWeight: 1.25, rarityWeight: 0.4, preferLowCmc: 1.35 },
  5: { synergyWeight: 0.8, utilityWeight: 1.4, rarityWeight: 0.45, preferLowCmc: 1.55 },
}

const UTILITY_POINTS: Partial<Record<CardRole, number>> = {
  ramp: 12,
  draw: 9,
  tutor: 8,
  removal: 10,
  wipe: 6,
  counter: 9,
  protection: 7,
  recursion: 5,
  reanimation: 6,
  sac_outlet: 4,
  tokens: 4,
  blink: 4,
  treasure: 5,
  anthem: 4,
  wincon: 5,
  land: 4,
}

/**
 * Puntuación revisada:
 * - Sin foil ni precio de compra
 * - Rareza con poco peso
 * - Planeswalkers sin bonus extra (solo si tienen utilidad/sinergia real)
 * - Roles vía cardRoles (Oracle rules)
 */
export function scoreCardDetailed(
  card: Card,
  commander: Card,
  bracket: Bracket,
  profile?: CommanderProfile,
): ScoreBreakdown {
  const prof = profile ?? buildCommanderProfile(commander)
  const w = WEIGHTS[bracket]
  const type = getPrimaryType(card.typeLine)
  const roles = detectCardRoles(card)
  const synInfo = synergyBreakdown(card, prof)

  let utility = 0
  for (const role of roles) {
    utility += UTILITY_POINTS[role] ?? 0
  }
  if (roles.includes('creature') && synInfo.total > 0) utility += 2

  // Planeswalker: sin bonus por ser PW; solo roles reales arriba
  if (type === 'Planeswalker' && synInfo.total < 10 && utility < 8) {
    utility -= 4
  }

  let rarity = 0
  if (card.rarity === 'mythic') rarity += 3
  else if (card.rarity === 'rare') rarity += 2
  else if (card.rarity === 'uncommon') rarity += 1

  let curve = 0
  if (type !== 'Land') {
    if (card.cmc <= 2) curve += 4 * w.preferLowCmc
    else if (card.cmc <= 3) curve += 2.5 * w.preferLowCmc
    else if (card.cmc <= 4) curve += 1 * w.preferLowCmc
    else if (card.cmc >= 7) curve -= 3 * w.preferLowCmc
    else if (card.cmc >= 6) curve -= 1.5 * w.preferLowCmc
  }

  let gameChanger = 0
  if (isGameChanger(card.name)) {
    if (bracket <= 2) gameChanger = -80
    else if (bracket === 3) gameChanger = 8
    else gameChanger = 14
  }

  // En B1: castiga staples sin sinergia
  let utilityAdj = utility
  if (bracket === 1 && synInfo.total < 10 && utility > 10) {
    utilityAdj *= 0.5
  }

  const synergy = synInfo.total * w.synergyWeight
  const utilPart = utilityAdj * w.utilityWeight
  const rarityPart = rarity * w.rarityWeight
  const total = Math.round((synergy + utilPart + curve + rarityPart + gameChanger) * 10) / 10

  return {
    total,
    synergy: Math.round(synergy * 10) / 10,
    utility: Math.round(utilPart * 10) / 10,
    curve: Math.round(curve * 10) / 10,
    rarity: Math.round(rarityPart * 10) / 10,
    gameChanger,
    roles,
    synergyNotes: synInfo.notes,
  }
}

export function scoreCard(
  card: Card,
  commander: Card,
  bracket: Bracket,
  profile?: CommanderProfile,
): number {
  return scoreCardDetailed(card, commander, bracket, profile).total
}
