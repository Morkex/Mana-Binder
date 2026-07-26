import type { Card } from '../types'
import { detectCardRoles, type CardRole } from './cardRoles'
import { buildCommanderProfile } from './commanderProfile'
import { fitsColorIdentity, isPotentialCommander } from './mtg'
import { synergyScore } from './commanderProfile'

const CORE_ROLES: CardRole[] = ['ramp', 'draw', 'removal', 'wipe', 'protection', 'tutor']

function countRoleCoverage(pool: Card[]): number {
  const have = new Set<CardRole>()
  for (const c of pool) {
    for (const r of detectCardRoles(c)) {
      if (CORE_ROLES.includes(r)) have.add(r)
    }
  }
  return have.size / CORE_ROLES.length
}

function countCoreHits(pool: Card[]): { owned: number; total: number } {
  let owned = 0
  for (const role of CORE_ROLES) {
    if (pool.some((c) => detectCardRoles(c).includes(role))) owned += 1
  }
  return { owned, total: CORE_ROLES.length }
}

export interface CommanderSuitability {
  commander: Card
  score: number
  poolSize: number
  synergistic: number
  roleCoverage: number
  coreOwned: number
  coreTotal: number
  reasons: string[]
  /** Boost 0–15 por overlap colección ↔ top EDHREC (si se ha cargado). */
  edhrecBoost?: number
}

/**
 * Puntúa comandantes de la colección según soporte del inventario (sin red).
 * Pasa `edhrecBoost` (0–15) si ya tienes meta del comandante.
 */
export function scoreCommanderSuitability(
  commander: Card,
  collection: Card[],
  opts?: { edhrecBoost?: number },
): CommanderSuitability {
  const identity = commander.colorIdentity
  const pool = collection.filter(
    (c) => c.id !== commander.id && fitsColorIdentity(c, identity),
  )
  const profile = buildCommanderProfile(commander)

  let synergistic = 0
  for (const c of pool) {
    if (synergyScore(c, profile) >= 8) synergistic += 1
  }

  const roleCoverage = countRoleCoverage(pool)
  const core = countCoreHits(pool)
  const edhrecBoost = Math.max(0, Math.min(15, opts?.edhrecBoost ?? 0))

  // Heurística 0–100 (+ boost EDHREC opcional)
  const poolScore = Math.min(40, pool.length / 8)
  const synScore = Math.min(30, synergistic / 1.2)
  const roleScore = roleCoverage * 20
  const coreScore = (core.owned / core.total) * 10
  const score = Math.round(Math.min(100, poolScore + synScore + roleScore + coreScore + edhrecBoost))

  const reasons: string[] = [
    `${pool.length} cartas legales en identidad`,
    `${synergistic} con sinergia notable`,
    `Roles core ${core.owned}/${core.total}`,
  ]
  if (edhrecBoost > 0) reasons.push(`+${edhrecBoost} meta EDHREC (owned overlap)`)
  if (roleCoverage >= 0.85) reasons.push('Buena cobertura de roles')
  if (pool.length < 60) reasons.push('Pool pequeño — mazo corto de opciones')

  return {
    commander,
    score,
    poolSize: pool.length,
    synergistic,
    roleCoverage,
    coreOwned: core.owned,
    coreTotal: core.total,
    reasons,
    edhrecBoost: edhrecBoost || undefined,
  }
}

/** % de las top N cartas EDHREC que tienes → boost 0–15. */
export function edhrecOwnedBoost(
  edhrecCards: { name: string }[],
  collection: Card[],
  topN = 40,
): number {
  const owned = new Set(collection.map((c) => c.name.split('//')[0].trim().toLowerCase()))
  const top = edhrecCards.slice(0, topN)
  if (!top.length) return 0
  let hits = 0
  for (const c of top) {
    if (owned.has(c.name.split('//')[0].trim().toLowerCase())) hits += 1
  }
  return Math.round((hits / top.length) * 15)
}

export function rankCommanders(collection: Card[], limit = 40): CommanderSuitability[] {
  const commanders = collection.filter(isPotentialCommander)
  const ranked = commanders
    .map((c) => scoreCommanderSuitability(c, collection))
    .sort((a, b) => b.score - a.score || b.poolSize - a.poolSize)
  return ranked.slice(0, limit)
}
