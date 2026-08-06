import { GoogleSignIn } from '@capawesome/capacitor-google-sign-in'
import { GOOGLE_CLIENT_ID, DRIVE_FOLDER_NAME } from '@/config'

/**
 * Backing up to the farmer's own Google Drive.
 *
 * Scope is `drive.file` — Google classifies it NON-SENSITIVE, so the app needs
 * no verification review and is exempt from the hundred-user cap that applies
 * to sensitive scopes. It also grants access ONLY to files this app creates:
 * Krishi Khata cannot see anything else in the farmer's Drive, which is the
 * honest thing to be able to tell them.
 *
 * Files go into a visible "Krishi Khata Backups" folder rather than the hidden
 * appDataFolder. A farmer who can open the folder and see the file believes the
 * backup exists; one who cannot has to take the app's word for it. It also lets
 * them send a copy to a son or an accountant without the app's help.
 *
 * THE LIMIT WORTH KNOWING: an Android OAuth client has no client secret by
 * design, so without a backend there is no refresh token — only an access token
 * lasting about an hour. Backup therefore runs while the app is OPEN; there is
 * no true background backup, and building one would mean running a server,
 * which this app deliberately does not.
 *
 * The plugin at this version exposes no silent re-authorisation either, so a
 * token that has expired is renewed by calling signIn() again. On Android that
 * usually completes without a prompt when the grant already exists, via
 * Credential Manager — but it MAY show one, and the UI says so rather than
 * promising something that will occasionally be untrue.
 */

const SCOPE = 'https://www.googleapis.com/auth/drive.file'
const FILES = 'https://www.googleapis.com/drive/v3/files'
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files'

export interface DriveFile {
  id: string
  name: string
  modifiedTime: string
  size?: string
}

export class DriveNotConfigured extends Error {
  constructor() {
    super(
      'Google backup is not set up yet. A Google OAuth client ID has to be added to the app before this can work.',
    )
  }
}

export const isDriveConfigured = () => GOOGLE_CLIENT_ID.length > 0

/* ------------------------------------------------------------------ *
 * Auth
 * ------------------------------------------------------------------ */

let cachedToken: { value: string; expiresAt: number } | null = null
let initialised = false

function requireConfig(): void {
  if (!isDriveConfigured()) throw new DriveNotConfigured()
}

/**
 * The plugin requires initialize() once before anything else, and the client
 * ID must be the WEB one even on Android — the step that trips everyone up.
 */
async function ensureInitialised(): Promise<void> {
  requireConfig()
  if (initialised) return
  await GoogleSignIn.initialize({
    clientId: GOOGLE_CLIENT_ID,
    scopes: [SCOPE],
    redirectUrl: window.location.origin,
  })
  initialised = true
}

export async function signIn(): Promise<string> {
  await ensureInitialised()
  const result = await GoogleSignIn.signIn()
  const token = result.accessToken
  if (!token) throw new Error('Google did not return permission to use Drive.')
  // Treated as 55 minutes rather than the full hour, so a long upload cannot
  // start on a token that expires halfway through it.
  cachedToken = { value: token, expiresAt: Date.now() + 55 * 60_000 }
  return token
}

export async function signOut(): Promise<void> {
  cachedToken = null
  try {
    await GoogleSignIn.signOut()
  } catch {
    // Already signed out, or the plugin is unavailable on this platform.
  }
}

/**
 * A usable token.
 *
 * Cached for the life of the app session; beyond that, re-acquired by calling
 * signIn() again. `interactive: false` refuses rather than risking a prompt,
 * which is what an automatic backup wants — a dialog appearing unbidden while
 * the farmer is doing something else is worse than a backup deferred.
 */
export async function getAccessToken(interactive = false): Promise<string> {
  requireConfig()
  if (cachedToken && cachedToken.expiresAt > Date.now()) return cachedToken.value
  if (!interactive) throw new Error('Sign in to Google to back up.')
  return signIn()
}

/** True only when a token is already in hand — never triggers a prompt. */
export function hasLiveToken(): boolean {
  return !!cachedToken && cachedToken.expiresAt > Date.now()
}

export async function isSignedIn(): Promise<boolean> {
  return isDriveConfigured() && hasLiveToken()
}

/* ------------------------------------------------------------------ *
 * Drive calls
 * ------------------------------------------------------------------ */

async function api(url: string, token: string, init: RequestInit = {}): Promise<Response> {
  const res = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, ...(init.headers ?? {}) },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Google Drive refused the request (${res.status}). ${body.slice(0, 200)}`)
  }
  return res
}

/** Find the backup folder, creating it the first time. */
async function folderId(token: string): Promise<string> {
  const query = encodeURIComponent(
    `mimeType='application/vnd.google-apps.folder' and name='${DRIVE_FOLDER_NAME}' and trashed=false`,
  )
  const found = (await (
    await api(`${FILES}?q=${query}&fields=files(id,name)&spaces=drive`, token)
  ).json()) as { files: { id: string }[] }

  if (found.files?.length) return found.files[0].id

  const created = (await (
    await api(FILES, token, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: DRIVE_FOLDER_NAME,
        mimeType: 'application/vnd.google-apps.folder',
      }),
    })
  ).json()) as { id: string }

  return created.id
}

export async function uploadBackup(blob: Blob, fileName: string): Promise<DriveFile> {
  const token = await getAccessToken(true)
  const parent = await folderId(token)

  // Multipart upload: metadata and bytes in one request, so a dropped
  // connection cannot leave an empty file with the right name sitting in the
  // folder looking like a successful backup.
  const boundary = `kk${Date.now()}`
  const metadata = JSON.stringify({ name: fileName, parents: [parent] })

  const body = new Blob([
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n`,
    `--${boundary}\r\nContent-Type: ${blob.type || 'application/octet-stream'}\r\n\r\n`,
    blob,
    `\r\n--${boundary}--`,
  ])

  const res = await api(`${UPLOAD}?uploadType=multipart&fields=id,name,modifiedTime,size`, token, {
    method: 'POST',
    headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
    body,
  })

  return (await res.json()) as DriveFile
}

export async function listBackups(): Promise<DriveFile[]> {
  const token = await getAccessToken(true)
  const parent = await folderId(token)
  const query = encodeURIComponent(`'${parent}' in parents and trashed=false`)

  const res = await api(
    `${FILES}?q=${query}&fields=files(id,name,modifiedTime,size)&orderBy=modifiedTime desc&pageSize=50`,
    token,
  )
  const data = (await res.json()) as { files: DriveFile[] }
  return data.files ?? []
}

export async function downloadBackup(fileId: string): Promise<Blob> {
  const token = await getAccessToken(true)
  const res = await api(`${FILES}/${fileId}?alt=media`, token)
  return res.blob()
}

export async function deleteBackup(fileId: string): Promise<void> {
  const token = await getAccessToken(true)
  await api(`${FILES}/${fileId}`, token, { method: 'DELETE' })
}

/**
 * Keep the most recent `keep` backups and remove the rest.
 *
 * Failure here is swallowed on purpose: tidying up is not worth reporting an
 * error over when the backup itself succeeded.
 */
export async function pruneBackups(keep = 12): Promise<number> {
  try {
    const files = await listBackups()
    const stale = files.slice(keep)
    for (const f of stale) await deleteBackup(f.id).catch(() => {})
    return stale.length
  } catch {
    return 0
  }
}
