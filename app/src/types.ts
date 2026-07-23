export type ColorCode = 'W' | 'U' | 'B' | 'R' | 'G'

export interface CardImages {
  small?: string
  normal?: string
  large?: string
  png?: string
  art?: string
  /** Ruta local Scryfall normal (grid). */
  local?: string
  /** Ruta local Scryfall png (detalle / máxima calidad). */
  localHq?: string
}

export interface CardFaceData {
  name: string
  typeLine: string
  manaCost: string
  oracleText: string
  power: string | null
  toughness: string | null
  loyalty: string | null
  images: CardImages
}

export interface Card {
  id: string
  manaboxId: string
  name: string
  setCode: string
  setName: string
  collectorNumber: string
  foil: boolean
  rarity: string
  quantity: number
  condition: string
  language: string
  purchasePrice: number
  currency: string
  colors: string[]
  colorIdentity: string[]
  typeLine: string
  manaCost: string
  cmc: number
  oracleText: string
  power: string | null
  toughness: string | null
  loyalty: string | null
  keywords: string[]
  commanderLegal: boolean
  images: CardImages
  /** Scryfall layout: transform, adventure, modal_dfc, etc. */
  layout?: string
  /** Per-face data when the card has multiple faces. */
  faces?: CardFaceData[]
}

export interface CollectionMaster {
  version: number
  source: string
  totalEntries: number
  totalQuantity: number
  uniqueCards: number
  colorGroups: Record<string, number>
  cards: Card[]
}

export type PrimaryType =
  | 'Creature'
  | 'Planeswalker'
  | 'Artifact'
  | 'Enchantment'
  | 'Instant'
  | 'Sorcery'
  | 'Battle'
  | 'Land'
  | 'Other'

export interface DeckEntry {
  card: Card
  quantity: number
}

export interface SavedDeck {
  id: string
  name: string
  commanderId: string
  cardIds: string[]
  notes?: string
  updatedAt: string
}
