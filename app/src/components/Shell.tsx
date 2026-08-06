import type { ReactNode } from 'react'
import { House, ReceiptText, Plus, Users, ChartColumn, Settings } from 'lucide-react'
import { navigate, usePath } from '@/router'
import { useI18n } from '@/i18n'
import { Logo } from './Logo'
import type { StringKey } from '@/i18n/strings'

/**
 * The frame every screen sits in: a title bar and a bottom nav.
 *
 * Navigation lives at the BOTTOM because this app is used one-handed while
 * standing in a field, often by someone whose other hand is holding something.
 * The five destinations are fixed and always visible — a farmer who has to
 * find a hidden menu to record a payment will not record the payment.
 */

interface NavItem {
  path: string
  label: StringKey
  icon: typeof House
  /** Matches child screens too, so a detail page keeps its tab lit. */
  prefix?: string
}

const NAV: NavItem[] = [
  { path: '/', label: 'nav.home', icon: House },
  { path: '/entries', label: 'nav.entries', icon: ReceiptText, prefix: '/entries' },
  { path: '/add', label: 'nav.add', icon: Plus, prefix: '/add' },
  { path: '/labour', label: 'nav.labour', icon: Users, prefix: '/labour' },
  { path: '/reports', label: 'nav.reports', icon: ChartColumn, prefix: '/reports' },
]

function isActive(item: NavItem, path: string): boolean {
  if (item.prefix) return path === item.path || path.startsWith(item.prefix + '/')
  return path === item.path
}

export function Shell({
  children,
  title,
  showNav = true,
  right,
  onBack,
}: {
  children: ReactNode
  title?: string
  showNav?: boolean
  right?: ReactNode
  onBack?: () => void
}) {
  const path = usePath()
  const { t } = useI18n()

  return (
    <div className="min-h-dvh flex flex-col">
      <header
        className="sticky top-0 z-20 flex items-center gap-3 px-4 h-14 border-b"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
      >
        {onBack ? (
          <button
            onClick={onBack}
            className="-ml-2 px-2 text-sm font-semibold"
            style={{ color: 'var(--color-brand-600)' }}
          >
            ← {t('common.back')}
          </button>
        ) : (
          <Logo size={30} />
        )}

        <h1 className="flex-1 text-lg font-semibold truncate">
          {title ?? t('app.name')}
        </h1>

        {right ?? (
          <button
            onClick={() => navigate('/settings')}
            aria-label={t('nav.settings')}
            className="p-2 -mr-2"
            style={{ color: 'var(--text-soft)' }}
          >
            <Settings size={22} />
          </button>
        )}
      </header>

      <main
        className="flex-1"
        style={{ paddingBottom: showNav ? 'calc(72px + env(safe-area-inset-bottom))' : 0 }}
      >
        {children}
      </main>

      {showNav ? (
        <nav
          className="fixed bottom-0 inset-x-0 z-20 border-t"
          style={{
            background: 'var(--surface)',
            borderColor: 'var(--border)',
            paddingBottom: 'env(safe-area-inset-bottom)',
          }}
        >
          <ul className="grid grid-cols-5">
            {NAV.map((item) => {
              const active = isActive(item, path)
              const Icon = item.icon
              const isAdd = item.path === '/add'

              return (
                <li key={item.path}>
                  <button
                    onClick={() => navigate(item.path)}
                    className="w-full flex flex-col items-center justify-center gap-0.5 py-2"
                    style={{ color: active ? 'var(--color-brand-600)' : 'var(--text-faint)' }}
                    aria-current={active ? 'page' : undefined}
                  >
                    <span
                      className="flex items-center justify-center rounded-full"
                      style={
                        isAdd
                          ? {
                              width: 38,
                              height: 38,
                              background: 'var(--color-brand-500)',
                              color: '#fff',
                            }
                          : undefined
                      }
                    >
                      <Icon size={isAdd ? 22 : 21} strokeWidth={active ? 2.4 : 1.9} />
                    </span>
                    <span
                      className="text-[11px] leading-tight"
                      style={{ fontWeight: active ? 600 : 400 }}
                    >
                      {t(item.label)}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </nav>
      ) : null}
    </div>
  )
}

/** Consistent page padding, so screens do not each invent their own. */
export function Page({ children }: { children: ReactNode }) {
  return <div className="px-4 py-4 space-y-4 max-w-2xl mx-auto w-full">{children}</div>
}
