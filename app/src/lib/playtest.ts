import type { Card } from '../types'
import { getPrimaryType, imageUrl } from './mtg'
import {
  canPayMana,
  formatManaNeed,
  parseManaCost,
  tryPayMana,
  type ManaPool,
} from './playMana'
import {
  detectCombatDamageTriggers,
  detectDiesTriggers,
  detectEtbTriggers,
  effectivePower,
  effectiveToughness,
  isCreature,
  isLegendary,
  legendNameKey,
  type DetectedTrigger,
  type TriggerEffect,
} from './playRules'
import { fetchTokenImage, parseCreateTokens, type ParsedToken } from './playTokens'

export type ZoneId =
  | 'library'
  | 'hand'
  | 'battlefield'
  | 'graveyard'
  | 'exile'
  | 'command'
  | 'stack'

export type Phase =
  | 'untap'
  | 'upkeep'
  | 'draw'
  | 'main1'
  | 'combat'
  | 'main2'
  | 'end'

export interface PlayCounter {
  id: string
  label: string
  amount: number
}

export interface PlayObject {
  id: string
  /** Card from collection, or null for freeform tokens. */
  card: Card | null
  name: string
  zone: ZoneId
  tapped: boolean
  attacking: boolean
  isToken: boolean
  power: string | null
  toughness: string | null
  counters: PlayCounter[]
  image?: string
  /** Marked damage (cleared on cleanup / untap). */
  damage?: number
}

/** Unified stack: spells (card objects) + triggered abilities. Top = last. */
export type StackItem =
  | { kind: 'spell'; id: string; objectId: string }
  | {
      kind: 'ability'
      id: string
      sourceId: string
      sourceName: string
      trigger: DetectedTrigger['kind']
      text: string
      effects: TriggerEffect[]
    }

export interface PlayState {
  turn: number
  phase: Phase
  life: number
  poison: number
  energy: number
  experience: number
  commanderTax: number
  /** Dummy goldfish opponent (EDH starting life). */
  opponentLife: number
  mana: ManaPool
  objects: PlayObject[]
  stack: StackItem[]
  log: string[]
}

const PHASES: Phase[] = ['untap', 'upkeep', 'draw', 'main1', 'combat', 'main2', 'end']

export function phaseLabel(p: Phase): string {
  const map: Record<Phase, string> = {
    untap: 'Untap',
    upkeep: 'Upkeep',
    draw: 'Draw',
    main1: 'Main 1',
    combat: 'Combat',
    main2: 'Main 2',
    end: 'End',
  }
  return map[p]
}

