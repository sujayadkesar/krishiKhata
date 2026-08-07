import { all, one, run, tx } from '@/db/db'
import { newId } from '@/lib/ids'
import { notifyDataChanged } from '@/hooks/useQuery'
import { attendanceAmountPaise, matchFifo } from '@/lib/labour'
import type { Alloc, OpenPayment, OpenWork } from '@/lib/labour'
import type { Bool, ISODate, PaymentMode } from '@/db/types'

/**
 * The labour ledger.
 *
 * The whole design turns on one separation: ATTENDANCE records work, PAYMENTS
 * record money. Attendance builds each labourer's khata and every worked-day
 * statistic but moves nothing in the books, because this app keeps cash-basis
 * accounts — the expense appears on the day the wage is actually paid.
 *
 * ALLOCATIONS join the two, oldest work first. That is what keeps crop-wise
 * costing honest on a cash basis: the payment is the expense, but which crop it
 * belongs to is knowable only through the work days it settles.
 */

const nowISO = () => new Date().toISOString()

/* ------------------------------------------------------------------ *
 * Recording work
 * ------------------------------------------------------------------ */

export interface WorkDay {
  labourer_id: string
  date: ISODate
  /** FULL_DAY (1000) or HALF_DAY (500). */
  day_fraction: number
  group_size: number
  is_group: Bool
  /** Snapshotted from the labourer at entry time. Never re-read later. */
  daily_rate_paise: number
  half_day_rate_paise: number | null
  member_names?: string | null
}

export interface WorkSessionInput {
  head_id: string | null
  activity_id: string | null
  sub_head_id: string | null
  note: string | null
  days: WorkDay[]
}

/**
 * Save one engagement and all its days.
 *
 * Written as a single transaction because a session with only half its days
 * recorded is worse than none: the farmer sees the entry, believes the week is
 * captured, and only finds the gap when someone disputes their wages.
 */
export async function saveWorkSession(input: WorkSessionInput): Promise<string> {
  const ts = nowISO()
  const sessionId = newId()

  await tx(async (exec) => {
    await exec(
      `INSERT INTO work_sessions (id, head_id, activity_id, sub_head_id, note, is_deleted, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 0, ?, ?);`,
      [sessionId, input.head_id, input.activity_id, input.sub_head_id, input.note, ts, ts],
    )

    for (const d of input.days) {
      const amount = attendanceAmountPaise(
        d.day_fraction,
        d.daily_rate_paise,
        d.half_day_rate_paise,
        d.group_size,
      )
      await exec(
        `INSERT INTO attendance
           (id, work_session_id, labourer_id, date, is_group, group_size, member_names,
            day_fraction, rate_paise, amount_paise, head_id, activity_id, note,
            is_deleted, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 0, ?, ?);`,
        [
          newId(), sessionId, d.labourer_id, d.date, d.is_group, d.group_size,
          d.member_names ?? null, d.day_fraction, d.daily_rate_paise, amount,
          input.head_id, input.activity_id, ts, ts,
        ],
      )
    }
  })

  // New work may settle an advance the labourer is already holding.
  const touched = new Set(input.days.map((d) => d.labourer_id))
  for (const labourerId of touched) await settleOutstanding(labourerId)

  notifyDataChanged()
  return sessionId
}

export async function deleteAttendance(id: string): Promise<void> {
  await tx(async (exec) => {
    // Allocations against a removed day would leave payments pointing at work
    // that no longer exists, so they are released back to unallocated first.
    await exec('DELETE FROM payment_allocations WHERE attendance_id = ?;', [id])
    await exec('UPDATE attendance SET is_deleted = 1, updated_at = ? WHERE id = ?;', [nowISO(), id])
  })
  notifyDataChanged()
}

/* ------------------------------------------------------------------ *
 * The open sides of the ledger
 * ------------------------------------------------------------------ */

export interface OpenWorkRow extends OpenWork {
  head_id: string | null
  amount_paise: number
  day_fraction: number
  group_size: number
}

