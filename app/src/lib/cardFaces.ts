import type { Card, CardFaceData, CardImages } from '../types'
import { detailImageUrl, imageUrl } from './mtg'

export interface CardFaceView {
  name: string
  typeLine: string
  manaCost: string
  oracleText: string
  power: string | null
  toughness: string | null
  loyalty: string | null
  imageDetail: string
  imageDetailFallback: string
  imageGrid: string
}

const MULTI_FACE_LAYOUTS = new Set([
  'transform',
  'modal_dfc',
  'adventure',
  'meld',
  'split',
  'flip',
  'reversible_card',
])

function collectionPath(rel: string | undefined | null): string {
  if (!rel) return ''
  return `/collection/${rel.replace(/^\/+/, '')}`
}

function splitFaces(value: string): string[] {
  if (!value.includes('//')) return [value.trim()]
  return value.split('//').map((part) => part.trim())
}

function swapFaceInUrl(url: string, side: 'front' | 'back'): string {
  if (!url) return ''
  const target = side === 'back' ? '/back/' : '/front/'
  const other = side === 'back' ? '/front/' : '/back/'
  return url.includes(other) ? url.replace(other, target) : url
}

function backLocalPath(local: string | undefined): string {
  if (!local) return ''
  if (local.includes('_back.')) return collectionPath(local)
  const dot = local.lastIndexOf('.')
  if (dot < 0) return collectionPath(local)
  return collectionPath(`${local.slice(0, dot)}_back${local.slice(dot)}`)
}

function faceImagesToUrls(images: CardImages, side: 'front' | 'back'): { detail: string; detailFallback: string; grid: string } {
  const localHq = side === 'back' ? images.localHq : images.localHq
  const local = side === 'back' ? images.local : images.local
  const remotePng = images.png || images.large || images.normal || ''
  const remoteNormal = images.normal || images.small || ''

  const detailLocal = side === 'back' ? backLocalPath(localHq || local) : collectionPath(localHq || local)
  const gridLocal = side === 'back' ? backLocalPath(local) : collectionPath(local)
  const detailRemote = swapFaceInUrl(remotePng || remoteNormal, side)
  const gridRemote = swapFaceInUrl(remoteNormal, side)

  return {
    detail: detailLocal || detailRemote,
    detailFallback: detailRemote,
    grid: gridLocal || gridRemote,
  }
}

function storedFaceToView(face: CardFaceData): CardFaceView {
  const detail =
    collectionPath(face.images.localHq) ||
    face.images.png ||
    face.images.large ||
    face.images.normal ||
    ''
  const grid =
    collectionPath(face.images.local) || face.images.normal || face.images.small || ''
  return {
    name: face.name,
    typeLine: face.typeLine,
    manaCost: face.manaCost,
    oracleText: face.oracleText,
    power: face.power,
    toughness: face.toughness,
    loyalty: face.loyalty,
    imageDetail: detail,
    imageDetailFallback: face.images.png || face.images.large || face.images.normal || '',
    imageGrid: grid,
  }
}

export function isMultiFaceCard(card: Card): boolean {
  if (card.faces && card.faces.length > 1) return true
  if (card.layout && MULTI_FACE_LAYOUTS.has(card.layout)) return true
  return card.name.includes('//') || card.typeLine.includes('//')
}

export function getCardFaces(card: Card): CardFaceView[] {
  if (card.faces?.length) {
    return card.faces.map(storedFaceToView)
  }

  const names = splitFaces(card.name)
  if (names.length < 2) {
    return [
      {
        name: card.name,
        typeLine: card.typeLine,
        manaCost: card.manaCost,
        oracleText: card.oracleText,
        power: card.power,
        toughness: card.toughness,
        loyalty: card.loyalty,
        imageDetail: detailImageUrl(card),
        imageDetailFallback: card.images?.png || card.images?.large || card.images?.normal || '',
        imageGrid: imageUrl(card),
      },
    ]
  }

  const types = splitFaces(card.typeLine)
  const costs = splitFaces(card.manaCost)
  const texts = card.oracleText.includes('//') ? splitFaces(card.oracleText) : []

  const frontUrls = faceImagesToUrls(card.images, 'front')
  const backUrls = faceImagesToUrls(card.images, 'back')

  return names.map((name, index) => ({
    name,
    typeLine: types[index] ?? types[0] ?? '',
    manaCost: costs[index] ?? '',
    oracleText: texts[index] ?? '',
    power: index === 0 ? card.power : null,
    toughness: index === 0 ? card.toughness : null,
    loyalty: index === 0 ? card.loyalty : null,
    imageDetail: index === 0 ? frontUrls.detail : backUrls.detail,
    imageDetailFallback: index === 0 ? frontUrls.detailFallback : backUrls.detailFallback,
    imageGrid: index === 0 ? frontUrls.grid : backUrls.grid,
  }))
}

export function primaryFaceName(card: Card): string {
  return getCardFaces(card)[0]?.name ?? card.name.split('//')[0]?.trim() ?? card.name
}
