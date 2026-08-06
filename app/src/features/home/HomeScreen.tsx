import { all } from '@/db/db'
import { useQuery } from '@/hooks/useQuery'
import { useI18n } from '@/i18n'
import { Page, Shell } from '@/components/Shell'
import { formatRupees } from '@/lib/money'
import { formatMonth, todayISO } from '@/lib/date'
import { navigate } from '@/router'
import { TrendingUp, TrendingDown, Users, Plus } from 'lucide-react'
import type { Account } from '@/db/types'

/**
 * The dashboard. Charts and trends arrive in a later phase; what is here now
 * is the part a farmer opens the app to see — what came in, what went out, and
 * what is actually in the box.
 */

interface HomeData {
  accounts: Account[]
  incomePaise: number
  expensePaise: number
}

async function load(): Promise<HomeData> {
  const today = todayISO()
  const from = today.slice(0, 8) + '01'

  const accounts = await all<Account>(
    'SELECT * FROM accounts WHERE is_active = 1 ORDER BY sort_order, name_en;',
  )

  const totals = await all<{ kind: string; total: number }>(
    `SELECT kind, SUM(amount_paise) AS total
       FROM entries
      WHERE is_deleted = 0 AND date >= ? AND date <= ?
      GROUP BY kind;`,
    [from, today],
  )

  const of = (k: string) => totals.find((t) => t.kind === k)?.total ?? 0
  return { accounts, incomePaise: of('income'), expensePaise: of('expense') }
}

function Stat({
  label,
  value,
  tone,
  icon: Icon,
}: {
  label: string
  value: string
  tone: 'income' | 'expense' | 'neutral'
  icon?: typeof TrendingUp
}) {
  const colour =
    tone === 'income'
      ? 'var(--color-income)'
      : tone === 'expense'
        ? 'var(--color-expense)'
        : 'var(--text)'

  return (
    <div className="card p-3.5">
      <div className="flex items-center gap-1.5 mb-1">
        {Icon ? <Icon size={15} style={{ color: colour }} /> : null}
        <span className="text-xs font-semibold" style={{ color: 'var(--text-soft)' }}>
          {label}
        </span>
      </div>
      <div className="text-xl font-semibold tnum truncate" style={{ color: colour }}>
        {value}
      </div>
    </div>
  )
}

export function HomeScreen() {
  const { t, lang, nameOf } = useI18n()
  const { data, loading } = useQuery(load, [])

  const net = (data?.incomePaise ?? 0) - (data?.expensePaise ?? 0)

  return (
    <Shell>
      <Page>
        <section>
          <h2 className="text-sm font-semibold mb-2" style={{ color: 'var(--text-soft)' }}>
            {t('dash.thisMonth')} · {formatMonth(todayISO(), lang)}
          </h2>

          <div className="grid grid-cols-3 gap-2.5">
            <Stat
              label={t('dash.income')}
              value={loading ? '—' : formatRupees(data?.incomePaise ?? 0)}
              tone="income"
              icon={TrendingUp}
            />
            <Stat
              label={t('dash.expense')}
              value={loading ? '—' : formatRupees(data?.expensePaise ?? 0)}
              tone="expense"
              icon={TrendingDown}
            />
            <Stat
              label={t('dash.net')}
              value={loading ? '—' : formatRupees(net)}
              tone={net < 0 ? 'expense' : 'neutral'}
            />
          </div>
        </section>

        <section>
          <h2 className="text-sm font-semibold mb-2" style={{ color: 'var(--text-soft)' }}>
            {t('dash.balances')}
          </h2>
          <div className="card divide-y" style={{ borderColor: 'var(--border)' }}>
            {(data?.accounts ?? []).map((a) => (
              <div
                key={a.id}
                className="flex items-center justify-between px-4 py-3"
                style={{ borderColor: 'var(--border)' }}
              >
                <span className="font-medium">{nameOf(a)}</span>
                <span className="tnum font-semibold">
                  {formatRupees(a.opening_balance_paise)}
                </span>
              </div>
            ))}
            {!loading && (data?.accounts.length ?? 0) === 0 ? (
              <p className="px-4 py-6 text-center text-sm" style={{ color: 'var(--text-faint)' }}>
                {t('common.empty')}
              </p>
            ) : null}
          </div>
        </section>

        <section>
          <h2 className="text-sm font-semibold mb-2" style={{ color: 'var(--text-soft)' }}>
            {t('dash.quickAdd')}
          </h2>
          <div className="grid grid-cols-2 gap-2.5">
            <button
              onClick={() => navigate('/add')}
              className="card p-4 flex items-center gap-2.5 font-semibold"
              style={{ color: 'var(--color-brand-600)' }}
            >
              <Plus size={20} />
              {t('nav.add')}
            </button>
            <button
              onClick={() => navigate('/labour')}
              className="card p-4 flex items-center gap-2.5 font-semibold"
              style={{ color: 'var(--color-brand-600)' }}
            >
              <Users size={20} />
              {t('labour.addWork')}
            </button>
          </div>
        </section>
      </Page>
    </Shell>
  )
}
