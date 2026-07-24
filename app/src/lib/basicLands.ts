import type { Card } from '../types'

export const BASIC_LAND_BY_COLOR: Record<string, string> = {
  W: 'Plains',
  U: 'Island',
  B: 'Swamp',
  R: 'Mountain',
  G: 'Forest',
  C: 'Wastes',
}

export const BASIC_LAND_NAMES = new Set(Object.values(BASIC_LAND_BY_COLOR))

const BASIC_TYPE_LINE: Record<string, string> = {
  Plains: 'Basic Land — Plains',
  Island: 'Basic Land — Island',
  Swamp: 'Basic Land — Swamp',
  Mountain: 'Basic Land — Mountain',
  Forest: 'Basic Land — Forest',
  Wastes: 'Basic Land',
}

const BASIC_ORACLE: Record<string, string> = {
  Plains: '({T}: Add {W}.)',
  Island: '({T}: Add {U}.)',
  Swamp: '({T}: Add {B}.)',
  Mountain: '({T}: Add {R}.)',
  Forest: '({T}: Add {G}.)',
  Wastes: '{T}: Add {C}.',
}

const BASIC_COLOR: Record<string, string[]> = {
  Plains: ['W'],
  Island: ['U'],
  Swamp: ['B'],
  Mountain: ['R'],
  Forest: ['G'],
  Wastes: [],
}

/** Scryfall CDN fallbacks if the collection has no basic art. */
const BASIC_IMAGE_FALLBACK: Record<string, string> = {
  Plains: 'https://cards.scryfall.io/normal/front/9/c/9ca16bd5-e261-4229-a92d-7cd55654dd11.jpg',
  Island: 'https://cards.scryfall.io/normal/front/b/0/b0da67fb-1cb2-4105-ab5c-b7c680b8116c.jpg',
  Swamp: 'https://cards.scryfall.io/normal/front/1/d/1dd4d605-02a2-4183-b191-0bca8dfbf962.jpg',
  Mountain: 'https://cards.scryfall.io/normal/front/2/9/295b92bc-d66f-45d8-9bbe-5f5f13e39fd4.jpg',
  Forest: 'https://cards.scryfall.io/normal/front/8/0/8097c9ce-8fe9-4150-9810-52f6c92c6099.jpg',
  Wastes: 'https://cards.scryfall.io/normal/front/0/7/07eb4805-4ce2-4e1b-a8d3-6d040d5a4c3e.jpg',
}

export function isBasicLandName(name: string): boolean {
  return BASIC_LAND_NAMES.has(name)
}

export function isBasicLand(card: Card): boolean {
  return isBasicLandName(card.name) || /\bBasic\b/i.test(card.typeLine)
}

export function basicNamesForIdentity(colorIdentity: string[]): string[] {
  const colors = colorIdentity.filter((c) => c in BASIC_LAND_BY_COLOR)
  if (!colors.length) return ['Wastes']
  return colors.map((c) => BASIC_LAND_BY_COLOR[c])
}

function virtualBasic(name: string, template?: Card): Card {
  const img = template?.images?.normal || BASIC_IMAGE_FALLBACK[name]
  const local = template?.images?.local
  const localHq = template?.images?.localHq
  return {
    id: `virtual-basic-${name.toLowerCase()}`,
    manaboxId: `virtual-basic-${name.toLowerCase()}`,
    name,
    setCode: template?.setCode ?? 'BASIC',
    setName: template?.setName ?? 'Basic Lands (unlimited)',
    collectorNumber: template?.collectorNumber ?? '0',
    foil: false,
    rarity: 'common',
    quantity: 9999,
    condition: 'NM',
    language: 'en',
    purchasePrice: 0,
    currency: 'EUR',
    colors: [],
    colorIdentity: BASIC_COLOR[name] ?? [],
    typeLine: BASIC_TYPE_LINE[name] ?? 'Basic Land',
    manaCost: '',
    cmc: 0,
    oracleText: BASIC_ORACLE[name] ?? '',
    power: null,
    toughness: null,
    loyalty: null,
    keywords: [],
    commanderLegal: true,
    images: {
      normal: img,
      large: img,
      small: img,
      local,
      localHq,
      art: template?.images?.art,
    },
  }
}

/** One template card per basic available for the commander's identity (infinite supply). */
export function getBasicLandTemplates(colorIdentity: string[], pool: Card[] = []): Card[] {
  const byName = new Map<string, Card>()
  for (const card of pool) {
    if (isBasicLandName(card.name) && !byName.has(card.name)) byName.set(card.name, card)
  }
  return basicNamesForIdentity(colorIdentity).map((name) => virtualBasic(name, byName.get(name)))
}

/**
 * Merge unlimited basics into a deckbuilding pool (one entry each for UI / scoring).
 * Existing unique basics from the collection are replaced by the unlimited templates.
 */
export function withUnlimitedBasics(pool: Card[], colorIdentity: string[]): Card[] {
  const withoutBasics = pool.filter((c) => !isBasicLandName(c.name))
  return [...withoutBasics, ...getBasicLandTemplates(colorIdentity, pool)]
}

/** Create N basic land copies, distributed across the identity colors. */
export function makeBasicLandCopies(
  colorIdentity: string[],
  count: number,
  pool: Card[] = [],
): Card[] {
  if (count <= 0) return []
  const templates = getBasicLandTemplates(colorIdentity, pool)
  if (!templates.length) return []

  const out: Card[] = []
  for (let i = 0; i < count; i++) {
    const template = templates[i % templates.length]
    out.push({
      ...template,
      id: `${template.id}-${i + 1}`,
      manaboxId: `${template.manaboxId}-${i + 1}`,
    })
  }
  return out
}

const BASIC_NAME_BY_SLUG: Record<string, string> = {
  plains: 'Plains',
  island: 'Island',
  swamp: 'Swamp',
  mountain: 'Mountain',
  forest: 'Forest',
  wastes: 'Wastes',
}

/**
 * Rebuild a virtual basic from an id like `virtual-basic-swamp` / `virtual-basic-swamp-3`
 * with correct art (never reuse another card's images).
 */
export function resolveVirtualBasicFromId(id: string, pool: Card[] = []): Card | undefined {
  const m = id.match(/virtual-basic-([a-z]+)/i)
  if (!m) return undefined
  const name = BASIC_NAME_BY_SLUG[m[1].toLowerCase()]
  if (!name) return undefined

  const byName = new Map<string, Card>()
  for (const card of pool) {
    if (isBasicLandName(card.name) && !byName.has(card.name)) byName.set(card.name, card)
  }
  const card = virtualBasic(name, byName.get(name))
  return { ...card, id, manaboxId: id }
}

/** Count copies of each card name (for lists / export). */
export function countByName(cards: Card[]): { name: string; count: number; card: Card }[] {
  const map = new Map<string, { name: string; count: number; card: Card }>()
  for (const card of cards) {
    const key = card.name
    const prev = map.get(key)
    if (prev) prev.count += 1
    else map.set(key, { name: key, count: 1, card })
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, 'en'))
}