/** Work days not yet fully covered by a payment, oldest first. */
export function openWork(labourerId: string): Promise<OpenWorkRow[]> {
  return all<OpenWorkRow>(
    `SELECT * FROM (
       SELECT a.id AS attendance_id, a.date, a.head_id, a.amount_paise,
              a.day_fraction, a.group_size,
              a.amount_paise - COALESCE(
                (SELECT SUM(pa.amount_paise) FROM payment_allocations pa
                  WHERE pa.attendance_id = a.id), 0) AS unpaid_paise
         FROM attendance a
        WHERE a.labourer_id = ? AND a.is_deleted = 0
     ) WHERE unpaid_paise > 0
     ORDER BY date, attendance_id;`,
    [labourerId],
  )
}

/**
 * Payments with money not yet tied to any work day — advances, in effect.
 *
 * Money the labourer has handed BACK is subtracted from that pool, newest
 * advance first. Without this, repaying an advance in cash would leave the app
 * still believing it was holding money on the farm's behalf, and it would
 * silently absorb the next few days of work the labourer had already been paid
 * back for.
 */
export async function openPayments(labourerId: string): Promise<OpenPayment[]> {
  const advances = await all<OpenPayment>(
    `SELECT * FROM (
       SELECT p.id AS payment_id, p.date,
              p.amount_paise - COALESCE(
                (SELECT SUM(pa.amount_paise) FROM payment_allocations pa
                  WHERE pa.payment_id = p.id), 0) AS unallocated_paise
         FROM labour_payments p
        WHERE p.labourer_id = ? AND p.is_deleted = 0 AND p.direction = 'out'
     ) WHERE unallocated_paise > 0
     ORDER BY date, payment_id;`,
    [labourerId],
  )

  const returned = await one<{ total: number }>(
    `SELECT COALESCE(SUM(amount_paise), 0) AS total FROM labour_payments
      WHERE labourer_id = ? AND is_deleted = 0 AND direction = 'in';`,
    [labourerId],
  )

  let toAbsorb = returned?.total ?? 0
  if (toAbsorb <= 0) return advances

  // Newest first: the most recent advance is the one being repaid.
  for (let i = advances.length - 1; i >= 0 && toAbsorb > 0; i--) {
    const take = Math.min(advances[i].unallocated_paise, toAbsorb)
    advances[i].unallocated_paise -= take
    toAbsorb -= take
  }

  return advances.filter((a) => a.unallocated_paise > 0)
}

async function writeAllocations(allocs: Alloc[]): Promise<void> {
  if (!allocs.length) return
  const ts = nowISO()
  await tx(async (exec) => {
    for (const a of allocs) {
      await exec(
        `INSERT INTO payment_allocations (id, payment_id, attendance_id, amount_paise, created_at)
         VALUES (?, ?, ?, ?, ?);`,
        [newId(), a.payment_id, a.attendance_id, a.amount_paise, ts],
      )
    }
  })
}

/**
 * Match whatever is open on both sides for one labourer.
 *
 * Called after recording work and after taking a payment, because both can
 * create a match: an advance waiting for work, or work waiting for money.
 * `matchFifo` handles both directions, so there is one rule and one place it
 * can be wrong.
 */
export async function settleOutstanding(labourerId: string): Promise<Alloc[]> {
  const [payments, work] = await Promise.all([openPayments(labourerId), openWork(labourerId)])
  const allocs = matchFifo(payments, work)
  await writeAllocations(allocs)
  return allocs
}

/* ------------------------------------------------------------------ *
 * Paying
 * ------------------------------------------------------------------ */

export type PaymentDirection = 'out' | 'in'

export interface PaymentInput {
  labourer_id: string
  date: ISODate
  account_id: string
  amount_paise: number
  mode: PaymentMode
  note: string | null
  /** The sub-head the resulting expense is filed under (a labour one). */
  sub_head_id: string | null
  /** 'out' pays the labourer; 'in' records money they handed back. */
  direction?: PaymentDirection
}

