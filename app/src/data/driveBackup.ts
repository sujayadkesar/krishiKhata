import { Network } from '@capacitor/network'
import { App } from '@capacitor/app'
import { buildSnapshot, decodeBackup, encodeBackup, restoreSnapshot } from './backup'
import { getSetting, setSetting } from './masterData'
import { notifyDataChanged, onDataChanged } from '@/hooks/useQuery'
import { run } from '@/db/db'
import {
  authorize, downloadBackup, driveAvailable, findBackup, forgetAccount, uploadBackup,
} from '@/lib/googleDrive'
import type { RestoreResult } from './backup'

/**
 * Keeping the ledger in the farmer's own Drive, by itself, every day.
 *
 * THE PROMISE THIS HAS TO KEEP: lose the phone, buy another, install the app,
 * sign in, and the farm is back. Nothing else counts. Android's own backup
 * could not promise it — it depends on a switch the app cannot read, runs only
 * on wi-fi while charging, and restores during new-phone setup or never.
 *
 * ENTRIES ARE NEVER BLOCKED ON THE NETWORK. Every write goes to local SQLite
 * first and always has; this only ever marks the ledger as changed. A farmer
 * records six days of work standing in a field with no signal, walks back into
 * range, and the upload happens on its own with nothing asked of them. If the
 * phone never sees a network again, nothing is lost that was not already lost.
 *
 * MOBILE DATA COUNTS. A backup is tens of kilobytes without bills and a couple
 * of hundred with them, which is not a sum worth weighing against a season's
 * records — so any connection will do. Wi-fi-only is what made the old backup
 * useless to somebody whose phone is on mobile data from one month to the next.
 */

const KEY_ENABLED = 'drive.enabled'
const KEY_EMAIL = 'drive.email'
const KEY_FILE_ID = 'drive.file_id'
const KEY_LAST_SYNC = 'drive.last_sync_at'
const KEY_DIRTY = 'drive.dirty'
const KEY_LAST_ERROR = 'drive.last_error'

/** At most one upload an hour when nothing is forcing it. */
const MIN_GAP_MS = 60 * 60 * 1000

export interface DriveStatus {
  available: boolean
  enabled: boolean
  email: string | null
  lastSyncAt: string | null
  pending: boolean
  lastError: string | null
}

export async function driveStatus(): Promise<DriveStatus> {
  const [enabled, email, last, dirty, err] = await Promise.all([
    getSetting(KEY_ENABLED),
    getSetting(KEY_EMAIL),
    getSetting(KEY_LAST_SYNC),
    getSetting(KEY_DIRTY),
    getSetting(KEY_LAST_ERROR),
  ])
  return {
    available: driveAvailable(),
    enabled: enabled === '1',
    email: email ?? null,
    lastSyncAt: last ?? null,
    pending: dirty === '1',
    lastError: err ?? null,
  }
}

/**
 * Turn it on. This is the one moment the farmer sees Google's consent sheet.
 *
 * Returns false when they decline or pick nothing, which is an answer and not
 * an error — the app carries on exactly as before, with the file backup.
 */
export async function enableDrive(): Promise<boolean> {
  const auth = await authorize(true)
  if (!auth.granted || !auth.accessToken) return false

  await setSetting(KEY_ENABLED, '1')
  if (auth.email) await setSetting(KEY_EMAIL, auth.email)
  await setSetting(KEY_LAST_ERROR, '')
  // Upload immediately, so "it is on" and "it has actually worked once" are
  // the same moment rather than a promise about tonight.
  await syncNow(true)
  return true
}

export async function disableDrive(): Promise<void> {
  await setSetting(KEY_ENABLED, '0')
  await setSetting(KEY_EMAIL, '')
  await setSetting(KEY_FILE_ID, '')
  await forgetAccount()
  notifyDataChanged()
}

/**
 * Something changed, so the copy in Drive is now behind.
 *
 * Written with `run` rather than `setSetting` for a reason that is not style:
 * `setSetting` announces a data change, this is subscribed TO data changes,
 * and the two together are an infinite loop. The flag is internal bookkeeping
 * that no screen renders, so nothing needs telling about it.
 *
 * Cheap on purpose — one row, no network, nothing awaited that is slow. A
 * farmer entering twelve people's attendance must not feel this.
 */
export async function markDirty(): Promise<void> {
  try {
    await run("INSERT OR REPLACE INTO settings (key, value) VALUES (?, '1');", [KEY_DIRTY])
  } catch {
    // A flag that cannot be written is not a reason to fail a write.
  }
}

/**
 * True while an upload is in flight.
 *
 * The sync writes its own settings — the file id, the timestamp, the cleared
 * flag — and each of those announces a data change. Without this, finishing a
 * sync would immediately mark the ledger dirty again and the app would upload
 * for ever.
 */
let syncing = false

async function online(): Promise<boolean> {
  try {
    return (await Network.getStatus()).connected
  } catch {
    // No plugin on the web preview; assume the browser knows.
    return navigator.onLine
  }
}

