import { useMemo, useState } from 'react'
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from 'recharts'
import { Phone, IndianRupee, Trash2, Share2, Clock } from 'lucide-react'
import { Page, Shell } from '@/components/Shell'
import { Button, Card, Confirm, EmptyState, SectionHeader } from '@/components/ui'
import { useQuery } from '@/hooks/useQuery'
import {
  attendanceFor, deleteAttendance, deletePayment, labourBalances, labourLedger,
  monthlyFor, paymentGapFor, paymentsFor, workByCropFor,
} from '@/data/labour'
import { getFarmProfile } from '@/data/masterData'
import { labourStatementDoc } from '@/features/reports/documents'
import { printReport, reportFileName, shareReport } from '@/lib/print'
import { useI18n } from '@/i18n'
import { formatCompactINR, formatRupees } from '@/lib/money'
import { balanceState } from '@/lib/labour'
import { formatDate, formatMonth, todayISO } from '@/lib/date'
import { FULL_DAY } from '@/db/types'
import { back } from '@/router'

/**
 * One labourer, completely.
 *
 * The khata ledger is the centre of this screen: work and money interleaved
 * with a running balance, the way the two of them actually settle up. The
 * underlying tables stay separate — that separation is what makes cash-basis
 * accounting work — but a farmer standing in front of somebody needs one
 * column to run a finger down.
 */

const SWATCH: Record<string, string> = {
  amber: '#f59e0b', rose: '#f43f5e', orange: '#f97316', yellow: '#eab308',
  lime: '#84cc16', emerald: '#10b981', sky: '#0ea5e9', violet: '#8b5cf6', slate: '#64748b',
}
const FALLBACK = ['#1b7a43', '#d98324', '#2563eb', '#c0392b', '#8b5cf6']

const moneyTip = (v: unknown): string => {
  const n = Array.isArray(v) ? Number(v[0]) : Number(v)
  return formatRupees(Number.isFinite(n) ? n : 0)
}
const axisStyle = { fontSize: 11, fill: 'var(--text-faint)' }
const TOOLTIP_STYLE = {
  background: 'var(--surface-raised)',
  border: '1px solid var(--border)',
  borderRadius: 10,
  fontSize: 12,
  color: 'var(--text)',
}

