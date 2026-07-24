/** Parse oracle "create … token" clauses and fetch Scryfall token art. */

export interface ParsedToken {
  count: number
  name: string
  power: string
  toughness: string
  typeLine: string
  colors: string[]
}

const WORD_COUNTS: Record<string, number> = {
  a: 1,
  an: 1,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
}

const COLOR_WORDS: Record<string, string> = {
  white: 'W',
  blue: 'U',
  black: 'B',
  red: 'R',
  green: 'G',
  colorless: 'C',
}

function scryfallBase(): string {
  if (import.meta.env.DEV) return '/api/scryfall'
  if (typeof window !== 'undefined') {
    const host = window.location.hostname
    if (host === '127.0.0.1' || host === 'localhost') return '/api/scryfall'
  }
  return 'https://api.scryfall.com'
}

/** Extract create-token instructions from oracle text (English). */
export function parseCreateTokens(oracleText: string): ParsedToken[] {
  if (!oracleText) return []
  const out: ParsedToken[] = []
  // "Create a 2/2 green Wolf creature token" / "create two 1/1 white Soldier tokens"
  const re =
    /create (a|an|one|two|three|four|five|six|seven|eight|nine|ten|\d+) ([^.]+?) tokens?(?:\.|,| |$)/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(oracleText))) {
    const countRaw = m[1].toLowerCase()
    const count = WORD_COUNTS[countRaw] ?? (Number(countRaw) || 1)
    const desc = m[2].trim()
    const pt = desc.match(/(\d+)\s*\/\s*(\d+)/)
    const power = pt?.[1] ?? '1'
    const toughness = pt?.[2] ?? '1'
    const colors: string[] = []
    for (const [word, code] of Object.entries(COLOR_WORDS)) {
      if (new RegExp(`\\b${word}\\b`, 'i').test(desc)) colors.push(code)
    }
    // Name ≈ last capitalized-ish creature type word before "creature" or end
    let name = 'Token'
    const typeMatch = desc.match(
      /\d+\s*\/\s*\d+\s+(?:(?:white|blue|black|red|green|colorless)\s+)*([A-Za-z][A-Za-z\-']+)/i,
    )
    if (typeMatch) name = typeMatch[1]
    else {
      const words = desc.replace(/creature$/i, '').trim().split(/\s+/)
      name = words[words.length - 1] || 'Token'
    }
    const typeLine = `Token Creature — ${name}`
    out.push({ count, name, power, toughness, typeLine, colors })
  }
  return out
}

export async function fetchTokenImage(token: ParsedToken): Promise<string | undefined> {
  try {
    const q = [
      'is:token',
      `name:/^${token.name}$/`,
      token.power ? `power=${token.power}` : '',
      token.toughness ? `toughness=${token.toughness}` : '',
    ]
      .filter(Boolean)
      .join(' ')
    const url = `${scryfallBase()}/cards/search?q=${encodeURIComponent(q)}`
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) {
      // Fallback: name only
      const res2 = await fetch(
        `${scryfallBase()}/cards/named?fuzzy=${encodeURIComponent(token.name + ' token')}`,
        { signal: AbortSignal.timeout(8000) },
      )
      if (!res2.ok) return undefined
      const card = (await res2.json()) as { image_uris?: { normal?: string }; card_faces?: { image_uris?: { normal?: string } }[] }
      return card.image_uris?.normal ?? card.card_faces?.[0]?.image_uris?.normal
    }
    const data = (await res.json()) as {
      data?: { image_uris?: { normal?: string }; card_faces?: { image_uris?: { normal?: string } }[] }[]
    }
    const card = data.data?.[0]
    return card?.image_uris?.normal ?? card?.card_faces?.[0]?.image_uris?.normal
  } catch {
    return undefined
  }
}
