import { all, one, run, scalar, tx } from '@/db/db'
import { newId } from '@/lib/ids'
import { notifyDataChanged } from '@/hooks/useQuery'
import type {
  Account,
  Activity,
  AreaUnit,
  Bool,
  Head,
  HeadUnit,
  Labourer,
  Plot,
  SubHead,
  Unit,
} from '@/db/types'

/**
 * Reading and writing master data.
 *
 * Master data is DEACTIVATED, never deleted, once anything references it.
 * Deleting a head that transactions point at would orphan them and quietly
 * drop a season's figures out of every report. `remove` therefore checks for
 * references first and downgrades itself to a deactivation when it finds any,
 * telling the caller which it did so the screen can say so.
 */

const nowISO = () => new Date().toISOString()

async function logChange(
  table: string,
  rowId: string,
  action: 'create' | 'update' | 'delete' | 'restore',
  summary: string,
): Promise<void> {
  await run(
    'INSERT INTO change_log (id, table_name, row_id, action, summary, at) VALUES (?, ?, ?, ?, ?, ?);',
    [newId(), table, rowId, action, summary, nowISO()],
  )
}

/**
 * The next free worker code.
 *
 * Derived from the highest existing number rather than a count, so deleting
 * somebody never causes the next person to reuse their code — a reused code on
 * a statement points at the wrong person.
 */
async function nextWorkerCode(): Promise<string> {
  const rows = await all<{ code: string | null }>(
    `SELECT code FROM labourers WHERE code LIKE 'W%';`,
  )
  const highest = rows.reduce((max, r) => {
    const n = parseInt((r.code ?? '').slice(1), 10)
    return Number.isFinite(n) && n > max ? n : max
  }, 0)
  return 'W' + String(highest + 1).padStart(3, '0')
}

/** Next sort_order for a table, so new rows land at the end of the list. */
async function nextOrder(table: string): Promise<number> {
  return (await scalar(`SELECT COALESCE(MAX(sort_order), -1) + 1 FROM ${table};`)) || 0
}

/* ------------------------------------------------------------------ *
 * Reads
 * ------------------------------------------------------------------ */

const activeClause = (includeInactive: boolean) => (includeInactive ? '' : 'WHERE is_active = 1')

export const listAccounts = (includeInactive = false) =>
  all<Account>(
    `SELECT * FROM accounts ${activeClause(includeInactive)} ORDER BY sort_order, name_en;`,
  )

export const listUnits = (includeInactive = false) =>
  all<Unit>(`SELECT * FROM units ${activeClause(includeInactive)} ORDER BY sort_order, name_en;`)

export const listHeads = (includeInactive = false) =>
  all<Head>(`SELECT * FROM heads ${activeClause(includeInactive)} ORDER BY sort_order, name_en;`)

/**
 * Heads for one side of the book.
 *
 * Settings keeps two lists because the two are genuinely different questions:
 * "what do you sell" and "what do you spend on". A crop answers both and is
 * still ONE row — Banana carries `used_for = 'both'` and appears in each list.
 * Splitting it into two rows would read more simply in Settings and would
 * quietly destroy crop profitability, because income and cost would then sit
 * on two head ids that nothing joins back together.
 */
export const listHeadsFor = (side: 'income' | 'expense', includeInactive = false) =>
  all<Head>(
    `SELECT * FROM heads
      WHERE used_for IN (?, 'both') ${includeInactive ? '' : 'AND is_active = 1'}
      ORDER BY sort_order, name_en;`,
    [side],
  )

/**
 * Expense sub-heads: the global ones plus any scoped to a crop.
 * Grades (income-only) are excluded — see `listSubHeadsFor`.
 */
export const listSubHeads = (includeInactive = false) =>
  all<SubHead>(
    `SELECT * FROM sub_heads
      WHERE used_for IN ('expense', 'both') ${includeInactive ? '' : 'AND is_active = 1'}
      ORDER BY sort_order, name_en;`,
  )

