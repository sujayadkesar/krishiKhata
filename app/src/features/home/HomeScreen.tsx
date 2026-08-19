import { useMemo } from 'react'
import {
  Bar, BarChart, CartesianGrid, LabelList, Legend, ResponsiveContainer, Tooltip,
  XAxis, YAxis,
} from 'recharts'
import {
  Plus, CalendarPlus, Wallet, CloudUpload, MapPin,
  IndianRupee, ChartColumn,
} from 'lucide-react'
import { Page, Shell } from '@/components/Shell'
import { Card, EmptyState, QuickLink, SectionHeader, StatTile } from '@/components/ui'
import { useQuery } from '@/hooks/useQuery'
import {
  accountBalances, expenseTotalsBySubHead, monthlyTotals, totalsByKind,
} from '@/data/entries'
import { cropProfitability } from '@/data/reports'
import { labourBalances, totalOutstandingWages } from '@/data/labour'
import { backupIsDue, lastBackupAt } from '@/data/backup'
import { useI18n } from '@/i18n'
import { formatCompactINR, formatRupees } from '@/lib/money'
import { addMonths, formatMonth, monthEnd, monthStart, todayISO } from '@/lib/date'
import { navigate } from '@/router'
import type { Lang } from '@/i18n/strings'

/**
 * The dashboard.
 *
 * THREE charts, and each answers one question a farmer actually asks: how is
 * the year going, where is the money going, and which crop is worth growing.
 *
 * There were five. A donut of crop income beside a bar of crop income beside
 * a line of monthly income is the same money drawn three ways, and a screen
 * that shows the same money three ways teaches people to scroll past all of
 * it. The tiles above are this month; the charts are the last twelve, because
 * one month of anything has no shape to see.
 */

async function load() {
  const today = todayISO()
  const from = monthStart(today)
  const to = monthEnd(today)
  const trendFrom = monthStart(addMonths(today, -11))

  const [
    kinds, crops, bySubHead, balances, trend, labour, outstanding, backupDue, lastBackup,
  ] = await Promise.all([
    totalsByKind(from, to),
    // Income against real cost per crop — the crop chart needs both halves,
    // and only cropProfitability knows the labour side, which arrives through
    // payment allocations rather than through the expense rows.
    cropProfitability({ from: trendFrom, to }),
    expenseTotalsBySubHead(from, to),
    accountBalances(),
    monthlyTotals(trendFrom, to),
    labourBalances(false),
    totalOutstandingWages(),
    backupIsDue(),
    lastBackupAt(),
  ])

  const of = (k: string) => kinds.find((x) => x.kind === k)?.total ?? 0
  return {
    income: of('income'),
    expense: of('expense'),
    crops,
    bySubHead,
    balances,
    trend,
    labour,
    outstanding,
    backupDue,
    lastBackup,
  }
}

const axisStyle = { fontSize: 11, fill: 'var(--text-faint)' }

/** Rupees on a chart axis are unreadable in full; lakhs and thousands are not. */
const compactAxis = (v: number) => formatCompactINR(v).replace('₹', '')

/** The figure at the end of a bar, where an axis would be noise. */
const compactLabel = (v: unknown): string => {
  const n = Number(v)
  return Number.isFinite(n) && n !== 0 ? formatCompactINR(n) : ''
}

/**
 * Recharts hands a tooltip formatter a loosely-typed value that may be an
 * array or undefined, so it is coerced here rather than at every call site.
 */
const moneyTip = (value: unknown): string => {
  const n = Array.isArray(value) ? Number(value[0]) : Number(value)
  return formatRupees(Number.isFinite(n) ? n : 0)
}

const TOOLTIP_STYLE = {
  background: 'var(--surface-raised)',
  border: '1px solid var(--border)',
  borderRadius: 10,
  fontSize: 12,
  color: 'var(--text)',
}

