import { all, run, tx } from '@/db/db'
import { newId } from '@/lib/ids'
import { notifyDataChanged } from '@/hooks/useQuery'
import type { Entry, EntryKind, ISODate } from '@/db/types'

/**
 * Income, expense and transfer entries.
 *
 * `amount_paise` is always positive; direction comes from `kind`, never from a
 * sign. A signed amount means every query has to remember which way round the
 * convention went, and one that forgets produces a total that is wrong by
 * twice the figure rather than obviously broken.
 */

const nowISO = () => new Date().toISOString()

export interface EntryInput {
  id?: string
  kind: EntryKind
  date: ISODate
  head_id?: string | null
  sub_head_id?: string | null
  activity_id?: string | null
  plot_id?: string | null
  account_id?: string | null
  to_account_id?: string | null
  quantity_milli?: number | null
  unit_id?: string | null
  rate_paise?: number | null
  amount_paise: number
  party_name?: string | null
  note?: string | null
  photo_id?: string | null
  labour_payment_id?: string | null
}

export async function saveEntry(input: EntryInput): Promise<string> {
  const ts = nowISO()
  const id = input.id ?? newId()

  const values = [
    input.kind,
    input.date,
    input.head_id ?? null,
    input.sub_head_id ?? null,
    input.activity_id ?? null,
    input.plot_id ?? null,
    input.account_id ?? null,
    input.to_account_id ?? null,
    input.quantity_milli ?? null,
    input.unit_id ?? null,
    input.rate_paise ?? null,
    Math.abs(Math.round(input.amount_paise)),
    input.party_name ?? null,
    input.note ?? null,
    input.photo_id ?? null,
    input.labour_payment_id ?? null,
  ]

  if (input.id) {
    await run(
      `UPDATE entries SET kind=?, date=?, head_id=?, sub_head_id=?, activity_id=?,
              plot_id=?, account_id=?, to_account_id=?, quantity_milli=?, unit_id=?,
              rate_paise=?, amount_paise=?, party_name=?, note=?, photo_id=?,
              labour_payment_id=?, updated_at=?
         WHERE id=?;`,
      [...values, ts, id],
    )
  } else {
    await run(
      `INSERT INTO entries
         (kind, date, head_id, sub_head_id, activity_id, plot_id, account_id, to_account_id,
          quantity_milli, unit_id, rate_paise, amount_paise, party_name, note,
          photo_id, labour_payment_id, is_deleted, created_at, updated_at, id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?);`,
      [...values, ts, ts, id],
    )
  }

  await run(
    'INSERT INTO change_log (id, table_name, row_id, action, summary, at) VALUES (?, ?, ?, ?, ?, ?);',
    [newId(), 'entries', id, input.id ? 'update' : 'create', `${input.kind} ${input.amount_paise}`, ts],
  )
  notifyDataChanged()
  return id
}

/**
 * Soft delete. Reports filter these out; nothing is ever really removed,
 * because "where did that ₹4,000 go" is a question that gets asked months
 * later and an absent row cannot answer it.
 */
export async function deleteEntry(id: string): Promise<void> {
  const ts = nowISO()
  await run('UPDATE entries SET is_deleted = 1, updated_at = ? WHERE id = ?;', [ts, id])
  await run(
    'INSERT INTO change_log (id, table_name, row_id, action, summary, at) VALUES (?, ?, ?, ?, ?, ?);',
    [newId(), 'entries', id, 'delete', null, ts],
  )
  notifyDataChanged()
}

export async function restoreEntry(id: string): Promise<void> {
  await run('UPDATE entries SET is_deleted = 0, updated_at = ? WHERE id = ?;', [nowISO(), id])
  notifyDataChanged()
}

/* ------------------------------------------------------------------ *
 * Reads
 * ------------------------------------------------------------------ */

/** An entry joined to the names it needs, so a list is one query. */
export interface EntryRow extends Entry {
  head_name_en: string | null
  head_name_kn: string | null
  head_color: string | null
  sub_head_name_en: string | null
  sub_head_name_kn: string | null
  activity_name_en: string | null
  activity_name_kn: string | null
  account_name_en: string | null
  account_name_kn: string | null
  to_account_name_en: string | null
  to_account_name_kn: string | null
  unit_short_en: string | null
  unit_short_kn: string | null
  plot_name_en: string | null
  plot_name_kn: string | null
}

