import { escapeHtml } from '@/lib/printDoc'
import { formatCompactINR, formatINR, formatPaise } from '@/lib/money'
import { formatQuantity } from '@/lib/quantity'
import { formatDate } from '@/lib/date'
import { logoSvg } from '@/components/logoArt'
import { donut, groupedBars, rankedBars } from './charts'
import type { Lang } from '@/i18n/strings'
import type { FarmProfile } from '@/data/masterData'
import type {
  CropRow, DayBookRow, DetailLine, DuesRow, EffortRow, Period, PlotRow, StatementLine,
} from '@/data/reports'
import type { AttendanceRow, PaymentRow } from '@/data/labour'

/**
 * Report documents, built as HTML strings.
 *
 * The same string is shown in the on-screen preview and handed to the print
 * engine, so what the farmer approves is exactly what comes out. Building the
 * preview from React and the PDF from something else is how a report ends up
 * looking right on screen and wrong on paper.
 *
 * The shape is a statement, not a dashboard: the farm's own letterhead, a
 * centred title, figures in ruled tables, and a signature block at the end.
 * These get handed to a bank, a landlord, or the worker named on them, and a
 * document that looks like a screenshot does not survive that.
 *
 * Charts are real SVG (see charts.ts) — never rasterised, because a rasteriser
 * takes Kannada apart.
 */

const LOGO = logoSvg({ size: 46, className: 'lh-logo' })

const rupees = (p: number) => escapeHtml(formatINR(p, { decimals: false }))
const plain = (p: number) => escapeHtml(formatPaise(p, { decimals: false }))
const compact = (p: number) => formatCompactINR(p).replace('₹', '')

const INK = {
  income: '#04796b',
  expense: '#c62828',
  brand: '#12502c',
  neutral: '#8b7f71',
}

/** A categorical ramp for crops and plots, matching the app's charts. */
const RAMP = ['#04796b', '#e35b0d', '#2563eb', '#c026d3', '#65a30d', '#0891b2', '#b45309', '#7c3aed']

export interface DocContext {
  profile: FarmProfile
  period: Period
  lang: Lang
  /** Picks the right name column; passed in so documents stay pure. */
  name: (row: { name_en: string | null; name_kn: string | null } | null | undefined) => string
}

/**
 * A label in the document's language.
 *
 * In 'both' mode every heading carries both, because a statement is exactly
 * the thing a farmer hands to someone who reads the other language.
 */
const L = (lang: Lang, kn: string, en: string) =>
  lang === 'en' ? en : lang === 'both' ? `${kn} · ${en}` : kn

/* ------------------------------------------------------------------ *
 * The furniture every document shares
 * ------------------------------------------------------------------ */

/**
 * The letterhead.
 *
 * The farm's own name leads. Krishi Khata made the document, but it is the
 * farmer's statement, not the app's advertisement — so the app's name sits
 * small on the right, where a printer's imprint would go.
 */
function letterhead(ctx: DocContext, title: string, subject?: string): string {
  const { profile, period, lang } = ctx

  const farm = profile.farm_name || L(lang, 'ತೋಟದ ಹೆಸರು', 'Farm name')
  const contact = [profile.village, profile.phone].filter(Boolean).map(escapeHtml).join(' · ')

  return `
  <div class="lh">
    ${LOGO}
    <div class="lh-main">
      <div class="lh-farm">${escapeHtml(farm)}</div>
      ${profile.owner_name ? `<div class="lh-owner">${escapeHtml(profile.owner_name)}</div>` : ''}
      ${contact ? `<div class="lh-sub">${contact}</div>` : ''}
    </div>
    <div class="lh-right">ಕೃಷಿ ಖಾತೆ<br>Krishi Khata</div>
  </div>
  <hr class="rule">
  <hr class="rule-thin">
  <div class="title-block">
    <h1 class="title">${escapeHtml(title)}</h1>
    ${subject ? `<div class="subject">${subject}</div>` : ''}
    <div class="period">${escapeHtml(formatDate(period.from, lang))} — ${escapeHtml(
      formatDate(period.to, lang),
    )}</div>
  </div>`
}

type CardTone = 'income' | 'expense' | 'neutral' | 'brand' | ''

/**
 * The grid of summary figures that opens every document.
 *
 * Padded to a multiple of four so the last row never sits half-empty with the
 * tiles stretched across it — a fixed four-across grid is what keeps two
 * farmers comparing the same report looking at the same document.
 */
function cards(items: [label: string, value: string, tone?: CardTone, sub?: string][]): string {
  const padded = [...items]
  while (padded.length % 4 !== 0) padded.push(['', '', ''])

  return `<div class="totals">${padded
    .map(([label, value, tone, sub]) =>
      label === ''
        ? '<div style="border:0;background:none"></div>'
        : `
      <div class="${tone ? `is-${tone}` : ''}">
        <div class="k">${escapeHtml(label)}</div>
        <div class="v">${value}</div>
        ${sub ? `<div class="sub">${escapeHtml(sub)}</div>` : ''}
      </div>`,
    )
    .join('')}</div>`
}

/**
 * A proportion bar for a table cell.
 *
 * Drawn with a div rather than an image or a chart library: the document has
 * to survive whatever print engine the phone has, and a coloured box always
 * survives.
 */
function bar(value: number, max: number, tone: 'income' | 'expense' | 'brand' = 'income'): string {
  const pct = max > 0 ? Math.round((Math.abs(value) / max) * 100) : 0
  return `<div class="bar is-${tone}"><span style="width:${pct}%"></span></div>`
}

function section(lang: Lang, kn: string, en: string): string {
  return `<h2 class="section">${escapeHtml(L(lang, kn, en))}</h2>`
}

function chart(svg: string): string {
  return svg ? `<div class="chart-block">${svg}</div>` : ''
}

/**
 * The close of the document.
 *
 * A signature line, because these are handed over: to a bank asking for proof
 * of income, to a landlord, or to the worker whose wages are on it. The line
 * about how it was made sits opposite, so nobody has to wonder whether an
 * unsigned copy is valid.
 */
