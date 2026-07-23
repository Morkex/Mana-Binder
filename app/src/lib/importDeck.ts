import type { Card } from '../types'
import { isBasicLandName, makeBasicLandCopies } from './basicLands'
import {
  buildCardIndexes,
  findCardByName,
  normalizeCardName,
} from './cardLookup'

export type DeckListSection = 'commander' | 'deck' | 'maybeboard' | 'sideboard' | 'companion'

export interface ParsedDeckLine {
  count: number
  name: string
  setCode?: string
  collectorNumber?: string
  foil?: boolean
  section: DeckListSection
}

export interface ParsedDeckList {
  format: 'moxfield' | 'archidekt' | 'simple'
  commanderNames: string[]
  deck: ParsedDeckLine[]
  maybeboard: ParsedDeckLine[]
  sideboard: ParsedDeckLine[]
  rawLineCount: number
}

export interface ImportDeckResult {
  commander: Card | null
  deck: Card[]
  maybeboard: Card[]
  missing: string[]
  warnings: string[]
  parsed: ParsedDeckList
}

const SECTION_HEADERS: Record<string, DeckListSection> = {
  commander: 'commander',
  commanders: 'commander',
  deck: 'deck',
  mainboard: 'deck',
  main: 'deck',
  maybeboard: 'maybeboard',
  maybe: 'maybeboard',
  considerations: 'maybeboard',
  sideboard: 'sideboard',
  side: 'sideboard',
  companion: 'companion',
}

/** Strip Moxfield/Archidekt noise: (SET) 123, *F*, #Category, trailing tags. */
export function cleanCardName(raw: string): {
  name: string
  setCode?: string
  collectorNumber?: string
  foil?: boolean
} {
  let line = raw.trim()
  let foil = false
  if (/\*F\*/i.test(line) || /\bFOIL\b/i.test(line)) {
    foil = true
    line = line.replace(/\*F\*/gi, '').replace(/\bFOIL\b/gi, '')
  }

  // Archidekt category suffix: Card Name [Ramp]
  line = line.replace(/\s*\[[^\]]+\]\s*$/g, '')

  // Moxfield: Name (SET) 123  or Name (SET)
  let setCode: string | undefined
  let collectorNumber: string | undefined
  const mox = line.match(/^(.*?)\s+\(([A-Za-z0-9]+)\)(?:\s+(\d[\w-]*))?\s*$/)
  if (mox) {
    line = mox[1].trim()
    setCode = mox[2]
    collectorNumber = mox[3]
  }

  // MTGO-ish: 1 Card Name
  line = line.replace(/\s+/g, ' ').trim()
  return { name: line, setCode, collectorNumber, foil }
}

function parseCountAndRest(line: string): { count: number; rest: string } | null {
  const trimmed = line.trim()
  if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('#')) return null

  // "1x Card" / "1 Card" / "x1 Card" / "Card" (count 1)
  const m = trimmed.match(/^(\d+)\s*[xX]?\s+(.+)$/)
  if (m) return { count: Math.max(1, Number(m[1])), rest: m[2].trim() }

  const m2 = trimmed.match(/^[xX]\s*(\d+)\s+(.+)$/)
  if (m2) return { count: Math.max(1, Number(m2[1])), rest: m2[2].trim() }

  return { count: 1, rest: trimmed }
}

export function parseDeckListText(text: string): ParsedDeckList {
  const lines = text.replace(/\r\n/g, '\n').split('\n')
  let section: DeckListSection = 'deck'
  let sawHeader = false
  const commanderNames: string[] = []
  const deck: ParsedDeckLine[] = []
  const maybeboard: ParsedDeckLine[] = []
  const sideboard: ParsedDeckLine[] = []
  let rawLineCount = 0

  for (const raw of lines) {
    const trimmed = raw.trim()
    if (!trimmed) continue

    const headerKey = trimmed.toLowerCase().replace(/:$/, '')
    if (SECTION_HEADERS[headerKey]) {
      section = SECTION_HEADERS[headerKey]
      sawHeader = true
      continue
    }

    // Archidekt: "About" / "Deck" style already covered; skip metadata
    if (/^(about|created|updated|format)\b/i.test(trimmed)) continue

    const parsed = parseCountAndRest(trimmed)
    if (!parsed) continue
    rawLineCount += 1

    const cleaned = cleanCardName(parsed.rest)
    if (!cleaned.name) continue

    const entry: ParsedDeckLine = {
      count: parsed.count,
      name: cleaned.name,
      setCode: cleaned.setCode,
      collectorNumber: cleaned.collectorNumber,
      foil: cleaned.foil,
      section,
    }

    if (section === 'commander' || section === 'companion') {
      commanderNames.push(cleaned.name)
      continue
    }
    if (section === 'maybeboard') {
      maybeboard.push(entry)
      continue
    }
    if (section === 'sideboard') {
      sideboard.push(entry)
      continue
    }
    deck.push(entry)
  }

  // Heuristic: if no Commander header, first legendary line in deck might be commander —
  // leave that to resolveImport (caller can pick). Format detection:
  const format: ParsedDeckList['format'] = sawHeader
    ? text.toLowerCase().includes('maybeboard') || text.toLowerCase().includes('commander')
      ? 'moxfield'
      : 'archidekt'
    : 'simple'

  return { format, commanderNames, deck, maybeboard, sideboard, rawLineCount }
}

