/** Precios Scryfall (EUR/USD) con cache en sessionStorage. */

export interface CardPrice {
  name: string
  usd: number | null
  eur: number | null
}

const memory = new Map<string, CardPrice>()
const CACHE_KEY = 'mana-binder-scryfall-prices'
const CACHE_MS = 1000 * 60 * 60 * 24

function scryfallBase(): string {
  if (import.meta.env.DEV) return '/api/scryfall'
  if (typeof window !== 'undefined') {
    const host = window.location.hostname
    if (host === '127.0.0.1' || host === 'localhost') return '/api/scryfall'
  }
  return 'https://api.scryfall.com'
}

function loadSessionCache(): void {
  if (memory.size) return
  try {
    const raw = sessionStorage.getItem(CACHE_KEY)
    if (!raw) return
    const parsed = JSON.parse(raw) as { at: number; items: CardPrice[] }
    if (Date.now() - parsed.at > CACHE_MS) return
    for (const p of parsed.items) memory.set(p.name.toLowerCase(), p)
  } catch {
    /* ignore */
  }
}

function persistSessionCache(): void {
  try {
    sessionStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ at: Date.now(), items: [...memory.values()].slice(0, 400) }),
    )
  } catch {
    /* quota */
  }
}

function norm(name: string): string {
  return name.split('//')[0].trim().toLowerCase()
}

/**
 * Fetch precios para una lista de nombres (máx ~75 por request Scryfall collection).
 */
export async function fetchCardPrices(names: string[]): Promise<Map<string, CardPrice>> {
  loadSessionCache()
  const unique = [...new Set(names.map(norm).filter(Boolean))]
  const missing = unique.filter((n) => !memory.has(n))
  const out = new Map<string, CardPrice>()

  for (const n of unique) {
    const hit = memory.get(n)
    if (hit) out.set(n, hit)
  }

  const chunkSize = 70
  for (let i = 0; i < missing.length; i += chunkSize) {
    const chunk = missing.slice(i, i + chunkSize)
    try {
      const res = await fetch(`${scryfallBase()}/cards/collection`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          identifiers: chunk.map((name) => ({ name })),
        }),
        signal: AbortSignal.timeout(20_000),
      })
      if (!res.ok) continue
      const data = (await res.json()) as {
        data?: {
          name?: string
          prices?: { usd?: string | null; eur?: string | null }
        }[]
      }
      for (const card of data.data ?? []) {
        if (!card.name) continue
        const key = norm(card.name)
        const price: CardPrice = {
          name: card.name,
          usd: card.prices?.usd != null ? Number(card.prices.usd) : null,
          eur: card.prices?.eur != null ? Number(card.prices.eur) : null,
        }
        memory.set(key, price)
        out.set(key, price)
      }
      // Identifiers not found → mark null so we don't refetch every time
      for (const n of chunk) {
        if (!memory.has(n)) {
          const empty: CardPrice = { name: n, usd: null, eur: null }
          memory.set(n, empty)
          out.set(n, empty)
        }
      }
    } catch {
      /* offline */
    }
    if (i + chunkSize < missing.length) {
      await new Promise((r) => setTimeout(r, 100))
    }
  }

  persistSessionCache()
  return out
}

export function formatPrice(p: CardPrice | undefined, prefer: 'eur' | 'usd' = 'eur'): string {
  if (!p) return ''
  if (prefer === 'eur' && p.eur != null) return `${p.eur.toFixed(2)} €`
  if (p.usd != null) return `$${p.usd.toFixed(2)}`
  if (p.eur != null) return `${p.eur.toFixed(2)} €`
  return 'sin precio'
}