function signOff(ctx: DocContext, signatory: string): string {
  const { lang, profile } = ctx
  const made = L(
    lang,
    'ಇದು ಕಂಪ್ಯೂಟರ್‌ನಿಂದ ತಯಾರಾದ ವರದಿ.',
    'Computer generated from the farm’s own records.',
  )
  const generated = L(lang, 'ತಯಾರಿಸಿದ ದಿನಾಂಕ', 'Generated')
  const today = formatDate(new Date().toISOString().slice(0, 10), lang)

  return `
  <div class="sign">
    <div class="made">${escapeHtml(made)}</div>
    <div class="line">${escapeHtml(signatory)}${
      profile.owner_name ? `<br>${escapeHtml(profile.owner_name)}` : ''
    }</div>
  </div>
  <div class="foot">
    <span>${escapeHtml(generated)}: ${escapeHtml(today)}</span>
    <span>ಕೃಷಿ ಖಾತೆ · Krishi Khata</span>
  </div>`
}

/**
 * The line that has to appear on every money report.
 *
 * These books are kept on a cash basis, so wages earned but unpaid are not in
 * any total above it. Leaving that implicit is how a farmer concludes a month
 * was cheap and then meets the bill for it.
 */
function outstandingNote(outstanding: number, lang: Lang): string {
  if (outstanding <= 0) return ''
  const amount = formatINR(outstanding, { decimals: false })
  const kn = `ಈ ಲೆಕ್ಕವು ಕೊಟ್ಟ ಹಣವನ್ನು ಮಾತ್ರ ತೋರಿಸುತ್ತದೆ. ಇನ್ನೂ ಕೊಡಬೇಕಾದ ಕೂಲಿ: ${amount}`
  const en = `These figures count wages only when they were paid. Wages earned but still unpaid: ${amount}`
  const text = lang === 'en' ? en : lang === 'both' ? `${kn}\n${en}` : kn
  return `<div class="note">${escapeHtml(text).replace(/\n/g, '<br>')}</div>`
}

function table(
  headers: string[],
  rows: (string[] | { cells: string[]; group?: boolean })[],
  opts: { numeric?: number[]; foot?: string[] } = {},
): string {
  const numeric = new Set(opts.numeric ?? [])
  const th = headers
    .map((h, i) => `<th class="${numeric.has(i) ? 'num' : ''}">${escapeHtml(h)}</th>`)
    .join('')
  const body = rows
    .map((r) => {
      const cells = Array.isArray(r) ? r : r.cells
      const isGroup = !Array.isArray(r) && r.group
      return `<tr${isGroup ? ' class="group"' : ''}>${cells
        .map((c, i) => `<td class="${numeric.has(i) ? 'num' : ''}">${c}</td>`)
        .join('')}</tr>`
    })
    .join('')
  const tfoot = opts.foot
    ? `<tfoot><tr>${opts.foot
        .map((c, i) => `<td class="${numeric.has(i) ? 'num' : ''}">${c}</td>`)
        .join('')}</tr></tfoot>`
    : ''
  return `<table><thead><tr>${th}</tr></thead><tbody>${body}</tbody>${tfoot}</table>`
}

/** "2026-08" -> "ಆಗಸ್ಟ್ 2026" */
function monthLabel(ym: string, lang: Lang): string {
  const [y, m] = ym.split('-').map(Number)
  return formatDate(`${y}-${String(m).padStart(2, '0')}-01`, lang).slice(3)
}

/** Short month for a chart axis, where there is no room for the year. */
function shortMonth(ym: string, lang: Lang): string {
  return monthLabel(ym, lang).split(' ')[0]
}

/* ------------------------------------------------------------------ *
 * Income & Expense statement
 * ------------------------------------------------------------------ */

export function incomeExpenseDoc(
  ctx: DocContext,
  income: StatementLine[],
  expense: StatementLine[],
  detail: DetailLine[],
  outstanding: number,
): string {
  const { lang } = ctx
  const incomeTotal = income.reduce((s, r) => s + r.total, 0)
  const expenseTotal = expense.reduce((s, r) => s + r.total, 0)
  const net = incomeTotal - expenseTotal

  const totals = cards([
    [L(lang, 'ಆದಾಯ', 'Income'), `<span class="pos">${rupees(incomeTotal)}</span>`, 'income'],
    [L(lang, 'ಖರ್ಚು', 'Expense'), `<span class="neg">${rupees(expenseTotal)}</span>`, 'expense'],
    [
      L(lang, 'ಉಳಿತಾಯ', 'Net'),
      `<span class="${net < 0 ? 'neg' : 'pos'}">${rupees(net)}</span>`,
      net < 0 ? 'expense' : 'income',
    ],
    [L(lang, 'ದಾಖಲೆಗಳು', 'Line items'), String(income.length + expense.length), 'neutral'],
  ])

  const incomeChart = donut({
    slices: income
      .filter((r) => r.total > 0)
      .map((r, i) => ({
        label: ctx.name(r) || L(lang, 'ಇತರೆ', 'Unallocated'),
        value: r.total,
        color: RAMP[i % RAMP.length],
      })),
    centreValue: compact(incomeTotal),
    centreLabel: L(lang, 'ಒಟ್ಟು ಆದಾಯ', 'Total income'),
  })

  const spendChart = rankedBars({
    rows: expense
      .filter((r) => r.total > 0)
      .slice(0, 10)
      .map((r) => ({
        label: ctx.name(r) || L(lang, 'ಇತರೆ', 'Unallocated'),
        value: r.total,
        note: formatPaise(r.total, { decimals: false }),
      })),
    color: INK.expense,
  })

  const incomeTable = table(
    [L(lang, 'ಬೆಳೆ', 'Crop / Head'), L(lang, 'ಮೊತ್ತ', 'Amount')],
    income.map((r) => [escapeHtml(ctx.name(r) || '—'), plain(r.total)]),
    { numeric: [1], foot: [L(lang, 'ಒಟ್ಟು', 'Total'), plain(incomeTotal)] },
  )

  const expenseTable = table(
    [L(lang, 'ಖರ್ಚಿನ ವಿಧ', 'Sub-head'), L(lang, 'ಮೊತ್ತ', 'Amount')],
    expense.map((r) => [escapeHtml(ctx.name(r) || '—'), plain(r.total)]),
    { numeric: [1], foot: [L(lang, 'ಒಟ್ಟು', 'Total'), plain(expenseTotal)] },
  )

  const detailTable = table(
    [
      L(lang, 'ಬೆಳೆ', 'Crop'),
      L(lang, 'ಖರ್ಚಿನ ವಿಧ', 'Sub-head'),
      L(lang, 'ಕೆಲಸ', 'Work'),
      L(lang, 'ಮೊತ್ತ', 'Amount'),
    ],
    detail.map((d) => [
      escapeHtml(ctx.name({ name_en: d.head_en, name_kn: d.head_kn }) || '—'),
      escapeHtml(ctx.name({ name_en: d.sub_en, name_kn: d.sub_kn }) || '—'),
      escapeHtml(ctx.name({ name_en: d.activity_en, name_kn: d.activity_kn }) || '—'),
      plain(d.total),
    ]),
    { numeric: [3] },
  )

  return `
    ${letterhead(ctx, L(lang, 'ಆದಾಯ ಮತ್ತು ಖರ್ಚಿನ ವಿವರ', 'Income & Expense Statement'))}
    ${totals}
    ${outstandingNote(outstanding, lang)}
    ${section(lang, 'ಆದಾಯ', 'Income')}
    ${chart(incomeChart)}
    ${incomeTable}
    ${section(lang, 'ಖರ್ಚು', 'Expense')}
    ${chart(spendChart)}
    ${expenseTable}
    ${section(lang, 'ಖರ್ಚಿನ ವಿವರ', 'Expense detail')}
    ${detailTable}
    ${signOff(ctx, L(lang, 'ಸಹಿ', 'Signature'))}`
}

