import {
  Wallet, Sprout, Tags, Hammer, Users, Home, Languages, CloudUpload, ChevronRight, MapPin,
  TrendingUp, TrendingDown,
} from 'lucide-react'
import { Page, Shell } from '@/components/Shell'
import { Card, ListRow, SectionHeader } from '@/components/ui'
import { useI18n } from '@/i18n'
import { LANGS } from '@/i18n/strings'
import { navigate } from '@/router'
import versionFile from '../../../version.json'
import type { StringKey } from '@/i18n/strings'

/**
 * Settings is where the app is shaped to the farm: which crops, which units
 * they sell in, what each labourer is paid. Everything else depends on it,
 * which is why the first group is the one a new user must fill in.
 */

interface Row {
  path: string
  label: StringKey
  icon: typeof Wallet
  hint: StringKey
}

/**
 * Four groups, in the order a farm is set up.
 *
 * Selling and spending sit together under ONE heading now, with a row each.
 * They are two lists and stay two lists — clubbing them into a single list is
 * what made the old screen unreadable — but they are two answers to the same
 * question, "what does money move against", and separating them across the
 * page implied they were unrelated things.
 *
 * The crops have their own row, apart from both. That list is what fills the
 * crop box when a day of labour is recorded, and a farmer looking for it under
 * "what you sell" would not find it, because a worker weeding a field is not
 * a sale. It is the same underlying rows — a crop is sold, spent on, AND
 * worked — shown where each of the three questions is asked.
 *
 * Every row says where in the app it shows up. From inside Settings there was
 * no way to tell, so people edited the wrong list or edited nothing.
 */
const GROUPS: { title: StringKey; rows: Row[] }[] = [
  {
    title: 'set.grpFarm',
    rows: [
      { path: '/settings/profile', label: 'set.farmProfile', icon: Home, hint: 'set.hintProfile' },
      { path: '/settings/plots', label: 'plot.title', icon: MapPin, hint: 'set.hintPlots' },
      { path: '/settings/accounts', label: 'set.accounts', icon: Wallet, hint: 'set.hintAccounts' },
    ],
  },
  {
    title: 'set.grpMoney',
    rows: [
      { path: '/settings/heads/income', label: 'set.incomeHeads', icon: TrendingUp, hint: 'set.hintCrops' },
      { path: '/settings/heads/expense', label: 'set.expenseHeads', icon: TrendingDown, hint: 'set.hintSpend' },
      { path: '/settings/spend-types', label: 'set.spendTypes', icon: Tags, hint: 'set.hintSpendKinds' },
    ],
  },
  {
    title: 'set.grpWork',
    rows: [
      { path: '/settings/crops', label: 'set.cropHeads', icon: Sprout, hint: 'set.hintCropWork' },
      { path: '/settings/activities', label: 'set.activities', icon: Hammer, hint: 'set.hintActivities' },
      { path: '/settings/labourers', label: 'labour.labourers', icon: Users, hint: 'set.hintWorkers' },
    ],
  },
]

export function SettingsScreen() {
  const { t, lang, setLang } = useI18n()
  // Straight from version.json, the one place the shipped version lives.
  const { version } = versionFile

  return (
    <Shell title={t('set.title')} right={<span />}>
      <Page>
        {GROUPS.map((group) => (
          <section key={group.title}>
            <SectionHeader>{t(group.title)}</SectionHeader>
            <Card>
              {group.rows.map(({ path, label, icon: Icon, hint }) => (
                <ListRow
                  key={path}
                  title={t(label)}
                  subtitle={t(hint)}
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
              subtitle={t('backup.privacyBody')}
              onClick={() => navigate('/settings/backup')}
              leading={<CloudUpload size={20} style={{ color: 'var(--color-brand-600)' }} />}
              right={<ChevronRight size={18} style={{ color: 'var(--text-faint)' }} />}
            />
          </Card>
        </div>

        <p className="text-center text-xs pt-2" style={{ color: 'var(--text-faint)' }}>
          ಕೃಷಿ ಖಾತೆ · Krishi Khata · {version}
        </p>
      </Page>
    </Shell>
  )
}
