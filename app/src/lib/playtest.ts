import type { Card } from '../types'
import { imageUrl } from './mtg'

export type ZoneId = 'library' | 'hand' | 'battlefield' | 'graveyard' | 'exile' | 'command'

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
  isToken: boolean
  power: string | null
  toughness: string | null
  counters: PlayCounter[]
  image?: string
}

export interface PlayState {
  turn: number
  phase: Phase
  life: number
  poison: number
  energy: number
  experience: number
  commanderTax: number
  mana: Record<'W' | 'U' | 'B' | 'R' | 'G' | 'C', number>
  objects: PlayObject[]
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
    isToken: false,
    power: card.power,
    toughness: card.toughness,
    counters: [],
    image: imageUrl(card),
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
    mana: { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 },
    objects: [cmd, ...library],
    log: [`Partida lista · ${library.length} en biblioteca · comandante en command zone`],
  }
}

function pushLog(state: PlayState, msg: string): PlayState {
  return { ...state, log: [`T${state.turn}: ${msg}`, ...state.log].slice(0, 80) }
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
  // Rebuild library order from shuffled
  const byId = new Map(objects.map((o) => [o.id, o]))
  const ordered = shuffled.map((s) => {
    const cur = byId.get(s.id)!
    return { ...cur, zone: drawIds.has(s.id) ? ('hand' as ZoneId) : ('library' as ZoneId) }
  })
  const cmd = objects.filter((o) => o.zone === 'command')
  const rest = objects.filter((o) => o.zone !== 'command' && o.zone !== 'library' && o.zone !== 'hand')
  return pushLog(
    { ...state, objects: [...cmd, ...ordered, ...rest] },
    `Mulligan → mano de ${keep}`,
  )
}

export function startHand(state: PlayState): PlayState {
  return drawCards(state, 7)
}

export function moveObject(state: PlayState, id: string, zone: ZoneId): PlayState {
  const obj = state.objects.find((o) => o.id === id)
  if (!obj) return state
  let commanderTax = state.commanderTax
  if (obj.zone === 'command' && zone === 'battlefield') {
    // casting commander — tax increases after it leaves later; apply when returning to command
  }
  if (zone === 'command' && obj.zone !== 'command' && obj.card) {
    commanderTax += 2
  }
  const objects = state.objects.map((o) =>
    o.id === id
      ? {
          ...o,
          zone,
          tapped: zone === 'battlefield' ? o.tapped : false,
        }
      : o,
  )
  return pushLog(
    { ...state, objects, commanderTax },
    `${obj.name} → ${zone}${zone === 'command' && obj.zone !== 'command' ? ` (tax ${commanderTax})` : ''}`,
  )
}

export function toggleTap(state: PlayState, id: string): PlayState {
  const objects = state.objects.map((o) =>
    o.id === id && o.zone === 'battlefield' ? { ...o, tapped: !o.tapped } : o,
  )
  return { ...state, objects }
}

export function untapAll(state: PlayState): PlayState {
  const objects = state.objects.map((o) =>
    o.zone === 'battlefield' ? { ...o, tapped: false } : o,
  )
  return pushLog({ ...state, objects }, 'Untap all')
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
    return pushLog(next, `Fase ${phaseLabel(phase)}`)
  }
  // New turn
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
  key: 'life' | 'poison' | 'energy' | 'experience',
  delta: number,
): PlayState {
  return { ...state, [key]: Math.max(0, state[key] + delta) }
}

export function setMana(
  state: PlayState,
  color: keyof PlayState['mana'],
  delta: number,
): PlayState {
  return {
    ...state,
    mana: { ...state.mana, [color]: Math.max(0, state.mana[color] + delta) },
  }
}

export function addToken(
  state: PlayState,
  name: string,
  power: string,
  toughness: string,
): PlayState {
  const token: PlayObject = {
    id: uid('tok'),
    card: null,
    name: name || 'Token',
    zone: 'battlefield',
    tapped: false,
    isToken: true,
    power,
    toughness,
    counters: [],
  }
  return pushLog({ ...state, objects: [...state.objects, token] }, `Token ${token.name} ${power}/${toughness}`)
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
  return { ...state, objects }
}

export function shuffleLibrary(state: PlayState): PlayState {
  const lib = shuffle(objectsIn(state, 'library'))
  const others = state.objects.filter((o) => o.zone !== 'library')
  return pushLog({ ...state, objects: [...others, ...lib] }, 'Biblioteca barajada')
}
