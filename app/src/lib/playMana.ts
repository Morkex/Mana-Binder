/** Mana pool / cost payment helpers for the goldfish playtester. */

export type ManaColor = 'W' | 'U' | 'B' | 'R' | 'G' | 'C'
export type ManaPool = Record<ManaColor, number>

export interface ManaNeed {
  W: number
  U: number
  B: number
  R: number
  G: number
  C: number
  generic: number
  /** Hybrid symbols like W/U — pay either side. */
  hybrid: Array<[ManaColor, ManaColor]>
}

const EMPTY_NEED = (): ManaNeed => ({
  W: 0,
  U: 0,
  B: 0,
  R: 0,
  G: 0,
  C: 0,
  generic: 0,
  hybrid: [],
})

const COLORS: ManaColor[] = ['W', 'U', 'B', 'R', 'G', 'C']

function isColor(s: string): s is ManaColor {
  return COLORS.includes(s as ManaColor)
}

/** Parse a Scryfall-style mana cost string, e.g. `{2}{W}{U}`. `{X}`/`{Y}` ignored (0). */
export function parseManaCost(manaCost: string, extraGeneric = 0): ManaNeed {
  const need = EMPTY_NEED()
  need.generic += Math.max(0, extraGeneric)
  if (!manaCost) return need

  const re = /\{([^}]+)\}/g
  let m: RegExpExecArray | null
  while ((m = re.exec(manaCost))) {
    const sym = m[1].toUpperCase()
    if (sym === 'X' || sym === 'Y' || sym === 'Z') continue
    if (/^\d+$/.test(sym)) {
      need.generic += Number(sym)
      continue
    }
    if (sym === 'C' || sym === 'S') {
      need.C += 1
      continue
    }
    if (isColor(sym)) {
      need[sym] += 1
      continue
    }
    // Hybrid W/U, 2/W, W/P, etc.
    if (sym.includes('/')) {
      const [a, b] = sym.split('/')
      if (isColor(a) && isColor(b)) {
        need.hybrid.push([a, b])
      } else if (/^\d+$/.test(a) && isColor(b)) {
        // {2/W} — treat as generic 2 OR colored; simplify to colored preference optional.
        // Pay as generic 2 for goldfish simplicity when pool is tight, else color.
        need.hybrid.push(['C', b])
        need.generic += 1 // approximate: need at least 1 more somehow — use hybrid C/b
      } else if (isColor(a) && b === 'P') {
        // Phyrexian — pay life OR color; goldfish: require the color (life payment manual).
        need[a] += 1
      }
      continue
    }
  }
  return need
}

function clonePool(pool: ManaPool): ManaPool {
  return { W: pool.W, U: pool.U, B: pool.B, R: pool.R, G: pool.G, C: pool.C }
}

/** Try to satisfy hybrid symbols, then colored, then generic from remaining. */
export function tryPayMana(pool: ManaPool, need: ManaNeed): ManaPool | null {
  const p = clonePool(pool)

  for (const c of ['W', 'U', 'B', 'R', 'G', 'C'] as const) {
    if (p[c] < need[c]) return null
    p[c] -= need[c]
  }

  for (const [a, b] of need.hybrid) {
    if (p[a] > 0) p[a] -= 1
    else if (p[b] > 0) p[b] -= 1
    else return null
  }

  let generic = need.generic
  // Spend colorless first, then colored leftovers.
  const order: ManaColor[] = ['C', 'W', 'U', 'B', 'R', 'G']
  for (const c of order) {
    if (generic <= 0) break
    const use = Math.min(p[c], generic)
    p[c] -= use
    generic -= use
  }
  if (generic > 0) return null
  return p
}

export function canPayMana(pool: ManaPool, need: ManaNeed): boolean {
  return tryPayMana(pool, need) !== null
}

export function formatManaNeed(need: ManaNeed): string {
  const parts: string[] = []
  if (need.generic) parts.push(`{${need.generic}}`)
  for (const c of ['W', 'U', 'B', 'R', 'G', 'C'] as const) {
    for (let i = 0; i < need[c]; i++) parts.push(`{${c}}`)
  }
  for (const [a, b] of need.hybrid) parts.push(`{${a}/${b}}`)
  return parts.join('') || '{0}'
}
