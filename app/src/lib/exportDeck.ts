import type { Card } from '../types'
import { countByName } from './basicLands'

/** Formato compatible con importación de Moxfield (Commander). */
export function toMoxfieldList(commander: Card, deck: Card[]): string {
  const lines = [
    'Commander',
    `1 ${commander.name}`,
    '',
    'Deck',
    ...countByName(deck).map(({ name, count }) => `${count} ${name}`),
  ]
  return lines.join('\n')
}

/** Lista simple con cantidades agrupadas. */
export function toSimpleList(commander: Card, deck: Card[]): string {
  const lines = [
    `1 ${commander.name}`,
    ...countByName(deck).map(({ name, count }) => `${count} ${name}`),
  ]
  return lines.join('\n')
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    try {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.style.position = 'fixed'
      ta.style.left = '-9999px'
      document.body.appendChild(ta)
      ta.select()
      const ok = document.execCommand('copy')
      document.body.removeChild(ta)
      return ok
    } catch {
      return false
    }
  }
}

export function downloadTextFile(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename.endsWith('.txt') ? filename : `${filename}.txt`
  a.click()
  URL.revokeObjectURL(url)
}

export function safeFilename(name: string): string {
  return name.replace(/[<>:"/\\|?*]+/g, '_').trim() || 'mazo'
}