export function LabourerDetailScreen({ id }: { id: string }) {
  const { t, nameOf, lang } = useI18n()

  const { data: balances } = useQuery(() => labourBalances(true), [])
  const { data: work } = useQuery(() => attendanceFor(id), [id])
  const { data: payments } = useQuery(() => paymentsFor(id), [id])
  const { data: ledger } = useQuery(() => labourLedger(id), [id])
  const { data: byCrop } = useQuery(() => workByCropFor(id), [id])
  const { data: monthly } = useQuery(() => monthlyFor(id), [id])
  const { data: gap } = useQuery(() => paymentGapFor(id), [id])
  const { data: profile } = useQuery(getFarmProfile, [])

  const [removeWork, setRemoveWork] = useState<string | null>(null)
  const [removePay, setRemovePay] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const me = balances?.find((b) => b.labourer_id === id)
  const state = balanceState(me?.balance_paise ?? 0)
  const colour =
    state === 'owed'
      ? 'var(--color-expense)'
      : state === 'advance'
        ? 'var(--color-transfer)'
        : 'var(--text-faint)'

  const cropData = useMemo(
    () =>
      (byCrop ?? [])
        .filter((c) => c.earned_paise > 0)
        .map((c, i) => ({
          name: c.name_en
            ? nameOf({ name_en: c.name_en, name_kn: c.name_kn ?? c.name_en })
            : '—',
          value: c.earned_paise,
          days: c.person_days,
          fill: (c.color && SWATCH[c.color]) || FALLBACK[i % FALLBACK.length],
        })),
    [byCrop, nameOf],
  )

  const trend = useMemo(
    () =>
      (monthly ?? []).map((m) => ({
        month: formatMonth(`${m.month}-01`, lang).split(' ')[0],
        earned: m.earned,
        paid: m.paid,
      })),
    [monthly, lang],
  )

  async function output(mode: 'print' | 'share') {
    if (!me || !profile || !work || !payments) return
    setBusy(mode)
    setError(null)
    try {
      const html = labourStatementDoc(
        {
          profile,
          period: { from: work.at(-1)?.date ?? todayISO(), to: todayISO() },
          lang,
          name: (row) =>
            row ? nameOf({ name_en: row.name_en ?? '', name_kn: row.name_kn ?? '' }) : '',
        },
        me,
        work,
        payments,
        me.balance_paise,
        { byCrop: byCrop ?? [], monthly: monthly ?? [] },
      )
      const run = mode === 'print' ? printReport : shareReport
      await run(
        html,
        `${nameOf(me)} — ${t('report.labourStatement')}`,
        reportFileName(me.code ?? nameOf(me), '', ''),
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(null)
    }
  }

  return (
    <Shell
      title={me ? nameOf(me) : t('labour.labourer')}
      onBack={back}
      right={
        me?.phone ? (
          <a href={`tel:${me.phone}`} aria-label="Call" style={{ color: 'var(--color-brand-600)' }}>
            <Phone size={20} />
          </a>
        ) : (
          <span />
        )
      }
    >
      <Page>
        {/* Headline balance */}
        <div
          className="card p-5 text-center"
          style={{
            background:
              state === 'owed'
                ? 'var(--color-expense-soft)'
                : state === 'advance'
                  ? 'var(--color-transfer-soft)'
                  : 'var(--surface-raised)',
            borderColor: state === 'settled' ? 'var(--border)' : 'transparent',
          }}
        >
          <p className="text-xs font-semibold" style={{ color: 'var(--text-soft)' }}>
            {state === 'advance' ? t('labour.advance') : t('labour.balance')}
          </p>
          <p className="text-4xl font-semibold tnum mt-0.5" style={{ color: colour }}>
            {formatRupees(Math.abs(me?.balance_paise ?? 0))}
          </p>
          <p className="text-sm mt-1" style={{ color: colour }}>
            {state === 'owed'
              ? t('labour.owed')
              : state === 'advance'
                ? t('labour.advanceHeld')
                : t('labour.settled')}
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2.5">
          {[
            [t('labour.daysWorked'), String(me?.days ?? 0),
              me && me.person_days !== me.days ? `${me.person_days} ${t('labour.personDays')}` : ''],
            [t('labour.earned'), formatCompactINR(me?.earned_paise ?? 0), ''],
            [t('labour.paid'), formatCompactINR(me?.paid_paise ?? 0), ''],
          ].map(([label, value, sub]) => (
            <div key={label} className="card p-3">
              <p className="text-[11px] font-semibold" style={{ color: 'var(--text-soft)' }}>
                {label}
              </p>
              <p className="text-base font-semibold tnum truncate">{value}</p>
              {sub ? (
                <p className="text-[10px] truncate" style={{ color: 'var(--text-faint)' }}>
                  {sub}
                </p>
              ) : null}
            </div>
          ))}
        </div>

        {/* How long they wait to be paid */}
        {gap && (gap.averageDays != null || gap.unpaidDays != null) ? (
          <div className="card p-3.5 flex items-start gap-2.5">
            <Clock size={17} className="shrink-0 mt-0.5" style={{ color: 'var(--color-earth-500)' }} />
            <div className="text-sm">
              {gap.averageDays != null ? (
                <p>
                  {t('labour.avgGap')}{' '}
                  <span className="font-semibold">{gap.averageDays} {t('labour.days')}</span>
                  {gap.longestDays != null && gap.longestDays !== gap.averageDays ? (
                    <span style={{ color: 'var(--text-faint)' }}>
                      {' '}· {t('labour.longest')} {gap.longestDays}
                    </span>
                  ) : null}
                </p>
              ) : null}
              {gap.unpaidDays != null && gap.unpaidDays > 0 ? (
                <p style={{ color: 'var(--color-expense)' }}>
                  {t('labour.waitingSince')} {formatDate(gap.unpaidOldest!, lang)} ({gap.unpaidDays}{' '}
                  {t('labour.days')})
                </p>
              ) : null}
            </div>
          </div>
        ) : null}

        <Button full onClick={() => (window.location.hash = `#/labour/pay/${id}`)}>
          <span className="inline-flex items-center gap-2 justify-center">
            <IndianRupee size={17} /> {t('labour.pay')}
          </span>
        </Button>

        {/* Work by crop */}
        {cropData.length > 0 ? (
          <div>
            <SectionHeader>{t('labour.workByCrop')}</SectionHeader>
            <div className="card p-3">
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={cropData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={44}
                    outerRadius={72}
                    paddingAngle={2}
                    stroke="none"
                  >
                    {cropData.map((c) => (
                      <Cell key={c.name} fill={c.fill} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={TOOLTIP_STYLE} formatter={moneyTip} />
                  <Legend verticalAlign="bottom" iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : null}

        {/* Earned against paid, month by month */}
        {trend.length > 1 ? (
          <div>
            <SectionHeader>{t('labour.earnedVsPaid')}</SectionHeader>
            <div className="card p-3">
              <ResponsiveContainer width="100%" height={190}>
                <BarChart data={trend} margin={{ left: 4, right: 8, top: 8 }}>
                  <CartesianGrid stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="month" tick={axisStyle} />
                  <YAxis
                    tickFormatter={(v: number) => formatCompactINR(v).replace('₹', '')}
                    tick={axisStyle}
                    width={44}
                  />
                  <Tooltip contentStyle={TOOLTIP_STYLE} formatter={moneyTip} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="earned" name={t('labour.earned')} fill="var(--color-brand-500)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="paid" name={t('labour.paid')} fill="var(--color-expense)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : null}

        {/* The khata itself */}
        <div>
          <SectionHeader>{t('labour.khata')}</SectionHeader>
          {!ledger?.length ? (
            <EmptyState>{t('common.empty')}</EmptyState>
          ) : (
            <Card>
              {[...ledger].reverse().map((r) => {
                const isWork = r.kind === 'work'
                const isReturn = r.kind === 'return'
                const tone = isWork
                  ? 'var(--color-brand-600)'
                  : isReturn
                    ? 'var(--color-income)'
                    : 'var(--color-expense)'
                const label = isWork
                  ? t('labour.workDay')
                  : isReturn
                    ? t('labour.returned')
                    : r.label === 'advance'
                      ? t('labour.advance')
                      : t('labour.paid')

                return (
                  <div key={r.id} className="flex items-center gap-3 px-4 py-2.5">
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-medium">
                        {formatDate(r.date, lang)}
                        <span className="ml-1.5 text-[11px] font-semibold" style={{ color: tone }}>
                          {label}
                        </span>
                        {r.day_fraction != null && r.day_fraction !== FULL_DAY ? (
                          <span style={{ color: 'var(--text-faint)' }}> ½</span>
                        ) : null}
                        {r.group_size != null && r.group_size > 1 ? (
                          <span style={{ color: 'var(--color-earth-700)' }}> ×{r.group_size}</span>
                        ) : null}
                      </span>
                      {r.detail ? (
                        <span
                          className="block text-xs truncate"
                          style={{ color: 'var(--text-faint)' }}
                        >
                          {r.detail}
                        </span>
                      ) : null}
                    </span>

                    <span className="text-right shrink-0">
                      <span className="block tnum text-sm font-semibold" style={{ color: tone }}>
                        {isWork || isReturn ? '+' : '−'}
                        {formatRupees(isWork || isReturn ? r.credit_paise : r.debit_paise)}
                      </span>
                      <span className="block text-[11px] tnum" style={{ color: 'var(--text-faint)' }}>
                        {formatRupees(r.running_balance_paise)}
                      </span>
                    </span>

                    <button
                      onClick={() => (isWork ? setRemoveWork(r.id) : setRemovePay(r.id))}
                      aria-label={t('common.delete')}
                      style={{ color: 'var(--text-faint)' }}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                )
              })}
            </Card>
          )}
        </div>

        {error ? (
          <div
            className="card p-3 text-sm"
            style={{ background: 'var(--color-expense-soft)', color: 'var(--color-expense)' }}
          >
            {error}
          </div>
        ) : null}

        <Button variant="soft" full onClick={() => void output('share')} disabled={!!busy}>
          <span className="inline-flex items-center gap-2 justify-center">
            <Share2 size={17} /> {busy === 'share' ? t('common.loading') : t('report.share')}
          </span>
        </Button>

        <Confirm
          open={!!removeWork}
          danger
          title={t('common.delete')}
          body="Remove this work day? Any payment that had settled it becomes an advance again."
          confirmLabel={t('common.delete')}
          onConfirm={async () => {
            const target = removeWork!
            setRemoveWork(null)
            await deleteAttendance(target)
          }}
          onCancel={() => setRemoveWork(null)}
        />

        <Confirm
          open={!!removePay}
          danger
          title={t('common.delete')}
          body="Remove this payment? The expense it created is removed too, and the work it settled goes back to unpaid."
          confirmLabel={t('common.delete')}
          onConfirm={async () => {
            const target = removePay!
            setRemovePay(null)
            await deletePayment(target)
          }}
          onCancel={() => setRemovePay(null)}
        />
      </Page>
    </Shell>
  )
}
