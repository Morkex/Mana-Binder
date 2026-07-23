import type { Card } from '../types'
import {
  type Bracket,
  cardAllowedInBracket,
  maxGameChangersFor,
} from './brackets'
import { buildCommanderProfile, synergyScore } from './commanderProfile'
import { isGameChanger } from './gameChangers'
import {
  detectRoles,
  isDraw,
  isInteraction,
  isRamp,
  scoreCard,
} from './cardScore'
import { fitsColorIdentity, getPrimaryType, uniqueByName } from './mtg'
import { autoBuildDeck } from './autoDeck'
import { DEFAULT_OLLAMA_MODEL, ollamaChat } from './ollamaClient'
import {
  isBasicLand,
  makeBasicLandCopies,
  withUnlimitedBasics,
} from './basicLands'

const DECK_SIZE = 99
const CANDIDATE_LIMIT = 140
const MUST_INCLUDE_TARGET = 28

export interface AgentDeckResult {
  deck: Card[]
  strategy: string
  source: 'agent' | 'hybrid' | 'fallback'
  pickedByAgent: number
  model: string
}

interface CandidateView {
  name: string
  cmc: number
  type: string
  roles: string[]
  score: number
  syn: number
  gc: boolean
  text: string
}

interface AgentPlan {
  strategy: string
  mustInclude: string[]
  avoid: string[]
}

function legalPool(commander: Card, pool: Card[], targetBracket: Bracket): Card[] {
  let legal = uniqueByName(
    withUnlimitedBasics(
      pool.filter(
        (c) =>
          c.commanderLegal &&
          fitsColorIdentity(c, commander.colorIdentity) &&
          c.name.toLowerCase() !== commander.name.toLowerCase(),
      ),
      commander.colorIdentity,
    ),
  )
  if (maxGameChangersFor(targetBracket) === 0) {
    legal = legal.filter((c) => !isGameChanger(c.name))
  }
  return legal
}

export function buildCandidatePool(
  commander: Card,
  pool: Card[],
  targetBracket: Bracket,
  limit = CANDIDATE_LIMIT,
): CandidateView[] {
  const profile = buildCommanderProfile(commander)
  return legalPool(commander, pool, targetBracket)
    .map((card) => ({
      card,
      score: scoreCard(card, commander, targetBracket, profile),
      syn: synergyScore(card, profile),
    }))
    .sort((a, b) => b.score - a.score || b.syn - a.syn)
    .slice(0, limit)
    .map(({ card, score, syn }) => ({
      name: card.name,
      cmc: card.cmc,
      type: getPrimaryType(card.typeLine),
      roles: detectRoles(card),
      score: Math.round(score),
      syn: Math.round(syn),
      gc: isGameChanger(card.name),
      text: card.oracleText.replace(/\s+/g, ' ').slice(0, 120),
    }))
}

function asStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => {
      if (typeof item === 'string') return item.trim()
      if (item && typeof item === 'object' && 'name' in item) {
        return String((item as { name: unknown }).name).trim()
      }
      return ''
    })
    .filter(Boolean)
}

function parseAgentPlan(raw: string): AgentPlan {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    const match = raw.match(/\{[\s\S]*\}/)
    if (!match) throw new Error('La IA no devolvió JSON válido')
    parsed = JSON.parse(match[0])
  }

  const obj = parsed as Record<string, unknown>
  const strategy =
    (typeof obj.strategy === 'string' && obj.strategy.trim()) ||
    (typeof obj.plan === 'string' && obj.plan.trim()) ||
    (typeof obj.comments === 'string' && obj.comments.trim()) ||
    (typeof obj.comentario === 'string' && obj.comentario.trim()) ||
    ''

  const mustInclude = asStringList(
    obj.mustInclude ?? obj.must_include ?? obj.picks ?? obj.core ?? obj.deck,
  )
  const avoid = asStringList(obj.avoid ?? obj.skip ?? obj.exclude)

  if (!strategy && mustInclude.length === 0) {
    throw new Error('La IA no devolvió estrategia ni picks')
  }

  return {
    strategy: strategy || 'No strategy commentary.',
    mustInclude,
    avoid,
  }
}

function normalizeCardName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/['']/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function buildCardIndexes(cards: Card[]): {
  byLower: Map<string, Card>
  byNorm: Map<string, Card>
  all: Card[]
} {
  const byLower = new Map<string, Card>()
  const byNorm = new Map<string, Card>()
  for (const card of cards) {
    byLower.set(card.name.toLowerCase(), card)
    const norm = normalizeCardName(card.name)
    if (!byNorm.has(norm)) byNorm.set(norm, card)
    const front = normalizeCardName(card.name.split('//')[0] ?? card.name)
    if (front && !byNorm.has(front)) byNorm.set(front, card)
  }
  return { byLower, byNorm, all: cards }
}

