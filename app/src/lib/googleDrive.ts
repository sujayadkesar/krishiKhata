import { registerPlugin, Capacitor } from '@capacitor/core'

/**
 * The farmer's own Google Drive, reached directly from the phone.
 *
 * NOBODY ELSE IS IN THIS PATH. There is no Krishi Khata server, no account on
 * anybody's system, and no copy of the ledger anywhere but the phone and the
 * Drive the farmer already owns. That is the whole point: the backup has to
 * outlive the phone without the app's author ever holding a farmer's figures.
 *
 * Everything lands in `appDataFolder` — a hidden per-app folder. The scope
 * reaches that folder and nothing else: not documents, not photos, not a file
 * this app did not write. A farmer can delete it from their Drive settings and
 * the app simply starts again.
 *
 * The REST calls are plain fetch rather than a Drive SDK. The native side does
 * one job — hand over an access token — and everything after that is ordinary
 * HTTP, which is far easier to read and to be sure of.
 */

export interface AuthResult {
  granted: boolean
  accessToken?: string | null
  email?: string | null
  reason?: string
}

interface GoogleDrivePlugin {
  authorize(options: { interactive: boolean }): Promise<AuthResult>
  signOut(): Promise<void>
}

const GoogleDrive = registerPlugin<GoogleDrivePlugin>('GoogleDrive')

export const driveAvailable = (): boolean => Capacitor.getPlatform() === 'android'

/** The one file. Overwritten each time, so Drive holds the latest and no more. */
export const BACKUP_NAME = 'krishi-khata-backup.json.gz'

/**
 * A token.
 *
 * `interactive` false is the everyday path and returns granted:false rather
 * than putting a consent sheet in front of somebody halfway through recording
 * a day's work. Once consent has been given this returns a fresh token with no
 * user interaction at all, which is what makes a daily automatic backup
 * possible without a refresh token and therefore without a server.
 */
export async function authorize(interactive = false): Promise<AuthResult> {
  if (!driveAvailable()) return { granted: false, reason: 'unsupported' }
  try {
    return await GoogleDrive.authorize({ interactive })
  } catch (e) {
    return { granted: false, reason: e instanceof Error ? e.message : String(e) }
  }
}

export async function forgetAccount(): Promise<void> {
  if (!driveAvailable()) return
  try {
    await GoogleDrive.signOut()
  } catch {
    // Nothing is cached locally, so a failure here changes nothing.
  }
}

const API = 'https://www.googleapis.com/drive/v3'
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3'

async function expectOk(res: Response, what: string): Promise<void> {
  if (res.ok) return
  const body = await res.text().catch(() => '')
  throw new Error(`${what} failed (${res.status}). ${body.slice(0, 180)}`)
}

export interface DriveFile {
  id: string
  name: string
  modifiedTime: string
  size?: string
}

/** The backup already in Drive, or null on a Drive that has never held one. */
export async function findBackup(token: string): Promise<DriveFile | null> {
  const url =
    `${API}/files?spaces=appDataFolder` +
    `&q=${encodeURIComponent(`name='${BACKUP_NAME}' and trashed=false`)}` +
    `&fields=${encodeURIComponent('files(id,name,modifiedTime,size)')}` +
    `&orderBy=modifiedTime desc&pageSize=1`

  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  await expectOk(res, 'Looking for the backup')
  const data = (await res.json()) as { files?: DriveFile[] }
  return data.files?.[0] ?? null
}

/**
 * Put the ledger in Drive, replacing what was there.
 *
 * Created first as metadata and then filled, rather than as one multipart
 * request: building a multipart body by hand around a gzip blob is the kind of
 * code that works until a boundary happens to appear in the compressed bytes.
 * Two requests on the first upload, one on every one after.
 */
export async function uploadBackup(
  token: string,
  blob: Blob,
  existingId: string | null,
): Promise<string> {
  let id = existingId

  if (!id) {
    const res = await fetch(`${API}/files`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: BACKUP_NAME, parents: ['appDataFolder'] }),
    })
    await expectOk(res, 'Creating the backup')
    id = ((await res.json()) as { id: string }).id
  }

  const res = await fetch(`${UPLOAD}/files/${id}?uploadType=media`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/gzip',
    },
    body: blob,
  })
  await expectOk(res, 'Uploading the backup')
  return id
}

/** Fetch it back, as the same gzip blob that was uploaded. */
export async function downloadBackup(token: string, id: string): Promise<Blob> {
  const res = await fetch(`${API}/files/${id}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  await expectOk(res, 'Downloading the backup')
  return res.blob()
}
