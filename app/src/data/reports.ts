import { all } from '@/db/db'
import { labourCostByHead, labourCostByPlot } from './labour'
import { impliedRatePaise } from '@/lib/quantity'
import type { AreaUnit, ISODate } from '@/db/types'

/**
 * Report aggregation.
 *
 * The headline is crop-wise profitability, and it is the one figure this whole
 * app exists to produce: what a crop brought in, what it cost, and therefore
 * what it made. Everything else — the day book, the statements — is bookkeeping
 * in service of that.
 *
 * Costs arrive from two places and both matter:
 *
 *   Direct expenses  — fertilizer, transport, a shop bill, tagged to the crop
 *                      when it was recorded.
 *   Labour           — reached through payment allocations, not through the
 *                      expense row, because on a cash basis a lump-sum wage
 *                      payment covers work across several crops and only the
 *                      allocations know the split.
 *
 * Wages earned but not yet paid are deliberately NOT counted, because the
 * farmer chose cash-basis accounts. They are reported separately, on the same
 * page, so the gap is visible rather than discovered later.
 */

export interface Period {
  from: ISODate
  to: ISODate
}

/* ------------------------------------------------------------------ *
 * Income and expense statement
 * ------------------------------------------------------------------ */

export interface StatementLine {
  id: string | null
  name_en: string | null
  name_kn: string | null
  total: number
}

export const incomeByHead = ({ from, to }: Period) =>
  all<StatementLine>(
    `SELECT e.head_id AS id, h.name_en, h.name_kn, SUM(e.amount_paise) AS total
       FROM entries e LEFT JOIN heads h ON h.id = e.head_id
      WHERE e.is_deleted = 0 AND e.kind = 'income' AND e.date >= ? AND e.date <= ?
      GROUP BY e.head_id ORDER BY total DESC;`,
    [from, to],
  )

export const expenseBySubHead = ({ from, to }: Period) =>
  all<StatementLine>(
    `SELECT e.sub_head_id AS id, s.name_en, s.name_kn, SUM(e.amount_paise) AS total
       FROM entries e LEFT JOIN sub_heads s ON s.id = e.sub_head_id
      WHERE e.is_deleted = 0 AND e.kind = 'expense' AND e.date >= ? AND e.date <= ?
      GROUP BY e.sub_head_id ORDER BY total DESC;`,
    [from, to],
  )

/**
 * Expenses broken down to the level the brief asked for: which crop, which
 * kind of spend, and exactly what work. This is the table that answers "where
 * did the money on banana actually go".
 */
export interface DetailLine {
  head_id: string | null
  head_en: string | null
  head_kn: string | null
  sub_en: string | null
  sub_kn: string | null
  activity_en: string | null
  activity_kn: string | null
  total: number
}

export const expenseDetail = ({ from, to }: Period) =>
  all<DetailLine>(
    `SELECT e.head_id, h.name_en AS head_en, h.name_kn AS head_kn,
            s.name_en AS sub_en, s.name_kn AS sub_kn,
            a.name_en AS activity_en, a.name_kn AS activity_kn,
            SUM(e.amount_paise) AS total
       FROM entries e
       LEFT JOIN heads h      ON h.id = e.head_id
       LEFT JOIN sub_heads s  ON s.id = e.sub_head_id
       LEFT JOIN activities a ON a.id = e.activity_id
      WHERE e.is_deleted = 0 AND e.kind = 'expense' AND e.date >= ? AND e.date <= ?
      GROUP BY e.head_id, e.sub_head_id, e.activity_id
      ORDER BY h.sort_order, total DESC;`,
    [from, to],
  )

/* ------------------------------------------------------------------ *
 * Crop-wise profitability
 * ------------------------------------------------------------------ */

export interface CropRow {
  head_id: string | null
  name_en: string
  name_kn: string
  color: string | null
  income_paise: number
  quantity_milli: number
  unit_short_en: string | null
  unit_short_kn: string | null
  direct_cost_paise: number
  labour_cost_paise: number
  total_cost_paise: number
  profit_paise: number
  /** What one unit cost to produce; null when nothing was sold. */
  cost_per_unit_paise: number | null
  /** What one unit fetched. */
  realised_rate_paise: number | null
}

