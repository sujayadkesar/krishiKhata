import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Reading from SQLite in a screen.
 *
 * There is no reactive query layer here on purpose. Dexie gave the previous
 * project live queries for free; @capacitor-community/sqlite does not, and
 * bolting on change-tracking for a single-user app would be more machinery
 * than it is worth. Instead writes announce themselves and interested screens
 * re-run their query — coarse, but a farm ledger holds thousands of rows, not
 * millions, and the whole dashboard re-queries in a few milliseconds.
 */

const listeners = new Set<() => void>()

/** Call after any write so open screens pick the change up. */
export function notifyDataChanged(): void {
  for (const fn of listeners) fn()
}

export function onDataChanged(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export interface QueryState<T> {
  data: T | null
  loading: boolean
  error: Error | null
  reload: () => void
}

export function useQuery<T>(run: () => Promise<T>, deps: unknown[] = []): QueryState<T> {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  // Keeps the latest callback without making it a dependency of the effect,
  // so an inline arrow at the call site does not re-query on every render.
  const runRef = useRef(run)
  runRef.current = run

  const [tick, setTick] = useState(0)
  const reload = useCallback(() => setTick((t) => t + 1), [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)

    runRef
      .current()
      .then((result) => {
        if (cancelled) return
        setData(result)
        setError(null)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setError(err instanceof Error ? err : new Error(String(err)))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, ...deps])

  useEffect(() => onDataChanged(reload), [reload])

  return { data, loading, error, reload }
}