/**
 * Upload, if there is any point.
 *
 * `force` skips the once-an-hour throttle but not the checks that matter:
 * switched on, online, and a token that can be had without interrupting
 * anybody.
 */
export async function syncNow(force = false): Promise<{ ok: boolean; reason?: string }> {
  const status = await driveStatus()
  if (!status.available) return { ok: false, reason: 'unsupported' }
  if (!status.enabled) return { ok: false, reason: 'off' }

  if (!force) {
    if (!status.pending) return { ok: false, reason: 'nothing-changed' }
    if (status.lastSyncAt && Date.now() - Date.parse(status.lastSyncAt) < MIN_GAP_MS) {
      return { ok: false, reason: 'too-soon' }
    }
  }

  if (!(await online())) return { ok: false, reason: 'offline' }
  if (syncing) return { ok: false, reason: 'busy' }
  syncing = true

  try {
    // Silent: if consent has lapsed the farmer is told on the backup screen
    // rather than ambushed with a sheet while doing something else.
    const auth = await authorize(false)
    if (!auth.granted || !auth.accessToken) {
      await setSetting(KEY_LAST_ERROR, 'consent')
      return { ok: false, reason: 'consent' }
    }

    const snapshot = await buildSnapshot()
    const { blob } = await encodeBackup(snapshot)

    let fileId = (await getSetting(KEY_FILE_ID)) || null
    if (!fileId) {
      // A reinstall onto the same account finds the file that is already there
      // rather than leaving two.
      fileId = (await findBackup(auth.accessToken))?.id ?? null
    }
    const id = await uploadBackup(auth.accessToken, blob, fileId)

    await setSetting(KEY_FILE_ID, id)
    await setSetting(KEY_LAST_SYNC, new Date().toISOString())
    await setSetting(KEY_DIRTY, '0')
    await setSetting(KEY_LAST_ERROR, '')
    notifyDataChanged()
    return { ok: true }
  } catch (e) {
    // The ledger is untouched and still marked dirty, so the next chance
    // retries it. A failed upload must never look like a successful one.
    await setSetting(KEY_LAST_ERROR, e instanceof Error ? e.message : String(e))
    notifyDataChanged()
    return { ok: false, reason: 'failed' }
  } finally {
    syncing = false
  }
}

/** Is there anything in Drive to come back to? Used by the restore screen. */
export async function driveHasBackup(): Promise<{ at: string; bytes: number } | null> {
  const auth = await authorize(false)
  if (!auth.granted || !auth.accessToken) return null
  const file = await findBackup(auth.accessToken)
  return file ? { at: file.modifiedTime, bytes: Number(file.size ?? 0) } : null
}

/**
 * The whole point: a new phone, and the farm comes back.
 *
 * Interactive, because this is somebody standing in front of a blank app
 * deliberately asking for their records — exactly when a consent sheet makes
 * sense. `restoreSnapshot` takes its own safety copy first.
 */
export async function restoreFromDrive(): Promise<RestoreResult> {
  const auth = await authorize(true)
  if (!auth.granted || !auth.accessToken) throw new Error('not-authorised')

  const file = await findBackup(auth.accessToken)
  if (!file) throw new Error('no-backup')

  const blob = await downloadBackup(auth.accessToken, file.id)
  const snapshot = await decodeBackup(blob, true)
  const result = await restoreSnapshot(snapshot)

  // Restoring makes this phone match Drive exactly, so there is nothing to
  // push back up; and the file id is remembered so the next upload replaces
  // this same file rather than making a second one.
  await setSetting(KEY_ENABLED, '1')
  if (auth.email) await setSetting(KEY_EMAIL, auth.email)
  await setSetting(KEY_FILE_ID, file.id)
  await setSetting(KEY_DIRTY, '0')
  await setSetting(KEY_LAST_SYNC, new Date().toISOString())
  return result
}

/**
 * Wire the automatic half of it up, once, at startup.
 *
 * Three moments, all of them cheap and none of them a timer: coming back to
 * the app, the network returning, and leaving the app. The last is the one
 * that matters most — a farmer finishes entering and puts the phone in their
 * pocket, and that is the natural end of a session's work.
 */
export function startDriveAutoBackup(): void {
  if (!driveAvailable()) return

  const attempt = () => {
    void syncNow(false)
  }

  /*
   * EVERY WRITE IN THE APP, through the one notification they all already
   * send. No data-layer function needs to remember to call this, which is
   * exactly how a backup quietly stops covering the newest table somebody
   * added. Marking is local and instant; the upload itself is throttled.
   */
  onDataChanged(() => {
    if (!syncing) void markDirty()
  })

  void App.addListener('appStateChange', ({ isActive }) => {
    // Returning AND leaving. Leaving is when a session is really finished.
    attempt()
    if (!isActive) void syncNow(false)
  })

  void Network.addListener('networkStatusChange', ({ connected }) => {
    // Back in range after a morning in the field with no signal.
    if (connected) attempt()
  })

  // And once now, for the phone that has been off overnight.
  attempt()
}