interface RawIncome {
  head_id: string | null
  name_en: string | null
  name_kn: string | null
  color: string | null
  income: number
  quantity_milli: number
  unit_short_en: string | null
  unit_short_kn: string | null
}

export async function cropProfitability(period: Period): Promise<CropRow[]> {
  const { from, to } = period

  // Quantity is summed only where a unit is recorded, and only the dominant
  // unit is reported — adding kilos to bunches would produce a number that
  // looks precise and means nothing.
  const income = await all<RawIncome>(
    `SELECT e.head_id, h.name_en, h.name_kn, h.color,
            SUM(e.amount_paise) AS income,
            SUM(COALESCE(e.quantity_milli, 0)) AS quantity_milli,
            u.short_en AS unit_short_en, u.short_kn AS unit_short_kn
       FROM entries e
       LEFT JOIN heads h ON h.id = e.head_id
       LEFT JOIN units u ON u.id = e.unit_id
      WHERE e.is_deleted = 0 AND e.kind = 'income' AND e.date >= ? AND e.date <= ?
      GROUP BY e.head_id
      ORDER BY income DESC;`,
    [from, to],
  )

  // Direct expenses exclude wage payments; those are attributed through
  // allocations instead, so counting the expense row too would double them.
  const direct = await all<{ head_id: string | null; total: number }>(
    `SELECT e.head_id, SUM(e.amount_paise) AS total
       FROM entries e
      WHERE e.is_deleted = 0 AND e.kind = 'expense'
        AND e.labour_payment_id IS NULL
        AND e.date >= ? AND e.date <= ?
      GROUP BY e.head_id;`,
    [from, to],
  )

  const labour = await labourCostByHead(from, to)

  const heads = new Map<string | null, CropRow>()
  const get = (
    id: string | null,
    name_en: string | null,
    name_kn: string | null,
    color: string | null,
  ): CropRow => {
    const existing = heads.get(id)
    if (existing) return existing
    const row: CropRow = {
      head_id: id,
      name_en: name_en ?? 'Unallocated',
      name_kn: name_kn ?? 'ಹಂಚಿಕೆಯಾಗದ',
      color,
      income_paise: 0,
      quantity_milli: 0,
      unit_short_en: null,
      unit_short_kn: null,
      direct_cost_paise: 0,
      labour_cost_paise: 0,
      total_cost_paise: 0,
      profit_paise: 0,
      cost_per_unit_paise: null,
      realised_rate_paise: null,
    }
    heads.set(id, row)
    return row
  }

  for (const i of income) {
    const row = get(i.head_id, i.name_en, i.name_kn, i.color)
    row.income_paise += i.income
    row.quantity_milli += i.quantity_milli
    row.unit_short_en = i.unit_short_en
    row.unit_short_kn = i.unit_short_kn
  }
  for (const d of direct) get(d.head_id, null, null, null).direct_cost_paise += d.total
  for (const l of labour) get(l.head_id, l.name_en, l.name_kn, l.color).labour_cost_paise += l.total

  const rows = [...heads.values()]
  for (const r of rows) {
    r.total_cost_paise = r.direct_cost_paise + r.labour_cost_paise
    r.profit_paise = r.income_paise - r.total_cost_paise
    if (r.quantity_milli > 0) {
      r.cost_per_unit_paise = impliedRatePaise(r.quantity_milli, r.total_cost_paise)
      r.realised_rate_paise = impliedRatePaise(r.quantity_milli, r.income_paise)
    }
  }

  return rows.sort((a, b) => b.profit_paise - a.profit_paise)
}

/* ------------------------------------------------------------------ *
 * Plot-wise profitability
 * ------------------------------------------------------------------ */

export interface PlotRow {
  plot_id: string | null
  name_en: string
  name_kn: string
  survey_no: string | null
  area_milli: number | null
  area_unit: AreaUnit | null
  income_paise: number
  direct_cost_paise: number
  labour_cost_paise: number
  total_cost_paise: number
  profit_paise: number
  /** Person-days of work recorded on this land in the period. */
  person_days: number
}

/**
 * What each piece of land brought in and cost.
 *
 * Built the same way as `cropProfitability`, and for the same reason: direct
 * expenses come off the entry, but wages have to be reached through payment
 * allocations, because on a cash basis a lump-sum payment covers work spread
 * across several plots and only the allocations know the split.
 *
 * Records made before plots existed carry no plot and land on a "Not recorded"
 * row rather than being folded into the first plot, which would quietly make
 * one piece of land look like it had absorbed the whole farm's history.
 */