const ENTRY_SELECT = `
  SELECT e.*,
         h.name_en  AS head_name_en,  h.name_kn  AS head_name_kn, h.color AS head_color,
         s.name_en  AS sub_head_name_en, s.name_kn AS sub_head_name_kn,
         ac.name_en AS activity_name_en, ac.name_kn AS activity_name_kn,
         a.name_en  AS account_name_en, a.name_kn AS account_name_kn,
         a2.name_en AS to_account_name_en, a2.name_kn AS to_account_name_kn,
         u.short_en AS unit_short_en, u.short_kn AS unit_short_kn,
         pl.name_en AS plot_name_en, pl.name_kn AS plot_name_kn
    FROM entries e
    LEFT JOIN heads      h  ON h.id  = e.head_id
    LEFT JOIN sub_heads  s  ON s.id  = e.sub_head_id
    LEFT JOIN activities ac ON ac.id = e.activity_id
    LEFT JOIN accounts   a  ON a.id  = e.account_id
    LEFT JOIN accounts   a2 ON a2.id = e.to_account_id
    LEFT JOIN units      u  ON u.id  = e.unit_id
    LEFT JOIN plots      pl ON pl.id = e.plot_id
`

export type EntrySort = 'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc'

export interface EntryFilter {
  kind?: EntryKind
  headId?: string
  subHeadId?: string
  activityId?: string
  accountId?: string
  unitId?: string
  plotId?: string
  from?: ISODate
  to?: ISODate
  minPaise?: number
  maxPaise?: number
  search?: string
  sort?: EntrySort
  limit?: number
}

const ORDER_BY: Record<EntrySort, string> = {
  // created_at breaks the tie so two entries on one day keep the order they
  // were typed in, which is the order the farmer remembers them in.
  'date-desc': 'e.date DESC, e.created_at DESC',
  'date-asc': 'e.date ASC, e.created_at ASC',
  'amount-desc': 'e.amount_paise DESC, e.date DESC',
  'amount-asc': 'e.amount_paise ASC, e.date DESC',
}

export async function listEntries(filter: EntryFilter = {}): Promise<EntryRow[]> {
  const where: string[] = ['e.is_deleted = 0']
  const params: unknown[] = []

  if (filter.kind) {
    where.push('e.kind = ?')
    params.push(filter.kind)
  }
  if (filter.headId) {
    where.push('e.head_id = ?')
    params.push(filter.headId)
  }
  if (filter.subHeadId) {
    where.push('e.sub_head_id = ?')
    params.push(filter.subHeadId)
  }
  if (filter.activityId) {
    where.push('e.activity_id = ?')
    params.push(filter.activityId)
  }
  if (filter.unitId) {
    where.push('e.unit_id = ?')
    params.push(filter.unitId)
  }
  if (filter.plotId) {
    where.push('e.plot_id = ?')
    params.push(filter.plotId)
  }
  if (filter.accountId) {
    where.push('(e.account_id = ? OR e.to_account_id = ?)')
    params.push(filter.accountId, filter.accountId)
  }
  if (filter.minPaise != null) {
    where.push('e.amount_paise >= ?')
    params.push(filter.minPaise)
  }
  if (filter.maxPaise != null) {
    where.push('e.amount_paise <= ?')
    params.push(filter.maxPaise)
  }
  if (filter.from) {
    where.push('e.date >= ?')
    params.push(filter.from)
  }
  if (filter.to) {
    where.push('e.date <= ?')
    params.push(filter.to)
  }
  if (filter.search?.trim()) {
    where.push('(e.party_name LIKE ? OR e.note LIKE ?)')
    const like = `%${filter.search.trim()}%`
    params.push(like, like)
  }

  const sql = `${ENTRY_SELECT} WHERE ${where.join(' AND ')}
               ORDER BY ${ORDER_BY[filter.sort ?? 'date-desc']}
               LIMIT ${Math.max(1, Math.min(filter.limit ?? 200, 2000))};`

  return all<EntryRow>(sql, params)
}

/**
 * How many filters are narrowing the list.
 *
 * Lives here rather than beside the filter sheet so that file exports only
 * components — mixing the two breaks Fast Refresh, and the last time that
 * happened it crashed every screen below the provider until a full reload.
 */
