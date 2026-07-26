import type { Card, SavedDeck } from '../types'
import { isBasicLand } from './basicLands'

export type OwnershipStatus = 'owned' | 'owned_elsewhere' | 'missing'

export interface OwnershipInfo {
  status: OwnershipStatus
  /** Copias en la colección (ManaBox quantity). */
  quantity: number
  /** Nombres de mazos guardados que ya usan esta carta (por nombre, no basics). */
  usedInDecks: string[]
  label: string
}

function normName(name: string): string {
  return name.split('//')[0].trim().toLowerCase()
}

/** Índice de ownership a partir de colección + mazos guardados. */
export function buildOwnershipIndex(cards: Card[], savedDecks: SavedDeck[]) {
  const byId = new Map<string, Card>()
  const byName = new Map<string, Card>()
  for (const c of cards) {
    byId.set(c.id, c)
    const key = normName(c.name)
    if (!byName.has(key)) byName.set(key, c)
  }

  /** name → deck names using it */
  const decksByCardName = new Map<string, string[]>()
  for (const deck of savedDecks) {
    const seen = new Set<string>()
    for (const id of deck.cardIds) {
      const card = byId.get(id)
      if (!card || isBasicLand(card)) continue
      const key = normName(card.name)
      if (seen.has(key)) continue
      seen.add(key)
      const list = decksByCardName.get(key) ?? []
      list.push(deck.name)
      decksByCardName.set(key, list)
    }
    // commander
    const cmd = byId.get(deck.commanderId)
    if (cmd) {
      const key = normName(cmd.name)
      const list = decksByCardName.get(key) ?? []
      if (!list.includes(deck.name)) {
        list.push(deck.name)
        decksByCardName.set(key, list)
      }
    }
  }

  return { byId, byName, decksByCardName }
}

export type OwnershipIndex = ReturnType<typeof buildOwnershipIndex>

export function getOwnership(
  index: OwnershipIndex,
  cardOrName: Card | string,
  opts?: { excludeDeckName?: string },
): OwnershipInfo {
  const name = typeof cardOrName === 'string' ? cardOrName : cardOrName.name
  const key = normName(name)
  const card =
    typeof cardOrName === 'string' ? index.byName.get(key) : index.byId.get(cardOrName.id) ?? index.byName.get(key)

  const quantity = card?.quantity ?? 0
  let usedInDecks = index.decksByCardName.get(key) ?? []
  if (opts?.excludeDeckName) {
    const skip = opts.excludeDeckName.toLowerCase()
    usedInDecks = usedInDecks.filter((d) => d.toLowerCase() !== skip)
  }

  if (quantity <= 0 && !card) {
    return { status: 'missing', quantity: 0, usedInDecks: [], label: '✘ No tengo' }
  }
  if (quantity <= 0) {
    return { status: 'missing', quantity: 0, usedInDecks, label: '✘ No tengo' }
  }
  // Si hay más copias que mazos que la usan, sigue disponible.
  if (usedInDecks.length > 0 && usedInDecks.length >= quantity) {
    return {
      status: 'owned_elsewhere',
      quantity,
      usedInDecks,
      label: `⚠ Tengo ${quantity} · en uso: ${usedInDecks.slice(0, 2).join(', ')}${usedInDecks.length > 2 ? '…' : ''}`,
    }
  }
  if (usedInDecks.length > 0) {
    return {
      status: 'owned',
      quantity,
      usedInDecks,
      label: `✔ Tengo ${quantity} · también en ${usedInDecks.slice(0, 2).join(', ')}`,
    }
  }
  return { status: 'owned', quantity, usedInDecks: [], label: `✔ Tengo ${quantity}` }
}

export function ownershipByName(
  cards: Card[],
  savedDecks: SavedDeck[],
  name: string,
): OwnershipInfo {
  return getOwnership(buildOwnershipIndex(cards, savedDecks), name)
}
