import { Capacitor } from '@capacitor/core'
import { UPDATE_REPO } from '@/config'

/**
 * Checking whether a newer build exists.
 *
 * There is no Play Store here and no update server. GitHub already publishes
 * every release with the APK attached, and its releases API is public, free
 * and needs no key — so the app asks that directly. Nothing is installed
 * silently: the farmer is shown that a version exists and taps to download it,
 * because sideloaded installs need their consent anyway.
 *
 * Bump APP_VERSION in the same commit as anything you want the phones to pick
 * up, and tag the release `vX.Y.Z` to match.
 */

export const APP_VERSION = '0.2.0'

export interface UpdateInfo {
  version: string
  url: string
  notes: string
  publishedAt: string
}

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
 * no releases yet. Every failure is silent on purpose — an update check is not
 * worth an error message in front of somebody trying to record a sale.
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

  try {
    const res = await fetch(`https://api.github.com/repos/${UPDATE_REPO}/releases/latest`, {
      headers: { Accept: 'application/vnd.github+json' },
    })
    if (!res.ok) return null

    const data = (await res.json()) as {
      tag_name?: string
      name?: string
      body?: string
      published_at?: string
      assets?: { name: string; browser_download_url: string }[]
      html_url?: string
    }

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
      notes: (data.body ?? '').split('\n').slice(0, 6).join('\n').trim(),
      publishedAt: data.published_at ?? '',
    }
  } catch {
    return null
  }
}

/**
 * Hand the download to the system browser.
 *
 * Android installs an APK from Downloads with one tap. Doing it inside the
 * WebView would just show bytes.
 */
export function openDownload(url: string): void {
  if (!url) return
  if (Capacitor.isNativePlatform()) {
    window.open(url, '_system')
    return
  }
  window.open(url, '_blank', 'noopener')
}