export function activeFilterCount(f: EntryFilter): number {
  return [
    f.headId, f.subHeadId, f.activityId, f.accountId, f.unitId, f.plotId,
    f.from, f.to, f.minPaise, f.maxPaise,
  ].filter((v) => v != null && v !== '').length
}

/** The totals for whatever the current filter matches. */
export async function filteredTotals(
  filter: EntryFilter,
): Promise<{ count: number; total: number }> {
  const rows = await listEntries({ ...filter, limit: 2000 })
  return {
    count: rows.length,
    total: rows.reduce((s, r) => s + r.amount_paise, 0),
  }
}

export async function getEntry(id: string): Promise<EntryRow | null> {
  const rows = await all<EntryRow>(`${ENTRY_SELECT} WHERE e.id = ?;`, [id])
  return rows[0] ?? null
}

/* ------------------------------------------------------------------ *
 * Balances
 * ------------------------------------------------------------------ */

export interface AccountBalance {
  account_id: string
  name_en: string
  name_kn: string
  kind: string
  balance_paise: number
}

/**
 * Opening balance, plus what came in, minus what went out, plus transfers in,
 * minus transfers out — computed in SQL so it stays correct as rows grow.
 */
export async function accountBalances(upTo?: ISODate): Promise<AccountBalance[]> {
  const dateClause = upTo ? 'AND e.date <= ?' : ''
  const p = (n: number) => (upTo ? Array(n).fill(upTo) : [])

  return all<AccountBalance>(
    `SELECT a.id AS account_id, a.name_en, a.name_kn, a.kind,
            a.opening_balance_paise
            + COALESCE((SELECT SUM(e.amount_paise) FROM entries e
                         WHERE e.is_deleted = 0 AND e.kind = 'income'
                           AND e.account_id = a.id ${dateClause}), 0)
            - COALESCE((SELECT SUM(e.amount_paise) FROM entries e
                         WHERE e.is_deleted = 0 AND e.kind = 'expense'
                           AND e.account_id = a.id ${dateClause}), 0)
            + COALESCE((SELECT SUM(e.amount_paise) FROM entries e
                         WHERE e.is_deleted = 0 AND e.kind = 'transfer'
                           AND e.to_account_id = a.id ${dateClause}), 0)
            - COALESCE((SELECT SUM(e.amount_paise) FROM entries e
                         WHERE e.is_deleted = 0 AND e.kind = 'transfer'
                           AND e.account_id = a.id ${dateClause}), 0)
            AS balance_paise
       FROM accounts a
      WHERE a.is_active = 1
      ORDER BY a.sort_order, a.name_en;`,
    [...p(4)],
  )
}

/* ------------------------------------------------------------------ *
 * Aggregates for the dashboard and reports
 * ------------------------------------------------------------------ */

export interface KindTotal {
  kind: EntryKind
  total: number
}

export const totalsByKind = (from: ISODate, to: ISODate) =>
  all<KindTotal>(
    `SELECT kind, SUM(amount_paise) AS total
       FROM entries
      WHERE is_deleted = 0 AND date >= ? AND date <= ?
      GROUP BY kind;`,
    [from, to],
  )

export interface HeadTotal {
  head_id: string | null
  name_en: string | null
  name_kn: string | null
  color: string | null
  total: number
}

export const totalsByHead = (kind: EntryKind, from: ISODate, to: ISODate) =>
  all<HeadTotal>(
    `SELECT e.head_id, h.name_en, h.name_kn, h.color, SUM(e.amount_paise) AS total
       FROM entries e
       LEFT JOIN heads h ON h.id = e.head_id
      WHERE e.is_deleted = 0 AND e.kind = ? AND e.date >= ? AND e.date <= ?
      GROUP BY e.head_id
      ORDER BY total DESC;`,
    [kind, from, to],
  )

export const expenseTotalsBySubHead = (from: ISODate, to: ISODate) =>
  all<HeadTotal>(
    `SELECT e.sub_head_id AS head_id, s.name_en, s.name_kn, NULL AS color,
            SUM(e.amount_paise) AS total
       FROM entries e
       LEFT JOIN sub_heads s ON s.id = e.sub_head_id
      WHERE e.is_deleted = 0 AND e.kind = 'expense' AND e.date >= ? AND e.date <= ?
      GROUP BY e.sub_head_id
      ORDER BY total DESC;`,
    [from, to],
  )

