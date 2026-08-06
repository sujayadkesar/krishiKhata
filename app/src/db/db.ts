import { Capacitor } from '@capacitor/core'
import { createDriver, type SqlDriver } from './driver'
import { MIGRATIONS } from './schema'

/**
 * The one database handle, and the only place SQL is executed.
 *
 * Screens call `all` / `one` / `scalar` to read and `run` / `tx` to write.
 * Nothing else should reach for the driver directly — the serialisation and
 * the persistence flush both live here, and a write that goes round them is a
 * write that can interleave with another or fail to be saved.
 */

let driver: SqlDriver | null = null
let opening: Promise<SqlDriver> | null = null

export const isNative = () => Capacitor.isNativePlatform()
export const isWeb = () => !Capacitor.isNativePlatform()

async function openInternal(): Promise<SqlDriver> {
  const d = await createDriver()
  await d.execScript('PRAGMA foreign_keys = ON;')
  await migrate(d)
  driver = d
  return d
}

export function getDb(): Promise<SqlDriver> {
  if (driver) return Promise.resolve(driver)
  if (!opening) {
    opening = openInternal().catch((err: unknown) => {
      // Let the next caller retry rather than caching a rejected promise
      // forever — a transient failure on first launch would be permanent.
      opening = null
      throw err
    })
  }
  return opening
}

/* ------------------------------------------------------------------ *
 * Migrations
 * ------------------------------------------------------------------ */

async function currentVersion(d: SqlDriver): Promise<number> {
  const rows = await d.query<Record<string, number>>('PRAGMA user_version;')
  const row = rows[0]
  return row ? Number(Object.values(row)[0] ?? 0) : 0
}

async function migrate(d: SqlDriver): Promise<void> {
  const from = await currentVersion(d)
  if (from >= MIGRATIONS.length) return

  for (let v = from; v < MIGRATIONS.length; v++) {
    await d.execScript(MIGRATIONS[v])
    // PRAGMA does not accept a bound parameter.
    await d.execScript(`PRAGMA user_version = ${v + 1};`)
  }
  await d.persist()
}

/* ------------------------------------------------------------------ *
 * Persistence
 * ------------------------------------------------------------------ */

let saveTimer: ReturnType<typeof setTimeout> | null = null

/**
 * Flush to durable storage. Free on Android, where the write already hit a
 * file; on the web it serialises the whole database, so it is debounced —
 * otherwise a burst of inserts would re-serialise once per row.
 */
export function save(): void {
  if (isNative()) return
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    saveTimer = null
    void driver?.persist().catch(() => {
      // A dropped debounced save is recoverable; the next write saves again.
    })
  }, 250)
}

/** Force an immediate flush — before backgrounding, backup or restore. */
export async function saveNow(): Promise<void> {
  if (saveTimer) {
    clearTimeout(saveTimer)
    saveTimer = null
  }
  await driver?.persist().catch(() => {})
}

/* ------------------------------------------------------------------ *
 * Reads
 * ------------------------------------------------------------------ */

export async function all<T>(sql: string, params: unknown[] = []): Promise<T[]> {
  const d = await getDb()
  return d.query<T>(sql, params)
}

export async function one<T>(sql: string, params: unknown[] = []): Promise<T | null> {
  const rows = await all<T>(sql, params)
  return rows[0] ?? null
}

/** A single scalar, for counts and sums. Returns 0 rather than null. */
export async function scalar(sql: string, params: unknown[] = []): Promise<number> {
  const row = await one<Record<string, unknown>>(sql, params)
  if (!row) return 0
  const v = Object.values(row)[0]
  return typeof v === 'number' ? v : Number(v ?? 0)
}

/* ------------------------------------------------------------------ *
 * Writes
 * ------------------------------------------------------------------ */

/**
 * Writes are serialised through this chain.
 *
 * React can fire two saves from one screen — a double-tapped button, an effect
 * racing a submit — and interleaving them across a transaction boundary is how
 * a payment gets allocated twice. Cheap insurance, even on a single-user app.
 */
let writeChain: Promise<unknown> = Promise.resolve()

export function serialise<T>(fn: () => Promise<T>): Promise<T> {
  const next = writeChain.then(fn, fn)
  writeChain = next.catch(() => {})
  return next
}

export async function run(sql: string, params: unknown[] = []): Promise<void> {
  await serialise(async () => {
    const d = await getDb()
    await d.run(sql, params)
  })
  save()
}

/**
 * Run several statements atomically — either all land or none do, which is
 * what a payment plus its allocations plus its expense row needs.
 *
 * The callback is handed a `run` that must be used for every statement inside
 * it; going back to the module-level `run` would deadlock on the write chain.
 */
export async function tx(
  work: (run: (sql: string, params?: unknown[]) => Promise<void>) => Promise<void>,
): Promise<void> {
  await serialise(async () => {
    const d = await getDb()
    await d.begin()
    try {
      await work((sql, params = []) => d.run(sql, params))
      await d.commit()
    } catch (err) {
      await d.rollback().catch(() => {})
      throw err
    }
  })
  save()
}

/* ------------------------------------------------------------------ *
 * Maintenance
 * ------------------------------------------------------------------ */

export async function closeDb(): Promise<void> {
  if (!driver) return
  await driver.close().catch(() => {})
  driver = null
  opening = null
}

/** Every row of the named tables, for the backup snapshot. */
export async function exportTables(tables: string[]): Promise<Record<string, unknown[]>> {
  const out: Record<string, unknown[]> = {}
  for (const t of tables) out[t] = await all(`SELECT * FROM ${t};`)
  return out
}
