import { useEffect, useMemo, useState } from 'react'
import {
  FileText, Sprout, Users, BookOpen, Printer, ChevronRight, User, LayoutDashboard, Share2,
} from 'lucide-react'
import { Page, Shell } from '@/components/Shell'
import { Button, Card, DateInput, EmptyState, Field, ListRow, Select, SectionHeader } from '@/components/ui'
import { useQuery } from '@/hooks/useQuery'
import { useI18n } from '@/i18n'
import { getFarmProfile } from '@/data/masterData'
import {
  cropProfitability, dayBook, effortByCrop, expenseBySubHead, expenseDetail,
  incomeByHead, labourDues,
} from '@/data/reports'
import { attendanceFor, labourBalances, paymentsFor, totalOutstandingWages } from '@/data/labour'
import {
  comprehensiveDoc, cropProfitDoc, dayBookDoc, incomeExpenseDoc, labourDuesDoc,
  labourStatementDoc,
} from './documents'
import type { DocContext } from './documents'
import { printReport, reportFileName, shareReport } from '@/lib/print'
import { accountBalances, monthlyTotals } from '@/data/entries'
import {
  financialYearLabel, financialYearOf, financialYearRange, monthEnd, monthStart, todayISO,
} from '@/lib/date'

/**
 * Reports.
 *
 * Every report is generated as one HTML string that is BOTH previewed on
 * screen and handed to the print engine, so what the farmer approves is exactly
 * what comes out. The preview renders in an iframe with the document's own
 * stylesheet, which keeps the app's CSS from leaking in and quietly changing
 * the layout between screen and paper.
 */

type ReportId =
  | 'comprehensive'
  | 'income-expense'
  | 'crop-profit'
  | 'labour-dues'
  | 'labour-statement'
  | 'day-book'

const REPORTS: { id: ReportId; icon: typeof FileText; kn: string; en: string; hint: string }[] = [
  {
    id: 'comprehensive',
    icon: LayoutDashboard,
    kn: 'ಸಂಪೂರ್ಣ ವರದಿ',
    en: 'Complete farm report',
    hint: 'Everything: profit, spending, trend, dues',
  },
  {
    id: 'crop-profit',
    icon: Sprout,
    kn: 'ಬೆಳೆವಾರು ಲಾಭ',
    en: 'Crop-wise profit',
    hint: 'What each crop earned, cost and made',
  },
  {
    id: 'income-expense',
    icon: FileText,
    kn: 'ಆದಾಯ ಮತ್ತು ಖರ್ಚು',
    en: 'Income & Expense',
    hint: 'Statement with full expense detail',
  },
  {
    id: 'labour-dues',
    icon: Users,
    kn: 'ಕೂಲಿ ಬಾಕಿ',
    en: 'Labour dues',
    hint: 'Who is owed, and effort by crop',
  },
  {
    id: 'labour-statement',
    icon: User,
    kn: 'ಕೂಲಿಯಾಳಿನ ಖಾತೆ',
    en: 'Labour statement',
    hint: 'One person: days, wages, payments',
  },
  {
    id: 'day-book',
    icon: BookOpen,
    kn: 'ದಿನಚರಿ',
    en: 'Day book',
    hint: 'Every entry, in order',
  },
]

