import { useMemo } from 'react'
import {
  Bar, BarChart, CartesianGrid, LabelList, Legend, ResponsiveContainer, Tooltip,
  XAxis, YAxis,
} from 'recharts'
import {
  Plus, CalendarPlus, CloudUpload, MapPin,
  IndianRupee, ChartColumn, TrendingUp, TrendingDown, HardHat,
} from 'lucide-react'
import { Page, Shell } from '@/components/Shell'
import { AccountAvatar } from '@/components/accountArt'
import { EmptyState, QuickLink, SectionHeader } from '@/components/ui'
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
  const totalBalance = (data?.balances ?? []).reduce((s, a) => s + a.balance_paise, 0)
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
            {/* Translated. This was two English literals on a Kannada screen,
                about the one thing a farmer cannot afford to misread. */}
            <span className="leading-tight">
              <span className="block text-sm font-semibold">
                {data.lastBackup ? t('backup.dueTitle') : t('backup.neverTitle')}
              </span>
              <span className="block text-xs opacity-85">{t('backup.dueHint')}</span>
            </span>
          </button>
        ) : null}

        {/* Two large actions, first thing.
            The second one used to be Reports. Reading a report is something a
            farmer does once a month sitting down; recording a day of labour is
            something they do standing in the field with one hand, most days of
            the week. The two biggest targets on the screen should be the two
            things done most often, so it is now money in-or-out and a work
            day. Reports moved to the row below, still one tap away. */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => navigate('/add')}
            className="flex flex-col items-start justify-between rounded-2xl px-4 py-4 text-white active:scale-[.98] transition"
            style={{
              background: 'linear-gradient(145deg, var(--color-brand-500), var(--color-brand-600))',
              boxShadow: '0 6px 16px -8px var(--color-brand-600)',
              minHeight: 116,
            }}
          >
            <span
              className="grid place-items-center rounded-xl"
              style={{ width: 38, height: 38, background: 'rgba(255,255,255,.22)' }}
            >
              <Plus size={22} strokeWidth={2.4} />
            </span>
            <span className="text-left leading-tight">
              <span className="block text-lg font-bold">{t('nav.add')}</span>
              <span className="block text-xs opacity-85">{t('dash.addHint')}</span>
            </span>
          </button>
          <button
            onClick={() => navigate('/labour/work')}
            className="card flex flex-col items-start justify-between rounded-2xl px-4 py-4 active:scale-[.98] transition"
            style={{
              minHeight: 116,
              background: 'var(--color-brand-50)',
              borderColor: 'var(--color-brand-200)',
            }}
          >
            <span
              className="grid place-items-center rounded-xl"
              style={{
                width: 38, height: 38,
                background: 'var(--color-brand-100)',
                color: 'var(--color-brand-700)',
              }}
            >
              <CalendarPlus size={22} strokeWidth={2.2} />
            </span>
            <span className="text-left leading-tight" style={{ color: 'var(--color-brand-800)' }}>
              <span className="block text-lg font-bold">{t('labour.workShort')}</span>
              <span className="block text-xs opacity-80">{t('dash.workHint')}</span>
            </span>
          </button>
        </div>

        {/*
          The month, as ONE card instead of four identical tiles.

          Four tiles gave income, expense, net and unpaid wages the same weight
          and the same grey box, so the eye had to read all four to find the
          one that mattered. What a farmer wants from this screen in two
          seconds is "am I up or down this month" — so net is the headline, the
          two halves that make it sit underneath, and the bar shows their
          proportion without anybody reading a number at all.
        */}
        <section>
          <SectionHeader>
            {t('dash.thisMonth')} · {formatMonth(todayISO(), lang)}
          </SectionHeader>
          <div className="card p-4">
            <div className="flex items-end justify-between gap-3">
              <div>
                <div
                  className="text-xs font-semibold uppercase tracking-wide"
                  style={{ color: 'var(--text-faint)' }}
                >
                  {t('dash.net')}
                </div>
                <div
                  className="tnum font-bold leading-none mt-1"
                  style={{
                    fontSize: 30,
                    color: net < 0 ? 'var(--color-expense)' : 'var(--color-income)',
                  }}
                >
                  {loading ? '—' : formatRupees(net)}
                </div>
              </div>
              <span
                className="grid place-items-center rounded-xl shrink-0"
                style={{
                  width: 42,
                  height: 42,
                  background: net < 0 ? 'var(--color-expense-soft)' : 'var(--color-income-soft)',
                  color: net < 0 ? 'var(--color-expense)' : 'var(--color-income)',
                }}
              >
                {net < 0 ? <TrendingDown size={22} /> : <TrendingUp size={22} />}
              </span>
            </div>

            {/* The proportion, read without reading. Drawn only when there is
                something to divide: a zero-width bar looks like a bug. */}
            {data && data.income + data.expense > 0 ? (
              <div
                className="flex mt-3.5 overflow-hidden"
                style={{ height: 8, borderRadius: 999, background: 'var(--surface-sunken)' }}
              >
                <span
                  style={{
                    width: (data.income / (data.income + data.expense)) * 100 + '%',
                    background: 'var(--color-income)',
                  }}
                />
                <span style={{ flex: 1, background: 'var(--color-expense)' }} />
              </div>
            ) : null}

            <div className="grid grid-cols-2 gap-3 mt-3.5">
              <MoneyLeg
                dot="var(--color-income)"
                label={t('dash.income')}
                value={loading ? '—' : formatRupees(data?.income ?? 0)}
              />
              <MoneyLeg
                dot="var(--color-expense)"
                label={t('dash.expense')}
                value={loading ? '—' : formatRupees(data?.expense ?? 0)}
              />
            </div>
          </div>
        </section>

        {/* Unpaid wages, and only when there are any.
            On a cash basis the books show what has been PAID, so what is still
            owed is invisible in every figure above — until somebody turns up
            at the gate asking for it. It gets its own colour and its own tap
            straight to the pay screen. */}
        {owed > 0 ? (
          <button
            onClick={() => navigate('/labour/pay')}
            className="card w-full flex items-center gap-3 px-4 py-3.5 text-left active:scale-[.99] transition"
            style={{ background: 'var(--color-earth-100)', borderColor: 'var(--color-earth-300)' }}
          >
            <span
              className="grid place-items-center rounded-xl shrink-0"
              style={{
                width: 36, height: 36,
                background: 'var(--color-earth-300)',
                color: 'var(--color-earth-700)',
              }}
            >
              <HardHat size={19} />
            </span>
            <span className="flex-1 leading-tight">
              <span
                className="block text-sm font-semibold"
                style={{ color: 'var(--color-earth-700)' }}
              >
                {t('labour.outstanding')}
              </span>
              <span
                className="block text-xs"
                style={{ color: 'var(--color-earth-700)', opacity: 0.8 }}
              >
                {daysThisMonth} {t('labour.days')}
              </span>
            </span>
            <span className="tnum font-bold text-lg" style={{ color: 'var(--color-earth-700)' }}>
              {formatRupees(owed)}
            </span>
          </button>
        ) : null}

        {/*
          What is actually in hand, and where.

          This was one grey wallet repeated down a list, so telling cash from
          the bank meant reading a Kannada word on every row. Each kind of
          account now wears its own tile — see `accountArt` — and the total
          sits at the top, because "how much have I got altogether" is the
          question that gets asked first and the list never answered it.
        */}
        <section>
          <SectionHeader>{t('dash.balances')}</SectionHeader>
          <div className="card rows overflow-hidden">
            {/* Only worth a row when there is more than one account to add
                up. On a farm that keeps cash and nothing else, a total that
                repeats the single line below it is noise. */}
            {(data?.balances ?? []).length > 1 ? (
              <div
                className="flex items-center justify-between px-4 py-3"
                style={{ background: 'var(--surface-sunken)' }}
              >
                <span className="text-sm font-semibold" style={{ color: 'var(--text-soft)' }}>
                  {t('dash.inHand')}
                </span>
                <span
                  className="tnum font-bold"
                  style={{
                    fontSize: 19,
                    color: totalBalance < 0 ? 'var(--color-expense)' : 'var(--text)',
                  }}
                >
                  {loading ? '—' : formatRupees(totalBalance)}
                </span>
              </div>
            ) : null}
            {(data?.balances ?? []).map((a) => (
              <div key={a.account_id} className="flex items-center gap-3 px-4 py-3">
                <AccountAvatar kind={a.kind} size={36} />
                <span className="flex-1 min-w-0 leading-tight">
                  <span className="block font-medium truncate">{nameOf(a)}</span>
                  <span className="block text-xs" style={{ color: 'var(--text-faint)' }}>
                    {t(`account.${a.kind}` as 'account.cash')}
                  </span>
                </span>
                <span
                  className="tnum font-semibold"
                  style={{ color: a.balance_paise < 0 ? 'var(--color-expense)' : 'var(--text)' }}
                >
                  {formatRupees(a.balance_paise)}
                </span>
              </div>
            ))}
          </div>
        </section>

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
              icon={(p) => <IndianRupee {...p} />}
              label={t('labour.pay')}
              onClick={() => navigate('/labour/pay')}
              tone="var(--color-expense)"
            />
            <QuickLink
              icon={(p) => <ChartColumn {...p} />}
              label={t('nav.reports')}
              onClick={() => navigate('/reports')}
              tone="var(--color-income)"
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

/** One half of the month card: a coloured dot, a label, a figure. */
function MoneyLeg({ dot, label, value }: { dot: string; label: string; value: string }) {
  return (
    <div>
      <div className="flex items-center gap-1.5">
        <span style={{ width: 8, height: 8, borderRadius: 999, background: dot }} />
        <span className="text-xs font-medium" style={{ color: 'var(--text-soft)' }}>
          {label}
        </span>
      </div>
      <div className="tnum font-semibold mt-0.5" style={{ fontSize: 17 }}>
        {value}
      </div>
    </div>
  )
}

/** "2026-08" -> "Aug" / "ಆಗಸ್ಟ್". Single-language always: a chart axis has no room. */
function shortMonth(ym: string, lang: Lang): string {
  const [y, m] = ym.split('-').map(Number)
  return formatMonth(`${y}-${String(m).padStart(2, '0')}-01`, lang).split(' ')[0]
}
