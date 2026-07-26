import type { Card } from '../types'
import { detectCardRoles, type CardRole } from './cardRoles'
import { getPrimaryType } from './mtg'
import { analyzeDeck } from './deckAnalysis'

export type DeckGoal = 'casual' | 'power7' | 'high' | 'tribal' | 'combo' | 'budget'

export interface RoleTarget {
  role: CardRole | 'lands' | 'interaction'
  label: string
  min: number
  max: number
}

export interface RoleHealthRow {
  key: string
  label: string
  count: number
  min: number
  max: number
  status: 'ok' | 'low' | 'high'
}

export interface DeckHealth {
  goal: DeckGoal
  rows: RoleHealthRow[]
  gaps: string[]
  avgCmc: number
  lands: number
}

const GOAL_TARGETS: Record<DeckGoal, RoleTarget[]> = {
  casual: [
    { role: 'lands', label: 'Tierras', min: 35, max: 40 },
    { role: 'ramp', label: 'Ramp', min: 8, max: 14 },
    { role: 'draw', label: 'Robo', min: 8, max: 14 },
    { role: 'interaction', label: 'Interacción', min: 8, max: 14 },
    { role: 'wipe', label: 'Wipes', min: 2, max: 5 },
    { role: 'protection', label: 'Protección', min: 2, max: 6 },
    { role: 'tutor', label: 'Tutores', min: 0, max: 6 },
  ],
  power7: [
    { role: 'lands', label: 'Tierras', min: 34, max: 38 },
    { role: 'ramp', label: 'Ramp', min: 10, max: 14 },
    { role: 'draw', label: 'Robo', min: 10, max: 15 },
    { role: 'interaction', label: 'Interacción', min: 10, max: 16 },
    { role: 'wipe', label: 'Wipes', min: 2, max: 4 },
    { role: 'protection', label: 'Protección', min: 3, max: 7 },
    { role: 'tutor', label: 'Tutores', min: 2, max: 8 },
  ],
  high: [
    { role: 'lands', label: 'Tierras', min: 32, max: 36 },
    { role: 'ramp', label: 'Ramp', min: 10, max: 15 },
    { role: 'draw', label: 'Robo', min: 10, max: 16 },
    { role: 'interaction', label: 'Interacción', min: 12, max: 18 },
    { role: 'wipe', label: 'Wipes', min: 1, max: 4 },
    { role: 'protection', label: 'Protección', min: 3, max: 8 },
    { role: 'tutor', label: 'Tutores', min: 4, max: 10 },
  ],
  tribal: [
    { role: 'lands', label: 'Tierras', min: 35, max: 39 },
    { role: 'ramp', label: 'Ramp', min: 8, max: 12 },
    { role: 'draw', label: 'Robo', min: 8, max: 12 },
    { role: 'interaction', label: 'Interacción', min: 6, max: 12 },
    { role: 'wipe', label: 'Wipes', min: 1, max: 4 },
    { role: 'protection', label: 'Protección', min: 2, max: 5 },
    { role: 'tutor', label: 'Tutores', min: 1, max: 6 },
  ],
  combo: [
    { role: 'lands', label: 'Tierras', min: 30, max: 36 },
    { role: 'ramp', label: 'Ramp', min: 10, max: 16 },
    { role: 'draw', label: 'Robo', min: 10, max: 16 },
    { role: 'interaction', label: 'Interacción', min: 8, max: 14 },
    { role: 'wipe', label: 'Wipes', min: 0, max: 3 },
    { role: 'protection', label: 'Protección', min: 4, max: 10 },
    { role: 'tutor', label: 'Tutores', min: 5, max: 12 },
  ],
  budget: [
    { role: 'lands', label: 'Tierras', min: 36, max: 40 },
    { role: 'ramp', label: 'Ramp', min: 10, max: 14 },
    { role: 'draw', label: 'Robo', min: 8, max: 12 },
    { role: 'interaction', label: 'Interacción', min: 8, max: 12 },
    { role: 'wipe', label: 'Wipes', min: 2, max: 4 },
    { role: 'protection', label: 'Protección', min: 1, max: 4 },
    { role: 'tutor', label: 'Tutores', min: 0, max: 4 },
  ],
}

function countRole(cards: Card[], role: CardRole | 'lands' | 'interaction'): number {
  if (role === 'lands') return cards.filter((c) => getPrimaryType(c.typeLine) === 'Land').length
  if (role === 'interaction') {
    return cards.filter((c) => {
      const r = detectCardRoles(c)
      return r.includes('removal') || r.includes('counter') || r.includes('wipe')
    }).length
  }
  return cards.filter((c) => detectCardRoles(c).includes(role)).length
}

export function analyzeDeckHealth(
  commander: Card | null,
  deck: Card[],
  goal: DeckGoal = 'casual',
): DeckHealth {
  const all = commander ? [commander, ...deck] : deck
  const analysis = analyzeDeck(commander, deck)
  const targets = GOAL_TARGETS[goal]
  const rows: RoleHealthRow[] = targets.map((t) => {
    const count = countRole(all, t.role)
    let status: RoleHealthRow['status'] = 'ok'
    if (count < t.min) status = 'low'
    else if (count > t.max) status = 'high'
    return {
      key: String(t.role),
      label: t.label,
      count,
      min: t.min,
      max: t.max,
      status,
    }
  })

  const gaps: string[] = []
  for (const row of rows) {
    if (row.status === 'low') {
      const need = row.min - row.count
      gaps.push(`Te faltan ~${need} de ${row.label.toLowerCase()} (vas ${row.count}, objetivo ${row.min}–${row.max}).`)
    } else if (row.status === 'high') {
      gaps.push(`Vas alto en ${row.label.toLowerCase()} (${row.count}; tope típico ${row.max}). Considera recortar.`)
    }
  }
  if (analysis.avgCmc > 3.8 && goal !== 'tribal') {
    gaps.push(`Curva alta (CMC medio ${analysis.avgCmc}). Prioriza hechizos baratos o más ramp.`)
  }
  if (all.length < 100) {
    gaps.push(`El mazo tiene ${all.length} cartas (comandante+99). Faltan ${100 - all.length} para 100.`)
  } else if (all.length > 100) {
    gaps.push(`El mazo tiene ${all.length} cartas; recorta ${all.length - 100} para legalidad Commander.`)
  }

  return {
    goal,
    rows,
    gaps,
    avgCmc: analysis.avgCmc,
    lands: analysis.lands,
  }
}
