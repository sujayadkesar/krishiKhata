/**
 * Wage arithmetic and the payment allocation engine.
 *
 * Everything here is pure — no database, no dates beyond plain strings — so it
 * can be asserted directly by `npm run check`. This is the riskiest logic in
 * the app: it decides what a farmer owes a person who is standing in front of
 * them, and it decides which crop a lump-sum payment is charged to.
 */

import { FULL_DAY, HALF_DAY } from '@/db/types'
import type { ISODate } from '@/db/types'

/* ------------------------------------------------------------------ *
 * What a day of work is worth
 * ------------------------------------------------------------------ */

/**
 * What ONE person earns for one day at this fraction.
 *
 * A half day is not always half the money — some arrangements pay a fixed
 * half-day figure — so an explicit half rate wins when one is set.
 */
export function perPersonWagePaise(
  dayFraction: number,
  dailyRatePaise: number,
  halfDayRatePaise: number | null,
): number {
  if (dayFraction === HALF_DAY) {
    return halfDayRatePaise ?? Math.round(dailyRatePaise / 2)
  }
  return dailyRatePaise
}

/**
 * What an attendance row costs: one person's wage times the head-count.
 *
 * Rounding happens once, on the per-person figure, before multiplying — that
 * is how the farmer works it out ("half day is ₹166.67 each, twelve of them"),
 * and rounding after multiplication would disagree with the cash handed over.
 */
export function attendanceAmountPaise(
  dayFraction: number,
  dailyRatePaise: number,
  halfDayRatePaise: number | null,
  groupSize: number,
): number {
  const per = perPersonWagePaise(dayFraction, dailyRatePaise, halfDayRatePaise)
  return per * Math.max(1, groupSize)
}

/** Calendar days, where a half day counts as half. */
export function daysFromFractions(fractions: number[]): number {
  return fractions.reduce((sum, f) => sum + f / FULL_DAY, 0)
}

/** Person-days: the same, weighted by crew size. A lead's crew is 12x one day. */
export function personDaysFromRows(rows: { day_fraction: number; group_size: number }[]): number {
  return rows.reduce((sum, r) => sum + (r.day_fraction / FULL_DAY) * Math.max(1, r.group_size), 0)
}

/* ------------------------------------------------------------------ *
 * Allocation
 * ------------------------------------------------------------------ */

/** A payment with money still not tied to any work day. */
export interface OpenPayment {
  payment_id: string
  date: ISODate
  unallocated_paise: number
}

/** A work day with wages still not covered by any payment. */
export interface OpenWork {
  attendance_id: string
  date: ISODate
  unpaid_paise: number
}

export interface Alloc {
  payment_id: string
  attendance_id: string
  amount_paise: number
}

/** Oldest first; ties broken by id so the result never depends on input order. */
function byDateThenId<T extends { date: ISODate }>(key: (t: T) => string) {
  return (a: T, b: T) => (a.date < b.date ? -1 : a.date > b.date ? 1 : key(a) < key(b) ? -1 : 1)
}

/**
 * Match money to work days, oldest work first.
 *
 * This one function serves both directions, which is the point:
 *
 *   Paying wages   — a new payment against work already done.
 *   Recording work — new work days against an advance already paid.
 *
 * Both are the same problem, so there is one implementation and one set of
 * rounding rules. Anything left over on either side simply stays open: unpaid
 * wages are a debt, unallocated payment is an advance, and the balance says
 * which without needing a separate concept for either.
 */
export function matchFifo(payments: OpenPayment[], work: OpenWork[]): Alloc[] {
  const ps = payments
    .filter((p) => p.unallocated_paise > 0)
    .map((p) => ({ ...p }))
    .sort(byDateThenId((p) => p.payment_id))

  const ws = work
    .filter((w) => w.unpaid_paise > 0)
    .map((w) => ({ ...w }))
    .sort(byDateThenId((w) => w.attendance_id))

  const out: Alloc[] = []
  let pi = 0

  for (const w of ws) {
    while (w.unpaid_paise > 0 && pi < ps.length) {
      const p = ps[pi]
      if (p.unallocated_paise <= 0) {
        pi++
        continue
      }
      const amount = Math.min(p.unallocated_paise, w.unpaid_paise)
      out.push({ payment_id: p.payment_id, attendance_id: w.attendance_id, amount_paise: amount })
      p.unallocated_paise -= amount
      w.unpaid_paise -= amount
    }
    if (pi >= ps.length) break
  }

  return out
}

/* ------------------------------------------------------------------ *
 * Balances
 * ------------------------------------------------------------------ */

/**
 * Positive: the farmer owes the labourer.
 * Negative: the labourer is holding an advance.
 *
 * There is no third state and no separate "advance" total — an advance is a
 * payment that ran out of work to attach to, and this subtraction already
 * says so.
 */
export function balancePaise(earnedPaise: number, paidPaise: number): number {
  return earnedPaise - paidPaise
}

export type BalanceState = 'owed' | 'advance' | 'settled'

export function balanceState(balancePaise: number): BalanceState {
  if (balancePaise > 0) return 'owed'
  if (balancePaise < 0) return 'advance'
  return 'settled'
}

/**
 * Splitting a payment across crops for cash-basis reporting.
 *
 * The payment is the expense, but which crop it belongs to is known only
 * through the work days it settles. Allocations carry that; this turns them
 * into per-head totals. Money not allocated to any work day is returned under
 * `unallocated`, and reports show it as its own line rather than silently
 * dropping it or dumping it on whichever crop sorted first.
 */
export function splitByHead(
  allocations: { attendance_id: string; amount_paise: number }[],
  headOfAttendance: Map<string, string | null>,
): { byHead: Map<string, number>; unallocated: number } {
  const byHead = new Map<string, number>()
  let unallocated = 0

  for (const a of allocations) {
    const head = headOfAttendance.get(a.attendance_id) ?? null
    if (!head) {
      unallocated += a.amount_paise
      continue
    }
    byHead.set(head, (byHead.get(head) ?? 0) + a.amount_paise)
  }

  return { byHead, unallocated }
}
