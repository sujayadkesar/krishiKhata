import { useEffect, useMemo, useState } from 'react'
import {
  FileText, Sprout, Users, BookOpen, ChevronRight, User, LayoutDashboard, Share2, MapPin,
} from 'lucide-react'
import { Page, Shell } from '@/components/Shell'
import { Button, Card, DateInput, EmptyState, Field, ListRow, Select, SectionHeader } from '@/components/ui'
import { useQuery } from '@/hooks/useQuery'
import { useI18n } from '@/i18n'
import { getFarmProfile } from '@/data/masterData'
import {
  cropProfitability, dayBook, effortByCrop, expenseBySubHead, expenseDetail,
  incomeByHead, labourDues, plotProfitability,
} from '@/data/reports'
import {
  attendanceFor, labourBalances, monthlyFor, paymentsFor, totalOutstandingWages, workByCropFor,
} from '@/data/labour'
import {
  comprehensiveDoc, cropProfitDoc, dayBookDoc, incomeExpenseDoc, labourDuesDoc,
  labourStatementDoc, plotProfitDoc,
} from './documents'
import type { DocContext } from './documents'
import { reportFileName, shareReport } from '@/lib/print'
import { accountBalances, monthlyTotals } from '@/data/entries'
import {
  financialYearLabel, financialYearOf, financialYearRange, monthEnd, monthStart, todayISO,
} from '@/lib/date'

/**
 * Reports.
 *
 * Every report is generated as one HTML string that is BOTH previewed on
 * screen and handed to the print engine, so what the farmer approves is
 * exactly what comes out. The preview renders in an iframe with the document's
 * own stylesheet, which keeps the app's CSS from leaking in and quietly
 * changing the layout between screen and paper.
 *
 * The preview is a MODE, not a panel at the bottom of the list. It used to sit
 * under the report menu at 68vh, so the farmer saw a letterbox of a document
 * and had to scroll the page to reach the button. Now it takes the screen with
 * its own header carrying Back and Share, which is what a preview is for:
 * looking at the thing, then sending it.
 */

type ReportId =
  | 'comprehensive'
  | 'income-expense'
  | 'crop-profit'
  | 'plot-profit'
  | 'labour-dues'
  | 'labour-statement'
  | 'day-book'