export async function plotProfitability(period: Period): Promise<PlotRow[]> {
  const { from, to } = period

  const income = await all<{ plot_id: string | null; total: number }>(
    `SELECT e.plot_id, SUM(e.amount_paise) AS total
       FROM entries e
      WHERE e.is_deleted = 0 AND e.kind = 'income' AND e.date >= ? AND e.date <= ?
      GROUP BY e.plot_id;`,
    [from, to],
  )

  const direct = await all<{ plot_id: string | null; total: number }>(
    `SELECT e.plot_id, SUM(e.amount_paise) AS total
       FROM entries e
      WHERE e.is_deleted = 0 AND e.kind = 'expense'
        AND e.labour_payment_id IS NULL
        AND e.date >= ? AND e.date <= ?
      GROUP BY e.plot_id;`,
    [from, to],
  )

  const effort = await all<{ plot_id: string | null; person_days: number }>(
    `SELECT a.plot_id, SUM(a.day_fraction * a.group_size) / 1000.0 AS person_days
       FROM attendance a
      WHERE a.is_deleted = 0 AND a.date >= ? AND a.date <= ?
      GROUP BY a.plot_id;`,
    [from, to],
  )

  const labour = await labourCostByPlot(from, to)

  const named = await all<{
    id: string
    name_en: string
    name_kn: string
    survey_no: string | null
    area_milli: number | null
    area_unit: AreaUnit | null
  }>('SELECT id, name_en, name_kn, survey_no, area_milli, area_unit FROM plots;')
  const meta = new Map(named.map((p) => [p.id, p]))

  const rows = new Map<string | null, PlotRow>()
  const get = (id: string | null): PlotRow => {
    const existing = rows.get(id)
    if (existing) return existing
    const m = id ? meta.get(id) : undefined
    const row: PlotRow = {
      plot_id: id,
      name_en: m?.name_en ?? 'Not recorded',
      name_kn: m?.name_kn ?? 'ದಾಖಲಾಗಿಲ್ಲ',
      survey_no: m?.survey_no ?? null,
      area_milli: m?.area_milli ?? null,
      area_unit: m?.area_unit ?? null,
      income_paise: 0,
      direct_cost_paise: 0,
      labour_cost_paise: 0,
      total_cost_paise: 0,
      profit_paise: 0,
      person_days: 0,
    }
    rows.set(id, row)
    return row
  }

  for (const i of income) get(i.plot_id).income_paise += i.total
  for (const d of direct) get(d.plot_id).direct_cost_paise += d.total
  for (const l of labour) get(l.plot_id).labour_cost_paise += l.total
  for (const e of effort) get(e.plot_id).person_days += e.person_days

  const out = [...rows.values()]
  for (const r of out) {
    r.total_cost_paise = r.direct_cost_paise + r.labour_cost_paise
    r.profit_paise = r.income_paise - r.total_cost_paise
  }

  return out.sort((a, b) => b.profit_paise - a.profit_paise)
}

/** Crop against plot — which land actually grows which crop profitably. */
export interface PlotCropRow {
  plot_id: string | null
  plot_en: string | null
  plot_kn: string | null
  head_en: string | null
  head_kn: string | null
  income_paise: number
  expense_paise: number
}

export const plotByCrop = ({ from, to }: Period) =>
  all<PlotCropRow>(
    `SELECT e.plot_id, pl.name_en AS plot_en, pl.name_kn AS plot_kn,
            h.name_en AS head_en, h.name_kn AS head_kn,
            SUM(CASE WHEN e.kind = 'income'  THEN e.amount_paise ELSE 0 END) AS income_paise,
            SUM(CASE WHEN e.kind = 'expense' THEN e.amount_paise ELSE 0 END) AS expense_paise
       FROM entries e
       LEFT JOIN plots pl ON pl.id = e.plot_id
       LEFT JOIN heads h  ON h.id  = e.head_id
      WHERE e.is_deleted = 0 AND e.kind IN ('income','expense')
        AND e.date >= ? AND e.date <= ?
      GROUP BY e.plot_id, e.head_id
      HAVING income_paise > 0 OR expense_paise > 0
      ORDER BY pl.sort_order, income_paise DESC;`,
    [from, to],
  )