/* ------------------------------------------------------------------ *
 * Crop-wise profitability
 * ------------------------------------------------------------------ */

export function cropProfitDoc(ctx: DocContext, rows: CropRow[], outstanding: number): string {
  const { lang } = ctx
  const unit = (r: CropRow) => (lang === 'en' ? r.unit_short_en : r.unit_short_kn) ?? ''

  const totals = {
    income: rows.reduce((s, r) => s + r.income_paise, 0),
    direct: rows.reduce((s, r) => s + r.direct_cost_paise, 0),
    labour: rows.reduce((s, r) => s + r.labour_cost_paise, 0),
    profit: rows.reduce((s, r) => s + r.profit_paise, 0),
  }

  const comparison = groupedBars({
    categories: rows.slice(0, 8).map((r) => ctx.name(r)),
    series: [
      {
        label: L(lang, 'ಆದಾಯ', 'Income'),
        color: INK.income,
        values: rows.slice(0, 8).map((r) => r.income_paise),
      },
      {
        label: L(lang, 'ಖರ್ಚು', 'Cost'),
        color: INK.expense,
        values: rows.slice(0, 8).map((r) => r.total_cost_paise),
      },
    ],
    axisFormat: compact,
  })

  const body = table(
    [
      L(lang, 'ಬೆಳೆ', 'Crop'),
      L(lang, 'ಮಾರಾಟ', 'Sold'),
      L(lang, 'ಆದಾಯ', 'Income'),
      L(lang, 'ಸಾಮಗ್ರಿ', 'Materials'),
      L(lang, 'ಕೂಲಿ', 'Labour'),
      L(lang, 'ಒಟ್ಟು ಖರ್ಚು', 'Total cost'),
      L(lang, 'ಲಾಭ', 'Profit'),
    ],
    rows.map((r) => [
      escapeHtml(ctx.name(r)),
      r.quantity_milli > 0
        ? escapeHtml(`${formatQuantity(r.quantity_milli)} ${unit(r)}`)
        : '<span class="muted">—</span>',
      plain(r.income_paise),
      plain(r.direct_cost_paise),
      plain(r.labour_cost_paise),
      plain(r.total_cost_paise),
      `<span class="${r.profit_paise < 0 ? 'neg' : 'pos'}">${plain(r.profit_paise)}</span>`,
    ]),
    {
      numeric: [1, 2, 3, 4, 5, 6],
      foot: [
        L(lang, 'ಒಟ್ಟು', 'Total'),
        '',
        plain(totals.income),
        plain(totals.direct),
        plain(totals.labour),
        plain(totals.direct + totals.labour),
        plain(totals.profit),
      ],
    },
  )

  // Cost per unit is the number a farmer can act on: it says whether the price
  // offered next season is worth taking.
  const perUnitRows = rows.filter((r) => r.cost_per_unit_paise != null)
  const perUnit = perUnitRows.length
    ? section(lang, 'ಪ್ರತಿ ಅಳತೆಗೆ', 'Per unit') +
      table(
        [
          L(lang, 'ಬೆಳೆ', 'Crop'),
          L(lang, 'ಖರ್ಚು', 'Cost per unit'),
          L(lang, 'ಸಿಕ್ಕ ದರ', 'Rate received'),
          L(lang, 'ವ್ಯತ್ಯಾಸ', 'Margin'),
        ],
        perUnitRows.map((r) => {
          const margin = (r.realised_rate_paise ?? 0) - (r.cost_per_unit_paise ?? 0)
          return [
            escapeHtml(`${ctx.name(r)} (${unit(r)})`),
            plain(r.cost_per_unit_paise ?? 0),
            plain(r.realised_rate_paise ?? 0),
            `<span class="${margin < 0 ? 'neg' : 'pos'}">${plain(margin)}</span>`,
          ]
        }),
        { numeric: [1, 2, 3] },
      )
    : ''

  return `
    ${letterhead(ctx, L(lang, 'ಬೆಳೆವಾರು ಲಾಭ-ನಷ್ಟ', 'Crop-wise Profitability'))}
    ${cards([
      [L(lang, 'ಆದಾಯ', 'Income'), `<span class="pos">${rupees(totals.income)}</span>`, 'income'],
      [
        L(lang, 'ಒಟ್ಟು ಖರ್ಚು', 'Total cost'),
        `<span class="neg">${rupees(totals.direct + totals.labour)}</span>`,
        'expense',
      ],
      [
        L(lang, 'ಲಾಭ', 'Profit'),
        `<span class="${totals.profit < 0 ? 'neg' : 'pos'}">${rupees(totals.profit)}</span>`,
        totals.profit < 0 ? 'expense' : 'income',
      ],
      [L(lang, 'ಬೆಳೆಗಳು', 'Crops'), String(rows.length), 'neutral'],
    ])}
    ${outstandingNote(outstanding, lang)}
    ${section(lang, 'ಆದಾಯ ಮತ್ತು ಖರ್ಚು', 'Income against cost')}
    ${chart(comparison)}
    ${body}
    ${perUnit}
    ${signOff(ctx, L(lang, 'ಸಹಿ', 'Signature'))}`
}

