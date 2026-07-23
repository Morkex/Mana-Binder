import type { Card } from '../types'
import type { Bracket } from './brackets'
import {
  buildCommanderProfile,
  type CommanderProfile,
  synergyBreakdown,
} from './commanderProfile'
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

/** Detección de roles más estricta (evita falsos positivos). */
export function detectRoles(card: Card): string[] {
  const type = getPrimaryType(card.typeLine)
  const text = card.oracleText
  const name = card.name
  const roles: string[] = []

  if (type === 'Land') {
    roles.push('land')
    return roles
  }

  if (
    /\{T\}: add|adds? \{[WUBRGC0-9/]+\}|search your library for (a |up to \w+ )?basic land|search your library for .{0,40}land card|sol ring|arcane signet|cultivate|kodama's reach|rampant growth|farseek|nature's lore|three visits/i.test(
      `${text} ${name}`,
    )
  ) {
    roles.push('ramp')
  }

  if (
    /draw (a|one|two|three) cards?|draw x cards|scry [2-9]|investigate/i.test(text) &&
    !/whenever .* deals combat damage.*draw/i.test(text)
  ) {
    roles.push('draw')
  }

  if (
    /destroy target (creature|permanent|artifact|enchantment)|exile target (creature|permanent)|counter target (spell|activated|triggered)|deal \d+ damage to (any target|target creature|target player)/i.test(
      text,
    )
  ) {
    roles.push('removal')
  }

  if (/destroy all creatures|each creature|all creatures get|wrath|day of judgment|damnation|blasphemous act/i.test(text)) {
    roles.push('wipe')
  }

  if (type === 'Creature') roles.push('creature')
  if (type === 'Planeswalker') roles.push('planeswalker')
  if (type === 'Artifact' && !roles.includes('ramp')) roles.push('artifact')
  if (type === 'Enchantment') roles.push('enchantment')

  return roles
}

export function isRamp(card: Card): boolean {
  return detectRoles(card).includes('ramp')
}

export function isDraw(card: Card): boolean {
  return detectRoles(card).includes('draw')
}

export function isInteraction(card: Card): boolean {
  const roles = detectRoles(card)
  return roles.includes('removal') || roles.includes('wipe')
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

/**
 * Puntuación revisada:
 * - Sin foil ni precio de compra
 * - Rareza con poco peso
 * - Planeswalkers sin bonus extra (solo si tienen utilidad/sinergia real)
 * - Roles más estrictos
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
  const roles = detectRoles(card)
  const synInfo = synergyBreakdown(card, prof)

  let utility = 0
  if (roles.includes('ramp')) utility += 12
  if (roles.includes('draw')) utility += 9
  if (roles.includes('removal')) utility += 10
  if (roles.includes('wipe')) utility += 6
  if (roles.includes('creature') && synInfo.total > 0) utility += 2
  if (roles.includes('land')) utility += 4

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
