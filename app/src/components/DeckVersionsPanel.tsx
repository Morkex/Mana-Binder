import { useMemo, useState } from 'react'
import type { Card } from '../types'
import {
  compareSnapshots,
  listDeckVersions,
  type DeckSnapshot,
} from '../lib/deckVersions'
import { runHandBatch } from '../lib/goldfishSim'
import { resolveVirtualBasicFromId } from '../lib/basicLands'

export function DeckVersionsPanel({
  deckId,
  cards,
}: {
  deckId: string
  cards: Card[]
}) {
  const versions = listDeckVersions(deckId)
  const [aId, setAId] = useState(versions[1]?.id ?? versions[0]?.id ?? '')
  const [bId, setBId] = useState(versions[0]?.id ?? '')

  const byId = useMemo(() => new Map(cards.map((c) => [c.id, c])), [cards])

  const nameOf = (id: string) =>
    byId.get(id)?.name ?? resolveVirtualBasicFromId(id, cards)?.name ?? id.slice(0, 8)

  const a = versions.find((v) => v.id === aId)
  const b = versions.find((v) => v.id === bId)
  const diff = a && b ? compareSnapshots(a, b) : null

  const goldfishCompare = useMemo(() => {
    if (!a || !b) return null
    const resolve = (snap: DeckSnapshot) =>
      snap.cardIds
        .map((id) => byId.get(id) ?? resolveVirtualBasicFromId(id, cards))
        .filter((c): c is Card => Boolean(c))
    return { ha: runHandBatch(resolve(a), 80), hb: runHandBatch(resolve(b), 80) }
  }, [a, b, byId, cards])

  if (versions.length === 0) {
    return (
      <div className="versions-box">
        <p className="export-box__title">Historial de versiones</p>
        <p className="muted">Guarda el mazo para crear el primer snapshot.</p>
      </div>
    )
  }

  return (
    <div className="versions-box">
      <p className="export-box__title">Historial / comparar</p>
      <p className="muted">
        {versions.length} snapshot{versions.length === 1 ? '' : 's'} · máx. 20
      </p>
      <ul className="versions-box__list">
        {versions.slice(0, 8).map((v) => (
          <li key={v.id}>
            <strong>{v.label}</strong>
            <span>
              {new Date(v.createdAt).toLocaleString('es')} · {v.cardIds.length} cartas
              {v.healthSummary
                ? ` · lands ${v.healthSummary.lands} · owned ${v.healthSummary.ownedPct ?? '—'}% · huecos ${v.healthSummary.gaps}`
                : ''}
            </span>
          </li>
        ))}
      </ul>
      {versions.length >= 2 && (
        <>
          <div className="versions-box__pick">
            <label>
              A
              <select value={aId} onChange={(e) => setAId(e.target.value)}>
                {versions.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              B
              <select value={bId} onChange={(e) => setBId(e.target.value)}>
                {versions.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {diff && (
            <div className="versions-box__diff">
              <p>
                A {diff.aCount} → B {diff.bCount} · +{diff.added.length} / −{diff.removed.length}
                {diff.ownedPctA != null && diff.ownedPctB != null
                  ? ` · owned ${diff.ownedPctA}% → ${diff.ownedPctB}%`
                  : ''}
              </p>
              {diff.roleDiffs.length > 0 && (
                <ul className="versions-box__roles">
                  {diff.roleDiffs.slice(0, 8).map((r) => (
                    <li key={r.key}>
                      {r.key}: {r.a} → {r.b} ({r.delta > 0 ? '+' : ''}
                      {r.delta})
                    </li>
                  ))}
                </ul>
              )}
              {diff.added.length > 0 && (
                <p>
                  <strong>Añadidas:</strong> {diff.added.slice(0, 12).map(nameOf).join(', ')}
                  {diff.added.length > 12 ? '…' : ''}
                </p>
              )}
              {diff.removed.length > 0 && (
                <p>
                  <strong>Quitadas:</strong> {diff.removed.slice(0, 12).map(nameOf).join(', ')}
                  {diff.removed.length > 12 ? '…' : ''}
                </p>
              )}
              {goldfishCompare && (
                <p className="versions-box__gf">
                  Goldfish 80 manos — keep A {(goldfishCompare.ha.keepRate * 100).toFixed(0)}% vs B{' '}
                  {(goldfishCompare.hb.keepRate * 100).toFixed(0)}% · lands{' '}
                  {goldfishCompare.ha.avgLands.toFixed(1)} vs {goldfishCompare.hb.avgLands.toFixed(1)}
                </p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
