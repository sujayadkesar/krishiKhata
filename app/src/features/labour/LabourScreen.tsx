import {
  BadgeIndianRupee, CalendarPlus, ChevronRight, Droplets, IndianRupee, User, Users,
} from 'lucide-react'
import { Page, Shell } from '@/components/Shell'
import { Card, EmptyState, SectionHeader } from '@/components/ui'
import { useQuery } from '@/hooks/useQuery'
import { labourBalances, openJobs, postSalary, salaryDueFor } from '@/data/labour'
import { listLabourers } from '@/data/masterData'
import { useI18n } from '@/i18n'
import { formatRupees } from '@/lib/money'
import { balanceState } from '@/lib/labour'
import { addMonths, formatMonth, monthEnd, monthStart, todayISO } from '@/lib/date'
import { navigate } from '@/router'

/**
 * The khata: everyone, and where each of them stands.
 *
 * Sorted by balance descending so whoever is owed the most is at the top —
 * that is the list a farmer opens this screen to see, usually because someone
 * is standing in front of them asking.
 */

export function LabourScreen() {
  const { t, lang, nameOf } = useI18n()
  const { data, loading } = useQuery(() => labourBalances(false), [])
  const { data: jobs, reload: reloadJobs } = useQuery(openJobs, [])
  const { data: workers, reload: reloadWorkers } = useQuery(() => listLabourers(false), [])

  /**
   * Salary is posted for the month that has ENDED, not the one running.
   *
   * Posting mid-month would put a full month's wage into a month that is not
   * over, and the balance would say the farm owes it before it has been
   * earned. The last day of last month is also the date the row carries.
   */
  const lastMonthEnd = monthEnd(monthStart(addMonths(todayISO(), -1)))
  const lastMonthLabel = formatMonth(lastMonthEnd, lang)

  const { data: posted, reload: reloadPosted } = useQuery(
    () => salaryDueFor(lastMonthEnd),
    [lastMonthEnd],
  )

  const salaryDue = (workers ?? []).filter(
    (l) =>
      l.employment === 'monthly' &&
      (l.monthly_salary_paise ?? 0) > 0 &&
      !(posted ?? []).includes(l.id),
  )

  async function postFor(labourerId: string, amount: number) {
    await postSalary(labourerId, lastMonthEnd, amount)
    reloadPosted()
    reloadWorkers()
    reloadJobs()
  }

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

        {/*
          Work that has been done but never priced.

          On a cash basis an unpriced job is worth nothing in every total on
          this screen, so without saying so plainly the farmer's books quietly
          understate what they are about to owe. This is the same reasoning as
          the unpaid-wages line on every statement, applied one step earlier.
        */}
        {(jobs ?? []).length > 0 ? (
          <button
            onClick={() => navigate('/labour/price')}
            className="card p-3.5 w-full flex items-center gap-3 text-left"
            style={{
              background: 'var(--color-earth-100)',
              borderColor: 'var(--color-earth-300)',
              color: 'var(--color-earth-700)',
            }}
          >
            <Droplets size={20} className="shrink-0" />
            <span className="flex-1 min-w-0">
              <span className="block text-sm font-semibold">{t('labour.openJobs')}</span>
              <span className="block text-xs">
                {jobs?.length} {jobs?.length === 1 ? 'job' : 'jobs'} · {t('labour.setPrice')}
              </span>
            </span>
            <ChevronRight size={16} />
          </button>
        ) : null}

        {/*
          A salaried worker's month, one tap. Offered only where it has not
          already been posted — `postSalary` refuses a second one for the same
          month anyway, but a button that does nothing is worse than no button.
        */}
        {salaryDue.length > 0 ? (
          <Card>
            {salaryDue.map((l) => (
              <div key={l.id} className="flex items-center gap-3 px-4 py-3">
                <BadgeIndianRupee size={19} style={{ color: 'var(--color-income)' }} />
                <span className="flex-1 min-w-0">
                  <span className="block font-medium truncate">{nameOf(l)}</span>
                  <span className="block text-xs" style={{ color: 'var(--text-faint)' }}>
                    {formatRupees(l.monthly_salary_paise ?? 0)} · {lastMonthLabel}
                  </span>
                </span>
                <button
                  onClick={() => void postFor(l.id, l.monthly_salary_paise ?? 0)}
                  className="rounded-lg px-3 py-2 text-sm font-semibold"
                  style={{ background: 'var(--color-brand-500)', color: '#fff', minHeight: 38 }}
                >
                  {t('labour.postSalary')}
                </button>
              </div>
            ))}
          </Card>
        ) : null}

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
