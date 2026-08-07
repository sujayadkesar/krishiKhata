import { CalendarPlus, IndianRupee, Users, User, ChevronRight } from 'lucide-react'
import { Page, Shell } from '@/components/Shell'
import { Card, EmptyState, SectionHeader } from '@/components/ui'
import { useQuery } from '@/hooks/useQuery'
import { labourBalances } from '@/data/labour'
import { useI18n } from '@/i18n'
import { formatRupees } from '@/lib/money'
import { balanceState } from '@/lib/labour'
import { navigate } from '@/router'

/**
 * The khata: everyone, and where each of them stands.
 *
 * Sorted by balance descending so whoever is owed the most is at the top —
 * that is the list a farmer opens this screen to see, usually because someone
 * is standing in front of them asking.
 */

export function LabourScreen() {
  const { t, nameOf } = useI18n()
  const { data, loading } = useQuery(() => labourBalances(false), [])

  const rows = data ?? []
  const totalOwed = rows.reduce((s, r) => s + Math.max(0, r.balance_paise), 0)
  const totalAdvance = rows.reduce((s, r) => s + Math.max(0, -r.balance_paise), 0)

  return (
    <Shell title={t('labour.title')}>
      <Page>
        <div className="grid grid-cols-2 gap-2.5">
          <button
            onClick={() => navigate('/labour/work')}
            className="card p-4 flex flex-col items-center gap-1.5 font-semibold"
            style={{ color: 'var(--color-brand-600)' }}
          >
            <CalendarPlus size={22} />
            <span className="text-sm">{t('labour.addWork')}</span>
          </button>
          <button
            onClick={() => navigate('/labour/pay')}
            className="card p-4 flex flex-col items-center gap-1.5 font-semibold"
            style={{ color: 'var(--color-expense)' }}
          >
            <IndianRupee size={22} />
            <span className="text-sm">{t('labour.pay')}</span>
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <div className="card p-3.5">
            <p className="text-xs font-semibold" style={{ color: 'var(--text-soft)' }}>
              {t('labour.owed')}
            </p>
            <p className="text-xl font-semibold tnum" style={{ color: 'var(--color-expense)' }}>
              {loading ? '—' : formatRupees(totalOwed)}
            </p>
          </div>
          <div className="card p-3.5">
            <p className="text-xs font-semibold" style={{ color: 'var(--text-soft)' }}>
              {t('labour.advance')}
            </p>
            <p className="text-xl font-semibold tnum" style={{ color: 'var(--color-transfer)' }}>
              {loading ? '—' : formatRupees(totalAdvance)}
            </p>
          </div>
        </div>

        <div>
          <SectionHeader>{t('labour.khata')}</SectionHeader>
          {loading ? (
            <EmptyState>{t('common.loading')}</EmptyState>
          ) : rows.length === 0 ? (
            <EmptyState>{t('labour.noLabourers')}</EmptyState>
          ) : (
            <Card>
              {rows.map((r) => {
                const state = balanceState(r.balance_paise)
                const colour =
                  state === 'owed'
                    ? 'var(--color-expense)'
                    : state === 'advance'
                      ? 'var(--color-transfer)'
                      : 'var(--text-faint)'

                return (
                  <button
                    key={r.labourer_id}
                    onClick={() => navigate(`/labour/khata/${r.labourer_id}`)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left"
                  >
                    <span style={{ color: 'var(--text-faint)' }}>
                      {r.is_group_lead ? <Users size={19} /> : <User size={19} />}
                    </span>

                    <span className="flex-1 min-w-0">
                      <span className="block font-medium truncate">{nameOf(r)}</span>
                      <span className="block text-xs" style={{ color: 'var(--text-faint)' }}>
                        {r.code ? `${r.code} · ` : ''}
                        {r.days} {t('labour.daysWorked')}
                        {r.person_days !== r.days
                          ? ` · ${r.person_days} ${t('labour.personDays')}`
                          : ''}
                      </span>
                    </span>

                    <span className="text-right shrink-0">
                      <span className="block tnum font-semibold" style={{ color: colour }}>
                        {formatRupees(Math.abs(r.balance_paise))}
                      </span>
                      <span className="block text-[11px]" style={{ color: colour }}>
                        {state === 'owed'
                          ? t('labour.owed')
                          : state === 'advance'
                            ? t('labour.advance')
                            : t('labour.settled')}
                      </span>
                    </span>

                    <ChevronRight size={16} style={{ color: 'var(--text-faint)' }} />
                  </button>
                )
              })}
            </Card>
          )}
        </div>

        <p className="text-xs px-1" style={{ color: 'var(--text-faint)' }}>
          {t('labour.advanceNote')}
        </p>
      </Page>
    </Shell>
  )
}
