import type { Card, SavedDeck } from '../types'
import type { DeckHealth } from './deckHealth'
import { isBasicLand } from './basicLands'

export interface SnapshotHealthDetail {
  lands: number
  avgCmc: number
  gaps: number
  ownedPct: number
  roles: Record<string, number>
}

export interface DeckSnapshot {
  id: string
  label: string
  createdAt: string
  cardIds: string[]
  commanderId: string
  healthSummary?: SnapshotHealthDetail
}

export interface SnapshotCompare {
  added: string[]
  removed: string[]
  aCount: number
  bCount: number
  roleDiffs: { key: string; a: number; b: number; delta: number }[]
  ownedPctA: number | null
  ownedPctB: number | null
}

const KEY = 'mana-binder-deck-versions'

function loadAll(): Record<string, DeckSnapshot[]> {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as Record<string, DeckSnapshot[]>) : {}
  } catch {
    return {}
  }
}

function saveAll(data: Record<string, DeckSnapshot[]>) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data))
  } catch {
    /* quota */
  }
}

export function listDeckVersions(deckId: string): DeckSnapshot[] {
  return loadAll()[deckId] ?? []
}

export function buildHealthDetail(
  health: DeckHealth,
  cards: Card[],
  collectionIds?: Set<string>,
): SnapshotHealthDetail {
  const roles: Record<string, number> = Object.fromEntries(
    health.rows.map((r) => [r.key, r.count]),
  )

  let ownedPct = 100
  if (collectionIds && cards.length) {
    const owned = cards.filter((c) => collectionIds.has(c.id) || isBasicLand(c)).length
    ownedPct = Math.round((owned / cards.length) * 100)
  }

  return {
    lands: health.lands,
    avgCmc: health.avgCmc,
    gaps: health.gaps.length,
    ownedPct,
    roles,
  }
}

export function saveDeckVersion(
  deck: SavedDeck,
  label?: string,
  health?: DeckHealth,
  detail?: SnapshotHealthDetail,
): DeckSnapshot {
  const all = loadAll()
  const snap: DeckSnapshot = {
    id: crypto.randomUUID(),
    label: label ?? `v${(all[deck.id]?.length ?? 0) + 1}`,
    createdAt: new Date().toISOString(),
    cardIds: [...deck.cardIds],
    commanderId: deck.commanderId,
    healthSummary: detail
      ? detail
      : health
        ? {
            lands: health.lands,
            avgCmc: health.avgCmc,
            gaps: health.gaps.length,
            ownedPct: 100,
            roles: Object.fromEntries(health.rows.map((r) => [r.key, r.count])),
          }
        : undefined,
  }
  const list = [snap, ...(all[deck.id] ?? [])].slice(0, 20)
  all[deck.id] = list
  saveAll(all)
  return snap
}

export function compareSnapshots(a: DeckSnapshot, b: DeckSnapshot): SnapshotCompare {
  const setA = new Set(a.cardIds)
  const setB = new Set(b.cardIds)
  const rolesA = a.healthSummary?.roles ?? {}
  const rolesB = b.healthSummary?.roles ?? {}
  const keys = new Set([...Object.keys(rolesA), ...Object.keys(rolesB)])
  const roleDiffs = [...keys]
    .map((key) => {
      const av = rolesA[key] ?? 0
      const bv = rolesB[key] ?? 0
      return { key, a: av, b: bv, delta: bv - av }
    })
    .filter((r) => r.delta !== 0)
    .sort((x, y) => Math.abs(y.delta) - Math.abs(x.delta))

  return {
    added: b.cardIds.filter((id) => !setA.has(id)),
    removed: a.cardIds.filter((id) => !setB.has(id)),
    aCount: a.cardIds.length,
    bCount: b.cardIds.length,
    roleDiffs,
    ownedPctA: a.healthSummary?.ownedPct ?? null,
    ownedPctB: b.healthSummary?.ownedPct ?? null,
  }
}