/**
 * Hand over money.
 *
 * This is the point at which an expense exists, and it creates three things
 * that must stand or fall together: the payment, the expense row, and the
 * allocations saying which work it settles.
 *
 * The expense carries a head only when every day it settles belongs to the
 * same crop. A lump sum covering banana and pepper genuinely has no single
 * crop, and picking one would quietly overstate that crop's costs — the
 * crop-wise report reads allocations instead, which know the real split.
 */
export async function recordPayment(input: PaymentInput): Promise<string> {
  const ts = nowISO()
  const paymentId = newId()
  const entryId = newId()
  const direction: PaymentDirection = input.direction ?? 'out'
  const amount = Math.abs(Math.round(input.amount_paise))

  const outstandingBefore = await openWork(input.labourer_id)
  const totalOutstanding = outstandingBefore.reduce((s, w) => s + w.unpaid_paise, 0)
  // Money handed over with no work waiting for it is an advance. This is a
  // label only — the arithmetic is the same either way.
  const isAdvance: Bool = direction === 'out' && totalOutstanding <= 0 ? 1 : 0

  /**
   * Money coming BACK is a negative expense, not income.
   *
   * A returned advance reduces what the farm spent on labour; calling it
   * income would inflate the crop takings with money that was never earned.
   * Recording it negative also means every existing SUM keeps working
   * untouched: expense totals net down, and the cash balance — which
   * subtracts expenses — goes up by the right amount.
   *
   * This is the one place a negative amount_paise is written, and it is
   * always paired with a labour_payment_id.
   */
  const entryAmount = direction === 'in' ? -amount : amount

  await tx(async (exec) => {
    // The ENTRY first. labour_payments.entry_id has a foreign key onto
    // entries(id), so writing the payment first fails with "FOREIGN KEY
    // constraint failed" and no payment can ever be saved. entries has no
    // matching constraint back, so this order is the safe one.
    await exec(
      `INSERT INTO entries
         (id, kind, date, head_id, sub_head_id, activity_id, account_id, to_account_id,
          quantity_milli, unit_id, rate_paise, amount_paise, party_name, note,
          photo_id, labour_payment_id, is_deleted, created_at, updated_at)
       VALUES (?, 'expense', ?, NULL, ?, NULL, ?, NULL, NULL, NULL, NULL, ?, NULL, ?, NULL, ?, 0, ?, ?);`,
      [
        entryId, input.date, input.sub_head_id, input.account_id,
        entryAmount, input.note, paymentId, ts, ts,
      ],
    )

    await exec(
      `INSERT INTO labour_payments
         (id, labourer_id, date, account_id, amount_paise, mode, is_advance, note,
          entry_id, direction, is_deleted, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?);`,
      [
        paymentId, input.labourer_id, input.date, input.account_id,
        amount, input.mode, isAdvance, input.note, entryId, direction, ts, ts,
      ],
    )
  })

  const allocs = await settleOutstanding(input.labourer_id)

  // If everything this payment settled sits on one crop, name it on the expense
  // so the day book reads sensibly.
  const mine = allocs.filter((a) => a.payment_id === paymentId)
  if (mine.length) {
    const heads = new Set(
      mine
        .map((a) => outstandingBefore.find((w) => w.attendance_id === a.attendance_id)?.head_id)
        .filter((h): h is string => !!h),
    )
    if (heads.size === 1) {
      await run('UPDATE entries SET head_id = ? WHERE id = ?;', [[...heads][0], entryId])
    }
  }

  notifyDataChanged()
  return paymentId
}

