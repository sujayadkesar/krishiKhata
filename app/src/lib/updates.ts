import { registerPlugin, Capacitor } from '@capacitor/core'
import type { PluginListenerHandle } from '@capacitor/core'
import { UPDATE_REPO } from '@/config'
import versionFile from '../../version.json'

/**
 * Getting a new version onto a phone.
 *
 * There is no Play Store here and no update server. GitHub already publishes
 * every release with the APK attached, and its releases API is public, free
 * and needs no key — so the app asks that directly, downloads the APK itself,
 * and hands it to Android's package installer.
 *
 * This replaces forwarding an APK on WhatsApp, which failed in three ways: the
 * file is indistinguishable from anything else somebody sends, it has to be
 * hunted down again in Downloads, and nobody could tell whether they were on
 * the current version. The install goes OVER the existing app — no uninstall,
 * so no data loss — as long as both builds carry the same signing key.
 *
 * THE VERSION LIVES IN app/version.json AND NOWHERE ELSE. Android's build
 * reads the same file for versionCode and versionName. Bump both there, tag
 * the release `vX.Y.Z` to match, and every phone offers it on next launch.
 */

export const APP_VERSION: string = versionFile.version
export const APP_VERSION_CODE: number = versionFile.versionCode

export interface UpdateInfo {
  version: string
  /** Direct APK download, or the release page when no asset was attached. */
  url: string
  /** True when `url` is an APK the app can install itself. */
  installable: boolean
  notes: string
  publishedAt: string
  sizeBytes: number
}

export interface DownloadProgress {
  /** 0–100, or -1 when the server did not send a length. */
  percent: number
  bytes: number
  total: number
}

interface AppUpdatePlugin {
  currentVersion(): Promise<{ version: string | null; versionCode?: number }>
  canInstall(): Promise<{ allowed: boolean }>
  openInstallSettings(): Promise<void>
  download(options: { url: string; version: string }): Promise<{ path: string; bytes: number }>
  install(options: { path: string }): Promise<void>
  addListener(
    event: 'progress',
    fn: (p: DownloadProgress) => void,
  ): Promise<PluginListenerHandle>
}

const AppUpdate = registerPlugin<AppUpdatePlugin>('AppUpdate')

export const isNativeApp = (): boolean => Capacitor.isNativePlatform()

/** Compare "1.2.10" against "1.3.0" numerically, not as strings. */
export function isNewer(candidate: string, current: string): boolean {
  const parse = (v: string) =>
    v
      .replace(/^v/i, '')
      .split(/[.-]/)
      .map((p) => parseInt(p, 10))
      .map((n) => (Number.isFinite(n) ? n : 0))

  const a = parse(candidate)
  const b = parse(current)
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i] ?? 0
    const y = b[i] ?? 0
    if (x !== y) return x > y
  }
  return false
}

const LAST_CHECK_KEY = 'kk.updateCheckedAt'
const CHECK_EVERY_MS = 6 * 60 * 60 * 1000

/**
 * Ask GitHub for the newest release.
 *
 * Returns null when there is nothing newer, when offline, or when the repo has
 * no releases yet. Failures are silent unless `force` is set — an automatic
 * check is not worth an error message in front of somebody trying to record a
 * sale, but a farmer who tapped "check for updates" deserves an answer.
 */
export async function checkForUpdate(force = false): Promise<UpdateInfo | null> {
  if (!UPDATE_REPO) return null

  if (!force) {
    try {
      const last = Number(localStorage.getItem(LAST_CHECK_KEY) ?? 0)
      if (Date.now() - last < CHECK_EVERY_MS) return null
    } catch {
      // localStorage unavailable; just check.
    }
  }

  const fetchLatest = async () => {
    const res = await fetch(`https://api.github.com/repos/${UPDATE_REPO}/releases/latest`, {
      headers: { Accept: 'application/vnd.github+json' },
    })
    if (!res.ok) throw new Error(`GitHub replied ${res.status}.`)
    return (await res.json()) as {
      tag_name?: string
      body?: string
      published_at?: string
      assets?: { name: string; browser_download_url: string; size?: number }[]
      html_url?: string
    }
  }

  try {
    const data = await fetchLatest()

    try {
      localStorage.setItem(LAST_CHECK_KEY, String(Date.now()))
    } catch {
      // Not fatal.
    }

    const tag = data.tag_name ?? ''
    if (!tag || !isNewer(tag, APP_VERSION)) return null

    const apk = data.assets?.find((a) => a.name.toLowerCase().endsWith('.apk'))

    return {
      version: tag.replace(/^v/i, ''),
      // Prefer the APK itself; fall back to the release page so the farmer at
      // least lands somewhere useful if the asset is missing.
      url: apk?.browser_download_url ?? data.html_url ?? '',
      installable: !!apk,
      notes: (data.body ?? '').split('\n').slice(0, 8).join('\n').trim(),
      publishedAt: data.published_at ?? '',
      sizeBytes: apk?.size ?? 0,
    }
  } catch (err) {
    if (force) throw err instanceof Error ? err : new Error(String(err))
    return null
  }
}

/* ------------------------------------------------------------------ *
 * Installing
 * ------------------------------------------------------------------ */

/** Whether Android will let this app start an install without a settings trip. */
export async function canInstallUpdates(): Promise<boolean> {
  if (!isNativeApp()) return false
  try {
    return (await AppUpdate.canInstall()).allowed
  } catch {
    return false
  }
}

/** Open the "Install unknown apps" screen for this app. */
export async function openInstallSettings(): Promise<void> {
  if (!isNativeApp()) return
  await AppUpdate.openInstallSettings()
}

/** Thrown when Android needs "Install unknown apps" turned on first. */
export const PERMISSION_REQUIRED = 'permission-required'

/**
 * Download the release APK and open the installer.
 *
 * The two steps are one call because there is nothing useful to do between
 * them: a downloaded APK sitting on disk that the farmer has to find is the
 * problem this replaces. The progress callback is what stops a 12 MB download
 * on a village connection looking like the app has frozen.
 */
export async function downloadAndInstall(
  update: UpdateInfo,
  onProgress?: (p: DownloadProgress) => void,
): Promise<void> {
  if (!isNativeApp()) {
    openDownload(update.url)
    return
  }

  let listener: PluginListenerHandle | undefined
  try {
    if (onProgress) {
      listener = await AppUpdate.addListener('progress', onProgress)
    }
    const { path } = await AppUpdate.download({ url: update.url, version: update.version })
    await AppUpdate.install({ path })
  } finally {
    await listener?.remove()
  }
}

/**
 * Hand the download to the system browser.
 *
 * The fallback for the web build, and for a release with no APK attached,
 * where all the app can usefully do is open the release page.
 */
export function openDownload(url: string): void {
  if (!url) return
  if (isNativeApp()) {
    window.open(url, '_system')
    return
  }
  window.open(url, '_blank', 'noopener')
}
