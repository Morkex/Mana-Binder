import type { Card } from '../types'
import { findCardByName, buildCardIndexes } from './cardLookup'

export interface EdhrecCardView {
  name: string
  synergy: number
  numDecks: number
  potentialDecks: number
  inclusion: number
  tag: string
  header: string
}

export interface EdhrecCommanderData {
  slug: string
  numDecks: number | null
  similar: string[]
  themes: { name: string; count: number }[]
  cards: EdhrecCardView[]
}

export interface SuggestionRow {
  name: string
  synergy: number
  inclusion: number
  header: string
  inCollection: boolean
  inDeck: boolean
  card?: Card
}

const memoryCache = new Map<string, { at: number; data: EdhrecCommanderData }>()
const CACHE_MS = 1000 * 60 * 60 * 12

export function edhrecSlug(commanderName: string): string {
  return commanderName
    .split('//')[0]
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[''`]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function edhrecBaseUrl(): string {
  // En desarrollo (Vite) siempre proxy local — evita CORS.
  // Electron carga http://localhost:5173; el check por hostname debe incluir localhost.
  if (import.meta.env.DEV) return '/api/edhrec'
  if (typeof window !== 'undefined') {
    const host = window.location.hostname
    if (host === '127.0.0.1' || host === 'localhost') return '/api/edhrec'
  }
  return 'https://json.edhrec.com'
}

function asCardlists(raw: unknown): { header: string; tag: string; cardviews: unknown[] }[] {
  if (!raw || typeof raw !== 'object') return []
  const container = (raw as { container?: { json_dict?: { cardlists?: unknown } } }).container
  const lists = container?.json_dict?.cardlists
  if (!Array.isArray(lists)) return []
  return lists.map((item) => {
    const o = item as { header?: string; tag?: string; cardviews?: unknown[] }
    return {
      header: o.header ?? '',
      tag: o.tag ?? '',
      cardviews: Array.isArray(o.cardviews) ? o.cardviews : [],
    }
  })
}

function parseCommanderPayload(raw: unknown, slug: string): EdhrecCommanderData {
  const obj = raw as {
    similar?: string[]
    tag_counts?: Record<string, number>
    container?: { json_dict?: { card?: { num_decks?: number } } }
  }
  const cardlists = asCardlists(raw)
  const cards: EdhrecCardView[] = []

  for (const list of cardlists) {
    // Skip average deck bulk for UI suggestions; keep high synergy / top / new
    if (!/highsynergy|topcards|newcards|creatures|instants|sorceries|artifacts|enchantments|planeswalkers|battles|utilitylands|manaartifacts/i.test(list.tag)) {
      continue
    }
    for (const view of list.cardviews) {
      const v = view as {
        name?: string
        synergy?: number
        num_decks?: number
        potential_decks?: number
      }
      if (!v.name) continue
      const potential = v.potential_decks ?? 0
      const num = v.num_decks ?? 0
      cards.push({
        name: v.name,
        synergy: typeof v.synergy === 'number' ? v.synergy : 0,
        numDecks: num,
        potentialDecks: potential,
        inclusion: potential > 0 ? num / potential : 0,
        tag: list.tag,
        header: list.header,
      })
    }
  }

  // Dedupe by name keeping highest synergy
  const byName = new Map<string, EdhrecCardView>()
  for (const c of cards) {
    const prev = byName.get(c.name.toLowerCase())
    if (!prev || c.synergy > prev.synergy) byName.set(c.name.toLowerCase(), c)
  }

  const themes = Object.entries(obj.tag_counts ?? {})
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 12)

  return {
    slug,
    numDecks: obj.container?.json_dict?.card?.num_decks ?? null,
    similar: obj.similar ?? [],
    themes,
    cards: [...byName.values()].sort((a, b) => b.synergy - a.synergy || b.inclusion - a.inclusion),
  }
}

export async function fetchEdhrecCommander(commanderName: string): Promise<EdhrecCommanderData> {
  const slug = edhrecSlug(commanderName)
  const cached = memoryCache.get(slug)
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.data

  const url = `${edhrecBaseUrl()}/pages/commanders/${slug}.json`
  let res: Response
  try {
    res = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(20_000),
    })
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'error de red'
    throw new Error(
      `No se pudo conectar con EDHREC (${reason}). Comprueba la red o reinicia la app con Vite en marcha.`,
    )
  }
  if (!res.ok) throw new Error(`EDHREC respondió ${res.status} para «${slug}»`)
  const raw = await res.json()
  const data = parseCommanderPayload(raw, slug)
  memoryCache.set(slug, { at: Date.now(), data })
  try {
    sessionStorage.setItem(`edhrec:${slug}`, JSON.stringify({ at: Date.now(), data }))
  } catch {
    /* quota */
  }
  return data
}

export function loadEdhrecFromSession(commanderName: string): EdhrecCommanderData | null {
  const slug = edhrecSlug(commanderName)
  try {
    const raw = sessionStorage.getItem(`edhrec:${slug}`)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { at: number; data: EdhrecCommanderData }
    if (Date.now() - parsed.at > CACHE_MS) return null
    memoryCache.set(slug, parsed)
    return parsed.data
  } catch {
    return null
  }
}

export function buildSuggestions(params: {
  edhrec: EdhrecCommanderData
  pool: Card[]
  deckNames: Set<string>
  onlyOwned?: boolean
  limit?: number
}): SuggestionRow[] {
  const indexes = buildCardIndexes(params.pool)
  const limit = params.limit ?? 40
  const rows: SuggestionRow[] = []

  for (const c of params.edhrec.cards) {
    const card = findCardByName(c.name, indexes)
    const inCollection = Boolean(card)
    if (params.onlyOwned && !inCollection) continue
    rows.push({
      name: c.name,
      synergy: c.synergy,
      inclusion: c.inclusion,
      header: c.header,
      inCollection,
      inDeck: params.deckNames.has(c.name.toLowerCase()),
      card,
    })
    if (rows.length >= limit) break
  }
  return rows
}