/** Quantity and value sold per head — the yield side of a crop's story. */
export interface YieldRow {
  head_id: string | null
  name_en: string | null
  name_kn: string | null
  unit_short_en: string | null
  unit_short_kn: string | null
  quantity_milli: number
  total_paise: number
}

export const yieldByHead = (from: ISODate, to: ISODate) =>
  all<YieldRow>(
    `SELECT e.head_id, h.name_en, h.name_kn,
            u.short_en AS unit_short_en, u.short_kn AS unit_short_kn,
            SUM(COALESCE(e.quantity_milli, 0)) AS quantity_milli,
            SUM(e.amount_paise) AS total_paise
       FROM entries e
       LEFT JOIN heads h ON h.id = e.head_id
       LEFT JOIN units u ON u.id = e.unit_id
      WHERE e.is_deleted = 0 AND e.kind = 'income' AND e.date >= ? AND e.date <= ?
      GROUP BY e.head_id, e.unit_id
      ORDER BY total_paise DESC;`,
    [from, to],
  )

/**
 * What each crop actually fetched per unit, month by month.
 *
 * Derived from the money and the quantity rather than the rate column, because
 * the rate is what was quoted and the total is what was paid — the trader
 * rounds, and only the total is real. Rows without a quantity are skipped
 * entirely: a sale recorded as a lump sum has no meaningful per-unit price and
 * averaging it in would drag the line somewhere untrue.
 */
export interface PriceRow {
  month: string
  head_id: string | null
  name_en: string | null
  name_kn: string | null
  color: string | null
  unit_short_en: string | null
  unit_short_kn: string | null
  quantity_milli: number
  total_paise: number
}

export const priceHistory = (from: ISODate, to: ISODate) =>
  all<PriceRow>(
    `SELECT substr(e.date, 1, 7) AS month, e.head_id,
            h.name_en, h.name_kn, h.color,
            u.short_en AS unit_short_en, u.short_kn AS unit_short_kn,
            SUM(e.quantity_milli) AS quantity_milli,
            SUM(e.amount_paise) AS total_paise
       FROM entries e
       LEFT JOIN heads h ON h.id = e.head_id
       LEFT JOIN units u ON u.id = e.unit_id
      WHERE e.is_deleted = 0 AND e.kind = 'income'
        AND e.quantity_milli IS NOT NULL AND e.quantity_milli > 0
        AND e.date >= ? AND e.date <= ?
      GROUP BY month, e.head_id, e.unit_id
      ORDER BY month;`,
    [from, to],
  )

/** Twelve months of income against expense, for the dashboard trend. */
export interface MonthTotal {
  month: string
  income: number
  expense: number
}

export const monthlyTotals = (from: ISODate, to: ISODate) =>
  all<MonthTotal>(
    `SELECT substr(date, 1, 7) AS month,
            SUM(CASE WHEN kind = 'income'  THEN amount_paise ELSE 0 END) AS income,
            SUM(CASE WHEN kind = 'expense' THEN amount_paise ELSE 0 END) AS expense
       FROM entries
      WHERE is_deleted = 0 AND date >= ? AND date <= ?
      GROUP BY month
      ORDER BY month;`,
    [from, to],
  )

/* ------------------------------------------------------------------ *
 * Photos
 * ------------------------------------------------------------------ */

export async function savePhoto(dataUrl: string): Promise<string> {
  const id = newId()
  const ts = nowISO()
  await run(
    'INSERT INTO photos (id, entry_id, data, bytes, created_at, updated_at) VALUES (?, NULL, ?, ?, ?, ?);',
    [id, dataUrl, dataUrl.length, ts, ts],
  )
  return id
}

export async function getPhoto(id: string): Promise<string | null> {
  const rows = await all<{ data: string }>('SELECT data FROM photos WHERE id = ?;', [id])
  return rows[0]?.data ?? null
}

export async function linkPhotoToEntry(photoId: string, entryId: string): Promise<void> {
  await tx(async (exec) => {
    await exec('UPDATE photos SET entry_id = ? WHERE id = ?;', [entryId, photoId])
    await exec('UPDATE entries SET photo_id = ? WHERE id = ?;', [photoId, entryId])
  })
  notifyDataChanged()
}