/* ------------------------------------------------------------------ *
 * Plot-wise
 * ------------------------------------------------------------------ */

function plotTable(ctx: DocContext, rows: PlotRow[]): string {
  const { lang } = ctx
  if (!rows.length) return ''

  const areaOf = (r: PlotRow) =>
    r.area_milli != null
      ? escapeHtml(`${formatQuantity(r.area_milli)} ${r.area_unit ?? 'acre'}`)
      : '<span class="muted">—</span>'

  return table(
    [
      L(lang, 'ಜಮೀನು', 'Plot'),
      L(lang, 'ವಿಸ್ತೀರ್ಣ', 'Area'),
      L(lang, 'ಆಳು-ದಿನ', 'Person-days'),
      L(lang, 'ಆದಾಯ', 'Income'),
      L(lang, 'ಒಟ್ಟು ಖರ್ಚು', 'Total cost'),
      L(lang, 'ಲಾಭ', 'Profit'),
    ],
    rows.map((r) => [
      escapeHtml(ctx.name(r)) +
        (r.survey_no ? ` <span class="muted">${escapeHtml(r.survey_no)}</span>` : ''),
      areaOf(r),
      String(Math.round(r.person_days * 10) / 10),
      plain(r.income_paise),
      plain(r.total_cost_paise),
      `<span class="${r.profit_paise < 0 ? 'neg' : 'pos'}">${plain(r.profit_paise)}</span>`,
    ]),
    {
      numeric: [1, 2, 3, 4, 5],
      foot: [
        L(lang, 'ಒಟ್ಟು', 'Total'),
        '',
        String(Math.round(rows.reduce((s, r) => s + r.person_days, 0) * 10) / 10),
        plain(rows.reduce((s, r) => s + r.income_paise, 0)),
        plain(rows.reduce((s, r) => s + r.total_cost_paise, 0)),
        plain(rows.reduce((s, r) => s + r.profit_paise, 0)),
      ],
    },
  )
}

export function plotProfitDoc(ctx: DocContext, rows: PlotRow[], outstanding: number): string {
  const { lang } = ctx

  const comparison = groupedBars({
    categories: rows.map((r) => ctx.name(r)),
    series: [
      {
        label: L(lang, 'ಆದಾಯ', 'Income'),
        color: INK.income,
        values: rows.map((r) => r.income_paise),
      },
      {
        label: L(lang, 'ಖರ್ಚು', 'Cost'),
        color: INK.expense,
        values: rows.map((r) => r.total_cost_paise),
      },
    ],
    axisFormat: compact,
  })

  const income = rows.reduce((s, r) => s + r.income_paise, 0)
  const cost = rows.reduce((s, r) => s + r.total_cost_paise, 0)

  return `
    ${letterhead(ctx, L(lang, 'ಜಮೀನುವಾರು ಲಾಭ-ನಷ್ಟ', 'Plot-wise Profitability'))}
    ${cards([
      [L(lang, 'ಜಮೀನುಗಳು', 'Plots'), String(rows.filter((r) => r.plot_id).length), 'brand'],
      [L(lang, 'ಆದಾಯ', 'Income'), `<span class="pos">${rupees(income)}</span>`, 'income'],
      [L(lang, 'ಖರ್ಚು', 'Cost'), `<span class="neg">${rupees(cost)}</span>`, 'expense'],
      [
        L(lang, 'ಲಾಭ', 'Profit'),
        `<span class="${income - cost < 0 ? 'neg' : 'pos'}">${rupees(income - cost)}</span>`,
        income - cost < 0 ? 'expense' : 'income',
      ],
    ])}
    ${outstandingNote(outstanding, lang)}
    ${chart(comparison)}
    ${plotTable(ctx, rows)}
    <div class="note">${escapeHtml(
      L(
        lang,
        'ಜಮೀನು ದಾಖಲಿಸದ ವ್ಯವಹಾರಗಳು “ದಾಖಲಾಗಿಲ್ಲ” ಸಾಲಿನಲ್ಲಿ ಬರುತ್ತವೆ.',
        'Entries recorded without a plot appear on the “Not recorded” line rather than being counted against any one piece of land.',
      ),
    )}</div>
    ${signOff(ctx, L(lang, 'ಸಹಿ', 'Signature'))}`
}

/* ------------------------------------------------------------------ *
 * Labour
 * ------------------------------------------------------------------ */

