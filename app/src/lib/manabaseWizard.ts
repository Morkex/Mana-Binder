import type { Card } from '../types'
import { isBasicLand, resolveVirtualBasicFromId } from './basicLands'
import { getPrimaryType } from './mtg'

const BASIC_BY_COLOR: Record<string, string> = {
  W: 'Plains',
  U: 'Island',
  B: 'Swamp',
  R: 'Mountain',
  G: 'Forest',
}

function countPips(cards: Card[]): Record<string, number> {
  const pips: Record<string, number> = { W: 0, U: 0, B: 0, R: 0, G: 0 }
  for (const card of cards) {
    if (getPrimaryType(card.typeLine) === 'Land') continue
    const re = /\{([^}]+)\}/g
    let m: RegExpExecArray | null
    while ((m = re.exec(card.manaCost ?? ''))) {
      for (const c of ['W', 'U', 'B', 'R', 'G']) {
        if (m[1].includes(c)) pips[c] += 1
      }
    }
  }
  return pips
}

export interface ManabasePlan {
  targetLands: number
  currentLands: number
  toAdd: number
  basics: { name: string; count: number }[]
  suggestedNonbasics: Card[]
  summary: string[]
}

/**
 * Propone manabase: nonbasics owned + resto en básicas según pips.
 */
export function planManabase(params: {
  commander: Card
  deck: Card[]
  collection: Card[]
  targetLands?: number
}): ManabasePlan {
  const { commander, deck, collection } = params
  const all = [commander, ...deck]
  const nonLands = all.filter((c) => getPrimaryType(c.typeLine) !== 'Land')
  const currentLands = all.filter((c) => getPrimaryType(c.typeLine) === 'Land').length
  const avgCmc =
    nonLands.length === 0 ? 3 : nonLands.reduce((s, c) => s + c.cmc, 0) / nonLands.length
  const targetLands = params.targetLands ?? (avgCmc >= 3.5 ? 37 : avgCmc <= 2.8 ? 35 : 36)

  const identity = commander.colorIdentity
  const pips = countPips(all)
  const totalPips = identity.reduce((s, c) => s + (pips[c] ?? 0), 0) || 1

  const ownedNonbasics = collection.filter(
    (c) =>
      getPrimaryType(c.typeLine) === 'Land' &&
      !isBasicLand(c) &&
      (c.colorIdentity.length === 0 ||
        c.colorIdentity.every((col) => identity.includes(col))) &&
      !deck.some((d) => d.id === c.id) &&
      c.id !== commander.id,
  )

  const suggestedNonbasics = [...ownedNonbasics]
    .sort((a, b) => {
      const sa = a.colorIdentity.filter((c) => identity.includes(c)).length
      const sb = b.colorIdentity.filter((c) => identity.includes(c)).length
      return sb - sa || a.cmc - b.cmc
    })
    .slice(0, Math.min(12, Math.max(0, targetLands - currentLands)))

  const afterNonbasic = currentLands + suggestedNonbasics.length
  const basicsNeeded = Math.max(0, targetLands - afterNonbasic)

  const basics: { name: string; count: number }[] = []
  if (identity.length === 0) {
    basics.push({ name: 'Wastes', count: basicsNeeded })
  } else {
    let remaining = basicsNeeded
    const shares = identity.map((c) => ({
      color: c,
      name: BASIC_BY_COLOR[c] ?? 'Wastes',
      weight: (pips[c] ?? 1) / totalPips,
    }))
    for (let i = 0; i < shares.length; i++) {
      const isLast = i === shares.length - 1
      const count = isLast ? remaining : Math.max(0, Math.round(shares[i].weight * basicsNeeded))
      const use = Math.min(remaining, count)
      if (use > 0) basics.push({ name: shares[i].name, count: use })
      remaining -= use
    }
    if (remaining > 0 && basics.length) basics[0].count += remaining
    else if (remaining > 0) basics.push({ name: shares[0]?.name ?? 'Wastes', count: remaining })
  }

  const summary = [
    `Objetivo ~${targetLands} tierras (ahora ${currentLands}).`,
    suggestedNonbasics.length
      ? `Añadir ${suggestedNonbasics.length} nonbasics de tu colección.`
      : 'No hay nonbasics claras pendientes en colección.',
    basics.map((b) => `${b.count} ${b.name}`).join(' · ') || 'Sin básicas extra',
  ]

  return {
    targetLands,
    currentLands,
    toAdd: Math.max(0, targetLands - currentLands),
    basics,
    suggestedNonbasics,
    summary,
  }
}

export function applyManabasePlan(
  deck: Card[],
  plan: ManabasePlan,
  collection: Card[],
): Card[] {
  const cards = [...deck, ...plan.suggestedNonbasics]
  const basicCards: Card[] = []
  let n = 0
  for (const b of plan.basics) {
    for (let i = 0; i < b.count; i++) {
      n += 1
      const slug = b.name.toLowerCase()
      const card =
        resolveVirtualBasicFromId(`virtual-basic-${slug}-${n}`, collection) ??
        resolveVirtualBasicFromId(`virtual-basic-${slug}`, collection)
      if (card) basicCards.push({ ...card, id: `virtual-basic-${slug}-${n}` })
    }
  }
  return [...cards, ...basicCards]
}
