import { useCallback, useEffect, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { SplashScreen } from '@capacitor/splash-screen'
import { getDb, saveNow } from '@/db/db'
import { seedIfEmpty } from '@/db/seed'
import { useHardwareBack, usePath, useRoutes, useScrollReset, navigate } from '@/router'
import type { RouteDef } from '@/router'
import { Logo } from '@/components/Logo'
import { Page, Shell } from '@/components/Shell'
import { HomeScreen } from '@/features/home/HomeScreen'
import { AddEntryScreen } from '@/features/entries/AddEntryScreen'
import { EntriesScreen } from '@/features/entries/EntriesScreen'
import { EntryDetailScreen } from '@/features/entries/EntryDetailScreen'
import { ReportsScreen } from '@/features/reports/ReportsScreen'
import { LabourScreen } from '@/features/labour/LabourScreen'
import { AddWorkScreen } from '@/features/labour/AddWorkScreen'
import { PayScreen } from '@/features/labour/PayScreen'
import { LabourerDetailScreen } from '@/features/labour/LabourerDetailScreen'
import { SettingsScreen } from '@/features/settings/SettingsScreen'
import { AccountsScreen } from '@/features/settings/AccountsScreen'
import { HeadsScreen } from '@/features/settings/HeadsScreen'
import {
  HeadSubHeadsScreen, SpendTypesScreen, SubHeadsScreen,
} from '@/features/settings/SubHeadsScreen'
import { ActivitiesScreen } from '@/features/settings/ActivitiesScreen'
import { LabourersScreen } from '@/features/settings/LabourersScreen'
import { PlotsScreen } from '@/features/settings/PlotsScreen'
import { FarmProfileScreen } from '@/features/settings/FarmProfileScreen'
import { BackupScreen } from '@/features/settings/BackupScreen'
import { UpdateScreen } from '@/features/settings/UpdateScreen'

/**
 * Boot, then routes.
 *
 * Nothing renders until the database is open and seeded. Screens can then read
 * it without every one of them carrying its own "not ready yet" branch, which
 * is the sort of thing that works on a fast phone and flickers on a slow one.
 */

type BootState = { status: 'loading' } | { status: 'ready' } | { status: 'error'; error: Error }

/**
 * The native splash is configured with launchAutoHide: false, so it stays up
 * until this is called. That is deliberate — it hides the moment the database
 * is open, instead of uncovering a half-drawn screen — but it means EVERY exit
 * from boot has to call it. Missing one leaves the app frozen on the splash
 * with no error and nothing to tap, which is exactly what happened.
 */
function hideSplash(): void {
  if (!Capacitor.isNativePlatform()) return
  void SplashScreen.hide().catch(() => {
    // Plugin missing or already hidden; nothing useful to do either way.
  })
}

/**
 * Opening the database should take milliseconds. If it has not finished in
 * twenty seconds it is not going to, and showing the farmer a recoverable
 * error beats a screen that never changes.
 */
const BOOT_TIMEOUT_MS = 20_000

function Splash() {
  return (
    <div className="min-h-dvh grid place-items-center">
      <div className="flex flex-col items-center gap-3">
        <Logo size={72} />
        <p className="text-sm" style={{ color: 'var(--text-faint)' }}>
          ಕೃಷಿ ಖಾತೆ
        </p>
      </div>
    </div>
  )
}

function BootError({ error, onRetry }: { error: Error; onRetry: () => void }) {
  return (
    <div className="min-h-dvh grid place-items-center p-6">
      <div className="card p-5 max-w-sm space-y-3">
        <h1 className="text-lg font-semibold">Could not open the database</h1>
        <p className="text-sm" style={{ color: 'var(--text-soft)' }}>
          Your records are still on this phone — the app just could not reach them this
          time. Try again, and if it keeps happening, restart the phone before
          reinstalling, because reinstalling can remove the data.
        </p>
        <pre
          className="text-xs overflow-x-auto p-2 rounded"
          style={{ background: 'var(--surface-sunken)', color: 'var(--text-faint)' }}
        >
          {error.message}
        </pre>
        <button
          onClick={onRetry}
          className="w-full rounded-xl py-3 font-semibold text-white"
          style={{ background: 'var(--color-brand-500)' }}
        >
          Try again
        </button>
      </div>
    </div>
  )
}

const ROUTES: RouteDef[] = [
  { path: '/', render: () => <HomeScreen /> },
  { path: '/entries', render: () => <EntriesScreen /> },
  { path: '/entries/:id', render: (p) => <EntryDetailScreen id={p.id} /> },
  { path: '/add', render: () => <AddEntryScreen /> },
  { path: '/labour', render: () => <LabourScreen /> },
  { path: '/labour/work', render: () => <AddWorkScreen /> },
  { path: '/labour/pay', render: () => <PayScreen /> },
  { path: '/labour/pay/:id', render: (p) => <PayScreen labourerId={p.id} /> },
  { path: '/labour/khata/:id', render: (p) => <LabourerDetailScreen id={p.id} /> },
  { path: '/reports', render: () => <ReportsScreen /> },

  { path: '/settings', render: () => <SettingsScreen /> },
  { path: '/settings/profile', render: () => <FarmProfileScreen /> },
  { path: '/settings/accounts', render: () => <AccountsScreen /> },
  { path: '/settings/plots', render: () => <PlotsScreen /> },
  // "What you sell" and "what you spend on" are separate lists; a crop is one
  // row appearing in both. /settings/heads keeps working and lands on sales.
  { path: '/settings/heads', render: () => <HeadsScreen side="income" /> },
  { path: '/settings/heads/income', render: () => <HeadsScreen side="income" /> },
  { path: '/settings/heads/expense', render: () => <HeadsScreen side="expense" /> },
  { path: '/settings/sub-heads', render: () => <SubHeadsScreen /> },
  { path: '/settings/sub-heads/:headId', render: (p) => <HeadSubHeadsScreen headId={p.headId} /> },
  { path: '/settings/spend-types', render: () => <SpendTypesScreen /> },
  { path: '/settings/activities', render: () => <ActivitiesScreen /> },
  { path: '/settings/labourers', render: () => <LabourersScreen /> },
  { path: '/settings/backup', render: () => <BackupScreen /> },
  { path: '/settings/update', render: () => <UpdateScreen /> },
]

export default function App() {
  const [boot, setBoot] = useState<BootState>({ status: 'loading' })
  const path = usePath()

  const start = useCallback(() => {
    setBoot({ status: 'loading' })
    void (async () => {
      try {
        await Promise.race([
          (async () => {
            await getDb()
            await seedIfEmpty()
          })(),
          new Promise<never>((_, reject) =>
            setTimeout(
              () => reject(new Error('The database did not open in time.')),
              BOOT_TIMEOUT_MS,
            ),
          ),
        ])
        setBoot({ status: 'ready' })
      } catch (err) {
        setBoot({
          status: 'error',
          error: err instanceof Error ? err : new Error(String(err)),
        })
      } finally {
        // Both paths, always. The error screen is only useful if it is visible.
        hideSplash()
      }
    })()
  }, [])

  useEffect(start, [start])

  useScrollReset(path)
  useHardwareBack(
    useCallback(() => {
      const h = window.location.hash
      return h === '' || h === '#/' || h === '#'
    }, []),
  )

  // The web build holds the database in memory until it is flushed, so a
  // backgrounded tab that never comes back would lose the last few writes.
  useEffect(() => {
    const flush = () => void saveNow()
    document.addEventListener('visibilitychange', flush)
    window.addEventListener('pagehide', flush)
    return () => {
      document.removeEventListener('visibilitychange', flush)
      window.removeEventListener('pagehide', flush)
    }
  }, [])

  const screen = useRoutes(
    ROUTES,
    <Shell title="Not found" onBack={() => navigate('/')}>
      <Page>
        <p className="text-sm" style={{ color: 'var(--text-faint)' }}>
          That screen does not exist.
        </p>
      </Page>
    </Shell>,
  )

  if (boot.status === 'loading') return <Splash />
  if (boot.status === 'error') return <BootError error={boot.error} onRetry={start} />
  return <>{screen}</>
}