/** Every sub-head, grades included — for the Settings list. */
export const listAllSubHeads = (includeInactive = false) =>
  all<SubHead>(
    `SELECT * FROM sub_heads ${activeClause(includeInactive)} ORDER BY used_for, sort_order, name_en;`,
  )

/**
 * The sub-heads that apply to one head, on one side of the book.
 *
 * This is what stops the entry screen offering every sub-head in the database
 * for every crop. On the income side it returns the crop's own varieties and
 * grades; on the expense side, the global kinds of spend plus anything scoped
 * to this crop. Both levels of the tree come back in one read — the caller
 * splits them by `parent_id`, which is cheaper than a query per level and
 * keeps the ordering consistent.
 */
export const listSubHeadsFor = (
  headId: string,
  usedFor: 'income' | 'expense',
  includeInactive = false,
) =>
  all<SubHead>(
    `SELECT * FROM sub_heads
      WHERE used_for IN (?, 'both')
        AND (head_id IS NULL OR head_id = ?)
        ${includeInactive ? '' : 'AND is_active = 1'}
      ORDER BY sort_order, name_en;`,
    [usedFor, headId],
  )

/** Everything filed under one head, both directions — for the Settings tree. */
export const listSubHeadsOfHead = (headId: string, includeInactive = false) =>
  all<SubHead>(
    `SELECT * FROM sub_heads
      WHERE head_id = ? ${includeInactive ? '' : 'AND is_active = 1'}
      ORDER BY used_for, sort_order, name_en;`,
    [headId],
  )

export const listActivities = (includeInactive = false) =>
  all<Activity>(
    `SELECT * FROM activities ${activeClause(includeInactive)} ORDER BY sort_order, name_en;`,
  )

export const listPlots = (includeInactive = false) =>
  all<Plot>(`SELECT * FROM plots ${activeClause(includeInactive)} ORDER BY sort_order, name_en;`)

export const listLabourers = (includeInactive = false) =>
  all<Labourer>(
    `SELECT * FROM labourers ${activeClause(includeInactive)} ORDER BY is_group_lead DESC, sort_order, name_en;`,
  )

export const getHeadUnits = (headId: string) =>
  all<HeadUnit & { short_en: string; short_kn: string; name_en: string; name_kn: string }>(
    `SELECT hu.head_id, hu.unit_id, hu.is_default,
            u.short_en, u.short_kn, u.name_en, u.name_kn
       FROM head_units hu
       JOIN units u ON u.id = hu.unit_id
      WHERE hu.head_id = ?
      ORDER BY hu.is_default DESC, u.sort_order;`,
    [headId],
  )

/* ------------------------------------------------------------------ *
 * Writes
 * ------------------------------------------------------------------ */

export interface AccountInput {
  id?: string
  name_en: string
  name_kn: string
  kind: Account['kind']
  opening_balance_paise: number
  bank_name: string | null
  account_last4: string | null
}

export async function saveAccount(input: AccountInput): Promise<string> {
  const ts = nowISO()
  if (input.id) {
    await run(
      `UPDATE accounts SET name_en=?, name_kn=?, kind=?, opening_balance_paise=?,
              bank_name=?, account_last4=?, updated_at=? WHERE id=?;`,
      [
        input.name_en, input.name_kn, input.kind, input.opening_balance_paise,
        input.bank_name, input.account_last4, ts, input.id,
      ],
    )
    await logChange('accounts', input.id, 'update', input.name_en)
    notifyDataChanged()
    return input.id
  }

  const id = newId()
  await run(
    `INSERT INTO accounts
       (id, name_en, name_kn, kind, opening_balance_paise, bank_name, account_last4,
        is_active, sort_order, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?);`,
    [
      id, input.name_en, input.name_kn, input.kind, input.opening_balance_paise,
      input.bank_name, input.account_last4, await nextOrder('accounts'), ts, ts,
    ],
  )
  await logChange('accounts', id, 'create', input.name_en)
  notifyDataChanged()
  return id
}

