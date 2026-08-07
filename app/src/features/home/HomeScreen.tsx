import { useEffect, useMemo, useState } from 'react'
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import {
  Users, Plus, CalendarPlus, Wallet, CloudUpload, Download,
  IndianRupee, ReceiptText, ChartColumn,
} from 'lucide-react'
import { Page, Shell } from '@/components/Shell'
import { Card, EmptyState, QuickLink, SectionHeader, StatTile } from '@/components/ui'
import { useQuery } from '@/hooks/useQuery'
import {
  accountBalances, expenseTotalsBySubHead, monthlyTotals, totalsByHead, totalsByKind,
} from '@/data/entries'
import { labourBalances, totalOutstandingWages } from '@/data/labour'
import { backupIsDue, lastBackupAt } from '@/data/backup'
import { useI18n } from '@/i18n'
import { formatCompactINR, formatRupees } from '@/lib/money'
import { addMonths, formatMonth, monthEnd, monthStart, todayISO } from '@/lib/date'
import { navigate } from '@/router'
import { checkForUpdate, openDownload } from '@/lib/updates'
import type { UpdateInfo } from '@/lib/updates'
import type { Lang } from '@/i18n/strings'

/**
 * The dashboard.
 *
 * Charts here answer questions a farmer actually asks — which crop brought
 * money in, where it went out, who is owed — rather than showing every figure
 * the database holds. Everything is scoped to the current month except the
 * trend, because a month is the unit a farm's cash actually moves in.
 */

const SWATCH: Record<string, string> = {
  amber: '#f59e0b', rose: '#f43f5e', orange: '#f97316', yellow: '#eab308',
  lime: '#84cc16', emerald: '#10b981', sky: '#0ea5e9', violet: '#8b5cf6', slate: '#64748b',
}

const FALLBACK = ['#1b7a43', '#d98324', '#2563eb', '#c0392b', '#8b5cf6', '#0ea5e9']

async function load() {
  const today = todayISO()
  const from = monthStart(today)
  const to = monthEnd(today)
  const trendFrom = monthStart(addMonths(today, -11))

  const [kinds, byCrop, bySubHead, balances, trend, labour, outstanding, backupDue, lastBackup] =
    await Promise.all([
      totalsByKind(from, to),
      totalsByHead('income', from, to),
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
    byCrop,
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

  // Checked on launch, throttled to once every six hours inside the helper.
  // Failures are silent — an update check is not worth an error message in
  // front of somebody trying to record a sale.
  const [update, setUpdate] = useState<UpdateInfo | null>(null)
  useEffect(() => {
    void checkForUpdate().then(setUpdate)
  }, [])

  const net = (data?.income ?? 0) - (data?.expense ?? 0)
  const owed = (data?.labour ?? []).reduce((s, r) => s + Math.max(0, r.balance_paise), 0)
  const daysThisMonth = (data?.labour ?? []).reduce((s, r) => s + r.days, 0)

  const cropData = useMemo(
    () =>
      (data?.byCrop ?? [])
        .filter((c) => c.total > 0)
        .map((c, i) => ({
          name: c.name_en ? nameOf({ name_en: c.name_en, name_kn: c.name_kn ?? c.name_en }) : '—',
          value: c.total,
          fill: (c.color && SWATCH[c.color]) || FALLBACK[i % FALLBACK.length],
        })),
    [data?.byCrop, nameOf],
  )

  const spendData = useMemo(
    () =>
      (data?.bySubHead ?? [])
        .filter((s) => s.total > 0)
        .slice(0, 6)
        .map((s) => ({
          name: s.name_en ? nameOf({ name_en: s.name_en, name_kn: s.name_kn ?? s.name_en }) : '—',
          value: s.total,
        })),
    [data?.bySubHead, nameOf],
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
        {update ? (
          <button
            onClick={() => openDownload(update.url)}
            className="card p-3.5 w-full text-left flex items-center gap-3"
            style={{
              background: 'var(--color-brand-50)',
              borderColor: 'var(--color-brand-300)',
              color: 'var(--color-brand-700)',
            }}
          >
            <Download size={20} className="shrink-0" />
            <span className="flex-1 min-w-0">
              <span className="block text-sm font-semibold">
                {t('update.available')} {update.version}
              </span>
              <span className="block text-xs" style={{ color: 'var(--color-brand-600)' }}>
                {t('update.tapToGet')}
              </span>
            </span>
          </button>
        ) : null}

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

        {/* Two large actions, first thing. Recording is what the app is for,
            and it happens standing up with one hand; everything else is
            reference and can wait below. */}
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
            onClick={() => navigate('/labour/work')}
            className="card flex flex-col items-center justify-center gap-2.5 rounded-2xl px-4 py-8 active:scale-[.98] transition"
            style={{ color: 'var(--color-brand-700)' }}
          >
            <CalendarPlus size={36} strokeWidth={1.8} />
            <span className="text-lg font-bold">{t('labour.workShort')}</span>
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

        <div>
          <SectionHeader>{t('dash.byCrop')}</SectionHeader>
          {cropData.length === 0 ? (
            <EmptyState>{t('common.empty')}</EmptyState>
          ) : (
            <div className="card p-3">
              <ResponsiveContainer width="100%" height={210}>
                <PieChart>
                  <Pie
                    data={cropData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={48}
                    outerRadius={78}
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
          )}
        </div>

        <div>
          <SectionHeader>{t('dash.bySubHead')}</SectionHeader>
          {spendData.length === 0 ? (
            <EmptyState>{t('common.empty')}</EmptyState>
          ) : (
            <div className="card p-3">
              <ResponsiveContainer width="100%" height={40 + spendData.length * 34}>
                <BarChart data={spendData} layout="vertical" margin={{ left: 4, right: 12 }}>
                  <CartesianGrid horizontal={false} stroke="var(--border)" />
                  <XAxis type="number" tickFormatter={compactAxis} tick={axisStyle} />
                  <YAxis type="category" dataKey="name" width={92} tick={axisStyle} interval={0} />
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    cursor={{ fill: 'var(--surface-sunken)' }}
                    formatter={moneyTip}
                  />
                  <Bar dataKey="value" fill="var(--color-expense)" radius={[0, 5, 5, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div>
          <SectionHeader>{t('dash.trend')}</SectionHeader>
          {trendData.length < 2 ? (
            <EmptyState>{t('common.empty')}</EmptyState>
          ) : (
            <div className="card p-3">
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={trendData} margin={{ left: 4, right: 12, top: 8 }}>
                  <CartesianGrid stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="month" tick={axisStyle} />
                  <YAxis tickFormatter={compactAxis} tick={axisStyle} width={44} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} formatter={moneyTip} />
                  <Line
                    type="monotone"
                    dataKey="income"
                    name={t('dash.income')}
                    stroke="var(--color-income)"
                    strokeWidth={2.5}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="expense"
                    name={t('dash.expense')}
                    stroke="var(--color-expense)"
                    strokeWidth={2.5}
                    dot={false}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

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
              icon={(p) => <Users {...p} />}
              label={t('nav.labour')}
              onClick={() => navigate('/labour')}
            />
            <QuickLink
              icon={(p) => <ReceiptText {...p} />}
              label={t('nav.entries')}
              onClick={() => navigate('/entries')}
            />
            <QuickLink
              icon={(p) => <ChartColumn {...p} />}
              label={t('nav.reports')}
              onClick={() => navigate('/reports')}
            />
          </div>
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
