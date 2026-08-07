import { escapeHtml } from '@/lib/printDoc'
import { formatINR, formatPaise } from '@/lib/money'
import { formatQuantity } from '@/lib/quantity'
import { formatDate } from '@/lib/date'
import type { Lang } from '@/i18n/strings'
import type { FarmProfile } from '@/data/masterData'
import type {
  CropRow, DayBookRow, DetailLine, DuesRow, EffortRow, Period, StatementLine,
} from '@/data/reports'
import type { AttendanceRow, PaymentRow } from '@/data/labour'

/**
 * Report documents, built as HTML strings.
 *
 * The same string is shown in the on-screen preview and handed to the print
 * engine, so what the farmer approves is exactly what comes out. Building the
 * preview from React and the PDF from something else is how a report ends up
 * looking right on screen and wrong on paper.
 */

const LOGO = `<svg class="lh-logo" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
<rect width="64" height="64" rx="15" fill="#12502c"/>
<path d="M32 45V24" stroke="#f0c078" stroke-width="3.2" stroke-linecap="round" fill="none"/>
<path d="M33 31c0-6 4.6-11 11-11 0 6-4.6 11-11 11Z" fill="#a7d9bc"/>
<path d="M31 35c0-6.4-4.9-11.6-11.6-11.6 0 6.4 4.9 11.6 11.6 11.6Z" fill="#6dbd92"/>
<path d="M32 44c-5.6-4-13.4-4.6-20-2.6v13c6.6-2 14.4-1.4 20 2.6Z" fill="#ffffff"/>
<path d="M32 44c5.6-4 13.4-4.6 20-2.6v13c-6.6-2-14.4-1.4-20 2.6Z" fill="#d6e6dc"/></svg>`

const rupees = (p: number) => escapeHtml(formatINR(p, { decimals: false }))
const plain = (p: number) => escapeHtml(formatPaise(p, { decimals: false }))

export interface DocContext {
  profile: FarmProfile
  period: Period
  lang: Lang
  /** Picks the right name column; passed in so documents stay pure. */
  name: (row: { name_en: string | null; name_kn: string | null } | null | undefined) => string
}

function letterhead(ctx: DocContext, title: string): string {
  const { profile, period, lang } = ctx

  // The farm's own name leads. Krishi Khata made the document, but it is the
  // farmer's statement, not the app's advertisement.
  const farm = profile.farm_name || L(lang, 'ತೋಟದ ಹೆಸರು', 'Farm name')
  const contact = [profile.village, profile.phone].filter(Boolean).map(escapeHtml).join(' · ')

  return `
  <div class="lh">
    ${LOGO}
    <div class="lh-main">
      <div class="lh-app">${escapeHtml(farm)}</div>
      ${profile.owner_name ? `<div class="lh-farm">${escapeHtml(profile.owner_name)}</div>` : ''}
      ${contact ? `<div class="lh-sub">${contact}</div>` : ''}
    </div>
    <div class="lh-right">ಕೃಷಿ ಖಾತೆ<br>Krishi Khata</div>
  </div>
  <div class="title-band">
    <h1 class="title">${escapeHtml(title)}</h1>
    <span class="period">${escapeHtml(formatDate(period.from, lang))} — ${escapeHtml(
      formatDate(period.to, lang),
    )}</span>
  </div>`
}

type CardTone = 'income' | 'expense' | 'neutral' | ''

