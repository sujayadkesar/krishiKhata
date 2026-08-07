import { Capacitor } from '@capacitor/core'
import { Filesystem, Directory } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'
import { exportTables, saveNow, tx } from '@/db/db'
import { SCHEMA_VERSION } from '@/db/schema'
import { notifyDataChanged } from '@/hooks/useQuery'
import { getSetting, setSetting } from './masterData'
import { todayISO } from '@/lib/date'

/**
 * Backup and restore.
 *
 * The snapshot is JSON rather than a copy of the SQLite file. A raw file is
 * only restorable by the schema version that wrote it, so a farmer restoring a
 * year-old backup onto a newer app would be stuck; JSON can be read by a later
 * version and migrated forward. It also means one format works on Android and
 * on the web, where the database is not a file at all.
 */

/** Order matters on restore: parents before the rows that reference them. */
export const BACKUP_TABLES = [
  'settings',
  'units',
  'accounts',
  'heads',
  'head_units',
  'sub_heads',
  'activities',
  'labourers',
  'entries',
  'photos',
  'work_sessions',
  'attendance',
  'labour_payments',
  'payment_allocations',
  'change_log',
] as const

export interface BackupFile {
  format: 'krishi-khata-backup'
  format_version: 1
  schema_version: number
  created_at: string
  app_version: string
  counts: Record<string, number>
  tables: Record<string, unknown[]>
}

export const LAST_BACKUP_KEY = 'last_backup_at'
export const BACKUP_FREQUENCY_KEY = 'backup_frequency_days'
export const BACKUP_ENABLED_KEY = 'backup_enabled'

/* ------------------------------------------------------------------ *
 * Building
 * ------------------------------------------------------------------ */

export async function buildSnapshot(appVersion = '0.1.0'): Promise<BackupFile> {
  // Flush first: on the web the database lives in memory until it is written,
  // and backing up before that would quietly miss the last few entries.
  await saveNow()

  const tables = await exportTables([...BACKUP_TABLES])
  const counts: Record<string, number> = {}
  for (const [name, rows] of Object.entries(tables)) counts[name] = rows.length

  return {
    format: 'krishi-khata-backup',
    format_version: 1,
    schema_version: SCHEMA_VERSION,
    created_at: new Date().toISOString(),
    app_version: appVersion,
    counts,
    tables,
  }
}

/**
 * Gzip, where the platform offers it.
 *
 * A farm's records compress to a fraction of their size — mostly repeated
 * column names — and the difference matters on a metered rural connection.
 * Falls back to plain JSON where CompressionStream is missing, and the file
 * name says which it is so restore never has to guess.
 */
export async function encodeBackup(
  snapshot: BackupFile,
): Promise<{ blob: Blob; gzipped: boolean }> {
  const json = JSON.stringify(snapshot)
  const bytes = new TextEncoder().encode(json)

  if (typeof CompressionStream === 'undefined') {
    return { blob: new Blob([bytes], { type: 'application/json' }), gzipped: false }
  }

  const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip'))
  const blob = await new Response(stream).blob()
  return { blob: new Blob([blob], { type: 'application/gzip' }), gzipped: true }
}

export async function decodeBackup(blob: Blob, gzipped: boolean): Promise<BackupFile> {
  let text: string
  if (gzipped && typeof DecompressionStream !== 'undefined') {
    const stream = blob.stream().pipeThrough(new DecompressionStream('gzip'))
    text = await new Response(stream).text()
  } else {
    text = await blob.text()
  }

  const parsed = JSON.parse(text) as BackupFile
  if (parsed.format !== 'krishi-khata-backup') {
    throw new Error('That file is not a Krishi Khata backup.')
  }
  if (parsed.schema_version > SCHEMA_VERSION) {
    throw new Error(
      'This backup was made by a newer version of the app. Update Krishi Khata, then restore.',
    )
  }
  return parsed
}

export function backupFileName(gzipped: boolean): string {
  return `krishi-khata-${todayISO()}.json${gzipped ? '.gz' : ''}`
}

/* ------------------------------------------------------------------ *
 * Restoring
 * ------------------------------------------------------------------ */