export interface HeadInput {
  id?: string
  name_en: string
  name_kn: string
  used_for: Head['used_for']
  color: string
  /** Unit ids this head may be sold in; the first is the default. */
  unitIds: string[]
}

export async function saveHead(input: HeadInput): Promise<string> {
  const ts = nowISO()
  const id = input.id ?? newId()
  const order = input.id ? null : await nextOrder('heads')

  await tx(async (exec) => {
    if (input.id) {
      await exec(
        'UPDATE heads SET name_en=?, name_kn=?, used_for=?, color=?, updated_at=? WHERE id=?;',
        [input.name_en, input.name_kn, input.used_for, input.color, ts, id],
      )
    } else {
      await exec(
        `INSERT INTO heads (id, name_en, name_kn, used_for, color, icon, is_active, sort_order, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, NULL, 1, ?, ?, ?);`,
        [id, input.name_en, input.name_kn, input.used_for, input.color, order, ts, ts],
      )
    }

    // Replace the unit set wholesale: the form always sends the full list, and
    // diffing it would only add a way for the two to drift apart.
    await exec('DELETE FROM head_units WHERE head_id = ?;', [id])
    for (let i = 0; i < input.unitIds.length; i++) {
      await exec('INSERT INTO head_units (head_id, unit_id, is_default) VALUES (?, ?, ?);', [
        id,
        input.unitIds[i],
        i === 0 ? 1 : 0,
      ])
    }
  })

  await logChange('heads', id, input.id ? 'update' : 'create', input.name_en)
  notifyDataChanged()
  return id
}

export interface SubHeadInput {
  id?: string
  name_en: string
  name_kn: string
  is_labour: Bool
  /** Scopes a grade to one crop. Null keeps it global. */
  head_id?: string | null
  used_for?: 'income' | 'expense' | 'both'
  /** The variety this grade sits under. Null for a top-level row. */
  parent_id?: string | null
}

export async function saveSubHead(input: SubHeadInput): Promise<string> {
  const ts = nowISO()
  const headId = input.head_id ?? null
  const usedFor = input.used_for ?? 'expense'
  const parentId = input.parent_id ?? null

  if (input.id) {
    await run(
      `UPDATE sub_heads SET name_en=?, name_kn=?, is_labour=?, head_id=?, used_for=?,
              parent_id=?, updated_at=?
       WHERE id=?;`,
      [
        input.name_en, input.name_kn, input.is_labour, headId, usedFor, parentId, ts,
        input.id,
      ],
    )
    await logChange('sub_heads', input.id, 'update', input.name_en)
    notifyDataChanged()
    return input.id
  }

  const id = newId()
  await run(
    `INSERT INTO sub_heads
       (id, name_en, name_kn, is_labour, head_id, used_for, parent_id,
        is_active, sort_order, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?);`,
    [
      id, input.name_en, input.name_kn, input.is_labour, headId, usedFor, parentId,
      await nextOrder('sub_heads'), ts, ts,
    ],
  )
  await logChange('sub_heads', id, 'create', input.name_en)
  notifyDataChanged()
  return id
}

export interface ActivityInput {
  id?: string
  name_en: string
  name_kn: string
  sub_head_id: string | null
}

export async function saveActivity(input: ActivityInput): Promise<string> {
  const ts = nowISO()
  if (input.id) {
    await run(
      'UPDATE activities SET name_en=?, name_kn=?, sub_head_id=?, updated_at=? WHERE id=?;',
      [input.name_en, input.name_kn, input.sub_head_id, ts, input.id],
    )
    await logChange('activities', input.id, 'update', input.name_en)
    notifyDataChanged()
    return input.id
  }

  const id = newId()
  await run(
    `INSERT INTO activities (id, name_en, name_kn, sub_head_id, is_active, sort_order, created_at, updated_at)
     VALUES (?, ?, ?, ?, 1, ?, ?, ?);`,
    [id, input.name_en, input.name_kn, input.sub_head_id, await nextOrder('activities'), ts, ts],
  )
  await logChange('activities', id, 'create', input.name_en)
  notifyDataChanged()
  return id
}