/** The row of summary figures that opens most documents. */
function cards(items: [label: string, value: string, tone?: CardTone, sub?: string][]): string {
  return `<div class="totals">${items
    .map(
      ([label, value, tone, sub]) => `
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
function bar(value: number, max: number, tone: 'income' | 'expense' = 'income'): string {
  const pct = max > 0 ? Math.round((Math.abs(value) / max) * 100) : 0
  return `<div class="bar ${tone === 'expense' ? 'is-expense' : ''}"><span style="width:${pct}%"></span></div>`
}

function footer(lang: Lang): string {
  const generated = L(lang, 'ತಯಾರಿಸಿದ ದಿನಾಂಕ', 'Generated')
  const today = formatDate(new Date().toISOString().slice(0, 10), lang)
  return `<div class="foot"><span>${escapeHtml(generated)}: ${escapeHtml(today)}</span>
          <span>ಕೃಷಿ ಖಾತೆ · Krishi Khata</span></div>`
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
  rows: string[][],
  opts: { numeric?: number[]; foot?: string[] } = {},
): string {
  const numeric = new Set(opts.numeric ?? [])
  const th = headers
    .map((h, i) => `<th class="${numeric.has(i) ? 'num' : ''}">${escapeHtml(h)}</th>`)
    .join('')
  const body = rows
    .map(
      (r) =>
        `<tr>${r
          .map((c, i) => `<td class="${numeric.has(i) ? 'num' : ''}">${c}</td>`)
          .join('')}</tr>`,
    )
    .join('')
  const tfoot = opts.foot
    ? `<tfoot><tr>${opts.foot
        .map((c, i) => `<td class="${numeric.has(i) ? 'num' : ''}">${c}</td>`)
        .join('')}</tr></tfoot>`
    : ''
  return `<table><thead><tr>${th}</tr></thead><tbody>${body}</tbody>${tfoot}</table>`
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
  ])

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
    <h2 class="section">${escapeHtml(L(lang, 'ಆದಾಯ', 'Income'))}</h2>
    ${incomeTable}
    <h2 class="section">${escapeHtml(L(lang, 'ಖರ್ಚು', 'Expense'))}</h2>
    ${expenseTable}
    <h2 class="section">${escapeHtml(L(lang, 'ಖರ್ಚಿನ ವಿವರ', 'Expense detail'))}</h2>
    ${detailTable}
    ${footer(lang)}`
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
    ? `<h2 class="section">${escapeHtml(L(lang, 'ಪ್ರತಿ ಅಳತೆಗೆ', 'Per unit'))}</h2>` +
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
    ${outstandingNote(outstanding, lang)}
    ${body}
    ${perUnit}
    ${footer(lang)}`
}

/* ------------------------------------------------------------------ *
 * Labour
 * ------------------------------------------------------------------ */