export function labourDuesDoc(ctx: DocContext, rows: DuesRow[], effort: EffortRow[]): string {
  const { lang } = ctx
  const owed = rows.reduce((s, r) => s + Math.max(0, r.balance_paise), 0)
  const advance = rows.reduce((s, r) => s + Math.max(0, -r.balance_paise), 0)

  const owedChart = rankedBars({
    rows: rows
      .filter((r) => r.balance_paise > 0)
      .map((r) => ({
        label: ctx.name(r),
        value: r.balance_paise,
        note: formatPaise(r.balance_paise, { decimals: false }),
      })),
    color: INK.expense,
  })

  const dues = table(
    [
      L(lang, 'ಹೆಸರು', 'Name'),
      L(lang, 'ದಿನ', 'Days'),
      L(lang, 'ಆಳು-ದಿನ', 'Person-days'),
      L(lang, 'ಗಳಿಸಿದ್ದು', 'Earned'),
      L(lang, 'ಕೊಟ್ಟಿದ್ದು', 'Paid'),
      L(lang, 'ಬಾಕಿ', 'Balance'),
    ],
    rows.map((r) => [
      escapeHtml(ctx.name(r)) +
        (r.phone ? ` <span class="muted">${escapeHtml(r.phone)}</span>` : ''),
      String(r.days),
      String(r.person_days),
      plain(r.earned_paise),
      plain(r.paid_paise),
      `<span class="${r.balance_paise < 0 ? 'muted' : 'neg'}">${plain(r.balance_paise)}</span>`,
    ]),
    {
      numeric: [1, 2, 3, 4, 5],
      foot: [
        L(lang, 'ಒಟ್ಟು', 'Total'),
        '',
        '',
        plain(rows.reduce((s, r) => s + r.earned_paise, 0)),
        plain(rows.reduce((s, r) => s + r.paid_paise, 0)),
        plain(rows.reduce((s, r) => s + r.balance_paise, 0)),
      ],
    },
  )

  const effortTable = effort.length
    ? section(lang, 'ಬೆಳೆವಾರು ಶ್ರಮ', 'Effort by crop') +
      table(
        [
          L(lang, 'ಬೆಳೆ', 'Crop'),
          L(lang, 'ಕೆಲಸ', 'Work'),
          L(lang, 'ಆಳು-ದಿನ', 'Person-days'),
          L(lang, 'ಕೂಲಿ', 'Wages'),
        ],
        effort.map((e) => [
          escapeHtml(ctx.name({ name_en: e.head_en, name_kn: e.head_kn }) || '—'),
          escapeHtml(ctx.name({ name_en: e.activity_en, name_kn: e.activity_kn }) || '—'),
          String(e.person_days),
          plain(e.earned_paise),
        ]),
        { numeric: [2, 3] },
      )
    : ''

  return `
    ${letterhead(ctx, L(lang, 'ಕೂಲಿ ಬಾಕಿ ವಿವರ', 'Wages Due'))}
    ${cards([
      [L(lang, 'ಕೊಡಬೇಕಾದದ್ದು', 'You owe'), `<span class="neg">${rupees(owed)}</span>`, 'expense'],
      [L(lang, 'ಮುಂಗಡ', 'Advance held'), rupees(advance), 'neutral'],
      [L(lang, 'ಒಟ್ಟು ಜನ', 'People'), String(rows.length), 'brand'],
      [
        L(lang, 'ಬಾಕಿ ಇರುವವರು', 'Awaiting payment'),
        String(rows.filter((r) => r.balance_paise > 0).length),
        'neutral',
      ],
    ])}
    ${owedChart ? section(lang, 'ಯಾರಿಗೆ ಎಷ್ಟು', 'Who is owed') + chart(owedChart) : ''}
    ${dues}
    ${effortTable}
    ${signOff(ctx, L(lang, 'ಸಹಿ', 'Signature'))}`
}

export interface WorkerCharts {
  byCrop: {
    name_en: string | null
    name_kn: string | null
    person_days: number
    earned_paise: number
  }[]
  monthly: { month: string; earned: number; paid: number; days: number }[]
}

/**
 * One person's complete record: what they worked, what they earned, what they
 * were paid, and what is still owed.
 *
 * This is the document that gets handed to the worker, so it ends with a
 * receipt line for them to sign rather than only the farmer's signature. It is
 * also the reason the app calls them workers and not labourers — the word on
 * the page is the word said to their face.
 */
