import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { Card, CollectionMaster, SavedDeck } from '../types'

interface CollectionContextValue {
  loading: boolean
  error: string | null
  master: CollectionMaster | null
  cards: Card[]
  reload: () => void
  savedDecks: SavedDeck[]
  saveDeck: (deck: Omit<SavedDeck, 'id' | 'updatedAt'> & { id?: string }) => void
  deleteDeck: (id: string) => void
}

const CollectionContext = createContext<CollectionContextValue | null>(null)
const DECKS_KEY = 'mana-binder-decks'

export function CollectionProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [master, setMaster] = useState<CollectionMaster | null>(null)
  const [savedDecks, setSavedDecks] = useState<SavedDeck[]>(() => {
    try {
      const raw = localStorage.getItem(DECKS_KEY)
      return raw ? (JSON.parse(raw) as SavedDeck[]) : []
    } catch {
      return []
    }
  })

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    fetch('/collection/coleccion_maestra.json')
      .then((r) => {
        if (!r.ok) throw new Error(`No se pudo cargar la colección (${r.status})`)
        return r.json() as Promise<CollectionMaster>
      })
      .then((data) => {
        setMaster(data)
        setLoading(false)
      })
      .catch((err: Error) => {
        setError(err.message)
        setLoading(false)
      })
  }, [])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    localStorage.setItem(DECKS_KEY, JSON.stringify(savedDecks))
  }, [savedDecks])

  const saveDeck = useCallback(
    (deck: Omit<SavedDeck, 'id' | 'updatedAt'> & { id?: string }) => {
      setSavedDecks((prev) => {
        const id = deck.id ?? crypto.randomUUID()
        const next: SavedDeck = {
          id,
          name: deck.name,
          commanderId: deck.commanderId,
          cardIds: deck.cardIds,
          notes: deck.notes ?? '',
          updatedAt: new Date().toISOString(),
        }
        const idx = prev.findIndex((d) => d.id === id)
        if (idx >= 0) {
          const copy = [...prev]
          copy[idx] = next
          return copy
        }
        return [next, ...prev]
      })
    },
    [],
  )

  const deleteDeck = useCallback((id: string) => {
    setSavedDecks((prev) => prev.filter((d) => d.id !== id))
  }, [])

  const value = useMemo(
    () => ({
      loading,
      error,
      master,
      cards: master?.cards ?? [],
      reload: load,
      savedDecks,
      saveDeck,
      deleteDeck,
    }),
    [loading, error, master, load, savedDecks, saveDeck, deleteDeck],
  )

  return <CollectionContext.Provider value={value}>{children}</CollectionContext.Provider>
}

export function useCollection() {
  const ctx = useContext(CollectionContext)
  if (!ctx) throw new Error('useCollection debe usarse dentro de CollectionProvider')
  return ctx
}