/* ------------------------------------------------------------------ *
 * Labour reporting
 * ------------------------------------------------------------------ */

export interface DuesRow {
  labourer_id: string
  name_en: string
  name_kn: string
  phone: string | null
  days: number
  person_days: number
  earned_paise: number
  paid_paise: number
  balance_paise: number
}

/** Everyone with a non-zero position, for the dues summary. */
export const labourDues = () =>
  all<DuesRow>(
    `SELECT l.id AS labourer_id, l.name_en, l.name_kn, l.phone,
            COALESCE(w.days, 0) AS days,
            COALESCE(w.person_days, 0) AS person_days,
            COALESCE(w.earned, 0) AS earned_paise,
            COALESCE(p.paid, 0) AS paid_paise,
            COALESCE(w.earned, 0) - COALESCE(p.paid, 0) AS balance_paise
       FROM labourers l
       LEFT JOIN (SELECT labourer_id, SUM(amount_paise) AS earned,
                         SUM(day_fraction)/1000.0 AS days,
                         SUM(day_fraction*group_size)/1000.0 AS person_days
                    FROM attendance WHERE is_deleted = 0 GROUP BY labourer_id) w
              ON w.labourer_id = l.id
       LEFT JOIN (SELECT labourer_id, SUM(amount_paise) AS paid
                    FROM labour_payments WHERE is_deleted = 0 GROUP BY labourer_id) p
              ON p.labourer_id = l.id
      WHERE COALESCE(w.earned,0) <> 0 OR COALESCE(p.paid,0) <> 0
      ORDER BY balance_paise DESC;`,
  )

/** Work done per crop per labourer — the effort side, not the money side. */
export interface EffortRow {
  head_en: string | null
  head_kn: string | null
  activity_en: string | null
  activity_kn: string | null
  person_days: number
  earned_paise: number
}

export const effortByCrop = ({ from, to }: Period) =>
  all<EffortRow>(
    `SELECT h.name_en AS head_en, h.name_kn AS head_kn,
            ac.name_en AS activity_en, ac.name_kn AS activity_kn,
            SUM(a.day_fraction * a.group_size)/1000.0 AS person_days,
            SUM(a.amount_paise) AS earned_paise
       FROM attendance a
       LEFT JOIN heads h       ON h.id  = a.head_id
       LEFT JOIN activities ac ON ac.id = a.activity_id
      WHERE a.is_deleted = 0 AND a.date >= ? AND a.date <= ?
      GROUP BY a.head_id, a.activity_id
      ORDER BY earned_paise DESC;`,
    [from, to],
  )

/* ------------------------------------------------------------------ *
 * Day book
 * ------------------------------------------------------------------ */

export interface DayBookRow {
  date: ISODate
  kind: string
  head_en: string | null
  head_kn: string | null
  sub_en: string | null
  sub_kn: string | null
  activity_en: string | null
  activity_kn: string | null
  account_en: string | null
  account_kn: string | null
  plot_en: string | null
  plot_kn: string | null
  party_name: string | null
  note: string | null
  amount_paise: number
}

export const dayBook = ({ from, to }: Period) =>
  all<DayBookRow>(
    `SELECT e.date, e.kind,
            h.name_en AS head_en, h.name_kn AS head_kn,
            s.name_en AS sub_en, s.name_kn AS sub_kn,
            ac.name_en AS activity_en, ac.name_kn AS activity_kn,
            a.name_en AS account_en, a.name_kn AS account_kn,
            pl.name_en AS plot_en, pl.name_kn AS plot_kn,
            e.party_name, e.note, e.amount_paise
       FROM entries e
       LEFT JOIN heads h       ON h.id  = e.head_id
       LEFT JOIN sub_heads s   ON s.id  = e.sub_head_id
       LEFT JOIN activities ac ON ac.id = e.activity_id
       LEFT JOIN accounts a    ON a.id  = e.account_id
       LEFT JOIN plots pl      ON pl.id = e.plot_id
      WHERE e.is_deleted = 0 AND e.date >= ? AND e.date <= ?
      ORDER BY e.date, e.created_at;`,
    [from, to],
  )