export async function deletePayment(paymentId: string): Promise<void> {
  const payment = await one<{ entry_id: string | null; labourer_id: string }>(
    'SELECT entry_id, labourer_id FROM labour_payments WHERE id = ?;',
    [paymentId],
  )

  await tx(async (exec) => {
    await exec('DELETE FROM payment_allocations WHERE payment_id = ?;', [paymentId])
    await exec('UPDATE labour_payments SET is_deleted = 1, updated_at = ? WHERE id = ?;', [
      nowISO(),
      paymentId,
    ])
    if (payment?.entry_id) {
      await exec('UPDATE entries SET is_deleted = 1, updated_at = ? WHERE id = ?;', [
        nowISO(),
        payment.entry_id,
      ])
    }
  })

  // Releasing those allocations may free earlier work to be settled by a later
  // payment, so the ledger is re-matched rather than left with a hole.
  if (payment) await settleOutstanding(payment.labourer_id)
  notifyDataChanged()
}

/* ------------------------------------------------------------------ *
 * Balances and statements
 * ------------------------------------------------------------------ */

export interface LabourBalanceRow {
  labourer_id: string
  name_en: string
  name_kn: string
  phone: string | null
  is_group_lead: Bool
  daily_rate_paise: number
  earned_paise: number
  paid_paise: number
  balance_paise: number
  days: number
  person_days: number
  last_worked_on: ISODate | null
  last_paid_on: ISODate | null
}

/**
 * Everyone's position in one query.
 *
 * `days` counts calendar days a half day as half; `person_days` weights by crew
 * size. Both are shown, because for a group lead "he came 6 days" and "that was
 * 72 days of work" are both true and answer different questions.
 */
export function labourBalances(includeInactive = false): Promise<LabourBalanceRow[]> {
  return all<LabourBalanceRow>(
    `SELECT l.id AS labourer_id, l.name_en, l.name_kn, l.phone,
            l.is_group_lead, l.daily_rate_paise,
            COALESCE(w.earned, 0) AS earned_paise,
            COALESCE(p.paid, 0)   AS paid_paise,
            COALESCE(w.earned, 0) - COALESCE(p.paid, 0) AS balance_paise,
            COALESCE(w.days, 0)        AS days,
            COALESCE(w.person_days, 0) AS person_days,
            w.last_worked_on, p.last_paid_on
       FROM labourers l
       LEFT JOIN (
         SELECT labourer_id,
                SUM(amount_paise) AS earned,
                SUM(day_fraction) / 1000.0 AS days,
                SUM(day_fraction * group_size) / 1000.0 AS person_days,
                MAX(date) AS last_worked_on
           FROM attendance WHERE is_deleted = 0 GROUP BY labourer_id
       ) w ON w.labourer_id = l.id
       LEFT JOIN (
         -- Net of anything handed back, so a repaid advance stops counting
         -- as money the labourer has had.
         SELECT labourer_id,
                SUM(CASE WHEN direction = 'in' THEN -amount_paise ELSE amount_paise END) AS paid,
                MAX(date) AS last_paid_on
           FROM labour_payments WHERE is_deleted = 0 GROUP BY labourer_id
       ) p ON p.labourer_id = l.id
      ${includeInactive ? '' : 'WHERE l.is_active = 1'}
      ORDER BY balance_paise DESC, l.name_en;`,
  )
}

export interface AttendanceRow {
  id: string
  date: ISODate
  day_fraction: number
  group_size: number
  is_group: Bool
  rate_paise: number
  amount_paise: number
  head_id: string | null
  head_name_en: string | null
  head_name_kn: string | null
  activity_name_en: string | null
  activity_name_kn: string | null
  paid_paise: number
}

export function attendanceFor(labourerId: string, limit = 400): Promise<AttendanceRow[]> {
  return all<AttendanceRow>(
    `SELECT a.id, a.date, a.day_fraction, a.group_size, a.is_group,
            a.rate_paise, a.amount_paise, a.head_id,
            h.name_en AS head_name_en, h.name_kn AS head_name_kn,
            ac.name_en AS activity_name_en, ac.name_kn AS activity_name_kn,
            COALESCE((SELECT SUM(pa.amount_paise) FROM payment_allocations pa
                       WHERE pa.attendance_id = a.id), 0) AS paid_paise
       FROM attendance a
       LEFT JOIN heads h       ON h.id  = a.head_id
       LEFT JOIN activities ac ON ac.id = a.activity_id
      WHERE a.labourer_id = ? AND a.is_deleted = 0
      ORDER BY a.date DESC, a.created_at DESC
      LIMIT ${Math.max(1, Math.min(limit, 2000))};`,
    [labourerId],
  )
}

