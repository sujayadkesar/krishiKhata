import { all, one, run, tx } from '@/db/db'
import { newId } from '@/lib/ids'
import { notifyDataChanged } from '@/hooks/useQuery'
import { crewSize, matchFifo, wagePaise } from '@/lib/labour'
import { lineTotalPaise } from '@/lib/quantity'
import { FULL_DAY } from '@/db/types'
import type { Alloc, OpenPayment, OpenWork } from '@/lib/labour'
import type { Bool, ISODate, PaymentMode, WorkBasis } from '@/db/types'

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
  /** FULL_DAY (1000), HALF_DAY (500), or 0 for a salaried month. */
  day_fraction: number
  /**
   * Piece work: how much was done that day, in milli-units. The amount stays
   * 0 until the session is priced.
   */
  quantity_milli?: number | null
  /**
   * Lump-sum work: the figure agreed for the job, used as-is.
   *
   * Coconut plucking is whatever was asked and agreed on the day. There is no
   * rate to multiply and pretending there is one — by dividing by trees, or by
   * days — invents a number nobody quoted.
   */
  amount_paise?: number | null
  is_group: Bool
  /** Snapshotted from the labourer at entry time. Never re-read later. */
  daily_rate_paise: number
  half_day_rate_paise: number | null
  /**
   * A crew, split by the rates actually paid. For an individual this is
   * simply one person on the male side; group_size and amount are derived.
   */
  male_count: number
  female_count: number
  male_rate_paise: number
  female_rate_paise: number
  member_names?: string | null
}