function findCardByName(
  rawName: string,
  indexes: ReturnType<typeof buildCardIndexes>,
): Card | undefined {
  const trimmed = rawName.trim()
  if (!trimmed) return undefined

  const lower = trimmed.toLowerCase()
  const exact = indexes.byLower.get(lower)
  if (exact) return exact

  const norm = normalizeCardName(trimmed)
  const byNorm = indexes.byNorm.get(norm)
  if (byNorm) return byNorm

  const front = normalizeCardName(trimmed.split('//')[0] ?? trimmed)
  const byFront = indexes.byNorm.get(front)
  if (byFront) return byFront

  const partial = indexes.all.filter((card) => {
    const cn = normalizeCardName(card.name)
    return cn === norm || cn.startsWith(`${norm} `) || norm.startsWith(cn)
  })
  if (partial.length === 1) return partial[0]

  return undefined
}

function resolveNames(
  names: string[],
  indexes: ReturnType<typeof buildCardIndexes>,
  commander: Card,
  targetBracket: Bracket,
  avoided: Set<string>,
): { picked: Card[]; missing: string[] } {
  const used = new Set<string>([commander.name.toLowerCase()])
  let gcCount = isGameChanger(commander.name) ? 1 : 0
  const picked: Card[] = []
  const missing: string[] = []

  for (const name of names) {
    if (picked.length >= MUST_INCLUDE_TARGET + 10) break
    const card = findCardByName(name, indexes)
    if (!card) {
      missing.push(name)
      continue
    }
    const key = card.name.toLowerCase()
    if (avoided.has(key) || avoided.has(normalizeCardName(card.name))) continue
    if (used.has(key)) continue
    if (!cardAllowedInBracket(card, targetBracket, gcCount)) {
      missing.push(`${name} (no permitida en B${targetBracket})`)
      continue
    }
    used.add(key)
    if (isGameChanger(card.name)) gcCount += 1
    picked.push(card)
  }

  return { picked, missing }
}

/** Garantiza que todas las cartas del núcleo están en el mazo final (máx. 99). */
function ensureCoreInDeck(core: Card[], deck: Card[], commander: Card): Card[] {
  const coreKeys = new Set(core.map((c) => c.name.toLowerCase()))
  const commanderKey = commander.name.toLowerCase()
  const merged: Card[] = []
  const used = new Set<string>([commanderKey])

  for (const card of core) {
    const key = card.name.toLowerCase()
    if (used.has(key)) continue
    used.add(key)
    merged.push(card)
  }

  for (const card of deck) {
    if (merged.length >= DECK_SIZE) break
    const key = card.name.toLowerCase()
    if (used.has(key)) continue
    used.add(key)
    merged.push(card)
  }

  // Si aún faltara espacio y el núcleo se cortó (no debería), priorizar núcleo
  if (merged.length > DECK_SIZE) {
    const corePart = merged.filter((c) => coreKeys.has(c.name.toLowerCase()))
    const rest = merged.filter((c) => !coreKeys.has(c.name.toLowerCase()))
    return [...corePart, ...rest].slice(0, DECK_SIZE)
  }

  return merged
}

function formatStrategyWithCore(
  strategy: string,
  coreInDeck: Card[],
  missing: string[],
): string {
  const body = strategy.trim() || 'No strategy commentary.'
  const parts = [body]

  if (coreInDeck.length > 0) {
    const lines = coreInDeck
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name, 'en'))
      .map((c) => `• ${c.name} (${getPrimaryType(c.typeLine)}, CMC ${c.cmc})`)
    parts.push('', `Core included in deck (${coreInDeck.length} cards):`, ...lines)
  }

  if (missing.length > 0) {
    parts.push(
      '',
      `Requested by AI but not included (${missing.length}):`,
      ...missing.map((n) => `• ${n}`),
    )
  }

  return parts.join('\n')
}