export function ReportsScreen() {
  const { t, lang, nameOf } = useI18n()

  const fy = financialYearOf(todayISO())
  const [from, setFrom] = useState(() => monthStart(todayISO()))
  const [to, setTo] = useState(() => monthEnd(todayISO()))
  const [selected, setSelected] = useState<ReportId | null>(null)
  const [labourerId, setLabourerId] = useState<string | null>(null)
  const [html, setHtml] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const { data: profile } = useQuery(getFarmProfile, [])
  const { data: labourers } = useQuery(() => labourBalances(true), [])

  const period = useMemo(() => ({ from, to }), [from, to])

  const ctx: DocContext | null = useMemo(
    () =>
      profile
        ? {
            profile,
            period,
            lang,
            name: (row) =>
              row ? nameOf({ name_en: row.name_en ?? '', name_kn: row.name_kn ?? '' }) : '',
          }
        : null,
    [profile, period, lang, nameOf],
  )

  // Changing the period or the report must not leave a stale document on
  // screen — a farmer would print last month's figures under this month's
  // heading and never know.
  useEffect(() => {
    setHtml(null)
    setError(null)
  }, [from, to, selected, labourerId, lang])

  const title = (id: ReportId) => {
    const r = REPORTS.find((x) => x.id === id)!
    return lang === 'kn' ? r.kn : r.en
  }

  async function build(id: ReportId): Promise<string> {
    if (!ctx) throw new Error('Farm profile is not loaded yet.')

    switch (id) {
      case 'comprehensive': {
        const [crops, income, expense, detail, dues, effort, balances, monthly, outstanding] =
          await Promise.all([
            cropProfitability(period),
            incomeByHead(period),
            expenseBySubHead(period),
            expenseDetail(period),
            labourDues(),
            effortByCrop(period),
            accountBalances(),
            monthlyTotals(period.from, period.to),
            totalOutstandingWages(),
          ])
        return comprehensiveDoc(ctx, {
          crops, income, expense, detail, dues, effort,
          balances: balances.map((b) => ({
            name_en: b.name_en,
            name_kn: b.name_kn,
            balance_paise: b.balance_paise,
          })),
          monthly,
          outstanding,
        })
      }
      case 'income-expense': {
        const [income, expense, detail, outstanding] = await Promise.all([
          incomeByHead(period),
          expenseBySubHead(period),
          expenseDetail(period),
          totalOutstandingWages(),
        ])
        return incomeExpenseDoc(ctx, income, expense, detail, outstanding)
      }
      case 'crop-profit': {
        const [rows, outstanding] = await Promise.all([
          cropProfitability(period),
          totalOutstandingWages(),
        ])
        return cropProfitDoc(ctx, rows, outstanding)
      }
      case 'labour-dues': {
        const [dues, effort] = await Promise.all([labourDues(), effortByCrop(period)])
        return labourDuesDoc(ctx, dues, effort)
      }
      case 'labour-statement': {
        if (!labourerId) throw new Error('Choose a labourer first.')
        const person = labourers?.find((l) => l.labourer_id === labourerId)
        if (!person) throw new Error('That labourer no longer exists.')
        const [work, payments] = await Promise.all([
          attendanceFor(labourerId),
          paymentsFor(labourerId),
        ])
        return labourStatementDoc(ctx, person, work, payments, person.balance_paise)
      }
      case 'day-book': {
        const rows = await dayBook(period)
        return dayBookDoc(ctx, rows)
      }
    }
  }

  async function preview(id: ReportId) {
    setSelected(id)
    setBusy('build')
    setError(null)
    setNotice(null)
    try {
      setHtml(await build(id))
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(null)
    }
  }

  async function output(mode: 'print' | 'share') {
    if (!selected || !html) return
    setBusy(mode)
    setError(null)
    try {
      const name = reportFileName(selected, from, to)
      const run = mode === 'print' ? printReport : shareReport
      const result = await run(html, title(selected), name)
      if (result.how === 'shared') setNotice('Saved. Choose where to send it.')
      if (result.how === 'file') setNotice(`Saved as ${name}.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(null)
    }
  }

  const setFY = () => {
    const r = financialYearRange(fy)
    setFrom(r.from)
    setTo(r.to)
  }
  const setThisMonth = () => {
    setFrom(monthStart(todayISO()))
    setTo(monthEnd(todayISO()))
  }

  return (
    <Shell title={t('report.title')}>
      <Page>
        <div>
          <SectionHeader>{t('report.period')}</SectionHeader>
          <div className="card p-3 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label={t('entry.from')}>
                <DateInput value={from} onChange={setFrom} />
              </Field>
              <Field label={t('entry.to')}>
                <DateInput value={to} onChange={setTo} />
              </Field>
            </div>
            <div className="flex gap-2">
              <Button variant="soft" onClick={setThisMonth}>
                {t('dash.thisMonth')}
              </Button>
              <Button variant="soft" onClick={setFY}>
                {financialYearLabel(fy)}
              </Button>
            </div>
          </div>
        </div>

        <div>
          <SectionHeader>{t('report.title')}</SectionHeader>
          <Card>
            {REPORTS.map((r) => (
              <ListRow
                key={r.id}
                title={lang === 'kn' ? r.kn : r.en}
                subtitle={r.hint}
                leading={<r.icon size={19} style={{ color: 'var(--color-brand-600)' }} />}
                right={<ChevronRight size={16} style={{ color: 'var(--text-faint)' }} />}
                onClick={() => void preview(r.id)}
              />
            ))}
          </Card>
        </div>

        {selected === 'labour-statement' ? (
          <Field label={t('labour.labourer')}>
            <Select
              value={labourerId}
              onChange={(v) => {
                setLabourerId(v)
                void preview('labour-statement')
              }}
              placeholder={t('common.select')}
              options={(labourers ?? []).map((l) => ({
                value: l.labourer_id,
                label: nameOf(l),
              }))}
            />
          </Field>
        ) : null}

        {error ? (
          <div
            className="card p-3 text-sm"
            style={{ background: 'var(--color-expense-soft)', color: 'var(--color-expense)' }}
          >
            {error}
          </div>
        ) : null}

        {notice ? (
          <div
            className="card p-3 text-sm"
            style={{ background: 'var(--color-income-soft)', color: 'var(--color-income)' }}
          >
            {notice}
          </div>
        ) : null}

        {busy === 'build' ? <EmptyState>{t('common.loading')}</EmptyState> : null}

        {html ? (
          <div className="space-y-3">
            <SectionHeader>{selected ? title(selected) : ''}</SectionHeader>

            {/* An iframe, so the document's own stylesheet is the only thing
                acting on it — exactly as when it reaches the print engine. */}
            <iframe
              title="preview"
              srcDoc={html}
              className="w-full card"
              style={{ height: '68vh', background: '#fff' }}
            />

            <div className="grid grid-cols-2 gap-2.5">
              <Button full onClick={() => void output('print')} disabled={!!busy}>
                <span className="inline-flex items-center gap-2 justify-center">
                  <Printer size={17} />
                  {busy === 'print' ? t('common.loading') : t('report.download')}
                </span>
              </Button>
              <Button variant="soft" full onClick={() => void output('share')} disabled={!!busy}>
                <span className="inline-flex items-center gap-2 justify-center">
                  <Share2 size={17} />
                  {busy === 'share' ? t('common.loading') : t('report.share')}
                </span>
              </Button>
            </div>
          </div>
        ) : null}
      </Page>
    </Shell>
  )
}
