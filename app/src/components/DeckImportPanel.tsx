import { useRef, useState } from 'react'
import type { Card } from '../types'
import { importDeckFromText, type ImportDeckResult } from '../lib/importDeck'

export function DeckImportPanel({
  pool,
  onImported,
}: {
  pool: Card[]
  onImported: (result: ImportDeckResult, deckName: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [preview, setPreview] = useState<ImportDeckResult | null>(null)
  const [deckName, setDeckName] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const runParse = (raw: string) => {
    const result = importDeckFromText(raw, pool)
    setPreview(result)
    if (!deckName && result.commander) {
      setDeckName(`Mazo ${result.commander.name}`)
    }
  }

  const handleFile = async (file: File | null) => {
    if (!file) return
    const raw = await file.text()
    setText(raw)
    runParse(raw)
    if (!deckName) setDeckName(file.name.replace(/\.txt$/i, ''))
  }

  if (!open) {
    return (
      <button type="button" className="btn" onClick={() => setOpen(true)}>
        Importar lista (Moxfield / Archidekt)
      </button>
    )
  }

  return (
    <div className="import-box">
      <div className="import-box__head">
        <p className="export-box__title">Importar mazo</p>
        <button type="button" className="btn btn--ghost btn--sm" onClick={() => setOpen(false)}>
          Cerrar
        </button>
      </div>
      <p className="export-box__hint">
        Pega una lista de Moxfield, Archidekt o formato simple (<code>1 Card Name</code>). Las cartas
        deben existir en tu colección (las básicas son ilimitadas).
      </p>
      <textarea
        className="import-box__input"
        rows={8}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={`Commander\n1 Atraxa, Praetors' Voice\n\nDeck\n1 Sol Ring\n1 Cultivate\n...`}
      />
      <div className="import-box__actions">
        <button type="button" className="btn" onClick={() => runParse(text)} disabled={!text.trim()}>
          Analizar lista
        </button>
        <button type="button" className="btn btn--ghost" onClick={() => fileRef.current?.click()}>
          Subir .txt
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".txt,.csv,text/plain"
          hidden
          onChange={(e) => void handleFile(e.target.files?.[0] ?? null)}
        />
      </div>

      {preview && (
        <div className="import-box__preview">
          <p>
            <strong>Comandante:</strong>{' '}
            {preview.commander ? preview.commander.name : 'No encontrado en colección'}
          </p>
          <p>
            <strong>Mazo:</strong> {preview.deck.length} cartas
            {preview.maybeboard.length > 0 ? ` · Maybe ${preview.maybeboard.length}` : ''}
          </p>
          {preview.warnings.length > 0 && (
            <ul className="import-box__warn">
              {preview.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          )}
          {preview.missing.length > 0 && (
            <details className="import-box__missing">
              <summary>{preview.missing.length} no están en tu colección</summary>
              <ul>
                {preview.missing.slice(0, 40).map((m) => (
                  <li key={m}>{m}</li>
                ))}
                {preview.missing.length > 40 && <li>…y {preview.missing.length - 40} más</li>}
              </ul>
            </details>
          )}
          <label className="field">
            <span>Nombre del mazo</span>
            <input value={deckName} onChange={(e) => setDeckName(e.target.value)} />
          </label>
          <button
            type="button"
            className="btn btn--primary"
            disabled={!preview.commander || preview.deck.length === 0}
            onClick={() => {
              onImported(preview, deckName || `Mazo ${preview.commander?.name ?? 'importado'}`)
              setOpen(false)
              setText('')
              setPreview(null)
            }}
          >
            Cargar en el constructor
          </button>
        </div>
      )}
    </div>
  )
}