function fillRemaining(
  commander: Card,
  pool: Card[],
  current: Card[],
  targetBracket: Bracket,
  avoided: Set<string>,
): Card[] {
  if (current.length >= DECK_SIZE) return current.slice(0, DECK_SIZE)

  const used = new Set(current.map((c) => c.name.toLowerCase()))
  used.add(commander.name.toLowerCase())
  let gcCount =
    (isGameChanger(commander.name) ? 1 : 0) + current.filter((c) => isGameChanger(c.name)).length

  const profile = buildCommanderProfile(commander)
  const needLands = Math.max(0, 36 - current.filter((c) => getPrimaryType(c.typeLine) === 'Land').length)
  const needRamp = Math.max(0, 10 - current.filter((c) => isRamp(c)).length)
  const needDraw = Math.max(0, 10 - current.filter((c) => isDraw(c)).length)
  const needInteraction = Math.max(0, 12 - current.filter((c) => isInteraction(c)).length)

  const scored = legalPool(commander, pool, targetBracket)
    .filter(
      (c) =>
        !isBasicLand(c) &&
        !used.has(c.name.toLowerCase()) &&
        !avoided.has(c.name.toLowerCase()),
    )
    .map((card) => ({
      card,
      score: scoreCard(card, commander, targetBracket, profile),
      syn: synergyScore(card, profile),
      roles: detectRoles(card),
    }))
    .sort((a, b) => b.score - a.score || b.syn - a.syn)

  const result = [...current]

  const take = (predicate: (row: (typeof scored)[0]) => boolean, n: number) => {
    let taken = 0
    for (const row of scored) {
      if (taken >= n || result.length >= DECK_SIZE) break
      const key = row.card.name.toLowerCase()
      if (used.has(key)) continue
      if (!predicate(row)) continue
      if (!cardAllowedInBracket(row.card, targetBracket, gcCount)) continue
      used.add(key)
      if (isGameChanger(row.card.name)) gcCount += 1
      result.push(row.card)
      taken += 1
    }
  }

  // A few non-basic lands from collection, then fill with unlimited basics
  const maxNonBasicLands = Math.min(12, needLands)
  take((r) => r.roles.includes('land'), maxNonBasicLands)
  const stillNeedLands = Math.max(
    0,
    36 - result.filter((c) => getPrimaryType(c.typeLine) === 'Land').length,
  )
  if (stillNeedLands > 0 && result.length < DECK_SIZE) {
    const n = Math.min(stillNeedLands, DECK_SIZE - result.length)
    result.push(...makeBasicLandCopies(commander.colorIdentity, n, pool))
  }

  take((r) => isRamp(r.card), needRamp)
  take((r) => isDraw(r.card), needDraw)
  take((r) => isInteraction(r.card), needInteraction)
  take((r) => r.syn >= 12 || r.score > 0, DECK_SIZE - result.length)
  take(() => true, DECK_SIZE - result.length)

  if (result.length < DECK_SIZE) {
    result.push(
      ...makeBasicLandCopies(commander.colorIdentity, DECK_SIZE - result.length, pool),
    )
  }

  return result.slice(0, DECK_SIZE)
}

function buildSystemPrompt(): string {
  return [
    'You are a Magic: The Gathering Commander deckbuilder.',
    'Do NOT build the full 99. Only the game plan and a synergistic core.',
    'CRITICAL: Never translate card names. Always use exact English Oracle names from the candidate lists.',
    'Basic lands (Plains, Island, Swamp, Mountain, Forest, Wastes) are UNLIMITED for the player — do not spend mustInclude slots on basics; the app fills the manabase with basics automatically.',
    'Your card memory may be wrong: rely on synergy scores (syn) and total scores (s) from the candidates.',
    'Selection rules:',
    '- Prefer syn>=20, then syn>=12, then high score.',
    '- Include 2-4 enablers for the commander, 1-3 wincons/finishers, plus some ramp/draw/interaction from the shortlist.',
    '- Avoid generic low-synergy picks when a thematic higher-syn option exists.',
    '- Never invent names: only exact names from the lists.',
    'Reply with JSON only:',
    '{"strategy":"English commentary (5-8 sentences)","mustInclude":["Exact English Card Name",...],"avoid":["Exact English Card Name",...]}',
    'strategy: early/mid/late plan, how the commander is used, wincons, and why this core. Use English card names only.',
    `mustInclude: 20-${MUST_INCLUDE_TARGET} exact English names. At least half should have syn>=12 when available.`,
    'avoid: 3-8 low-synergy or off-plan cards.',
  ].join(' ')
}

