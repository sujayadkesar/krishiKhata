import { useMemo } from 'react'
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import {
  TrendingUp, TrendingDown, Users, Plus, CalendarPlus, Wallet, CloudUpload,
} from 'lucide-react'
import { Page, Shell } from '@/components/Shell'
import { Card, EmptyState, SectionHeader } from '@/components/ui'
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
        {Icon ? <Icon size={14} style={{ color: colour }} /> : null}
        <span className="text-[11px] font-semibold" style={{ color: 'var(--text-soft)' }}>
          {label}
        </span>
      </div>
      <div className="text-lg font-semibold tnum truncate" style={{ color: colour }}>
        {value}
      </div>
    </div>
  )
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

        <SectionHeader>
          {t('dash.thisMonth')} · {formatMonth(todayISO(), lang)}
        </SectionHeader>

        <div className="grid grid-cols-3 gap-2.5">
          <Stat
            label={t('dash.income')}
            value={loading ? '—' : formatRupees(data?.income ?? 0)}
            tone="income"
            icon={TrendingUp}
          />
          <Stat
            label={t('dash.expense')}
            value={loading ? '—' : formatRupees(data?.expense ?? 0)}
            tone="expense"
            icon={TrendingDown}
          />
          <Stat
            label={t('dash.net')}
            value={loading ? '—' : formatRupees(net)}
            tone={net < 0 ? 'expense' : 'neutral'}
          />
        </div>

        {/* Paid and owed sit side by side deliberately: on a cash basis the
            books show only what has been paid, and the farmer must be able to
            see what is still hanging over them without going looking. */}
        <div className="grid grid-cols-2 gap-2.5">
          <button
            onClick={() => navigate('/labour')}
            className="card p-3.5 text-left"
            aria-label={t('labour.owed')}
          >
            <span className="text-[11px] font-semibold block" style={{ color: 'var(--text-soft)' }}>
              {t('labour.outstanding')}
            </span>
            <span
              className="text-lg font-semibold tnum block"
              style={{ color: owed > 0 ? 'var(--color-expense)' : 'var(--text-faint)' }}
            >
              {loading ? '—' : formatRupees(owed)}
            </span>
          </button>
          <div className="card p-3.5">
            <span className="text-[11px] font-semibold block" style={{ color: 'var(--text-soft)' }}>
              {t('labour.daysWorked')}
            </span>
            <span className="text-lg font-semibold tnum block">
              {loading ? '—' : daysThisMonth}
            </span>
          </div>
        </div>

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

        <div>
          <SectionHeader>{t('dash.quickAdd')}</SectionHeader>
          <div className="grid grid-cols-3 gap-2.5">
            <button
              onClick={() => navigate('/add')}
              className="card p-4 flex flex-col items-center gap-1.5 text-sm font-semibold"
              style={{ color: 'var(--color-brand-600)' }}
            >
              <Plus size={20} />
              {t('nav.add')}
            </button>
            <button
              onClick={() => navigate('/labour/work')}
              className="card p-4 flex flex-col items-center gap-1.5 text-sm font-semibold"
              style={{ color: 'var(--color-brand-600)' }}
            >
              <CalendarPlus size={20} />
              {t('labour.addWork')}
            </button>
            <button
              onClick={() => navigate('/labour/pay')}
              className="card p-4 flex flex-col items-center gap-1.5 text-sm font-semibold"
              style={{ color: 'var(--color-expense)' }}
            >
              <Users size={20} />
              {t('labour.pay')}
            </button>
          </div>
        </div>
      </Page>
    </Shell>
  )
}

/** "2026-08" -> "Aug" / "ಆಗಸ್ಟ್". Single-language always: a chart axis has no room. */
function shortMonth(ym: string, lang: Lang): string {
  const [y, m] = ym.split('-').map(Number)
  return formatMonth(`${y}-${String(m).padStart(2, '0')}-01`, lang).split(' ')[0]
}