export interface RestoreResult {
  restored: Record<string, number>
  safetyCopy: BackupFile
}

/**
 * Replace everything with the contents of a backup.
 *
 * A safety copy of the current database is taken FIRST and handed back to the
 * caller. Restoring is the one operation in this app that destroys data, and a
 * farmer who restores the wrong file must not lose the right one.
 *
 * The whole restore is a single transaction: a half-restored database — some
 * tables from the backup, some from before — is worse than either.
 */
export async function restoreSnapshot(snapshot: BackupFile): Promise<RestoreResult> {
  const safetyCopy = await buildSnapshot()

  const restored: Record<string, number> = {}

  await tx(async (run) => {
    // Children first, so foreign keys never point at a row that has gone.
    for (const table of [...BACKUP_TABLES].reverse()) {
      await run(`DELETE FROM ${table};`)
    }

    for (const table of BACKUP_TABLES) {
      const rows = snapshot.tables[table]
      if (!rows?.length) {
        restored[table] = 0
        continue
      }

      for (const row of rows) {
        const record = row as Record<string, unknown>
        const columns = Object.keys(record)
        const placeholders = columns.map(() => '?').join(', ')
        await run(
          `INSERT OR REPLACE INTO ${table} (${columns.join(', ')}) VALUES (${placeholders});`,
          columns.map((c) => record[c] ?? null),
        )
      }
      restored[table] = rows.length
    }
  })

  await saveNow()
  notifyDataChanged()
  return { restored, safetyCopy }
}

/* ------------------------------------------------------------------ *
 * Scheduling
 * ------------------------------------------------------------------ */

/**
 * Back up in one tap, with no setup at all.
 *
 * The Google Drive route needs an OAuth client ID created in the Cloud
 * console, which is not something to ask a farmer to do. The Android share
 * sheet already lists Drive — along with WhatsApp, Files and a memory card —
 * so writing the file and offering it there gets the backup into Drive with
 * the farmer choosing where, and no credentials anywhere.
 */
export async function shareBackup(): Promise<{ fileName: string; rows: number }> {
  const snapshot = await buildSnapshot()
  const { blob, gzipped } = await encodeBackup(snapshot)
  const fileName = backupFileName(gzipped)
  const rows = Object.values(snapshot.counts).reduce((a, b) => a + b, 0)

  if (!Capacitor.isNativePlatform()) {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = fileName
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    await markBackedUp()
    return { fileName, rows }
  }

  // Filesystem wants text, and a gzip blob is not text — base64 is the only
  // encoding that survives the bridge intact.
  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '')
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })

  const written = await Filesystem.writeFile({
    path: fileName,
    data: base64,
    directory: Directory.Cache,
    recursive: true,
  })

  await Share.share({
    title: 'Krishi Khata backup',
    text: `Krishi Khata backup — ${rows} records`,
    url: written.uri,
    dialogTitle: 'Save your backup',
  })

  await markBackedUp()
  return { fileName, rows }
}

export async function lastBackupAt(): Promise<string | null> {
  return getSetting(LAST_BACKUP_KEY)
}

export async function markBackedUp(): Promise<void> {
  await setSetting(LAST_BACKUP_KEY, new Date().toISOString())
}

export async function backupFrequencyDays(): Promise<number> {
  const raw = await getSetting(BACKUP_FREQUENCY_KEY)
  const n = raw ? parseInt(raw, 10) : NaN
  return Number.isFinite(n) && n > 0 ? n : 30
}

export async function backupEnabled(): Promise<boolean> {
  return (await getSetting(BACKUP_ENABLED_KEY)) === '1'
}

/**
 * Whether a backup is due.
 *
 * Checked when the app opens, not on a timer. Without a backend there is no
 * refresh token, so there is no way to run this while the app is closed —
 * see sync/drive.ts. This is the honest limit of a no-server design.
 */
export async function backupIsDue(): Promise<boolean> {
  if (!(await backupEnabled())) return false
  const last = await lastBackupAt()
  if (!last) return true

  const days = await backupFrequencyDays()
  const elapsed = (Date.now() - new Date(last).getTime()) / 86_400_000
  return elapsed >= days
}