export function labourStatementDoc(
  ctx: DocContext,
  labourer: { name_en: string; name_kn: string; phone: string | null; code?: string | null },
  work: AttendanceRow[],
  payments: PaymentRow[],
  balance: number,
  charts?: WorkerCharts,
): string {
  const { lang } = ctx
  const earned = work.reduce((s, w) => s + w.amount_paise, 0)
  const paid = payments.reduce(
    (s, p) => s + (p.direction === 'in' ? -p.amount_paise : p.amount_paise),
    0,
  )

  const days = work.reduce((s, w) => s + w.day_fraction / 1000, 0)
  const personDays = work.reduce(
    (s, w) => s + (w.day_fraction / 1000) * Math.max(1, w.group_size),
    0,
  )

  const subject = [
    `<span class="strong">${escapeHtml(ctx.name(labourer))}</span>`,
    labourer.code ? escapeHtml(labourer.code) : '',
    labourer.phone ? escapeHtml(labourer.phone) : '',
  ]
    .filter(Boolean)
    .join(' <span class="muted">·</span> ')

  const monthChart = charts?.monthly.length
    ? groupedBars({
        categories: charts.monthly.map((m) => shortMonth(m.month, lang)),
        series: [
          {
            label: L(lang, 'ಗಳಿಕೆ', 'Earned'),
            color: INK.income,
            values: charts.monthly.map((m) => m.earned),
          },
          {
            label: L(lang, 'ಪಾವತಿ', 'Paid'),
            color: INK.expense,
            values: charts.monthly.map((m) => m.paid),
          },
        ],
        axisFormat: compact,
      })
    : ''

  const cropChart = charts?.byCrop.length
    ? donut({
        slices: charts.byCrop
          .filter((c) => c.earned_paise > 0)
          .map((c, i) => ({
            label: ctx.name({ name_en: c.name_en, name_kn: c.name_kn }) || '—',
            value: c.earned_paise,
            color: RAMP[i % RAMP.length],
          })),
        centreValue: compact(earned),
        centreLabel: L(lang, 'ಒಟ್ಟು ಗಳಿಕೆ', 'Total earned'),
      })
    : ''

  const cropTable = charts?.byCrop.length
    ? table(
        [L(lang, 'ಬೆಳೆ', 'Crop'), L(lang, 'ಆಳು-ದಿನ', 'Person-days'), L(lang, 'ಗಳಿಕೆ', 'Earned')],
        charts.byCrop.map((c) => [
          escapeHtml(ctx.name({ name_en: c.name_en, name_kn: c.name_kn }) || '—'),
          String(c.person_days),
          plain(c.earned_paise),
        ]),
        { numeric: [1, 2] },
      )
    : ''

  const workTable = table(
    [
      L(lang, 'ದಿನಾಂಕ', 'Date'),
      L(lang, 'ಬೆಳೆ', 'Crop'),
      L(lang, 'ಕೆಲಸ', 'Work'),
      L(lang, 'ಜನ', 'People'),
      L(lang, 'ದರ', 'Rate'),
      L(lang, 'ಮೊತ್ತ', 'Amount'),
    ],
    work.map((w) => [
      escapeHtml(formatDate(w.date, lang)) +
        (w.day_fraction !== 1000 ? ' <span class="muted">½</span>' : ''),
      escapeHtml(ctx.name({ name_en: w.head_name_en, name_kn: w.head_name_kn }) || '—'),
      escapeHtml(ctx.name({ name_en: w.activity_name_en, name_kn: w.activity_name_kn }) || '—'),
      String(w.group_size),
      plain(w.rate_paise),
      plain(w.amount_paise),
    ]),
    { numeric: [3, 4, 5], foot: [L(lang, 'ಒಟ್ಟು', 'Total'), '', '', '', '', plain(earned)] },
  )

  // Money out and money back are shown in one column with a sign, the way a
  // khata book does it — two columns invites reading the wrong one.
  const payTable = table(
    [L(lang, 'ದಿನಾಂಕ', 'Date'), L(lang, 'ವಿವರ', 'Detail'), L(lang, 'ಮೊತ್ತ', 'Amount')],
    payments.map((p) => {
      const isReturn = p.direction === 'in'
      const label = isReturn
        ? L(lang, 'ವಾಪಸ್ ಬಂತು', 'Returned')
        : p.is_advance
          ? L(lang, 'ಮುಂಗಡ', 'Advance')
          : L(lang, 'ಕೂಲಿ', 'Wages')
      return [
        escapeHtml(formatDate(p.date, lang)),
        `<span class="strong">${escapeHtml(label)}</span>` +
          escapeHtml(
            [ctx.name({ name_en: p.account_name_en, name_kn: p.account_name_kn }), p.note ?? '']
              .filter(Boolean)
              .join(' · ')
              .replace(/^(.)/, ' · $1'),
          ),
        `<span class="${isReturn ? 'pos' : ''}">${isReturn ? '−' : ''}${plain(p.amount_paise)}</span>`,
      ]
    }),
    { numeric: [2], foot: [L(lang, 'ನಿವ್ವಳ', 'Net paid'), '', plain(paid)] },
  )

  return `
    ${letterhead(ctx, L(lang, 'ಕೆಲಸ ಮತ್ತು ಪಾವತಿ ವಿವರ', 'Work & Payment Statement'), subject)}
    ${cards([
      [
        L(lang, 'ಕೆಲಸದ ದಿನ', 'Days'),
        String(days),
        'brand',
        personDays !== days ? `${personDays} ${L(lang, 'ಆಳು-ದಿನ', 'person-days')}` : undefined,
      ],
      [L(lang, 'ಗಳಿಸಿದ್ದು', 'Earned'), `<span class="pos">${rupees(earned)}</span>`, 'income'],
      [L(lang, 'ಕೊಟ್ಟಿದ್ದು', 'Paid'), rupees(paid), 'expense'],
      [
        balance < 0 ? L(lang, 'ಮುಂಗಡ', 'Advance held') : L(lang, 'ಬಾಕಿ', 'Balance due'),
        `<span class="${balance > 0 ? 'neg' : ''}">${rupees(Math.abs(balance))}</span>`,
        balance > 0 ? 'expense' : 'neutral',
      ],
    ])}

    ${monthChart ? section(lang, 'ತಿಂಗಳವಾರು', 'Month by month') + chart(monthChart) : ''}
    ${cropChart ? section(lang, 'ಯಾವ ಬೆಳೆಗೆ ಕೆಲಸ', 'Work by crop') + chart(cropChart) + cropTable : ''}

    ${section(lang, 'ಕೆಲಸದ ದಿನಗಳು', 'Days worked')}
    ${workTable}
    ${section(lang, 'ಪಾವತಿ ಮತ್ತು ವಾಪಸಾತಿ', 'Payments and returns')}
    ${payTable}
    ${signOff(ctx, L(lang, 'ಸ್ವೀಕರಿಸಿದವರ ಸಹಿ', 'Received by'))}`
}

/* ------------------------------------------------------------------ *
 * The whole farm, on one document
 * ------------------------------------------------------------------ */

export interface ComprehensiveData {
  crops: CropRow[]
  plots: PlotRow[]
  income: StatementLine[]
  expense: StatementLine[]
  detail: DetailLine[]
  dues: DuesRow[]
  effort: EffortRow[]
  balances: { name_en: string; name_kn: string; balance_paise: number }[]
  monthly: { month: string; income: number; expense: number }[]
  outstanding: number
}

/**
 * The full picture: balances, crop and plot profitability, where money went,
 * who is owed, and the month-by-month trend.
 *
 * Long on purpose — this is the one a farmer prints once a year and files.
 * Every section that can stand alone is also its own shorter report, for the
 * times somebody needs only that page.
 */
