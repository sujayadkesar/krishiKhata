import {
  Wallet, Sprout, Tags, Hammer, Users, Home, Languages, CloudUpload, ChevronRight,
} from 'lucide-react'
import { Page, Shell } from '@/components/Shell'
import { Card, ListRow, SectionHeader } from '@/components/ui'
import { useI18n } from '@/i18n'
import { LANGS } from '@/i18n/strings'
import { navigate } from '@/router'
import type { StringKey } from '@/i18n/strings'

/**
 * Settings is where the app is shaped to the farm: which crops, which units
 * they sell in, what each labourer is paid. Everything else depends on it,
 * which is why the first three rows are the ones a new user must fill in.
 */

interface Row {
  path: string
  label: StringKey
  icon: typeof Wallet
  hint: string
}

/**
 * Grouped, not one long list.
 *
 * Six identical rows give no clue which matter on day one. "Your farm" is what
 * a new user must fill in before anything works; "What you grow and spend on"
 * is the vocabulary; "Your team" is people. Someone who has just installed the
 * app can work down the groups in order.
 */
const GROUPS: { title: string; rows: Row[] }[] = [
  {
    title: 'Your farm',
    rows: [
      { path: '/settings/profile', label: 'set.farmProfile', icon: Home, hint: 'Name and village, printed on every statement' },
      { path: '/settings/accounts', label: 'set.accounts', icon: Wallet, hint: 'Cash, bank and UPI, with opening balances' },
    ],
  },
  {
    title: 'What you grow and spend on',
    rows: [
      { path: '/settings/heads', label: 'set.heads', icon: Sprout, hint: 'Crops, the units they sell in, and their colours' },
      { path: '/settings/sub-heads', label: 'set.subHeads', icon: Tags, hint: 'Kinds of spending, and grades a crop is sold in' },
      { path: '/settings/activities', label: 'set.activities', icon: Hammer, hint: 'The work itself — harvesting, spraying, weeding' },
    ],
  },
  {
    title: 'Your team',
    rows: [
      { path: '/settings/labourers', label: 'labour.labourers', icon: Users, hint: 'Names, phones and day rates' },
    ],
  },
]

export function SettingsScreen() {
  const { t, lang, setLang } = useI18n()

  return (
    <Shell title={t('set.title')} right={<span />}>
      <Page>
        {GROUPS.map((group) => (
          <section key={group.title}>
            <SectionHeader>{group.title}</SectionHeader>
            <Card>
              {group.rows.map(({ path, label, icon: Icon, hint }) => (
                <ListRow
                  key={path}
                  title={t(label)}
                  subtitle={hint}
                  onClick={() => navigate(path)}
                  leading={
                    <span
                      className="grid place-items-center rounded-lg shrink-0"
                      style={{
                        width: 34,
                        height: 34,
                        background: 'var(--color-brand-50)',
                        color: 'var(--color-brand-600)',
                      }}
                    >
                      <Icon size={18} />
                    </span>
                  }
                  right={<ChevronRight size={18} style={{ color: 'var(--text-faint)' }} />}
                />
              ))}
            </Card>
          </section>
        ))}

        <div>
          <SectionHeader>{t('set.language')}</SectionHeader>
          <div className="grid grid-cols-3 gap-2">
            {LANGS.map((l) => {
              const on = l.id === lang
              return (
                <button
                  key={l.id}
                  onClick={() => setLang(l.id)}
                  className="card px-2 py-3.5 text-sm font-semibold flex flex-col items-center justify-center gap-1.5 text-center leading-tight"
                  style={{
                    borderColor: on ? 'var(--color-brand-500)' : 'var(--border)',
                    background: on ? 'var(--color-brand-50)' : 'var(--surface-raised)',
                    color: on ? 'var(--color-brand-700)' : 'var(--text-soft)',
                  }}
                >
                  <Languages size={18} />
                  {l.label}
                </button>
              )
            })}
          </div>
        </div>

        <div>
          <SectionHeader>{t('set.backup')}</SectionHeader>
          <Card>
            <ListRow
              title={t('set.backup')}
              subtitle={t('backup.explain')}
              onClick={() => navigate('/settings/backup')}
              leading={<CloudUpload size={20} style={{ color: 'var(--color-brand-600)' }} />}
              right={<ChevronRight size={18} style={{ color: 'var(--text-faint)' }} />}
            />
          </Card>
        </div>

        <p className="text-center text-xs pt-2" style={{ color: 'var(--text-faint)' }}>
          ಕೃಷಿ ಖಾತೆ · Krishi Khata
        </p>
      </Page>
    </Shell>
  )
}