export interface PlotInput {
  id?: string
  name_en: string
  name_kn: string
  survey_no: string | null
  /** Integer milli-units of `area_unit`. */
  area_milli: number | null
  area_unit: AreaUnit | null
  village: string | null
  note: string | null
}

export async function savePlot(input: PlotInput): Promise<string> {
  const ts = nowISO()
  if (input.id) {
    await run(
      `UPDATE plots SET name_en=?, name_kn=?, survey_no=?, area_milli=?, area_unit=?,
              village=?, note=?, updated_at=?
       WHERE id=?;`,
      [
        input.name_en, input.name_kn, input.survey_no, input.area_milli, input.area_unit,
        input.village, input.note, ts, input.id,
      ],
    )
    await logChange('plots', input.id, 'update', input.name_en)
    notifyDataChanged()
    return input.id
  }

  const id = newId()
  await run(
    `INSERT INTO plots
       (id, name_en, name_kn, survey_no, area_milli, area_unit, village, note,
        is_active, sort_order, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?);`,
    [
      id, input.name_en, input.name_kn, input.survey_no, input.area_milli, input.area_unit,
      input.village, input.note, await nextOrder('plots'), ts, ts,
    ],
  )
  await logChange('plots', id, 'create', input.name_en)
  notifyDataChanged()
  return id
}

export interface LabourerInput {
  id?: string
  name_en: string
  name_kn: string
  phone: string | null
  village: string | null
  is_group_lead: Bool
  daily_rate_paise: number
  half_day_rate_paise: number | null
  female_rate_paise: number | null
  typical_group_size: number | null
  note: string | null
}

export async function saveLabourer(input: LabourerInput): Promise<string> {
  const ts = nowISO()
  if (input.id) {
    // Changing the rate here affects FUTURE work only. Past attendance rows
    // carry their own snapshot and must not be touched — see CLAUDE.md rule 6.
    await run(
      `UPDATE labourers SET name_en=?, name_kn=?, phone=?, village=?, is_group_lead=?,
              daily_rate_paise=?, half_day_rate_paise=?, female_rate_paise=?,
              typical_group_size=?, note=?, updated_at=?
       WHERE id=?;`,
      [
        input.name_en, input.name_kn, input.phone, input.village, input.is_group_lead,
        input.daily_rate_paise, input.half_day_rate_paise, input.female_rate_paise,
        input.typical_group_size, input.note, ts, input.id,
      ],
    )
    await logChange('labourers', input.id, 'update', input.name_en)
    notifyDataChanged()
    return input.id
  }

  const id = newId()
  const code = await nextWorkerCode()
  await run(
    `INSERT INTO labourers
       (id, code, name_en, name_kn, phone, village, is_group_lead, daily_rate_paise,
        half_day_rate_paise, female_rate_paise, typical_group_size, note,
        is_active, sort_order, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?);`,
    [
      id, code, input.name_en, input.name_kn, input.phone, input.village, input.is_group_lead,
      input.daily_rate_paise, input.half_day_rate_paise, input.female_rate_paise,
      input.typical_group_size, input.note, await nextOrder('labourers'), ts, ts,
    ],
  )
  await logChange('labourers', id, 'create', input.name_en)
  notifyDataChanged()
  return id
}

/* ------------------------------------------------------------------ *
 * Retiring and removing
 * ------------------------------------------------------------------ */

export async function setActive(table: string, id: string, active: boolean): Promise<void> {
  await run(`UPDATE ${table} SET is_active = ?, updated_at = ? WHERE id = ?;`, [
    active ? 1 : 0,
    nowISO(),
    id,
  ])
  await logChange(table, id, active ? 'restore' : 'update', active ? 'reactivated' : 'deactivated')
  notifyDataChanged()
}