function uid(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function cardToPlayObject(card: Card, zone: ZoneId): PlayObject {
  return {
    id: uid('obj'),
    card,
    name: card.name.split('//')[0]?.trim() ?? card.name,
    zone,
    tapped: false,
    attacking: false,
    isToken: false,
    power: card.power,
    toughness: card.toughness,
    counters: [],
    image: imageUrl(card),
    damage: 0,
  }
}

export function createPlayState(commander: Card, deck: Card[]): PlayState {
  const library = shuffle(deck.map((c) => cardToPlayObject(c, 'library')))
  const cmd = cardToPlayObject(commander, 'command')
  return {
    turn: 1,
    phase: 'untap',
    life: 40,
    poison: 0,
    energy: 0,
    experience: 0,
    commanderTax: 0,
    opponentLife: 40,
    mana: { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 },
    objects: [cmd, ...library],
    stack: [],
    log: [`Partida lista · ${library.length} en biblioteca · comandante en command zone`],
  }
}

/** Migrate older saves missing stack / opponentLife / damage. */
export function normalizePlayState(state: PlayState): PlayState {
  const stack =
    state.stack ??
    objectsIn(state, 'stack').map((o) => ({
      kind: 'spell' as const,
      id: uid('sp'),
      objectId: o.id,
    }))
  return {
    ...state,
    opponentLife: state.opponentLife ?? 40,
    stack,
    objects: state.objects.map((o) => ({ ...o, damage: o.damage ?? 0 })),
  }
}

export function pushLog(state: PlayState, msg: string): PlayState {
  return { ...state, log: [`T${state.turn}: ${msg}`, ...state.log].slice(0, 100) }
}

export function objectsIn(state: PlayState, zone: ZoneId): PlayObject[] {
  return state.objects.filter((o) => o.zone === zone)
}

export function drawCards(state: PlayState, n: number): PlayState {
  const library = objectsIn(state, 'library')
  const take = library.slice(0, n)
  if (!take.length) return pushLog(state, 'No quedan cartas en la biblioteca')
  const ids = new Set(take.map((t) => t.id))
  const objects = state.objects.map((o) =>
    ids.has(o.id) ? { ...o, zone: 'hand' as ZoneId, tapped: false } : o,
  )
  return pushLog({ ...state, objects }, `Roba ${take.length}`)
}

export function mulligan(state: PlayState, keep: number): PlayState {
  const hand = objectsIn(state, 'hand')
  const libraryCards = [...objectsIn(state, 'library'), ...hand]
  const shuffled = shuffle(libraryCards).map((o) => ({
    ...o,
    zone: 'library' as ZoneId,
    tapped: false,
  }))
  const drawIds = new Set(shuffled.slice(0, keep).map((o) => o.id))
  const objects = state.objects.map((o) => {
    if (o.zone === 'command') return o
    const lib = shuffled.find((s) => s.id === o.id)
    if (!lib) return o
    return { ...lib, zone: drawIds.has(o.id) ? ('hand' as ZoneId) : ('library' as ZoneId) }
  })
  const byId = new Map(objects.map((o) => [o.id, o]))
  const ordered = shuffled.map((s) => {
    const cur = byId.get(s.id)!
    return { ...cur, zone: drawIds.has(s.id) ? ('hand' as ZoneId) : ('library' as ZoneId) }
  })
  const cmd = objects.filter((o) => o.zone === 'command')
  const rest = objects.filter((o) => o.zone !== 'command' && o.zone !== 'library' && o.zone !== 'hand')
  return pushLog(
    { ...state, objects: [...cmd, ...ordered, ...rest], stack: [] },
    `Mulligan → mano de ${keep}`,
  )
}

export function startHand(state: PlayState): PlayState {
  return drawCards(state, 7)
}

export function isLandObject(obj: PlayObject): boolean {
  if (!obj.card) return false
  return getPrimaryType(obj.card.typeLine) === 'Land'
}

export function resolvesAsPermanent(obj: PlayObject): boolean {
  if (!obj.card) return true
  const t = getPrimaryType(obj.card.typeLine)
  return t !== 'Instant' && t !== 'Sorcery'
}

function pushAbilities(state: PlayState, source: PlayObject, triggers: DetectedTrigger[]): PlayState {
  if (!triggers.length) return state
  let next = state
  const items: StackItem[] = triggers.map((tr) => ({
    kind: 'ability' as const,
    id: uid('abi'),
    sourceId: source.id,
    sourceName: source.name,
    trigger: tr.kind,
    text: tr.text,
    effects: tr.effects,
  }))
  next = {
    ...next,
    stack: [...next.stack, ...items],
  }
  for (const tr of triggers) {
    next = pushLog(next, `Trigger (${tr.kind}) ${source.name}: ${tr.text.slice(0, 80)}`)
  }
  return next
}

function destroyPermanent(state: PlayState, id: string, reason: string): PlayState {
  const obj = state.objects.find((o) => o.id === id)
  if (!obj || obj.zone !== 'battlefield') return state

  if (obj.isToken) {
    const objects = state.objects.filter((o) => o.id !== id)
    return pushLog({ ...state, objects }, `${obj.name} (token) deja el juego (${reason})`)
  }

  let next: PlayState = {
    ...state,
    objects: state.objects.map((o) =>
      o.id === id
        ? { ...o, zone: 'graveyard' as ZoneId, tapped: false, attacking: false, damage: 0 }
        : o,
    ),
  }
  next = pushLog(next, `${obj.name} → cementerio (${reason})`)
  next = pushAbilities(next, obj, detectDiesTriggers(obj))
  return next
}

/** State-based actions: 0 toughness, legend rule. */
export function applyStateBasedActions(state: PlayState): PlayState {
  let next = state
  let changed = true
  let guard = 32
  while (changed && guard-- > 0) {
    changed = false
    const bf = objectsIn(next, 'battlefield')

    for (const o of bf) {
      if (!isCreature(o)) continue
      if (effectiveToughness(o) <= 0) {
        next = destroyPermanent(next, o.id, '0 toughness')
        changed = true
        break
      }
    }
    if (changed) continue

    const legends = bf.filter(isLegendary)
    const groups = new Map<string, PlayObject[]>()
    for (const o of legends) {
      const key = legendNameKey(o)
      const list = groups.get(key) ?? []
      list.push(o)
      groups.set(key, list)
    }
    for (const [, list] of groups) {
      if (list.length <= 1) continue
      const keepId = list[list.length - 1].id
      for (const o of list) {
        if (o.id === keepId) continue
        next = destroyPermanent(next, o.id, 'legend rule')
        changed = true
      }
      break
    }
  }
  return next
}

function makeTokenObject(token: ParsedToken, image?: string): PlayObject {
  return {
    id: uid('tok'),
    card: null,
    name: token.name,
    zone: 'battlefield',
    tapped: false,
    attacking: false,
    isToken: true,
    power: token.power,
    toughness: token.toughness,
    counters: [],
    image,
    damage: 0,
  }
}

export function addToken(
  state: PlayState,
  name: string,
  power: string,
  toughness: string,
  image?: string,
): PlayState {
  const token = makeTokenObject(
    { count: 1, name: name || 'Token', power, toughness, typeLine: `Token — ${name}`, colors: [] },
    image,
  )
  const next = applyStateBasedActions({ ...state, objects: [...state.objects, token] })
  return pushLog(next, `Token ${token.name} ${power}/${toughness}`)
}

export function addParsedTokens(
  state: PlayState,
  tokens: ParsedToken[],
  images: (string | undefined)[] = [],
): PlayState {
  let next = state
  const created: PlayObject[] = []
  tokens.forEach((t, ti) => {
    for (let i = 0; i < t.count; i++) {
      created.push(makeTokenObject(t, images[ti]))
    }
  })
  if (!created.length) return state
  next = { ...next, objects: [...next.objects, ...created] }
  next = applyStateBasedActions(next)
  const summary = tokens.map((t) => `${t.count}× ${t.name} ${t.power}/${t.toughness}`).join(', ')
  return pushLog(next, `Crea ${summary}`)
}

function applyTriggerEffects(
  state: PlayState,
  item: Extract<StackItem, { kind: 'ability' }>,
): PlayState {
  let next = state
  for (const fx of item.effects) {
    switch (fx.type) {
      case 'draw':
        next = drawCards(next, fx.n)
        break
      case 'gain_life':
        next = pushLog({ ...next, life: next.life + fx.n }, `${item.sourceName}: +${fx.n} vida`)
        break
      case 'damage_opponent': {
        const life = Math.max(0, next.opponentLife - fx.n)
        next = pushLog({ ...next, opponentLife: life }, `${item.sourceName}: ${fx.n} daño → dummy a ${life}`)
        break
      }
      case 'create_tokens':
        next = addParsedTokens(next, fx.tokens)
        break
      case 'manual':
        next = pushLog(next, `Trigger manual · ${item.sourceName}: ${fx.note}`)
        break
    }
  }
  return next
}

export function moveObject(state: PlayState, id: string, zone: ZoneId): PlayState {
  const obj = state.objects.find((o) => o.id === id)
  if (!obj || obj.zone === zone) return state
  const from = obj.zone
  let commanderTax = state.commanderTax
  if (zone === 'command' && from !== 'command' && obj.card) {
    commanderTax += 2
  }

  let objects = state.objects.map((o) =>
    o.id === id
      ? {
          ...o,
          zone,
          tapped: false,
          attacking: false,
          damage: zone === 'battlefield' ? o.damage : 0,
        }
      : o,
  )

  let stack = state.stack
  if (from === 'stack') {
    stack = stack.filter((s) => !(s.kind === 'spell' && s.objectId === id))
  }
  if (zone === 'stack') {
    const moved = objects.find((o) => o.id === id)
    if (moved) objects = [...objects.filter((o) => o.id !== id), moved]
    stack = [...stack, { kind: 'spell', id: uid('sp'), objectId: id }]
  }

  let next: PlayState = { ...state, objects, commanderTax, stack }
  const verb =
    zone === 'battlefield' && (from === 'hand' || from === 'command')
      ? 'Juega'
      : zone === 'stack'
        ? 'Lanza'
        : 'Mueve'
  next = pushLog(
    next,
    `${verb} ${obj.name} → ${zone}${zone === 'command' && from !== 'command' ? ` (tax ${commanderTax})` : ''}`,
  )

  if (from === 'battlefield' && (zone === 'graveyard' || zone === 'exile')) {
    if (obj.isToken && zone === 'graveyard') {
      next = { ...next, objects: next.objects.filter((o) => o.id !== id) }
      next = pushLog(next, `${obj.name} (token) deja el juego`)
    } else if (zone === 'graveyard') {
      next = pushAbilities(next, obj, detectDiesTriggers(obj))
    }
  }

  if (zone === 'battlefield' && from !== 'battlefield' && from !== 'stack') {
    next = pushAbilities(next, { ...obj, zone: 'battlefield' }, detectEtbTriggers(obj))
    next = applyStateBasedActions(next)
  }

  return next
}

/**
 * Cast / play from hand or command.
 * Lands → battlefield. Others → pay mana (incl. commander tax) then stack.
 */
export function castSpell(state: PlayState, id: string): PlayState {
  const obj = state.objects.find((o) => o.id === id)
  if (!obj) return state
  if (obj.zone !== 'hand' && obj.zone !== 'command') return state

  if (isLandObject(obj)) {
    return moveObject(state, id, 'battlefield')
  }

  const tax = obj.zone === 'command' ? state.commanderTax : 0
  const need = parseManaCost(obj.card?.manaCost ?? '', tax)
  if (!canPayMana(state.mana, need)) {
    return pushLog(state, `No puedes pagar ${formatManaNeed(need)} para ${obj.name}`)
  }
  const paid = tryPayMana(state.mana, need)
  if (!paid) return state

  let next: PlayState = { ...state, mana: paid }
  next = pushLog(next, `Paga ${formatManaNeed(need)} → ${obj.name}`)
  return moveObject(next, id, 'stack')
}

export function playToBattlefield(state: PlayState, id: string): PlayState {
  return castSpell(state, id)
}

export function topOfStack(state: PlayState): StackItem | null {
  return state.stack.length ? state.stack[state.stack.length - 1] : null
}

export function passPriority(state: PlayState): PlayState {
  const top = topOfStack(state)
  if (!top) return pushLog(state, 'Pass priority (stack vacío)')
  return resolveTopOfStack(state)
}

export function resolveStackObject(state: PlayState, objectId: string): PlayState {
  const idx = state.stack.findIndex((s) => s.kind === 'spell' && s.objectId === objectId)
  if (idx < 0) return state
  const item = state.stack[idx]
  if (item.kind !== 'spell') return state
  const without = [...state.stack.slice(0, idx), ...state.stack.slice(idx + 1)]
  return resolveSpellItem({ ...state, stack: [...without, item] }, item)
}

function resolveSpellItem(
  state: PlayState,
  item: Extract<StackItem, { kind: 'spell' }>,
): PlayState {
  const obj = state.objects.find((o) => o.id === item.objectId)
  if (!obj || obj.zone !== 'stack') {
    return { ...state, stack: state.stack.filter((s) => s.id !== item.id) }
  }
  const dest: ZoneId = resolvesAsPermanent(obj) ? 'battlefield' : 'graveyard'
  let next: PlayState = {
    ...state,
    stack: state.stack.filter((s) => s.id !== item.id),
    objects: state.objects.map((o) =>
      o.id === item.objectId
        ? { ...o, zone: dest, tapped: false, attacking: false, damage: 0 }
        : o,
    ),
  }
  const where = dest === 'battlefield' ? 'battlefield' : 'cementerio'
  next = pushLog(next, `Resuelve ${obj.name} → ${where}`)
  if (dest === 'battlefield') {
    next = pushAbilities(next, { ...obj, zone: 'battlefield' }, detectEtbTriggers(obj))
    next = applyStateBasedActions(next)
  }
  return next
}

function resolveAbilityItem(
  state: PlayState,
  item: Extract<StackItem, { kind: 'ability' }>,
): PlayState {
  let next: PlayState = {
    ...state,
    stack: state.stack.filter((s) => s.id !== item.id),
  }
  next = pushLog(next, `Resuelve trigger ${item.sourceName} (${item.trigger})`)
  next = applyTriggerEffects(next, item)
  return applyStateBasedActions(next)
}

export function resolveTopOfStack(state: PlayState): PlayState {
  const top = topOfStack(state)
  if (!top) return pushLog(state, 'Stack vacío')
  if (top.kind === 'spell') return resolveSpellItem(state, top)
  return resolveAbilityItem(state, top)
}

export function resolveEntireStack(state: PlayState): PlayState {
  let next = state
  let guard = 64
  while (topOfStack(next) && guard-- > 0) {
    next = resolveTopOfStack(next)
  }
  return next
}

export function toggleTap(state: PlayState, id: string): PlayState {
  const objects = state.objects.map((o) =>
    o.id === id && o.zone === 'battlefield'
      ? { ...o, tapped: !o.tapped, attacking: o.tapped ? o.attacking : false }
      : o,
  )
  return { ...state, objects }
}

export function tapForMana(state: PlayState, id: string): PlayState {
  const obj = state.objects.find((o) => o.id === id)
  if (!obj || obj.zone !== 'battlefield' || obj.tapped) return state

  const name = obj.name.toLowerCase()
  let color: keyof PlayState['mana'] | null = null
  if (name === 'plains') color = 'W'
  else if (name === 'island') color = 'U'
  else if (name === 'swamp') color = 'B'
  else if (name === 'mountain') color = 'R'
  else if (name === 'forest') color = 'G'
  else if (name === 'wastes') color = 'C'
  else if (obj.card?.colorIdentity?.length === 1) {
    color = obj.card.colorIdentity[0] as keyof PlayState['mana']
  } else if (obj.card && /\{T\}: add \{C\}/i.test(obj.card.oracleText)) {
    color = 'C'
  } else if (obj.card && /\{T\}: add/i.test(obj.card.oracleText)) {
    const m = obj.card.oracleText.match(/\{T\}: add \{([WUBRGC])\}/i)
    if (m) color = m[1].toUpperCase() as keyof PlayState['mana']
  }

  if (!color || !(color in state.mana)) {
    return toggleTap(state, id)
  }

  const objects = state.objects.map((o) => (o.id === id ? { ...o, tapped: true } : o))
  return pushLog(
    { ...state, objects, mana: { ...state.mana, [color]: state.mana[color] + 1 } },
    `${obj.name} → +{${color}}`,
  )
}

export function toggleAttack(state: PlayState, id: string): PlayState {
  const objects = state.objects.map((o) => {
    if (o.id !== id || o.zone !== 'battlefield') return o
    if (o.tapped && !o.attacking) return o
    const attacking = !o.attacking
    return { ...o, attacking, tapped: attacking ? true : o.tapped }
  })
  const obj = objects.find((o) => o.id === id)
  return pushLog(
    { ...state, objects },
    obj?.attacking ? `${obj.name} ataca` : `${obj?.name ?? 'carta'} deja de atacar`,
  )
}

export function untapAll(state: PlayState): PlayState {
  const objects = state.objects.map((o) =>
    o.zone === 'battlefield' ? { ...o, tapped: false, attacking: false, damage: 0 } : o,
  )
  return pushLog({ ...state, objects }, 'Untap all')
}

/**
 * Combat vs dummy:
 * - noBlocks: all attackers deal power to opponent life
 * - blocks: each attacker fights a 2/2 dummy blocker (mutual damage)
 */
export function resolveCombat(state: PlayState, mode: 'noBlocks' | 'blocks' = 'noBlocks'): PlayState {
  const attackers = objectsIn(state, 'battlefield').filter((o) => o.attacking)
  if (!attackers.length) return pushLog(state, 'Combate: no hay atacantes')

  let next = state

  if (mode === 'noBlocks') {
    let total = 0
    for (const a of attackers) {
      const dmg = Math.max(0, effectivePower(a))
      total += dmg
      next = pushAbilities(next, a, detectCombatDamageTriggers(a))
    }
    next = {
      ...next,
      opponentLife: Math.max(0, next.opponentLife - total),
      objects: next.objects.map((o) => (o.attacking ? { ...o, attacking: false } : o)),
    }
    next = pushLog(next, `Combate: ${total} daño al dummy → ${next.opponentLife} vida`)
    if (next.opponentLife <= 0) next = pushLog(next, 'Dummy derrotado')
    return next
  }

  const DUMMY_P = 2
  const DUMMY_T = 2
  for (const a of attackers) {
    const ap = Math.max(0, effectivePower(a))
    const at = effectiveToughness(a)
    next = {
      ...next,
      objects: next.objects.map((o) =>
        o.id === a.id ? { ...o, damage: (o.damage ?? 0) + DUMMY_P, attacking: false } : o,
      ),
    }
    next = pushLog(next, `${a.name} (${ap}/${at}) vs dummy 2/2`)
    if (ap >= DUMMY_T) {
      next = pushLog(next, `Dummy blocker destruido por ${a.name}`)
    } else {
      next = pushLog(next, `Dummy blocker sobrevive (${DUMMY_T - ap} toughness)`)
    }
  }
  next = applyStateBasedActions(next)
  return next
}

export function nextPhase(state: PlayState): PlayState {
  const idx = PHASES.indexOf(state.phase)
  if (idx < PHASES.length - 1) {
    const phase = PHASES[idx + 1]
    let next = { ...state, phase }
    if (phase === 'untap') next = untapAll(next)
    if (phase === 'draw') next = drawCards({ ...next, mana: { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 } }, 1)
    if (phase === 'untap' || phase === 'main1') {
      next = { ...next, mana: { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 } }
    }
    if (phase === 'end') {
      next = {
        ...next,
        objects: next.objects.map((o) => (o.zone === 'battlefield' ? { ...o, damage: 0 } : o)),
      }
    }
    return pushLog(next, `Fase ${phaseLabel(phase)}`)
  }
  let next: PlayState = {
    ...state,
    turn: state.turn + 1,
    phase: 'untap',
    mana: { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 },
  }
  next = untapAll(next)
  next = { ...next, phase: 'draw' }
  next = drawCards(next, 1)
  next = { ...next, phase: 'main1' }
  return pushLog(next, `Turno ${next.turn} · Main 1`)
}

export function setResource(
  state: PlayState,
  key: 'life' | 'poison' | 'energy' | 'experience' | 'opponentLife',
  delta: number,
): PlayState {
  return { ...state, [key]: Math.max(0, state[key] + delta) }
}

export function setMana(state: PlayState, color: keyof PlayState['mana'], delta: number): PlayState {
  return {
    ...state,
    mana: { ...state.mana, [color]: Math.max(0, state.mana[color] + delta) },
  }
}

export function adjustCounter(state: PlayState, objId: string, label: string, delta: number): PlayState {
  const objects = state.objects.map((o) => {
    if (o.id !== objId) return o
    const existing = o.counters.find((c) => c.label === label)
    if (!existing && delta > 0) {
      return {
        ...o,
        counters: [...o.counters, { id: uid('ctr'), label, amount: delta }],
      }
    }
    return {
      ...o,
      counters: o.counters
        .map((c) => (c.label === label ? { ...c, amount: c.amount + delta } : c))
        .filter((c) => c.amount > 0),
    }
  })
  return applyStateBasedActions({ ...state, objects })
}

export function shuffleLibrary(state: PlayState): PlayState {
  const lib = shuffle(objectsIn(state, 'library'))
  const others = state.objects.filter((o) => o.zone !== 'library')
  return pushLog({ ...state, objects: [...others, ...lib] }, 'Biblioteca barajada')
}

/** Create tokens parsed from a card's oracle text (optionally with Scryfall art). */
export async function createTokensFromOracle(
  state: PlayState,
  oracleText: string,
  withArt = true,
): Promise<PlayState> {
  const parsed = parseCreateTokens(oracleText)
  if (!parsed.length) return pushLog(state, 'No se encontraron tokens en el texto oracle')
  const images: (string | undefined)[] = []
  if (withArt) {
    for (const t of parsed) {
      images.push(await fetchTokenImage(t))
    }
  }
  return addParsedTokens(state, parsed, images)
}

const SAVE_KEY = 'mana-binder-playtest'

export function savePlayState(
  state: PlayState,
  meta: { commanderId: string; deckName: string; cardIds: string[] },
): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ ...meta, state, savedAt: Date.now() }))
  } catch {
    /* quota */
  }
}

export function loadPlayState(): {
  commanderId: string
  deckName: string
  cardIds: string[]
  state: PlayState
} | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as {
      commanderId: string
      deckName: string
      cardIds: string[]
      state: PlayState
    }
    return { ...parsed, state: normalizePlayState(parsed.state) }
  } catch {
    return null
  }
}

export function clearSavedPlayState(): void {
  localStorage.removeItem(SAVE_KEY)
}

export function discardHand(state: PlayState): PlayState {
  const handIds = new Set(objectsIn(state, 'hand').map((o) => o.id))
  if (!handIds.size) return state
  const objects = state.objects.map((o) =>
    handIds.has(o.id) ? { ...o, zone: 'graveyard' as ZoneId, tapped: false, attacking: false } : o,
  )
  return pushLog({ ...state, objects }, `Descarta la mano (${handIds.size})`)
}

export { canPayMana, formatManaNeed, parseManaCost } from './playMana'
export { parseCreateTokens } from './playTokens'
export { effectivePower, effectiveToughness } from './playRules'