export interface WorkSessionInput {
  head_id: string | null
  activity_id: string | null
  sub_head_id: string | null
  /** Which piece of land the crew was on. Null when the farm is one plot. */
  plot_id: string | null
  /** Defaults to 'day', which is what every existing caller means. */
  basis?: WorkBasis
  /** Piece work: what the quantity is measured in. */
  unit_id?: string | null
  /**
   * Piece work: the agreed rate, if it happens to be known already.
   *
   * Normally null — the whole reason piece work exists here is that the price
   * is settled after the job. See `priceSession`.
   */
  rate_paise?: number | null
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

/**
 * How much of each day a person is already down for.
 *
 * Returned as "labourerId|date" -> total day_fraction already recorded, so a
 * screen can grey out a day somebody is already fully booked on rather than
 * letting it be tapped and refused at save.
 *
 * Only day-basis work counts. Piece and lump jobs carry no day fraction worth
 * defending, and a salaried month is deliberately zero.
 */

/**
 * A line in the trail, for every write this module makes.
 *
 * WHY THIS MODULE HAD NONE. `change_log` was written by entries and master
 * data from the start, but never by labour — so the half of the app where the
 * money is most often disputed kept no record of who touched what. "I don't
 * remember entering that" had no answer for exactly the rows a farmer is most
 * likely to re-check.
 *
 * Outside the transaction, deliberately. A trail entry is worth less than the
 * row it describes, so it must never be the thing that rolls a write back.
 */
async function logChange(
  table: string,
  rowId: string,
  action: 'create' | 'update' | 'delete' | 'price',
  summary: string,
): Promise<void> {
  try {
    await run(
      'INSERT INTO change_log (id, table_name, row_id, action, summary, at) VALUES (?, ?, ?, ?, ?, ?);',
      [newId(), table, rowId, action, summary, nowISO()],
    )
  } catch {
    // A trail that cannot be written is not a reason to lose a day's work.
  }
}

export async function recordedFractions(
  labourerIds: string[],
  from: ISODate,
  to: ISODate,
): Promise<Map<string, number>> {
  if (labourerIds.length === 0) return new Map()
  const marks = labourerIds.map(() => '?').join(',')
  const rows = await all<{ labourer_id: string; date: ISODate; used: number }>(
    `SELECT labourer_id, date, SUM(day_fraction) AS used
       FROM attendance
      WHERE is_deleted = 0
        AND basis = 'day'
        AND labourer_id IN (${marks})
        AND date BETWEEN ? AND ?
      GROUP BY labourer_id, date;`,
    [...labourerIds, from, to],
  )
  return new Map(rows.map((r) => [`${r.labourer_id}|${r.date}`, r.used]))
}

/**
 * A person cannot work more than one full day in one day.
 *
 * THE BUG THIS EXISTS FOR: a farmer records the morning's work, forgets, and
 * records it again that evening. Nothing stopped them, so the day was counted
 * twice — the worker was owed double, the crop carried double the labour cost,
 * and nothing on screen looked wrong.
 *
 * The rule is a CAP, not a ban on a second row. Two half days on two different
 * jobs is an ordinary thing and must keep working; it is the total that cannot
 * exceed a full day. Enforced here rather than in the screen so that no future
 * caller can route around it.
 */
async function assertNoOverbooking(input: WorkSessionInput, basis: WorkBasis): Promise<void> {
  if (basis !== 'day') return

  const dates = input.days.map((d) => d.date)
  if (dates.length === 0) return
  const ids = [...new Set(input.days.map((d) => d.labourer_id))]
  const already = await recordedFractions(
    ids,
    dates.reduce((a, b) => (a < b ? a : b)),
    dates.reduce((a, b) => (a > b ? a : b)),
  )

  const wanted = new Map<string, number>()
  for (const d of input.days) {
    const key = `${d.labourer_id}|${d.date}`
    wanted.set(key, (wanted.get(key) ?? 0) + d.day_fraction)
  }

  const clashes: { labourer_id: string; date: ISODate }[] = []
  for (const [key, add] of wanted) {
    if ((already.get(key) ?? 0) + add > FULL_DAY) {
      const [labourer_id, date] = key.split('|')
      clashes.push({ labourer_id, date: date as ISODate })
    }
  }
  if (clashes.length === 0) return

  // The names, so the message can say WHO rather than make the farmer guess.
  const names = await all<{ id: string; name_kn: string; name_en: string }>(
    `SELECT id, name_kn, name_en FROM labourers WHERE id IN (${clashes
      .map(() => '?')
      .join(',')});`,
    clashes.map((c) => c.labourer_id),
  )
  const nameOf = (id: string) => {
    const row = names.find((n) => n.id === id)
    return row ? row.name_kn || row.name_en : '?'
  }

  const err = new Error(
    clashes.map((c) => `${nameOf(c.labourer_id)} · ${c.date}`).join(', '),
  ) as Error & { code?: string; clashes?: typeof clashes }
  err.code = 'ALREADY_RECORDED'
  err.clashes = clashes
  throw err
}

export async function saveWorkSession(input: WorkSessionInput): Promise<string> {
  const ts = nowISO()
  const sessionId = newId()

  const basis: WorkBasis = input.basis ?? 'day'
  const sessionRate = input.rate_paise ?? null

  // Before anything is written: nobody works twice in one day.
  await assertNoOverbooking(input, basis)

  await tx(async (exec) => {
    await exec(
      `INSERT INTO work_sessions
         (id, head_id, activity_id, sub_head_id, plot_id, basis, unit_id, rate_paise,
          priced_at, note, is_deleted, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?);`,
      [
        sessionId, input.head_id, input.activity_id, input.sub_head_id, input.plot_id,
        basis, input.unit_id ?? null, sessionRate, sessionRate != null ? ts : null,
        input.note, ts, ts,
      ],
    )

    for (const d of input.days) {
      const size = crewSize(d.male_count, d.female_count)
      const amount = wageForDay(basis, d, sessionRate)

      await exec(
        `INSERT INTO attendance
           (id, work_session_id, labourer_id, date, is_group, group_size,
            male_count, female_count, male_rate_paise, female_rate_paise,
            member_names, day_fraction, rate_paise, amount_paise, head_id,
            activity_id, plot_id, basis, quantity_milli, note, is_deleted,
            created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 0, ?, ?);`,
        [
          newId(), sessionId, d.labourer_id, d.date, d.is_group, Math.max(1, size),
          d.male_count, d.female_count, d.male_rate_paise, d.female_rate_paise,
          d.member_names ?? null, d.day_fraction,
          /*
           * THE RATE THIS WORK WAS PAID AT, whatever the basis.
           *
           * Hourly work used to fall into the daily-rate branch, so a tractor
           * hired at ₹700 an hour stored its operator's day rate — usually
           * zero, because a machine has none. The statement then printed a
           * rate of 0 beside a real amount, and correcting the row recomputed
           * it as quantity x 0 and wiped the figure. Both rates that come from
           * the session belong on the row, because the row is the snapshot.
           */
          basis === 'piece' || basis === 'hour' ? (sessionRate ?? 0) : d.daily_rate_paise,
          amount,
          input.head_id, input.activity_id, input.plot_id,
          basis, d.quantity_milli ?? null,
          ts, ts,
        ],
      )
    }
  })

  // New work may settle an advance the labourer is already holding.
  const touched = new Set(input.days.map((d) => d.labourer_id))
  for (const labourerId of touched) await settleOutstanding(labourerId)

  await logChange(
    'work_sessions',
    sessionId,
    'create',
    `${basis} · ${input.days.length} ${input.days.length === 1 ? 'row' : 'rows'}`,
  )
  notifyDataChanged()
  return sessionId
}

/** The rule itself lives in `lib/labour.ts`, where the gate can assert it. */
const wageForDay = (basis: WorkBasis, d: WorkDay, sessionRate: number | null): number =>
  wagePaise(basis, d, sessionRate, lineTotalPaise)

/**
 * Agree the price of a piece-rate job, once it is finished.
 *
 * This is the moment the spraying becomes money. Every row under the session
 * gets `quantity × rate`, rounded once per row by `lineTotalPaise`, and then
 * the ordinary FIFO engine runs — which is what makes any advance taken during
 * the job settle itself against the work it was always for. There is no second
 * code path for "advance against unpriced work", because there does not need
 * to be one.
 *
 * Re-pricing is allowed. A rate that was mis-typed has to be fixable, and the
 * balance following it is the correct consequence rather than a bug. This does
 * NOT violate the rate-snapshot rule: that rule protects a rate the labourer
 * already worked under from being rewritten by a later Settings change, and
 * this is the one job's own price being set on the one job.
 */
export async function priceSession(sessionId: string, ratePaise: number): Promise<number> {
  const ts = nowISO()
  const rate = Math.abs(Math.round(ratePaise))

  const session = await one<{ basis: WorkBasis }>(
    'SELECT basis FROM work_sessions WHERE id = ?;',
    [sessionId],
  )
  if (!session) return 0
  const basis = session.basis

  const rows = await all<{
    id: string
    labourer_id: string
    quantity_milli: number | null
    day_fraction: number
    is_group: Bool
    male_count: number
    female_count: number
  }>(
    `SELECT id, labourer_id, quantity_milli, day_fraction, is_group, male_count, female_count
       FROM attendance
      WHERE work_session_id = ? AND is_deleted = 0;`,
    [sessionId],
  )

  /*
   * ONE RATE, APPLIED THE WAY THAT BASIS IS PAID.
   *
   * Piece and hourly work multiply the quantity. Day work does not: it is the
   * crew formula, so a half day comes out half and a crew of twelve comes out
   * twelve times. Running day rows through the quantity path would have priced
   * every one of them at zero, since day rows carry no quantity.
   */
  const amountFor = (r: (typeof rows)[number]): number =>
    basis === 'piece' || basis === 'hour'
      ? lineTotalPaise(r.quantity_milli ?? 0, rate)
      : wagePaise(
          basis,
          {
            day_fraction: r.day_fraction,
            is_group: r.is_group,
            daily_rate_paise: rate,
            // The agreed rate is the rate. A half-day rate is a standing
            // arrangement with one person, not something being settled here.
            half_day_rate_paise: null,
            male_count: r.male_count,
            female_count: r.female_count,
            male_rate_paise: rate,
            // A crew priced after the fact is priced at one rate for everyone;
            // nobody agrees two figures retrospectively.
            female_rate_paise: r.female_count > 0 ? rate : 0,
          },
          rate,
          lineTotalPaise,
        )

  await tx(async (exec) => {
    await exec(
      'UPDATE work_sessions SET rate_paise = ?, priced_at = ?, updated_at = ? WHERE id = ?;',
      [rate, ts, ts, sessionId],
    )
    for (const r of rows) {
      // The per-row rates are written too, so the snapshot on the row keeps
      // telling the truth about what this work was paid at.
      await exec(
        `UPDATE attendance
            SET rate_paise = ?, amount_paise = ?,
                male_rate_paise = ?, female_rate_paise = ?, updated_at = ?
          WHERE id = ?;`,
        [rate, amountFor(r), rate, r.female_count > 0 ? rate : 0, ts, r.id],
      )
    }
  })

  for (const labourerId of new Set(rows.map((r) => r.labourer_id))) {
    await settleOutstanding(labourerId)
  }

  await logChange('work_sessions', sessionId, 'price', `${basis} · ${rate}`)
  notifyDataChanged()
  return rows.length
}

export interface OpenJob {
  session_id: string
  basis: WorkBasis
  first_date: ISODate
  last_date: ISODate
  quantity_milli: number
  unit_short_en: string | null
  unit_short_kn: string | null
  head_name_en: string | null
  head_name_kn: string | null
  activity_name_en: string | null
  activity_name_kn: string | null
  labourer_id: string
  labourer_name_en: string
  labourer_name_kn: string
  days: number
  /** Days times crew size — what a day rate actually multiplies against. */
  person_days: number
  note: string | null
}

/**
 * Work that has been done and still has no price on it.
 *
 * Surfaced prominently rather than left to be remembered: work that has been
 * done but never priced is invisible in every total on a cash basis, so
 * without this the farmer's books quietly understate what they are about to
 * owe — which is the exact failure the outstanding-wages line exists to
 * prevent everywhere else.
 *
 * IT USED TO MEAN PIECE WORK ONLY, and that left a hole a farmer could fall
 * into and not climb out of. Add a worker without filling in their day rate,
 * record a week of their work, then set the rate in Settings — and every one
 * of those days stays at ₹0 for ever, in the khata, in the crop costs and in
 * their statement. The rate on an attendance row is a snapshot and must never
 * be rewritten by a later Settings change; that rule protects a rate somebody
 * actually worked under, and zero was never a rate anybody agreed. So day and
 * hourly work that totals nothing is listed here too, and pricing it fills it
 * in the same way pricing a spraying job does.
 */
export function openJobs(): Promise<OpenJob[]> {
  return all<OpenJob>(
    `SELECT ws.id AS session_id, ws.basis, ws.note,
            MIN(a.date) AS first_date, MAX(a.date) AS last_date,
            COALESCE(SUM(a.quantity_milli), 0) AS quantity_milli,
            SUM(a.day_fraction) / 1000.0 AS days,
            SUM(a.day_fraction * MAX(a.group_size, 1)) / 1000.0 AS person_days,
            u.short_en AS unit_short_en, u.short_kn AS unit_short_kn,
            h.name_en AS head_name_en, h.name_kn AS head_name_kn,
            ac.name_en AS activity_name_en, ac.name_kn AS activity_name_kn,
            a.labourer_id,
            l.name_en AS labourer_name_en, l.name_kn AS labourer_name_kn
       FROM work_sessions ws
       JOIN attendance a       ON a.work_session_id = ws.id AND a.is_deleted = 0
       JOIN labourers l        ON l.id = a.labourer_id
       LEFT JOIN units u       ON u.id = ws.unit_id
       LEFT JOIN heads h       ON h.id = ws.head_id
       LEFT JOIN activities ac ON ac.id = ws.activity_id
      WHERE ws.priced_at IS NULL AND ws.is_deleted = 0
        AND ws.basis IN ('piece', 'day', 'hour')
      GROUP BY ws.id, a.labourer_id
      -- Piece work is open until it is priced, whatever it adds up to. Day and
      -- hourly work is only open when it adds up to nothing, which is the
      -- signature of a rate that was never set. The day_fraction test keeps
      -- salaried months out: those carry no days, by design.
      HAVING ws.basis = 'piece'
          OR (SUM(a.amount_paise) = 0 AND SUM(a.day_fraction) > 0)
      ORDER BY first_date;`,
  )
}

/** Which monthly workers already have a salary row for the month of `date`. */
export async function salaryDueFor(monthEndDate: ISODate): Promise<string[]> {
  const rows = await all<{ labourer_id: string }>(
    `SELECT DISTINCT labourer_id FROM attendance
      WHERE basis = 'salary' AND is_deleted = 0 AND substr(date, 1, 7) = ?;`,
    [monthEndDate.slice(0, 7)],
  )
  return rows.map((r) => r.labourer_id)
}

/**
 * Post a fixed worker's salary for one month.
 *
 * A salary is earned by the month, so it enters the ledger as a single row
 * dated the last day of that month with `day_fraction` 0 — a salaried month is
 * not a day worked, and counting it as one would corrupt every person-day
 * figure the labour reports produce.
 *
 * Idempotent by month. Tapping "post July" twice is a thing that happens, and
 * paying somebody twice because of it is not recoverable from the farmer's
 * side.
 */
export async function postSalary(
  labourerId: string,
  monthEndDate: ISODate,
  amountPaise: number,
  opts: { head_id?: string | null; sub_head_id?: string | null; note?: string | null } = {},
): Promise<string | null> {
  const month = monthEndDate.slice(0, 7)
  const existing = await one<{ id: string }>(
    `SELECT a.id FROM attendance a
      WHERE a.labourer_id = ? AND a.basis = 'salary' AND a.is_deleted = 0
        AND substr(a.date, 1, 7) = ?;`,
    [labourerId, month],
  )
  if (existing) return null

  return saveWorkSession({
    head_id: opts.head_id ?? null,
    activity_id: null,
    sub_head_id: opts.sub_head_id ?? null,
    plot_id: null,
    basis: 'salary',
    note: opts.note ?? null,
    days: [
      {
        labourer_id: labourerId,
        date: monthEndDate,
        day_fraction: 0,
        is_group: 0,
        daily_rate_paise: 0,
        half_day_rate_paise: null,
        male_count: 1,
        female_count: 0,
        male_rate_paise: 0,
        female_rate_paise: 0,
        amount_paise: amountPaise,
      },
    ],
  })
}

export async function deleteAttendance(id: string): Promise<void> {
  await tx(async (exec) => {
    // Allocations against a removed day would leave payments pointing at work
    // that no longer exists, so they are released back to unallocated first.
    await exec('DELETE FROM payment_allocations WHERE attendance_id = ?;', [id])
    await exec('UPDATE attendance SET is_deleted = 1, updated_at = ? WHERE id = ?;', [nowISO(), id])
  })
  await logChange('attendance', id, 'delete', '')
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

  await logChange(
    'labour_payments',
    paymentId,
    'create',
    `${direction} · ${amount}`,
  )
  notifyDataChanged()
  return paymentId
}


/**
 * Correcting a work day that was entered wrong.
 *
 * Deleting and re-entering was the only way, and it is not the same thing:
 * the row's id is what payments are allocated against, so re-entering turned
 * settled work back into an advance and shuffled every allocation after it.
 *
 * What may change is what the farmer can actually have got wrong — the date,
 * how much of a day it was, which crop and work it was for, which plot, and
 * the rate. The amount is RECOMPUTED rather than accepted: a stored total that
 * disagrees with the rate and the fraction beside it is a figure nobody can
 * audit. Allocations are released and re-matched afterwards, because changing
 * what a day was worth changes what the payments covered.
 *
 * This does not breach the rate snapshot rule. That rule stops a Settings
 * change rewriting past work behind the farmer's back; this is the farmer
 * standing on this one row, deliberately correcting it.
 */
export interface AttendanceEdit {
  date?: ISODate
  day_fraction?: number
  head_id?: string | null
  activity_id?: string | null
  plot_id?: string | null
  rate_paise?: number
  note?: string | null
  /** Hourly and piece work: how many hours, how many litres. */
  quantity_milli?: number | null
  /** Lump and salary: the agreed figure, used as given. */
  amount_paise?: number | null
  /** Crew work: who actually turned up. */
  male_count?: number
  female_count?: number
}

export async function updateAttendance(id: string, edit: AttendanceEdit): Promise<void> {
  const row = await one<{
    labourer_id: string
    date: ISODate
    basis: WorkBasis
    day_fraction: number
    is_group: Bool
    male_count: number
    female_count: number
    male_rate_paise: number
    female_rate_paise: number
    rate_paise: number
    half_day_rate_paise: number | null
    quantity_milli: number | null
    amount_paise: number
    head_id: string | null
    activity_id: string | null
    plot_id: string | null
    note: string | null
  }>(
    `SELECT a.labourer_id, a.date, a.basis, a.day_fraction, a.is_group,
            a.male_count, a.female_count, a.male_rate_paise, a.female_rate_paise,
            a.rate_paise, a.quantity_milli, a.amount_paise,
            a.head_id, a.activity_id, a.plot_id, a.note,
            l.half_day_rate_paise
       FROM attendance a
       JOIN labourers l ON l.id = a.labourer_id
      WHERE a.id = ? AND a.is_deleted = 0;`,
    [id],
  )
  if (!row) return

  const date = edit.date ?? row.date
  const fraction = edit.day_fraction ?? row.day_fraction
  const rate = edit.rate_paise ?? row.rate_paise
  const quantity = edit.quantity_milli !== undefined ? edit.quantity_milli : row.quantity_milli
  const lump = edit.amount_paise !== undefined ? edit.amount_paise : row.amount_paise
  const males = edit.male_count ?? row.male_count
  const females = edit.female_count ?? row.female_count

  // The same cap the entry screen is held to. Moving a day onto one somebody
  // is already fully booked for is the same mistake as entering it twice.
  const used = await recordedFractions([row.labourer_id], date, date)
  const already = used.get(`${row.labourer_id}|${date}`) ?? 0
  const mine = date === row.date ? row.day_fraction : 0
  if (row.basis === 'day' && already - mine + fraction > FULL_DAY) {
    const err = new Error(date) as Error & { code?: string }
    err.code = 'ALREADY_RECORDED'
    throw err
  }

  /*
   * ONE RULE, EVERY BASIS.
   *
   * `wagePaise` already knows what each basis multiplies; passing the edited
   * figures through it is what keeps an hourly correction and a day-rate
   * correction agreeing with the arithmetic on the entry screen. Working it
   * out here a second way is how the two drift.
   */
  const amount = wagePaise(
    row.basis,
    {
      day_fraction: fraction,
      is_group: row.is_group,
      daily_rate_paise: rate,
      half_day_rate_paise: row.half_day_rate_paise,
      male_count: males,
      female_count: females,
      // A crew's two rates move with the one being corrected only when they
      // were the same to begin with; a deliberately split crew keeps its split.
      male_rate_paise: row.male_rate_paise === row.rate_paise ? rate : row.male_rate_paise,
      female_rate_paise: row.female_rate_paise === row.rate_paise ? rate : row.female_rate_paise,
      quantity_milli: quantity,
      amount_paise: lump,
    },
    rate,
    lineTotalPaise,
  )

  const ts = nowISO()
  await tx(async (exec) => {
    // Released first: what this day is worth is about to change, so what a
    // payment covered has to be worked out again from scratch.
    await exec('DELETE FROM payment_allocations WHERE attendance_id = ?;', [id])
    await exec(
      `UPDATE attendance
          SET date = ?, day_fraction = ?, rate_paise = ?, amount_paise = ?,
              quantity_milli = ?, male_count = ?, female_count = ?,
              group_size = ?, head_id = ?, activity_id = ?, plot_id = ?,
              note = ?, updated_at = ?
        WHERE id = ?;`,
      [
        date, fraction, rate, amount,
        quantity,
        males,
        females,
        Math.max(1, males + females),
        // Read with the row above, not inside the transaction: a query issued
        // from in here goes round the write chain `tx` is holding.
        edit.head_id !== undefined ? edit.head_id : row.head_id,
        edit.activity_id !== undefined ? edit.activity_id : row.activity_id,
        edit.plot_id !== undefined ? edit.plot_id : row.plot_id,
        edit.note !== undefined ? edit.note : row.note,
        ts, id,
      ],
    )
  })

  await logChange('attendance', id, 'update', `${row.basis} · ${amount}`)
  await settleOutstanding(row.labourer_id)
  notifyDataChanged()
}

/**
 * Correcting a payment.
 *
 * The expense it created moves with it — that row exists only because of this
 * payment, and leaving the two disagreeing is how the khata and the cash book
 * stop reconciling. Allocations are released and re-matched, so lowering a
 * payment puts the work it no longer covers back on the unpaid pile.
 */
export interface PaymentEdit {
  date?: ISODate
  amount_paise?: number
  account_id?: string
  note?: string | null
}

export async function updatePayment(paymentId: string, edit: PaymentEdit): Promise<void> {
  const row = await one<{
    labourer_id: string
    entry_id: string | null
    date: ISODate
    amount_paise: number
    account_id: string
    note: string | null
  }>(
    `SELECT labourer_id, entry_id, date, amount_paise, account_id, note
       FROM labour_payments WHERE id = ? AND is_deleted = 0;`,
    [paymentId],
  )
  if (!row) return

  const date = edit.date ?? row.date
  const amount = Math.abs(Math.round(edit.amount_paise ?? row.amount_paise))
  const account = edit.account_id ?? row.account_id
  const note = edit.note !== undefined ? edit.note : row.note
  const ts = nowISO()

  await tx(async (exec) => {
    await exec('DELETE FROM payment_allocations WHERE payment_id = ?;', [paymentId])
    await exec(
      `UPDATE labour_payments
          SET date = ?, amount_paise = ?, account_id = ?, note = ?, updated_at = ?
        WHERE id = ?;`,
      [date, amount, account, note, ts, paymentId],
    )
    if (row.entry_id) {
      await exec(
        `UPDATE entries
            SET date = ?, amount_paise = ?, account_id = ?, note = ?, updated_at = ?
          WHERE id = ?;`,
        [date, amount, account, note, ts, row.entry_id],
      )
    }
  })

  await logChange('labour_payments', paymentId, 'update', String(amount))
  await settleOutstanding(row.labourer_id)
  notifyDataChanged()
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

  await logChange('labour_payments', paymentId, 'delete', '')
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
  code: string | null
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
    `SELECT l.id AS labourer_id, l.code, l.name_en, l.name_kn, l.phone,
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
  /**
   * HOW THIS DAY WAS PAID FOR, and the quantity behind it.
   *
   * Left out until now, which meant everything downstream had to assume a day
   * rate. A statement for a tractor hired by the hour printed the day fraction
   * and the hourly rate side by side as though they multiplied, and the edit
   * sheet could only offer "full day or half day" for work that was never
   * measured in days at all.
   */
  basis: WorkBasis
  quantity_milli: number | null
  unit_short_en: string | null
  unit_short_kn: string | null
  note: string | null
}

/**
 * One person's work, optionally within a date range.
 *
 * The range exists so a farmer can settle up for a stretch — "what did he do
 * this month, what is still open" — and hand over exactly that. Without it,
 * every statement was the whole history, which is the wrong document to give
 * somebody who worked three weeks.
 */
export function attendanceFor(
  labourerId: string,
  limit = 400,
  range?: { from: ISODate; to: ISODate },
): Promise<AttendanceRow[]> {
  return all<AttendanceRow>(
    `SELECT a.id, a.date, a.day_fraction, a.group_size, a.is_group,
            a.rate_paise, a.amount_paise, a.head_id, a.basis, a.quantity_milli, a.note,
            h.name_en AS head_name_en, h.name_kn AS head_name_kn,
            ac.name_en AS activity_name_en, ac.name_kn AS activity_name_kn,
            u.short_en AS unit_short_en, u.short_kn AS unit_short_kn,
            COALESCE((SELECT SUM(pa.amount_paise) FROM payment_allocations pa
                       WHERE pa.attendance_id = a.id), 0) AS paid_paise
       FROM attendance a
       LEFT JOIN heads h       ON h.id  = a.head_id
       LEFT JOIN activities ac ON ac.id = a.activity_id
       LEFT JOIN work_sessions ws ON ws.id = a.work_session_id
       LEFT JOIN units u       ON u.id = ws.unit_id
      WHERE a.labourer_id = ? AND a.is_deleted = 0
        ${range ? 'AND a.date >= ? AND a.date <= ?' : ''}
      ORDER BY a.date DESC, a.created_at DESC
      LIMIT ${Math.max(1, Math.min(limit, 2000))};`,
    range ? [labourerId, range.from, range.to] : [labourerId],
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

export function paymentsFor(
  labourerId: string,
  limit = 400,
  range?: { from: ISODate; to: ISODate },
): Promise<PaymentRow[]> {
  return all<PaymentRow>(
    `SELECT p.id, p.date, p.amount_paise, p.mode, p.is_advance, p.direction, p.note,
            a.name_en AS account_name_en, a.name_kn AS account_name_kn,
            COALESCE((SELECT SUM(pa.amount_paise) FROM payment_allocations pa
                       WHERE pa.payment_id = p.id), 0) AS allocated_paise
       FROM labour_payments p
       LEFT JOIN accounts a ON a.id = p.account_id
      WHERE p.labourer_id = ? AND p.is_deleted = 0
        ${range ? 'AND p.date >= ? AND p.date <= ?' : ''}
      ORDER BY p.date DESC, p.created_at DESC
      LIMIT ${Math.max(1, Math.min(limit, 2000))};`,
    range ? [labourerId, range.from, range.to] : [labourerId],
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
 * The khata book view
 * ------------------------------------------------------------------ */

export type LedgerKind = 'work' | 'payment' | 'return'

export interface LedgerRow {
  id: string
  kind: LedgerKind
  date: ISODate
  /** What the labourer earned that day (work), else 0. */
  credit_paise: number
  /** What was handed over (payment), negative for money coming back. */
  debit_paise: number
  running_balance_paise: number
  label: string
  /**
   * The crop and the work, in BOTH languages, for the screen to pick from.
   *
   * This used to be one pre-joined string built from the English columns, so a
   * farmer with the app in Kannada read "Pepper · Planting" in their own khata.
   * Choosing a language is the UI's job — it is the only layer that knows
   * which one is on — and `nameOf` is where that decision belongs.
   */
  head: NamePair | null
  activity: NamePair | null
  note: string | null
  day_fraction?: number
  group_size?: number
  /* Work rows only, so the edit sheet can offer the fields that basis uses. */
  basis?: WorkBasis
  rate_paise?: number
  quantity_milli?: number | null
  unit?: { short_en: string | null; short_kn: string | null }
}

export interface NamePair {
  name_en: string
  name_kn: string
}

/** Null unless there is something to show, so the screen can skip the line. */
const pair = (en: string | null, kn: string | null): NamePair | null =>
  en || kn ? { name_en: en ?? kn ?? '', name_kn: kn ?? en ?? '' } : null

/**
 * Everything that happened, oldest first, with a running balance — the way a
 * khata book actually reads.
 *
 * Work and money are separate tables by design, but the farmer and the
 * labourer settle up by running a finger down one column. Interleaving them
 * here is a reporting concern only; nothing about the underlying separation
 * changes.
 */
export async function labourLedger(labourerId: string): Promise<LedgerRow[]> {
  const [work, payments] = await Promise.all([
    attendanceFor(labourerId, 2000),
    paymentsFor(labourerId, 2000),
  ])

  const rows: Omit<LedgerRow, 'running_balance_paise'>[] = [
    ...work.map((w) => ({
      id: w.id,
      kind: 'work' as const,
      date: w.date,
      credit_paise: w.amount_paise,
      debit_paise: 0,
      label: 'work',
      head: pair(w.head_name_en, w.head_name_kn),
      activity: pair(w.activity_name_en, w.activity_name_kn),
      note: w.note,
      day_fraction: w.day_fraction,
      group_size: w.group_size,
      basis: w.basis,
      rate_paise: w.rate_paise,
      quantity_milli: w.quantity_milli,
      unit: { short_en: w.unit_short_en, short_kn: w.unit_short_kn },
    })),
    ...payments.map((p) => ({
      id: p.id,
      kind: (p.direction === 'in' ? 'return' : 'payment') as LedgerKind,
      date: p.date,
      credit_paise: p.direction === 'in' ? p.amount_paise : 0,
      debit_paise: p.direction === 'in' ? 0 : p.amount_paise,
      label: p.direction === 'in' ? 'return' : p.is_advance ? 'advance' : 'payment',
      head: null,
      activity: null,
      note: p.note ?? null,
    })),
  ]

  rows.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.id < b.id ? -1 : 1))

  let balance = 0
  return rows.map((r) => {
    // Earning raises what is owed; money handed over lowers it; money coming
    // back raises it again.
    balance += r.kind === 'work' ? r.credit_paise : r.kind === 'return' ? r.credit_paise : -r.debit_paise
    return { ...r, running_balance_paise: balance }
  })
}

/** Work grouped by crop, for the per-labourer chart. */
export interface LabourerCropRow {
  head_id: string | null
  name_en: string | null
  name_kn: string | null
  color: string | null
  person_days: number
  earned_paise: number
}

export const workByCropFor = (labourerId: string) =>
  all<LabourerCropRow>(
    `SELECT a.head_id, h.name_en, h.name_kn, h.color,
            SUM(a.day_fraction * a.group_size) / 1000.0 AS person_days,
            SUM(a.amount_paise) AS earned_paise
       FROM attendance a
       LEFT JOIN heads h ON h.id = a.head_id
      WHERE a.labourer_id = ? AND a.is_deleted = 0
      GROUP BY a.head_id
      ORDER BY earned_paise DESC;`,
    [labourerId],
  )

/** Month-by-month work against money, for the per-labourer trend. */
export interface LabourerMonthRow {
  month: string
  earned: number
  paid: number
  days: number
}

export async function monthlyFor(labourerId: string): Promise<LabourerMonthRow[]> {
  const earned = await all<{ month: string; earned: number; days: number }>(
    `SELECT substr(date, 1, 7) AS month, SUM(amount_paise) AS earned,
            SUM(day_fraction) / 1000.0 AS days
       FROM attendance WHERE labourer_id = ? AND is_deleted = 0
      GROUP BY month;`,
    [labourerId],
  )
  const paid = await all<{ month: string; paid: number }>(
    `SELECT substr(date, 1, 7) AS month,
            SUM(CASE WHEN direction = 'in' THEN -amount_paise ELSE amount_paise END) AS paid
       FROM labour_payments WHERE labourer_id = ? AND is_deleted = 0
      GROUP BY month;`,
    [labourerId],
  )

  const months = new Map<string, LabourerMonthRow>()
  for (const e of earned) {
    months.set(e.month, { month: e.month, earned: e.earned, paid: 0, days: e.days })
  }
  for (const p of paid) {
    const row = months.get(p.month)
    if (row) row.paid = p.paid
    else months.set(p.month, { month: p.month, earned: 0, paid: p.paid, days: 0 })
  }

  return [...months.values()].sort((a, b) => a.month.localeCompare(b.month))
}

/**
 * How long the farm typically takes to pay this person.
 *
 * The gap between working and being paid is the thing a labourer actually
 * feels, and the thing that decides whether they come back next season.
 */
export interface PaymentGap {
  averageDays: number | null
  longestDays: number | null
  unpaidOldest: ISODate | null
  unpaidDays: number | null
}

export async function paymentGapFor(labourerId: string): Promise<PaymentGap> {
  const open = await openWork(labourerId)
  const settled = await all<{ worked: ISODate; paid: ISODate }>(
    `SELECT a.date AS worked, p.date AS paid
       FROM payment_allocations pa
       JOIN attendance a      ON a.id = pa.attendance_id AND a.is_deleted = 0
       JOIN labour_payments p ON p.id = pa.payment_id AND p.is_deleted = 0
      WHERE a.labourer_id = ?;`,
    [labourerId],
  )

  // Only days where the money came AFTER the work count as a wait. An advance
  // settles work that had not happened yet, which would otherwise report as a
  // negative gap — "usually paid after -2 days" is nonsense to read.
  const gaps = settled
    .map((s) =>
      Math.round((new Date(s.paid).getTime() - new Date(s.worked).getTime()) / 86_400_000),
    )
    .filter((d) => d >= 0)

  const oldest = open.length ? open[0].date : null
  const today = new Date()

  return {
    averageDays: gaps.length ? Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length) : null,
    longestDays: gaps.length ? Math.max(...gaps) : null,
    unpaidOldest: oldest,
    unpaidDays: oldest
      ? Math.round((today.getTime() - new Date(oldest).getTime()) / 86_400_000)
      : null,
  }
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

export interface LabourCostByPlot {
  plot_id: string | null
  name_en: string | null
  name_kn: string | null
  total: number
}

/**
 * The same cash-basis attribution as `labourCostByHead`, but per plot.
 *
 * Deliberately a second query rather than a grouping argument: the crop and
 * the plot are different questions, both are asked, and a single function
 * taking a column name is how an injectable column ends up in a WHERE clause.
 */
export function labourCostByPlot(from: ISODate, to: ISODate): Promise<LabourCostByPlot[]> {
  return all<LabourCostByPlot>(
    `SELECT a.plot_id, pl.name_en, pl.name_kn, SUM(pa.amount_paise) AS total
       FROM payment_allocations pa
       JOIN labour_payments p ON p.id = pa.payment_id AND p.is_deleted = 0
       JOIN attendance a      ON a.id = pa.attendance_id AND a.is_deleted = 0
       LEFT JOIN plots pl     ON pl.id = a.plot_id
      WHERE p.date >= ? AND p.date <= ?
      GROUP BY a.plot_id
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