function buildUserPrompt(params: {
  commander: Card
  targetBracket: Bracket
  playstyle: string
  candidates: CandidateView[]
}): string {
  const profile = buildCommanderProfile(params.commander)
  const maxGc = maxGameChangersFor(params.targetBracket)

  const topSynergy = params.candidates
    .filter((c) => c.syn >= 12)
    .slice(0, 45)
    .map((c) => ({
      n: c.name,
      cmc: c.cmc,
      t: c.type,
      r: c.roles,
      s: c.score,
      syn: c.syn,
      gc: c.gc || undefined,
      txt: c.text || undefined,
    }))

  const utilities = params.candidates
    .filter((c) => c.syn < 12 && (c.roles.includes('ramp') || c.roles.includes('draw') || c.roles.includes('removal') || c.roles.includes('wipe') || c.roles.includes('land')))
    .slice(0, 40)
    .map((c) => ({
      n: c.name,
      cmc: c.cmc,
      t: c.type,
      r: c.roles,
      s: c.score,
      syn: c.syn,
      gc: c.gc || undefined,
    }))

  const rest = params.candidates
    .filter((c) => !topSynergy.some((t) => t.n === c.name) && !utilities.some((u) => u.n === c.name))
    .slice(0, 40)
    .map((c) => ({
      n: c.name,
      cmc: c.cmc,
      t: c.type,
      r: c.roles,
      s: c.score,
      syn: c.syn,
    }))

  return [
    `Commander: ${params.commander.name}`,
    `Type line: ${params.commander.typeLine}`,
    `Color identity: ${params.commander.colorIdentity.join('') || 'C'}`,
    `Oracle text: ${params.commander.oracleText.replace(/\s+/g, ' ').slice(0, 500)}`,
    `Profile keywords: ${profile.keywords.join(', ') || 'none'}`,
    `Creature types: ${profile.creatureTypes.join(', ') || 'none'}`,
    `Detected themes: ${profile.themes.join(', ') || 'none'}`,
    `Target bracket: B${params.targetBracket} (max Game Changers: ${maxGc})`,
    `Player preferences: ${params.playstyle.trim() || 'synergistic, fun, balanced'}`,
    '',
    'IMPORTANT: pick mustInclude mainly from "highSynergy". Use "utilities" for ramp/draw/removal/lands. Use "other" only if needed.',
    'Never translate card names. Copy names exactly as given in field "n".',
    '',
    `highSynergy (${topSynergy.length}):`,
    JSON.stringify(topSynergy),
    '',
    `utilities (${utilities.length}):`,
    JSON.stringify(utilities),
    '',
    `other (${rest.length}):`,
    JSON.stringify(rest),
    '',
    `Return JSON: strategy (English) + mustInclude (20-${MUST_INCLUDE_TARGET} exact English names) + avoid.`,
  ].join('\n')
}

/**
 * La IA propone estrategia + núcleo; el relleno estructural es heurístico.
 */
export async function agentBuildDeck(
  commander: Card,
  pool: Card[],
  targetBracket: Bracket = 3,
  options: { playstyle?: string; model?: string } = {},
): Promise<AgentDeckResult> {
  const model = options.model ?? DEFAULT_OLLAMA_MODEL
  const candidates = buildCandidatePool(commander, pool, targetBracket)
  const indexes = buildCardIndexes(legalPool(commander, pool, targetBracket))

  try {
    const raw = await ollamaChat({
      model,
      system: buildSystemPrompt(),
      prompt: buildUserPrompt({
        commander,
        targetBracket,
        playstyle: options.playstyle ?? '',
        candidates,
      }),
      temperature: 0.55,
      numPredict: 2200,
    })

    const plan = parseAgentPlan(raw)
    const avoided = new Set(
      plan.avoid.flatMap((n) => [n.toLowerCase(), normalizeCardName(n)]),
    )
    const { picked: fromAgent, missing } = resolveNames(
      plan.mustInclude,
      indexes,
      commander,
      targetBracket,
      avoided,
    )

    if (fromAgent.length < 8) {
      const fallback = ensureCoreInDeck(
        fromAgent,
        autoBuildDeck(commander, pool, targetBracket),
        commander,
      )
      const coreInDeck = fromAgent.filter((c) =>
        fallback.some((d) => d.name.toLowerCase() === c.name.toLowerCase()),
      )
      return {
        deck: fallback,
        strategy: formatStrategyWithCore(
          `${plan.strategy}\n\n(Note: small core; completed with heuristic filler.)`,
          coreInDeck,
          missing,
        ),
        source: 'fallback',
        pickedByAgent: fromAgent.length,
        model,
      }
    }

    const filled = ensureCoreInDeck(
      fromAgent,
      fillRemaining(commander, pool, fromAgent, targetBracket, avoided),
      commander,
    )
    const coreInDeck = fromAgent.filter((c) =>
      filled.some((d) => d.name.toLowerCase() === c.name.toLowerCase()),
    )

    return {
      deck: filled,
      strategy: formatStrategyWithCore(plan.strategy, coreInDeck, missing),
      source: fromAgent.length >= 18 ? 'agent' : 'hybrid',
      pickedByAgent: coreInDeck.length,
      model,
    }
  } catch (err) {
    const fallback = autoBuildDeck(commander, pool, targetBracket)
    const reason = err instanceof Error ? err.message : 'error desconocido'
    return {
      deck: fallback,
      strategy: `Could not get AI commentary (${reason}). Deck built with heuristic generator.`,
      source: 'fallback',
      pickedByAgent: 0,
      model,
    }
  }
}