export function HomeScreen() {
  const { t, lang, nameOf } = useI18n()
  const { data, loading } = useQuery(load, [])

  const net = (data?.income ?? 0) - (data?.expense ?? 0)
  const owed = (data?.labour ?? []).reduce((s, r) => s + Math.max(0, r.balance_paise), 0)
  const daysThisMonth = (data?.labour ?? []).reduce((s, r) => s + r.days, 0)

  const spendData = useMemo(
    () =>
      (data?.bySubHead ?? [])
        .filter((s) => s.total > 0)
        .slice(0, 7)
        .map((s) => ({
          name: s.name_en ? nameOf({ name_en: s.name_en, name_kn: s.name_kn ?? s.name_en }) : '—',
          value: s.total,
        })),
    [data?.bySubHead, nameOf],
  )

  /**
   * Income against cost, per crop.
   *
   * Only crops that actually moved money appear, and only the six biggest:
   * a chart with a row for every head the farm has ever named is a chart
   * nobody reads to the bottom of.
   */
  const cropCompare = useMemo(
    () =>
      (data?.crops ?? [])
        .filter((c) => c.income_paise > 0 || c.total_cost_paise > 0)
        .slice(0, 6)
        .map((c) => ({
          name: nameOf(c),
          income: c.income_paise,
          cost: c.total_cost_paise,
        })),
    [data?.crops, nameOf],
  )

  const trendData = useMemo(
    () =>
      (data?.trend ?? []).map((m) => ({
        month: shortMonth(m.month, lang),
        income: m.income,
        expense: m.expense,
      })),
    [data?.trend, lang],
  )

  return (
    <Shell>
      <Page>
        {/* A reminder rather than a silent background backup, because there is
            no silent one to run: with no server there is no refresh token, so
            reaching Drive needs the farmer present. Saying so beats pretending. */}
        {data?.backupDue ? (
          <button
            onClick={() => navigate('/settings/backup')}
            className="card p-3 w-full text-left flex items-center gap-2.5"
            style={{
              background: 'var(--color-earth-100)',
              borderColor: 'var(--color-earth-300)',
              color: 'var(--color-earth-700)',
            }}
          >
            <CloudUpload size={19} className="shrink-0" />
            <span className="text-sm">
              {data.lastBackup
                ? 'A backup is due. Tap to save a copy of your records.'
                : 'Your records have never been backed up. Tap to save a copy.'}
            </span>
          </button>
        ) : null}

        {/* Two large actions, first thing: put something in, or look something
            up. Recording happens standing up with one hand, so it gets the
            filled button; everything else is reference. */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => navigate('/add')}
            className="flex flex-col items-center justify-center gap-2.5 rounded-2xl px-4 py-8 text-white active:scale-[.98] transition"
            style={{ background: 'var(--color-brand-500)' }}
          >
            <Plus size={36} strokeWidth={1.8} />
            <span className="text-lg font-bold">{t('nav.add')}</span>
          </button>
          <button
            onClick={() => navigate('/reports')}
            className="card flex flex-col items-center justify-center gap-2.5 rounded-2xl px-4 py-8 active:scale-[.98] transition"
            style={{ color: 'var(--text)' }}
          >
            <ChartColumn size={36} strokeWidth={1.8} />
            <span className="text-lg font-bold">{t('nav.reports')}</span>
          </button>
        </div>

        <section>
          <SectionHeader>
            {t('dash.thisMonth')} · {formatMonth(todayISO(), lang)}
          </SectionHeader>
          <div className="grid grid-cols-2 gap-2.5">
            <StatTile
              label={t('dash.income')}
              value={loading ? '—' : formatCompactINR(data?.income ?? 0)}
              sub={t('dash.sales')}
              tone="income"
            />
            <StatTile
              label={t('dash.expense')}
              value={loading ? '—' : formatCompactINR(data?.expense ?? 0)}
              sub={t('dash.spent')}
              tone="expense"
            />
            <StatTile
              label={t('dash.net')}
              value={loading ? '—' : formatCompactINR(net)}
              tone={net < 0 ? 'expense' : 'income'}
            />
            {/* Owed sits beside net deliberately: on a cash basis the books
                show only what has been paid, so unpaid wages would otherwise
                be invisible until somebody turns up asking. */}
            <StatTile
              label={t('labour.outstanding')}
              value={loading ? '—' : formatCompactINR(owed)}
              sub={`${daysThisMonth} ${t('labour.days')}`}
              tone={owed > 0 ? 'expense' : 'neutral'}
            />
          </div>
        </section>

        <div>
          <SectionHeader>{t('dash.balances')}</SectionHeader>
          <Card>
            {(data?.balances ?? []).map((a) => (
              <div key={a.account_id} className="flex items-center gap-3 px-4 py-3">
                <Wallet size={17} style={{ color: 'var(--text-faint)' }} />
                <span className="flex-1 font-medium truncate">{nameOf(a)}</span>
                <span
                  className="tnum font-semibold"
                  style={{ color: a.balance_paise < 0 ? 'var(--color-expense)' : 'var(--text)' }}
                >
                  {formatRupees(a.balance_paise)}
                </span>
              </div>
            ))}
          </Card>
        </div>

        {/*
          The quick row, directly under the balances where the thumb already is.
          It sat at the very bottom of the page, and three of its four tiles
          went where the bottom bar already goes — so it cost a scroll to offer
          nothing. Every destination here is one the bottom bar CANNOT reach:
          recording a work day, paying wages, the plot list, and the backup.
        */}
        <section>
          <SectionHeader>{t('dash.goTo')}</SectionHeader>
          <div className="grid grid-cols-4 gap-2.5">
            <QuickLink
              icon={(p) => <CalendarPlus {...p} />}
              label={t('labour.workShort')}
              onClick={() => navigate('/labour/work')}
              tone="var(--color-brand-600)"
            />
            <QuickLink
              icon={(p) => <IndianRupee {...p} />}
              label={t('labour.pay')}
              onClick={() => navigate('/labour/pay')}
              tone="var(--color-expense)"
            />
            <QuickLink
              icon={(p) => <MapPin {...p} />}
              label={t('plot.title')}
              onClick={() => navigate('/settings/plots')}
            />
            <QuickLink
              icon={(p) => <CloudUpload {...p} />}
              label={t('set.backup')}
              onClick={() => navigate('/settings/backup')}
            />
          </div>
        </section>

        {/*
          THREE CHARTS, AND EACH ANSWERS ONE QUESTION.
          
          There were five, and together they said less than these three do.
          A donut of crop income next to a bar of crop income next to a line
          of monthly income is the same money drawn three ways, and a screen
          that shows the same money three ways teaches the farmer to scroll
          past all of it.
          
          What is left: how the year is going, where the money goes, and which
          crop is actually worth growing.
        */}

        <section>
          <SectionHeader>{t('dash.trend')}</SectionHeader>
          {trendData.length < 2 ? (
            <EmptyState>{t('common.empty')}</EmptyState>
          ) : (
            <div className="card p-3 pt-4">
              {/* Paired bars rather than lines: a farmer reads "did more come
                  in than went out this month" by comparing two heights side by
                  side, which is one glance. Two crossing lines is a puzzle. */}
              <ResponsiveContainer width="100%" height={210}>
                <BarChart data={trendData} margin={{ left: 0, right: 8, top: 4 }} barGap={2}>
                  <CartesianGrid stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="month" tick={axisStyle} tickLine={false} axisLine={false} />
                  <YAxis
                    tickFormatter={compactAxis}
                    tick={axisStyle}
                    width={42}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    cursor={{ fill: 'var(--surface-sunken)' }}
                    formatter={moneyTip}
                  />
                  <Legend wrapperStyle={{ fontSize: 12, paddingTop: 4 }} iconType="circle" />
                  <Bar
                    dataKey="income"
                    name={t('dash.income')}
                    fill="var(--color-income)"
                    radius={[3, 3, 0, 0]}
                  />
                  <Bar
                    dataKey="expense"
                    name={t('dash.expense')}
                    fill="var(--color-brand-500)"
                    radius={[3, 3, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>

        <section>
          <SectionHeader>{t('dash.bySubHead')}</SectionHeader>
          {spendData.length === 0 ? (
            <EmptyState>{t('common.empty')}</EmptyState>
          ) : (
            <div className="card p-3">
              {/* Horizontal, because these labels are Kannada words of very
                  different lengths and a vertical axis of them is unreadable
                  at any phone width. Ranked, because the question is always
                  "what is the biggest one". */}
              <ResponsiveContainer width="100%" height={30 + spendData.length * 36}>
                <BarChart
                  data={spendData}
                  layout="vertical"
                  margin={{ left: 4, right: 46, top: 4 }}
                >
                  <XAxis type="number" hide />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={104}
                    tick={axisStyle}
                    interval={0}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    cursor={{ fill: 'var(--surface-sunken)' }}
                    formatter={moneyTip}
                  />
                  <Bar dataKey="value" fill="var(--color-brand-500)" radius={[0, 5, 5, 0]}>
                    <LabelList
                      dataKey="value"
                      position="right"
                      formatter={compactLabel}
                      style={{ fontSize: 11, fill: 'var(--text-soft)', fontWeight: 600 }}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>

        <section>
          <SectionHeader>{t('dash.cropCompare')}</SectionHeader>
          {cropCompare.length === 0 ? (
            <EmptyState>{t('common.empty')}</EmptyState>
          ) : (
            <div className="card p-3 pt-4">
              {/* Income and cost as two bars per crop, side by side. This is
                  the one chart that answers the question the whole app exists
                  for — whether a crop is worth growing — and it only answers
                  it if both halves are visible at once. */}
              <ResponsiveContainer width="100%" height={40 + cropCompare.length * 52}>
                <BarChart
                  data={cropCompare}
                  layout="vertical"
                  margin={{ left: 4, right: 12, top: 4 }}
                  barGap={2}
                >
                  <CartesianGrid horizontal={false} stroke="var(--border)" />
                  <XAxis type="number" tickFormatter={compactAxis} tick={axisStyle} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={90}
                    tick={axisStyle}
                    interval={0}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    cursor={{ fill: 'var(--surface-sunken)' }}
                    formatter={moneyTip}
                  />
                  <Legend wrapperStyle={{ fontSize: 12, paddingTop: 4 }} iconType="circle" />
                  <Bar
                    dataKey="income"
                    name={t('dash.income')}
                    fill="var(--color-income)"
                    radius={[0, 3, 3, 0]}
                  />
                  <Bar
                    dataKey="cost"
                    name={t('dash.expense')}
                    fill="var(--color-brand-500)"
                    radius={[0, 3, 3, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>

      </Page>
    </Shell>
  )
}

/** "2026-08" -> "Aug" / "ಆಗಸ್ಟ್". Single-language always: a chart axis has no room. */
function shortMonth(ym: string, lang: Lang): string {
  const [y, m] = ym.split('-').map(Number)
  return formatMonth(`${y}-${String(m).padStart(2, '0')}-01`, lang).split(' ')[0]
}
