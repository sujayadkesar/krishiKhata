import {
  Wallet, Sprout, Tags, Hammer, Users, Home, Languages, CloudUpload, ChevronRight, MapPin,
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
 * This list used to run six near-identical rows under one heading that said
 * "what you grow AND spend on" — which is exactly the confusion. They are two
 * different questions. Banana is a thing you SELL; it is also one of several
 * things you spend money ON, alongside the car and the house. Putting them
 * under one title asked the reader to hold both meanings at once.
 *
 * So: "What you sell" is the crops. "What you spend on" is every category
 * money leaves under, crops included. The varieties row is gone entirely —
 * kinds of banana are now edited inside banana, where somebody looking for
 * them would actually look.
 *
 * The titles and hints are translated. They were English literals on a screen
 * whose default language is Kannada, which is its own kind of clutter: a
 * reader who cannot read the heading has to open all six rows to find out
 * what they do.
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
    title: 'set.grpSell',
    rows: [
      { path: '/settings/heads/income', label: 'set.incomeHeads', icon: Sprout, hint: 'set.hintCrops' },
    ],
  },
  {
    title: 'set.grpSpend',
    rows: [
      { path: '/settings/heads/expense', label: 'set.expenseHeads', icon: Tags, hint: 'set.hintSpend' },
      { path: '/settings/spend-types', label: 'set.spendTypes', icon: Tags, hint: 'set.hintSpendKinds' },
    ],
  },
  {
    title: 'set.grpWork',
    rows: [
      { path: '/settings/labourers', label: 'labour.labourers', icon: Users, hint: 'set.hintWorkers' },
      { path: '/settings/activities', label: 'set.activities', icon: Hammer, hint: 'set.hintActivities' },
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