export function comprehensiveDoc(ctx: DocContext, d: ComprehensiveData): string {
  const { lang } = ctx

  const incomeTotal = d.income.reduce((s, r) => s + r.total, 0)
  const expenseTotal = d.expense.reduce((s, r) => s + r.total, 0)
  const net = incomeTotal - expenseTotal
  const cash = d.balances.reduce((s, b) => s + b.balance_paise, 0)
  const owed = d.dues.reduce((s, r) => s + Math.max(0, r.balance_paise), 0)
  const personDays = d.effort.reduce((s, e) => s + e.person_days, 0)

  const trendChart = d.monthly.length
    ? groupedBars({
        categories: d.monthly.map((m) => shortMonth(m.month, lang)),
        series: [
          {
            label: L(lang, 'ಆದಾಯ', 'Income'),
            color: INK.income,
            values: d.monthly.map((m) => m.income),
          },
          {
            label: L(lang, 'ಖರ್ಚು', 'Expense'),
            color: INK.expense,
            values: d.monthly.map((m) => m.expense),
          },
        ],
        axisFormat: compact,
      })
    : ''

  const trendTable = d.monthly.length
    ? table(
        [
          L(lang, 'ತಿಂಗಳು', 'Month'),
          L(lang, 'ಆದಾಯ', 'Income'),
          L(lang, 'ಖರ್ಚು', 'Expense'),
          L(lang, 'ಉಳಿತಾಯ', 'Net'),
        ],
        d.monthly.map((m) => {
          const n = m.income - m.expense
          return [
            escapeHtml(monthLabel(m.month, lang)),
            plain(m.income),
            plain(m.expense),
            `<span class="${n < 0 ? 'neg' : 'pos'}">${plain(n)}</span>`,
          ]
        }),
        {
          numeric: [1, 2, 3],
          foot: [
            L(lang, 'ಒಟ್ಟು', 'Total'),
            plain(d.monthly.reduce((s, m) => s + m.income, 0)),
            plain(d.monthly.reduce((s, m) => s + m.expense, 0)),
            plain(d.monthly.reduce((s, m) => s + m.income - m.expense, 0)),
          ],
        },
      )
    : ''

  const cropDonut = donut({
    slices: d.crops
      .filter((c) => c.income_paise > 0)
      .map((c, i) => ({
        label: ctx.name(c),
        value: c.income_paise,
        color: RAMP[i % RAMP.length],
      })),
    centreValue: compact(incomeTotal),
    centreLabel: L(lang, 'ಒಟ್ಟು ಆದಾಯ', 'Total income'),
  })

  const cropPeak = Math.max(1, ...d.crops.map((c) => c.income_paise))
  const cropTable = d.crops.length
    ? table(
        [
          L(lang, 'ಬೆಳೆ', 'Crop'),
          L(lang, 'ಆದಾಯ', 'Income'),
          '',
          L(lang, 'ಖರ್ಚು', 'Cost'),
          L(lang, 'ಲಾಭ', 'Profit'),
        ],
        d.crops.map((c) => [
          escapeHtml(ctx.name(c)),
          plain(c.income_paise),
          bar(c.income_paise, cropPeak),
          plain(c.total_cost_paise),
          `<span class="${c.profit_paise < 0 ? 'neg' : 'pos'}">${plain(c.profit_paise)}</span>`,
        ]),
        {
          numeric: [1, 3, 4],
          foot: [
            L(lang, 'ಒಟ್ಟು', 'Total'),
            plain(d.crops.reduce((s, c) => s + c.income_paise, 0)),
            '',
            plain(d.crops.reduce((s, c) => s + c.total_cost_paise, 0)),
            plain(d.crops.reduce((s, c) => s + c.profit_paise, 0)),
          ],
        },
      )
    : ''

  const spendChart = rankedBars({
    rows: d.expense
      .filter((e) => e.total > 0)
      .slice(0, 10)
      .map((e) => ({
        label: ctx.name(e) || L(lang, 'ಇತರೆ', 'Unallocated'),
        value: e.total,
        note: formatPaise(e.total, { decimals: false }),
      })),
    color: INK.expense,
  })

  const spendTable = d.expense.length
    ? table(
        [L(lang, 'ಖರ್ಚಿನ ವಿಧ', 'Spend type'), L(lang, 'ಪಾಲು', 'Share'), L(lang, 'ಮೊತ್ತ', 'Amount')],
        d.expense.map((e) => [
          escapeHtml(ctx.name(e) || '—'),
          expenseTotal > 0 ? `${Math.round((e.total / expenseTotal) * 100)}%` : '—',
          plain(e.total),
        ]),
        { numeric: [1, 2], foot: [L(lang, 'ಒಟ್ಟು', 'Total'), '100%', plain(expenseTotal)] },
      )
    : ''

  const balanceTable = d.balances.length
    ? table(
        [L(lang, 'ಖಾತೆ', 'Account'), L(lang, 'ಶಿಲ್ಕು', 'Balance')],
        d.balances.map((b) => [escapeHtml(ctx.name(b)), plain(b.balance_paise)]),
        { numeric: [1], foot: [L(lang, 'ಒಟ್ಟು', 'Total'), plain(cash)] },
      )
    : ''

  const activeDues = d.dues.filter((r) => r.balance_paise !== 0)
  const duesTable = activeDues.length
    ? section(lang, 'ಕೂಲಿ ಬಾಕಿ', 'Wages due') +
      table(
        [
          L(lang, 'ಹೆಸರು', 'Name'),
          L(lang, 'ದಿನ', 'Days'),
          L(lang, 'ಗಳಿಸಿದ್ದು', 'Earned'),
          L(lang, 'ಕೊಟ್ಟಿದ್ದು', 'Paid'),
          L(lang, 'ಬಾಕಿ', 'Balance'),
        ],
        activeDues.map((r) => [
          escapeHtml(ctx.name(r)),
          String(r.days),
          plain(r.earned_paise),
          plain(r.paid_paise),
          `<span class="${r.balance_paise > 0 ? 'neg' : 'muted'}">${plain(r.balance_paise)}</span>`,
        ]),
        { numeric: [1, 2, 3, 4] },
      )
    : ''

  // Only worth a section once there is more than one piece of land; otherwise
  // it repeats the farm totals under a different heading.
  const namedPlots = d.plots.filter((p) => p.plot_id)
  const plotSection = namedPlots.length
    ? section(lang, 'ಜಮೀನುವಾರು', 'Plot by plot') + plotTable(ctx, d.plots)
    : ''

  return `
    ${letterhead(ctx, L(lang, 'ಸಂಪೂರ್ಣ ವರದಿ', 'Complete Farm Report'))}
    ${cards([
      [L(lang, 'ಆದಾಯ', 'Income'), `<span class="pos">${rupees(incomeTotal)}</span>`, 'income'],
      [L(lang, 'ಖರ್ಚು', 'Expense'), `<span class="neg">${rupees(expenseTotal)}</span>`, 'expense'],
      [
        L(lang, 'ಉಳಿತಾಯ', 'Net'),
        `<span class="${net < 0 ? 'neg' : 'pos'}">${rupees(net)}</span>`,
        net < 0 ? 'expense' : 'income',
      ],
      [L(lang, 'ಕೈಶಿಲ್ಕು', 'Cash & bank'), rupees(cash), 'brand'],
      [
        L(lang, 'ಕೂಲಿ ಬಾಕಿ', 'Wages due'),
        `<span class="${owed ? 'neg' : ''}">${rupees(owed)}</span>`,
        'neutral',
      ],
      [L(lang, 'ಬೆಳೆಗಳು', 'Crops'), String(d.crops.length), 'neutral'],
      [L(lang, 'ಜಮೀನುಗಳು', 'Plots'), String(namedPlots.length || 1), 'neutral'],
      [
        L(lang, 'ಆಳು-ದಿನ', 'Person-days'),
        String(Math.round(personDays * 10) / 10),
        'neutral',
      ],
    ])}
    ${outstandingNote(d.outstanding, lang)}

    ${trendChart ? section(lang, 'ತಿಂಗಳವಾರು', 'Month by month') + chart(trendChart) + trendTable : ''}

    ${section(lang, 'ಬೆಳೆವಾರು ಲಾಭ', 'Crop by crop')}
    ${chart(cropDonut)}
    ${cropTable}

    ${plotSection}

    ${section(lang, 'ಖರ್ಚು ಎಲ್ಲಿ ಹೋಯಿತು', 'Where the money went')}
    ${chart(spendChart)}
    ${spendTable}

    ${section(lang, 'ಖಾತೆ ಶಿಲ್ಕು', 'Account balances')}
    ${balanceTable}

    ${duesTable}

    ${section(lang, 'ಖರ್ಚಿನ ವಿವರ', 'Expense detail')}
    ${table(
      [
        L(lang, 'ಬೆಳೆ', 'Crop'),
        L(lang, 'ವಿಧ', 'Type'),
        L(lang, 'ಕೆಲಸ', 'Work'),
        L(lang, 'ಮೊತ್ತ', 'Amount'),
      ],
      d.detail.map((x) => [
        escapeHtml(ctx.name({ name_en: x.head_en, name_kn: x.head_kn }) || '—'),
        escapeHtml(ctx.name({ name_en: x.sub_en, name_kn: x.sub_kn }) || '—'),
        escapeHtml(ctx.name({ name_en: x.activity_en, name_kn: x.activity_kn }) || '—'),
        plain(x.total),
      ]),
      { numeric: [3] },
    )}

    ${signOff(ctx, L(lang, 'ಸಹಿ', 'Signature'))}`
}