const REPORTS: { id: ReportId; icon: typeof FileText; kn: string; en: string; hint: string }[] = [
  {
    id: 'comprehensive',
    icon: LayoutDashboard,
    kn: 'ಸಂಪೂರ್ಣ ವರದಿ',
    en: 'Complete farm report',
    hint: 'Everything: charts, profit, spending, plots, dues',
  },
  {
    id: 'crop-profit',
    icon: Sprout,
    kn: 'ಬೆಳೆವಾರು ಲಾಭ',
    en: 'Crop-wise profit',
    hint: 'What each crop earned, cost and made',
  },
  {
    id: 'plot-profit',
    icon: MapPin,
    kn: 'ಜಮೀನುವಾರು ಲಾಭ',
    en: 'Plot-wise profit',
    hint: 'What each piece of land earned and cost',
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
    kn: 'ಪಾವತಿ ಬಾಕಿ',
    en: 'Wages due',
    hint: 'Who is owed, and effort by crop',
  },
  {
    id: 'labour-statement',
    icon: User,
    kn: 'ಕೆಲಸ ಮತ್ತು ಪಾವತಿ ವಿವರ',
    en: 'One worker: full statement',
    hint: 'Days, work, payments and charts, ready to hand over',
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
    setNotice(null)
  }, [from, to, selected, labourerId, lang])

  /**
   * Give the phone's back button something to pop.
   *
   * The preview is a mode rather than a route, so without this the hardware
   * back button leaves Reports altogether and the farmer has to find the
   * report again. Pushing one entry on the way in — and going BACK rather than
   * clearing state on the way out — keeps the history balanced, so a second
   * press does not land on a screen that looks like nothing happened.
   */
  useEffect(() => {
    if (!html) return
    window.history.pushState({ kkPreview: true }, '')
    const onPop = () => setHtml(null)
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [html])

  const title = (id: ReportId) => {
    const r = REPORTS.find((x) => x.id === id)!
    // 'both' is English chrome with Kannada names; a report title is chrome.
    return lang === 'kn' ? r.kn : r.en
  }

  async function build(id: ReportId): Promise<string> {
    if (!ctx) throw new Error('Farm profile is not loaded yet.')

    switch (id) {
      case 'comprehensive': {
        const [crops, plots, income, expense, detail, dues, effort, balances, monthly, outstanding] =
          await Promise.all([
            cropProfitability(period),
            plotProfitability(period),
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
          crops, plots, income, expense, detail, dues, effort,
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
      case 'plot-profit': {
        const [rows, outstanding] = await Promise.all([
          plotProfitability(period),
          totalOutstandingWages(),
        ])
        return plotProfitDoc(ctx, rows, outstanding)
      }
      case 'labour-dues': {
        const [dues, effort] = await Promise.all([labourDues(), effortByCrop(period)])
        return labourDuesDoc(ctx, dues, effort)
      }
      case 'labour-statement': {
        if (!labourerId) throw new Error('Choose someone first.')
        const person = labourers?.find((l) => l.labourer_id === labourerId)
        if (!person) throw new Error('That person is no longer on the list.')
        const [work, payments, byCrop, monthly] = await Promise.all([
          attendanceFor(labourerId),
          paymentsFor(labourerId),
          workByCropFor(labourerId),
          monthlyFor(labourerId),
        ])
        return labourStatementDoc(ctx, person, work, payments, person.balance_paise, {
          byCrop,
          monthly,
        })
      }
      case 'day-book': {
        const rows = await dayBook(period)
        return dayBookDoc(ctx, rows)
      }
    }
  }

  async function preview(id: ReportId) {
    setSelected(id)
    // The one report that needs a subject chosen before it means anything.
    if (id === 'labour-statement' && !labourerId) return

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

  async function share() {
    if (!selected || !html) return
    setBusy('share')
    setError(null)
    try {
      const name = reportFileName(selected, from, to)
      const result = await shareReport(html, title(selected), name)
      setNotice(
        result.format === 'pdf'
          ? 'PDF ready. Choose where to send it.'
          : 'Saved as a web page — this phone would not print a PDF. Open it and use Print → Save as PDF.',
      )
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

  /* ---------------------------------------------------------------- *
   * Preview mode — the document, full screen, with its own header
   * ---------------------------------------------------------------- */

  if (html && selected) {
    return (
      <div className="min-h-dvh flex flex-col" style={{ background: 'var(--surface-sunken)' }}>
        <header
          className="sticky top-0 z-20 flex items-center gap-2.5 px-4 py-2.5 border-b"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
        >
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-semibold truncate">{title(selected)}</h1>
            <p className="text-xs truncate" style={{ color: 'var(--text-faint)' }}>
              {from} — {to}
            </p>
          </div>
          <Button variant="ghost" onClick={() => window.history.back()}>
            {t('common.back')}
          </Button>
          <Button onClick={() => void share()} disabled={!!busy}>
            <span className="inline-flex items-center gap-1.5 justify-center">
              <Share2 size={17} />
              {busy === 'share' ? t('common.loading') : 'Share'}
            </span>
          </Button>
        </header>

        {notice ? (
          <div
            className="px-4 py-2 text-sm"
            style={{ background: 'var(--color-income-soft)', color: 'var(--color-income)' }}
          >
            {notice}
          </div>
        ) : null}
        {error ? (
          <div
            className="px-4 py-2 text-sm"
            style={{ background: 'var(--color-expense-soft)', color: 'var(--color-expense)' }}
          >
            {error}
          </div>
        ) : null}

        {/*
          An iframe, so the document's own stylesheet is the only thing acting
          on it — exactly as when it reaches the print engine. It fills the
          screen rather than sitting in a 68vh letterbox, and scrolls inside
          itself, so the header stays put while a long report is read.
        */}
        <iframe
          title="preview"
          srcDoc={html}
          className="flex-1 w-full border-0"
          style={{ background: '#fff', minHeight: 0 }}
        />
      </div>
    )
  }

  /* ---------------------------------------------------------------- *
   * The menu
   * ---------------------------------------------------------------- */

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

        {/* The worker picker sits above the list once that report is chosen,
            so the thing it is missing is the next thing on screen rather than
            something below the menu it was tapped from. */}
        {selected === 'labour-statement' ? (
          <div className="card p-3">
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
                  label: l.code ? `${l.code} · ${nameOf(l)}` : nameOf(l),
                }))}
              />
            </Field>
          </div>
        ) : null}

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

        {error ? (
          <div
            className="card p-3 text-sm"
            style={{ background: 'var(--color-expense-soft)', color: 'var(--color-expense)' }}
          >
            {error}
          </div>
        ) : null}

        {busy === 'build' ? <EmptyState>{t('common.loading')}</EmptyState> : null}
      </Page>
    </Shell>
  )
}
