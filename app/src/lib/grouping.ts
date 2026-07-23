import type { Card, PrimaryType } from '../types'
import {
  PRIMARY_TYPE_ORDER,
  colorGroupKey,
  colorGroupLabel,
  getPrimaryType,
  getSubtypes,
} from './mtg'

export interface SubtypeGroup {
  subtype: string
  cards: Card[]
}

export interface TypeGroup {
  type: PrimaryType
  cards: Card[]
  subtypes: SubtypeGroup[]
}

export interface ColorSection {
  key: string
  label: string
  cards: Card[]
  types: TypeGroup[]
}

function buildTypeGroups(cards: Card[]): TypeGroup[] {
  const byType = new Map<PrimaryType, Card[]>()
  for (const card of cards) {
    const t = getPrimaryType(card.typeLine)
    if (!byType.has(t)) byType.set(t, [])
    byType.get(t)!.push(card)
  }

  return PRIMARY_TYPE_ORDER.filter((t) => byType.has(t)).map((type) => {
    const typeCards = byType.get(type)!.slice().sort((a, b) => a.name.localeCompare(b.name, 'es'))
    const bySubtype = new Map<string, Card[]>()

    for (const card of typeCards) {
      const subs = getSubtypes(card.typeLine)
      const key = subs.length ? subs.join(' ') : 'Sin subtipo'
      if (!bySubtype.has(key)) bySubtype.set(key, [])
      bySubtype.get(key)!.push(card)
    }

    const subtypes: SubtypeGroup[] = [...bySubtype.entries()]
      .sort(([a], [b]) => {
        if (a === 'Sin subtipo') return 1
        if (b === 'Sin subtipo') return -1
        return a.localeCompare(b, 'es')
      })
      .map(([subtype, list]) => ({ subtype, cards: list }))

    return { type, cards: typeCards, subtypes }
  })
}

/** Orden de secciones de color respetando la identidad del comandante. */
export function groupCardsByColorThenType(
  cards: Card[],
  preferredColors: string[] = [],
): ColorSection[] {
  const byColor = new Map<string, Card[]>()

  for (const card of cards) {
    const key = colorGroupKey(card.colorIdentity)
    if (!byColor.has(key)) byColor.set(key, [])
    byColor.get(key)!.push(card)
  }

  const order: string[] = []
  const preferredSorted = [...preferredColors].sort(
    (a, b) => 'WUBRG'.indexOf(a) - 'WUBRG'.indexOf(b),
  )
  for (const c of preferredSorted) {
    if (byColor.has(c) && !order.includes(c)) order.push(c)
  }
  for (const c of ['W', 'U', 'B', 'R', 'G']) {
    if (byColor.has(c) && !order.includes(c)) order.push(c)
  }
  if (byColor.has('M')) order.push('M')
  if (byColor.has('C')) order.push('C')

  for (const key of byColor.keys()) {
    if (!order.includes(key)) order.push(key)
  }

  return order.map((key) => {
    const list = byColor.get(key) ?? []
    return {
      key,
      label: colorGroupLabel(key),
      cards: list,
      types: buildTypeGroups(list),
    }
  })
}