/** Where each master table can be referenced from. */
const REFERENCES: Record<string, [table: string, column: string][]> = {
  accounts: [
    ['entries', 'account_id'],
    ['entries', 'to_account_id'],
    ['labour_payments', 'account_id'],
  ],
  heads: [
    ['entries', 'head_id'],
    ['attendance', 'head_id'],
    ['work_sessions', 'head_id'],
  ],
  sub_heads: [
    ['entries', 'sub_head_id'],
    ['activities', 'sub_head_id'],
    ['work_sessions', 'sub_head_id'],
    // A variety with grades under it must be retired, not deleted, or the
    // grades are orphaned and every sale filed under them loses its variety.
    ['sub_heads', 'parent_id'],
  ],
  activities: [
    ['entries', 'activity_id'],
    ['attendance', 'activity_id'],
    ['work_sessions', 'activity_id'],
  ],
  labourers: [
    ['attendance', 'labourer_id'],
    ['labour_payments', 'labourer_id'],
  ],
  plots: [
    ['entries', 'plot_id'],
    ['attendance', 'plot_id'],
    ['work_sessions', 'plot_id'],
  ],
  units: [
    ['entries', 'unit_id'],
    ['head_units', 'unit_id'],
  ],
}

export async function referenceCount(table: string, id: string): Promise<number> {
  let total = 0
  for (const [refTable, column] of REFERENCES[table] ?? []) {
    total += await scalar(`SELECT COUNT(*) FROM ${refTable} WHERE ${column} = ?;`, [id])
  }
  return total
}

export type RemoveResult = 'deleted' | 'deactivated'

/**
 * Delete if nothing points at it, otherwise deactivate.
 *
 * The farmer does not need to know the difference in advance — they tap
 * "remove" and the row leaves the list either way. The distinction matters
 * only to the reports, which keep working.
 */
export async function remove(table: string, id: string, label: string): Promise<RemoveResult> {
  const refs = await referenceCount(table, id)
  if (refs > 0) {
    await setActive(table, id, false)
    return 'deactivated'
  }

  if (table === 'heads') await run('DELETE FROM head_units WHERE head_id = ?;', [id])
  await run(`DELETE FROM ${table} WHERE id = ?;`, [id])
  await logChange(table, id, 'delete', label)
  notifyDataChanged()
  return 'deleted'
}

/* ------------------------------------------------------------------ *
 * Farm profile — key/value, printed on every statement
 * ------------------------------------------------------------------ */

export interface FarmProfile {
  farm_name: string
  owner_name: string
  village: string
  phone: string
}

const PROFILE_KEYS: (keyof FarmProfile)[] = ['farm_name', 'owner_name', 'village', 'phone']

export async function getFarmProfile(): Promise<FarmProfile> {
  const rows = await all<{ key: string; value: string }>(
    `SELECT key, value FROM settings WHERE key IN (${PROFILE_KEYS.map(() => '?').join(',')});`,
    PROFILE_KEYS,
  )
  const map = new Map(rows.map((r) => [r.key, r.value]))
  return {
    farm_name: map.get('farm_name') ?? '',
    owner_name: map.get('owner_name') ?? '',
    village: map.get('village') ?? '',
    phone: map.get('phone') ?? '',
  }
}

export async function saveFarmProfile(profile: FarmProfile): Promise<void> {
  await tx(async (exec) => {
    for (const key of PROFILE_KEYS) {
      await exec('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?);', [key, profile[key]])
    }
  })
  notifyDataChanged()
}

export async function getSetting(key: string): Promise<string | null> {
  const row = await one<{ value: string }>('SELECT value FROM settings WHERE key = ?;', [key])
  return row?.value ?? null
}

export async function setSetting(key: string, value: string): Promise<void> {
  await run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?);', [key, value])
  notifyDataChanged()
}