function expandLines(
  lines: ParsedDeckLine[],
  indexes: ReturnType<typeof buildCardIndexes>,
  pool: Card[],
  colorIdentity: string[],
  missing: string[],
  singleton: boolean,
): Card[] {
  const out: Card[] = []
  const used = new Set<string>()

  for (const line of lines) {
    const found = findCardByName(line.name, indexes)
    if (!found) {
      if (isBasicLandName(line.name) || isBasicLandName(line.name.split('//')[0]?.trim() ?? '')) {
        const basicName = line.name.includes('//')
          ? line.name.split('//')[0]!.trim()
          : line.name.trim()
        const copies = makeBasicLandCopies(
          colorIdentity.length ? colorIdentity : ['W', 'U', 'B', 'R', 'G'],
          line.count,
          pool,
        )
          .filter((c) => normalizeCardName(c.name) === normalizeCardName(basicName))
        if (copies.length) {
          out.push(
            ...copies.map((c, i) => ({
              ...c,
              id: `${c.id}-import-${out.length + i}`,
            })),
          )
          continue
        }
        // Force basic copies even if identity mismatch
        const forced = makeBasicLandCopies(
          colorIdentity.length ? colorIdentity : ['G'],
          line.count,
          pool,
        )
        out.push(
          ...forced.slice(0, line.count).map((c, i) => ({
            ...c,
            name: basicName,
            id: `virtual-basic-${basicName}-${out.length + i}`,
          })),
        )
        continue
      }
      missing.push(`${line.count} ${line.name}`)
      continue
    }

    if (isBasicLandName(found.name)) {
      const copies = makeBasicLandCopies(
        colorIdentity.length ? colorIdentity : found.colorIdentity,
        line.count,
        pool,
      ).filter((c) => c.name === found.name)
      const use =
        copies.length > 0
          ? copies
          : Array.from({ length: line.count }, (_, i) => ({
              ...found,
              id: `${found.id}-import-${i}`,
              quantity: 9999,
            }))
      out.push(...use.slice(0, line.count))
      continue
    }

    const key = found.name.toLowerCase()
    const copies = singleton ? 1 : Math.min(line.count, Math.max(1, found.quantity || 1))
    if (singleton && used.has(key)) continue
    used.add(key)
    for (let i = 0; i < copies; i++) {
      out.push(i === 0 ? found : { ...found, id: `${found.id}-import-${i}` })
    }
    if (line.count > copies && !isBasicLandName(found.name)) {
      // Commander is singleton; extras ignored silently except note
    }
  }

  return out
}

/**
 * Import a pasted decklist against the local collection.
 * Cards not in the collection are reported in `missing` (except unlimited basics).
 */
export function importDeckFromText(
  text: string,
  pool: Card[],
  options: { preferredCommanderName?: string } = {},
): ImportDeckResult {
  const parsed = parseDeckListText(text)
  const indexes = buildCardIndexes(pool)
  const missing: string[] = []
  const warnings: string[] = []

  let commander: Card | null = null
  const cmdCandidates = [
    ...(options.preferredCommanderName ? [options.preferredCommanderName] : []),
    ...parsed.commanderNames,
  ]

  for (const name of cmdCandidates) {
    const card = findCardByName(name, indexes)
    if (card) {
      commander = card
      break
    }
    missing.push(`Commander: ${name}`)
  }

  // Simple lists: if no commander section, try first deck line as commander when legendary
  if (!commander && parsed.commanderNames.length === 0 && parsed.deck.length > 0) {
    const first = findCardByName(parsed.deck[0].name, indexes)
    if (
      first &&
      /\bLegendary\b/i.test(first.typeLine) &&
      (/\bCreature\b/i.test(first.typeLine) || /can be your commander/i.test(first.oracleText))
    ) {
      commander = first
      warnings.push(`Comandante inferido: ${first.name}`)
      parsed.deck = parsed.deck.slice(1)
    }
  }

  const identity = commander?.colorIdentity ?? []
  const deckCards = expandLines(parsed.deck, indexes, pool, identity, missing, true)
  const maybeCards = expandLines(parsed.maybeboard, indexes, pool, identity, missing, true)

  // Drop commander from main deck if duplicated
  const deckFiltered = commander
    ? deckCards.filter((c) => c.name.toLowerCase() !== commander!.name.toLowerCase())
    : deckCards

  if (deckFiltered.length > 99) {
    warnings.push(`El mazo importado tiene ${deckFiltered.length} cartas; Commander usa 99 (+ comandante).`)
  }

  return {
    commander,
    deck: deckFiltered.slice(0, 99),
    maybeboard: maybeCards,
    missing,
    warnings,
    parsed,
  }
}
