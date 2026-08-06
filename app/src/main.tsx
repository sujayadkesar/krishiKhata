import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { I18nProvider } from '@/i18n/Provider'
import App from './App'
import './index.css'

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
    const [db, labour, entries, masterData] = await Promise.all([
      import('@/db/db'),
      import('@/data/labour'),
      import('@/data/entries'),
      import('@/data/masterData'),
    ])
    Object.assign(window, { __kk: { db, labour, entries, masterData } })
  })()
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nProvider>
      <App />
    </I18nProvider>
  </StrictMode>,
)
