import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { App as CapApp } from '@capacitor/app'

/**
 * A small hash router.
 *
 * React Router was the obvious choice and was dropped deliberately: every
 * published version carries a high-severity advisory, all of them in SSR,
 * loader, action and manifest code paths that a client-only offline app never
 * reaches. Rather than teach ourselves to ignore a permanently red `npm audit`
 * on a project whose CI gate is meant to mean something, this app does the one
 * thing it actually needed from that library.
 *
 * Hash routing specifically, because the Android WebView serves the app from a
 * custom scheme where a path-based reload resolves to a file that is not there.
 */

export type Params = Record<string, string>

function currentPath(): string {
  const h = window.location.hash
  return h.startsWith('#') ? h.slice(1) || '/' : '/'
}

export function navigate(to: string, opts: { replace?: boolean } = {}): void {
  const url = `${window.location.pathname}${window.location.search}#${to}`
  if (opts.replace) window.history.replaceState(null, '', url)
  else window.history.pushState(null, '', url)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

export function back(): void {
  window.history.back()
}

/** The live path, e.g. "/labour/khata/abc". */
export function usePath(): string {
  const [path, setPath] = useState(currentPath)

  useEffect(() => {
    const onChange = () => setPath(currentPath())
    window.addEventListener('popstate', onChange)
    window.addEventListener('hashchange', onChange)
    return () => {
      window.removeEventListener('popstate', onChange)
      window.removeEventListener('hashchange', onChange)
    }
  }, [])

  return path
}

/**
 * Match "/labour/khata/:id" against "/labour/khata/abc".
 * Returns the extracted params, or null when the pattern does not apply.
 */
export function matchPath(pattern: string, path: string): Params | null {
  const p = pattern.split('/').filter(Boolean)
  const a = path.split('?')[0].split('/').filter(Boolean)
  if (p.length !== a.length) return null

  const params: Params = {}
  for (let i = 0; i < p.length; i++) {
    if (p[i].startsWith(':')) params[p[i].slice(1)] = decodeURIComponent(a[i])
    else if (p[i] !== a[i]) return null
  }
  return params
}

export interface RouteDef {
  path: string
  render: (params: Params) => ReactNode
}

export function useRoutes(routes: RouteDef[], fallback: ReactNode): ReactNode {
  const path = usePath()

  return useMemo(() => {
    for (const r of routes) {
      const params = matchPath(r.path, path)
      if (params) return r.render(params)
    }
    return fallback
  }, [routes, path, fallback])
}

/**
 * Android's hardware back button.
 *
 * Without this the button closes the whole app from any screen, which loses a
 * half-filled entry form. Backing out of the last screen exits, matching what
 * every other Android app does.
 */
export function useHardwareBack(isAtRoot: () => boolean): void {
  useEffect(() => {
    let remove: (() => void) | undefined

    CapApp.addListener('backButton', () => {
      if (isAtRoot()) CapApp.exitApp()
      else window.history.back()
    })
      .then((handle) => {
        remove = () => handle.remove()
      })
      .catch(() => {
        // Not running under Capacitor (browser preview) — nothing to bind.
      })

    return () => remove?.()
  }, [isAtRoot])
}

/** Scroll to the top whenever the screen changes, as a native app would. */
export function useScrollReset(path: string): void {
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [path])
}