export function labourDuesDoc(ctx: DocContext, rows: DuesRow[], effort: EffortRow[]): string {
  const { lang } = ctx
  const owed = rows.reduce((s, r) => s + Math.max(0, r.balance_paise), 0)
  const advance = rows.reduce((s, r) => s + Math.max(0, -r.balance_paise), 0)

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
    ? `<h2 class="section">${escapeHtml(L(lang, 'ಬೆಳೆವಾರು ಶ್ರಮ', 'Effort by crop'))}</h2>` +
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
    ${letterhead(ctx, L(lang, 'ಕೂಲಿ ಬಾಕಿ ವಿವರ', 'Labour Dues Summary'))}
    ${cards([
      [L(lang, 'ಕೊಡಬೇಕಾದದ್ದು', 'You owe'), `<span class="neg">${rupees(owed)}</span>`, 'expense'],
      [L(lang, 'ಮುಂಗಡ', 'Advance held'), rupees(advance), 'neutral'],
      [
        L(lang, 'ಒಟ್ಟು ಆಳುಗಳು', 'People'),
        String(rows.length),
        'neutral',
      ],
    ])}
    ${dues}
    ${effortTable}
    ${footer(lang)}`
}

export function labourStatementDoc(
  ctx: DocContext,
  labourer: { name_en: string; name_kn: string; phone: string | null },
  work: AttendanceRow[],
  payments: PaymentRow[],
  balance: number,
): string {
  const { lang } = ctx
  const earned = work.reduce((s, w) => s + w.amount_paise, 0)
  const paid = payments.reduce(
    (s, p) => s + (p.direction === 'in' ? -p.amount_paise : p.amount_paise),
    0,
  )

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
    [
      L(lang, 'ದಿನಾಂಕ', 'Date'),
      L(lang, 'ವಿವರ', 'Detail'),
      L(lang, 'ಮೊತ್ತ', 'Amount'),
    ],
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
            [
              ctx.name({ name_en: p.account_name_en, name_kn: p.account_name_kn }),
              p.note ?? '',
            ]
              .filter(Boolean)
              .join(' · ')
              .replace(/^(.)/, ' · $1'),
          ),
        `<span class="${isReturn ? 'pos' : ''}">${isReturn ? '−' : ''}${plain(p.amount_paise)}</span>`,
      ]
    }),
    { numeric: [2], foot: [L(lang, 'ನಿವ್ವಳ', 'Net paid'), '', plain(paid)] },
  )

  const days = work.reduce((s, w) => s + w.day_fraction / 1000, 0)
  const personDays = work.reduce((s, w) => s + (w.day_fraction / 1000) * Math.max(1, w.group_size), 0)

  return `
    ${letterhead(ctx, L(lang, 'ಕೂಲಿಯಾಳಿನ ಖಾತೆ', 'Labour Statement'))}
    <div class="block" style="font-size:12pt;font-weight:600;margin-bottom:10px">
      ${escapeHtml(ctx.name(labourer))}
      ${labourer.phone ? `<span class="muted"> · ${escapeHtml(labourer.phone)}</span>` : ''}
    </div>
    ${cards([
      [L(lang, 'ಕೆಲಸದ ದಿನ', 'Days'), String(days), 'neutral',
        personDays !== days ? `${personDays} ${L(lang, 'ಆಳು-ದಿನ', 'person-days')}` : undefined],
      [L(lang, 'ಗಳಿಸಿದ್ದು', 'Earned'), rupees(earned), 'income'],
      [L(lang, 'ಕೊಟ್ಟಿದ್ದು', 'Paid'), rupees(paid), 'expense'],
      [
        balance < 0 ? L(lang, 'ಮುಂಗಡ', 'Advance held') : L(lang, 'ಬಾಕಿ', 'Balance due'),
        `<span class="${balance > 0 ? 'neg' : ''}">${rupees(Math.abs(balance))}</span>`,
        balance > 0 ? 'expense' : 'neutral',
      ],
    ])}
    <h2 class="section">${escapeHtml(L(lang, 'ಕೆಲಸದ ದಿನಗಳು', 'Days worked'))}</h2>
    ${workTable}
    <h2 class="section">${escapeHtml(L(lang, 'ಪಾವತಿ ಮತ್ತು ವಾಪಸಾತಿ', 'Payments and returns'))}</h2>
    ${payTable}
    <div class="sign"><div>${escapeHtml(L(lang, 'ಸಹಿ', 'Signature'))}</div></div>
    ${footer(lang)}`
}

/* ------------------------------------------------------------------ *
 * The whole farm, on one document
 * ------------------------------------------------------------------ */

export interface ComprehensiveData {
  crops: CropRow[]
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
 * The full picture: balances, crop profitability, where money went, who is
 * owed, and the month-by-month trend.
 *
 * The trend is drawn as paired bars built from divs. A chart library would
 * render nothing here — the document is handed to a print engine as static
 * HTML, with no JavaScript and no canvas — and rasterising a chart to an image
 * would put unshaped Kannada back into the labels.
 */
export function comprehensiveDoc(ctx: DocContext, d: ComprehensiveData): string {
  const { lang } = ctx

  const incomeTotal = d.income.reduce((s, r) => s + r.total, 0)
  const expenseTotal = d.expense.reduce((s, r) => s + r.total, 0)
  const net = incomeTotal - expenseTotal
  const cash = d.balances.reduce((s, b) => s + b.balance_paise, 0)
  const owed = d.dues.reduce((s, r) => s + Math.max(0, r.balance_paise), 0)

  const peak = Math.max(1, ...d.monthly.map((m) => Math.max(m.income, m.expense)))

  const trend = d.monthly.length
    ? `<h2 class="section">${escapeHtml(L(lang, 'ತಿಂಗಳವಾರು ಬೆಳವಣಿಗೆ', 'Month by month'))}</h2>` +
      table(
        [
          L(lang, 'ತಿಂಗಳು', 'Month'),
          L(lang, 'ಆದಾಯ', 'Income'),
          '',
          L(lang, 'ಖರ್ಚು', 'Expense'),
          '',
          L(lang, 'ಉಳಿತಾಯ', 'Net'),
        ],
        d.monthly.map((m) => {
          const n = m.income - m.expense
          return [
            escapeHtml(monthLabel(m.month, lang)),
            plain(m.income),
            bar(m.income, peak, 'income'),
            plain(m.expense),
            bar(m.expense, peak, 'expense'),
            `<span class="${n < 0 ? 'neg' : 'pos'}">${plain(n)}</span>`,
          ]
        }),
        {
          numeric: [1, 3, 5],
          foot: [
            L(lang, 'ಒಟ್ಟು', 'Total'),
            plain(d.monthly.reduce((s, m) => s + m.income, 0)),
            '',
            plain(d.monthly.reduce((s, m) => s + m.expense, 0)),
            '',
            plain(d.monthly.reduce((s, m) => s + m.income - m.expense, 0)),
          ],
        },
      )
    : ''

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
        { numeric: [1, 3, 4] },
      )
    : ''

  const spendPeak = Math.max(1, ...d.expense.map((e) => e.total))
  const spendTable = d.expense.length
    ? table(
        [L(lang, 'ಖರ್ಚಿನ ವಿಧ', 'Spend type'), L(lang, 'ಮೊತ್ತ', 'Amount'), ''],
        d.expense.map((e) => [
          escapeHtml(ctx.name(e) || '—'),
          plain(e.total),
          bar(e.total, spendPeak, 'expense'),
        ]),
        { numeric: [1], foot: [L(lang, 'ಒಟ್ಟು', 'Total'), plain(expenseTotal), ''] },
      )
    : ''

  const balanceTable = d.balances.length
    ? table(
        [L(lang, 'ಖಾತೆ', 'Account'), L(lang, 'ಶಿಲ್ಕು', 'Balance')],
        d.balances.map((b) => [escapeHtml(ctx.name(b)), plain(b.balance_paise)]),
        { numeric: [1], foot: [L(lang, 'ಒಟ್ಟು', 'Total'), plain(cash)] },
      )
    : ''

  const duesTable = d.dues.filter((r) => r.balance_paise !== 0).length
    ? `<h2 class="section">${escapeHtml(L(lang, 'ಕೂಲಿ ಬಾಕಿ', 'Labour dues'))}</h2>` +
      table(
        [
          L(lang, 'ಹೆಸರು', 'Name'),
          L(lang, 'ದಿನ', 'Days'),
          L(lang, 'ಗಳಿಸಿದ್ದು', 'Earned'),
          L(lang, 'ಕೊಟ್ಟಿದ್ದು', 'Paid'),
          L(lang, 'ಬಾಕಿ', 'Balance'),
        ],
        d.dues
          .filter((r) => r.balance_paise !== 0)
          .map((r) => [
            escapeHtml(ctx.name(r)),
            String(r.days),
            plain(r.earned_paise),
            plain(r.paid_paise),
            `<span class="${r.balance_paise > 0 ? 'neg' : 'muted'}">${plain(r.balance_paise)}</span>`,
          ]),
        { numeric: [1, 2, 3, 4] },
      )
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
      [L(lang, 'ಕೈಶಿಲ್ಕು', 'In hand'), rupees(cash), 'neutral'],
      [L(lang, 'ಕೂಲಿ ಬಾಕಿ', 'Wages due'), `<span class="${owed ? 'neg' : ''}">${rupees(owed)}</span>`, 'neutral'],
    ])}
    ${outstandingNote(d.outstanding, lang)}

    <h2 class="section">${escapeHtml(L(lang, 'ಬೆಳೆವಾರು ಲಾಭ', 'Crop-wise profit'))}</h2>
    ${cropTable}

    <h2 class="section">${escapeHtml(L(lang, 'ಖರ್ಚು ಎಲ್ಲಿ ಹೋಯಿತು', 'Where the money went'))}</h2>
    ${spendTable}

    ${trend}

    <h2 class="section">${escapeHtml(L(lang, 'ಖಾತೆ ಶಿಲ್ಕು', 'Account balances'))}</h2>
    ${balanceTable}

    ${duesTable}

    <h2 class="section">${escapeHtml(L(lang, 'ಖರ್ಚಿನ ವಿವರ', 'Expense detail'))}</h2>
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

    ${footer(lang)}`
}

/** "2026-08" -> "ಆಗಸ್ಟ್ 2026" */
function monthLabel(ym: string, lang: Lang): string {
  const [y, m] = ym.split('-').map(Number)
  return formatDate(`${y}-${String(m).padStart(2, '0')}-01`, lang).slice(3)
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

  return `
    ${letterhead(ctx, L(lang, 'ದಿನಚರಿ', 'Day Book'))}
    ${table(
      [
        L(lang, 'ದಿನಾಂಕ', 'Date'),
        L(lang, 'ವಿಧ', 'Type'),
        L(lang, 'ವಿವರ', 'Detail'),
        L(lang, 'ಖಾತೆ', 'Account'),
        L(lang, 'ಮೊತ್ತ', 'Amount'),
      ],
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
        escapeHtml(ctx.name({ name_en: r.account_en, name_kn: r.account_kn }) || '—'),
        `<span class="${r.kind === 'expense' ? 'neg' : r.kind === 'income' ? 'pos' : ''}">${plain(
          r.amount_paise,
        )}</span>`,
      ]),
      { numeric: [4] },
    )}
    ${footer(lang)}`
}
