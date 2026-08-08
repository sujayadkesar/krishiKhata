import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Capacitor } from '@capacitor/core'
import { SplashScreen } from '@capacitor/splash-screen'
import { StatusBar, Style } from '@capacitor/status-bar'
import { I18nProvider } from '@/i18n/Provider'
import App from './App'
import './index.css'

/**
 * The status bar, pinned to the app's own light theme.
 *
 * capacitor.config.ts declares the same thing, but the config is only read at
 * launch — a phone that switches to dark mode while the app is open reapplies
 * the system bar and draws white icons on the app's cream header, where they
 * disappear. Setting it here as well makes the app's theme win.
 */
if (Capacitor.isNativePlatform()) {
  void (async () => {
    try {
      await StatusBar.setStyle({ style: Style.Light })
      await StatusBar.setBackgroundColor({ color: '#fdf7ef' })
      await StatusBar.setOverlaysWebView({ overlay: false })
    } catch {
      // Not every device exposes all three; a default bar is not worth an error.
    }
  })()
}

/**
 * Last-resort splash dismissal.
 *
 * App.tsx hides the splash as soon as the database is open, which is sooner
 * than this and is the normal path. But if the bundle throws before React ever
 * mounts, nothing in App runs and the native splash — configured not to
 * auto-hide — would stay up forever with no error and nothing to tap.
 *
 * Ten seconds is long enough that this never races the real dismissal, and
 * short enough that a broken build is diagnosable instead of looking hung.
 */
if (Capacitor.isNativePlatform()) {
  setTimeout(() => {
    void SplashScreen.hide().catch(() => {})
  }, 10_000)
}

/**
 * Development-only handle on the app's own modules.
 *
 * Verification scripts must reach the SAME database the UI is using. Importing
 * the modules again from a console gives a second sql.js handle over the same
 * IndexedDB key, and the two then overwrite each other's snapshots — which
 * looks exactly like data being silently lost. Stripped from production builds
 * by the `import.meta.env.DEV` guard.
 */
if (import.meta.env.DEV) {
  void (async () => {
    const [db, labour, entries, masterData, reports, documents, printDoc, print] =
      await Promise.all([
        import('@/db/db'),
        import('@/data/labour'),
        import('@/data/entries'),
        import('@/data/masterData'),
        import('@/data/reports'),
        import('@/features/reports/documents'),
        import('@/lib/printDoc'),
        import('@/lib/print'),
      ])
    Object.assign(window, {
      __kk: { db, labour, entries, masterData, reports, documents, printDoc, print },
    })
  })()
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nProvider>
      <App />
    </I18nProvider>
  </StrictMode>,
)
