import { Capacitor } from '@capacitor/core'

/**
 * One SQL interface, two engines behind it.
 *
 *   Android — @capacitor-community/sqlite, a real SQLite file in the app's
 *             private storage. This is the one that ships.
 *   Web     — sql.js (SQLite compiled to WASM) held in memory and flushed to
 *             IndexedDB. Development and preview only.
 *
 * The web side deliberately does NOT use the plugin's own web implementation.
 * That routes through `jeep-sqlite`, a Stencil custom element whose lazy chunk
 * never hydrates under Vite — the element registers, every method silently
 * queues forever, and the app hangs on a splash screen with no error to show
 * for it. Driving sql.js directly is about eighty lines, has no custom-element
 * lifecycle to lose a race with, and lets each platform load only its own
 * engine instead of shipping both inside the APK.
 */

export interface SqlDriver {
  query<T>(sql: string, params?: unknown[]): Promise<T[]>
  run(sql: string, params?: unknown[]): Promise<void>
  /** Several statements at once, for migrations. */
  execScript(sql: string): Promise<void>
  begin(): Promise<void>
  commit(): Promise<void>
  rollback(): Promise<void>
  /** Flush to durable storage. A no-op where writes already hit a file. */
  persist(): Promise<void>
  /** The whole database as bytes, for backup and export. */
  exportBytes(): Promise<Uint8Array>
  /** Replace the database wholesale, for restore. */
  importBytes(bytes: Uint8Array): Promise<void>
  close(): Promise<void>
}

export const DB_NAME = 'krishikhata'

/* ------------------------------------------------------------------ *
 * Web: sql.js + IndexedDB
 * ------------------------------------------------------------------ */

const IDB_NAME = 'krishikhata-store'
const IDB_STORE = 'db'
const IDB_KEY = 'main'

function idb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1)
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(IDB_STORE)) req.result.createObjectStore(IDB_STORE)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function idbGet(): Promise<Uint8Array | null> {
  const store = await idb()
  return new Promise((resolve, reject) => {
    const tx = store.transaction(IDB_STORE, 'readonly')
    const req = tx.objectStore(IDB_STORE).get(IDB_KEY)
    req.onsuccess = () => resolve((req.result as Uint8Array | undefined) ?? null)
    req.onerror = () => reject(req.error)
  })
}

async function idbPut(bytes: Uint8Array): Promise<void> {
  const store = await idb()
  return new Promise((resolve, reject) => {
    const tx = store.transaction(IDB_STORE, 'readwrite')
    tx.objectStore(IDB_STORE).put(bytes, IDB_KEY)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

async function createWebDriver(): Promise<SqlDriver> {
  // Let Vite resolve and fingerprint the wasm out of node_modules rather than
  // keeping a hand-copied duplicate in public/, which silently goes stale the
  // first time sql.js is upgraded.
  const { default: wasmUrl } = await import('sql.js/dist/sql-wasm.wasm?url')
  const initSqlJs = (await import('sql.js')).default
  const SQL = await initSqlJs({ locateFile: () => wasmUrl })

  const existing = await idbGet().catch(() => null)
  let database = existing ? new SQL.Database(existing) : new SQL.Database()

  const toRows = <T,>(sql: string, params: unknown[]): T[] => {
    const stmt = database.prepare(sql)
    try {
      if (params.length) stmt.bind(params as never)
      const rows: T[] = []
      while (stmt.step()) rows.push(stmt.getAsObject() as T)
      return rows
    } finally {
      stmt.free()
    }
  }

  return {
    async query<T>(sql: string, params: unknown[] = []) {
      return toRows<T>(sql, params)
    },
    async run(sql: string, params: unknown[] = []) {
      database.run(sql, params as never)
    },
    async execScript(sql: string) {
      database.exec(sql)
    },
    async begin() {
      database.exec('BEGIN;')
    },
    async commit() {
      database.exec('COMMIT;')
    },
    async rollback() {
      database.exec('ROLLBACK;')
    },
    async persist() {
      await idbPut(database.export())
    },
    async exportBytes() {
      return database.export()
    },
    async importBytes(bytes: Uint8Array) {
      database.close()
      database = new SQL.Database(bytes)
      await idbPut(database.export())
    },
    async close() {
      await idbPut(database.export()).catch(() => {})
      database.close()
    },
  }
}

/* ------------------------------------------------------------------ *
 * Android: @capacitor-community/sqlite
 * ------------------------------------------------------------------ */

async function createNativeDriver(): Promise<SqlDriver> {
  const mod = await import('@capacitor-community/sqlite')
  const sqlite = new mod.SQLiteConnection(mod.CapacitorSQLite)

  // A hot reload can leave the previous connection registered; reuse it
  // rather than creating a second, which the plugin rejects outright.
  const consistent = await sqlite.checkConnectionsConsistency().catch(() => ({ result: false }))
  const existing = await sqlite.isConnection(DB_NAME, false).catch(() => ({ result: false }))

  const conn =
    consistent.result && existing.result
      ? await sqlite.retrieveConnection(DB_NAME, false)
      : await sqlite.createConnection(DB_NAME, false, 'no-encryption', 1, false)

  await conn.open()

  return {
    async query<T>(sql: string, params: unknown[] = []) {
      const res = await conn.query(sql, params as never[])
      return (res.values ?? []) as T[]
    },
    async run(sql: string, params: unknown[] = []) {
      await conn.run(sql, params as never[], false)
    },
    async execScript(sql: string) {
      await conn.execute(sql)
    },
    async begin() {
      await conn.beginTransaction()
    },
    async commit() {
      await conn.commitTransaction()
    },
    async rollback() {
      await conn.rollbackTransaction()
    },
    async persist() {
      // Already on disk.
    },
    async exportBytes() {
      // The plugin exposes JSON rather than raw bytes; the backup layer uses
      // its own JSON snapshot, so this stays unimplemented rather than
      // pretending to hand back a valid SQLite file.
      throw new Error('exportBytes is web-only; use the JSON backup on Android')
    },
    async importBytes() {
      throw new Error('importBytes is web-only; use the JSON backup on Android')
    },
    async close() {
      await sqlite.closeConnection(DB_NAME, false).catch(() => {})
    },
  }
}

export function createDriver(): Promise<SqlDriver> {
  return Capacitor.isNativePlatform() ? createNativeDriver() : createWebDriver()
}