export interface PaymentRow {
  id: string
  date: ISODate
  amount_paise: number
  mode: PaymentMode
  is_advance: Bool
  direction: PaymentDirection
  note: string | null
  account_name_en: string | null
  account_name_kn: string | null
  allocated_paise: number
}

export function paymentsFor(labourerId: string, limit = 400): Promise<PaymentRow[]> {
  return all<PaymentRow>(
    `SELECT p.id, p.date, p.amount_paise, p.mode, p.is_advance, p.direction, p.note,
            a.name_en AS account_name_en, a.name_kn AS account_name_kn,
            COALESCE((SELECT SUM(pa.amount_paise) FROM payment_allocations pa
                       WHERE pa.payment_id = p.id), 0) AS allocated_paise
       FROM labour_payments p
       LEFT JOIN accounts a ON a.id = p.account_id
      WHERE p.labourer_id = ? AND p.is_deleted = 0
      ORDER BY p.date DESC, p.created_at DESC
      LIMIT ${Math.max(1, Math.min(limit, 2000))};`,
    [labourerId],
  )
}

/** Days already recorded in a month, so the calendar can show them. */
export interface ExistingDay {
  date: ISODate
  day_fraction: number
  group_size: number
}

export function attendanceInMonth(
  labourerId: string,
  from: ISODate,
  to: ISODate,
): Promise<ExistingDay[]> {
  return all<ExistingDay>(
    `SELECT date, day_fraction, group_size
       FROM attendance
      WHERE labourer_id = ? AND is_deleted = 0 AND date >= ? AND date <= ?;`,
    [labourerId, from, to],
  )
}

/* ------------------------------------------------------------------ *
 * Cash-basis crop attribution
 * ------------------------------------------------------------------ */

export interface LabourCostByHead {
  head_id: string | null
  name_en: string | null
  name_kn: string | null
  color: string | null
  total: number
}

/**
 * Wages PAID in a period, split across crops by the work each payment settled.
 *
 * This is the piece that makes cash-basis accounting compatible with per-crop
 * costing. Rows with a null head are payments that settled work carrying no
 * crop, plus advances not yet worked off; they are returned rather than
 * dropped so the report can show them as their own line.
 */
export function labourCostByHead(from: ISODate, to: ISODate): Promise<LabourCostByHead[]> {
  return all<LabourCostByHead>(
    `SELECT a.head_id, h.name_en, h.name_kn, h.color, SUM(pa.amount_paise) AS total
       FROM payment_allocations pa
       JOIN labour_payments p ON p.id = pa.payment_id AND p.is_deleted = 0
       JOIN attendance a      ON a.id = pa.attendance_id AND a.is_deleted = 0
       LEFT JOIN heads h      ON h.id = a.head_id
      WHERE p.date >= ? AND p.date <= ?
      GROUP BY a.head_id
      ORDER BY total DESC;`,
    [from, to],
  )
}

/** Total wages earned but not yet paid — the line every statement must carry. */
export async function totalOutstandingWages(): Promise<number> {
  const row = await one<{ total: number }>(
    `SELECT COALESCE(SUM(earned), 0) - COALESCE(SUM(paid), 0) AS total FROM (
       SELECT COALESCE((SELECT SUM(amount_paise) FROM attendance
                         WHERE labourer_id = l.id AND is_deleted = 0), 0) AS earned,
              COALESCE((SELECT SUM(CASE WHEN direction = 'in' THEN -amount_paise
                                        ELSE amount_paise END)
                          FROM labour_payments
                         WHERE labourer_id = l.id AND is_deleted = 0), 0) AS paid
         FROM labourers l
     );`,
  )
  return row?.total ?? 0
}