/* ------------------------------------------------------------------ *
 * Day book
 * ------------------------------------------------------------------ */

export function dayBookDoc(ctx: DocContext, rows: DayBookRow[]): string {
  const { lang } = ctx
  const kindLabel: Record<string, string> = {
    income: L(lang, 'ಆದಾಯ', 'Income'),
    expense: L(lang, 'ಖರ್ಚು', 'Expense'),
    transfer: L(lang, 'ವರ್ಗಾವಣೆ', 'Transfer'),
  }

  const totals = {
    income: rows.filter((r) => r.kind === 'income').reduce((s, r) => s + r.amount_paise, 0),
    expense: rows.filter((r) => r.kind === 'expense').reduce((s, r) => s + r.amount_paise, 0),
  }

  // Only worth a column once plots are actually in use.
  const hasPlots = rows.some((r) => r.plot_en)

  const headers = [
    L(lang, 'ದಿನಾಂಕ', 'Date'),
    L(lang, 'ವಿಧ', 'Type'),
    L(lang, 'ವಿವರ', 'Detail'),
    ...(hasPlots ? [L(lang, 'ಜಮೀನು', 'Plot')] : []),
    L(lang, 'ಖಾತೆ', 'Account'),
    L(lang, 'ಮೊತ್ತ', 'Amount'),
  ]

  return `
    ${letterhead(ctx, L(lang, 'ದಿನಚರಿ', 'Day Book'))}
    ${cards([
      [L(lang, 'ದಾಖಲೆಗಳು', 'Entries'), String(rows.length), 'brand'],
      [L(lang, 'ಆದಾಯ', 'Income'), `<span class="pos">${rupees(totals.income)}</span>`, 'income'],
      [L(lang, 'ಖರ್ಚು', 'Expense'), `<span class="neg">${rupees(totals.expense)}</span>`, 'expense'],
      [
        L(lang, 'ಉಳಿತಾಯ', 'Net'),
        `<span class="${totals.income - totals.expense < 0 ? 'neg' : 'pos'}">${rupees(
          totals.income - totals.expense,
        )}</span>`,
        totals.income - totals.expense < 0 ? 'expense' : 'income',
      ],
    ])}
    ${table(
      headers,
      rows.map((r) => [
        escapeHtml(formatDate(r.date, lang)),
        escapeHtml(kindLabel[r.kind] ?? r.kind),
        escapeHtml(
          [
            ctx.name({ name_en: r.head_en, name_kn: r.head_kn }),
            ctx.name({ name_en: r.activity_en, name_kn: r.activity_kn }) ||
              ctx.name({ name_en: r.sub_en, name_kn: r.sub_kn }),
            r.party_name ?? '',
            r.note ?? '',
          ]
            .filter(Boolean)
            .join(' · ') || '—',
        ),
        ...(hasPlots
          ? [escapeHtml(ctx.name({ name_en: r.plot_en, name_kn: r.plot_kn }) || '—')]
          : []),
        escapeHtml(ctx.name({ name_en: r.account_en, name_kn: r.account_kn }) || '—'),
        `<span class="${r.kind === 'expense' ? 'neg' : r.kind === 'income' ? 'pos' : ''}">${plain(
          r.amount_paise,
        )}</span>`,
      ]),
      { numeric: [headers.length - 1] },
    )}
    ${signOff(ctx, L(lang, 'ಸಹಿ', 'Signature'))}`
}
