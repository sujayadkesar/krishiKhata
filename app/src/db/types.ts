/**
 * The Krishi Khata data model.
 *
 * Read this before anything else. Conventions that hold everywhere:
 *
 *   Money      integer paise            (see lib/money.ts)
 *   Quantity   integer milli-units      (see lib/quantity.ts)
 *   Dates      'YYYY-MM-DD' local       (see lib/date.ts)
 *   Booleans   0 | 1                    SQLite has no boolean type
 *   Timestamps ISO UTC instants, for created_at/updated_at only
 *
 * Every master-data row carries name_en and name_kn because the app is
 * bilingual and a report may be printed in either language. Transactions store
 * ids, never names, so renaming a head in Settings is always safe.
 */

export type ISODate = string
export type ISOInstant = string
export type Bool = 0 | 1

/** Columns every stored row carries. */
export interface BaseRow {
  id: string
  created_at: ISOInstant
  updated_at: ISOInstant
}

/** Master data that can be retired but never deleted once referenced. */
export interface MasterRow extends BaseRow {
  name_en: string
  name_kn: string
  is_active: Bool
  sort_order: number
}

/* ------------------------------------------------------------------ *
 * Master data
 * ------------------------------------------------------------------ */

export type AccountKind = 'cash' | 'bank' | 'upi'

export interface Account extends MasterRow {
  kind: AccountKind
  /**
   * What was in this account on the day the farmer started using the app.
   * Every balance the app ever shows is this plus the entries since, so it is
   * the one figure worth getting right on day one.
   */
  opening_balance_paise: number
  bank_name: string | null
  account_last4: string | null
}

export interface Unit extends MasterRow {
  short_en: string
  short_kn: string
  /** 0 for things counted whole — bunches, boxes, bags. */
  allows_fraction: Bool
}

export type HeadUse = 'income' | 'expense' | 'both'

/** A crop or income source: Banana, Pepper, Arecanut, Honey, General. */
export interface Head extends MasterRow {
  used_for: HeadUse
  /** Tailwind-ish token, chosen in Settings, used consistently in charts. */
  color: string
  icon: string | null
}

/**
 * Which units a head may be sold in, and which is offered first.
 * Honey sells by bottle AND by kg; banana by kg AND by bunch. That is why the
 * unit lives here rather than as a single column on the head.
 */
export interface HeadUnit {
  head_id: string
  unit_id: string
  is_default: Bool
}

/**
 * The nature of a spend: Labour, Fertilizer, Transport, Machinery...
 * Called "sub-head" throughout the UI because that is the word the farmer used.
 */
export interface SubHead extends MasterRow {
  /**
   * Marks the sub-heads whose spending comes from the labour ledger rather
   * than from a shop bill. Wage payments are posted against one of these.
   */
  is_labour: Bool
  /**
   * Scopes this sub-head to one crop. Null means it applies to everything.
   *
   * Grades live here: "First class" and "Second class" belong to Banana and
   * make no sense anywhere else, while "Fertilizer" is global.
   */
  head_id: string | null
  /** Income sub-heads are grades; expense sub-heads are kinds of spend. */
  used_for: 'income' | 'expense' | 'both'
}

/** The granular work: Harvesting, Spraying, Weeding, Loading, Pruning... */
export interface Activity extends MasterRow {
  /** The sub-head this work usually belongs to; pre-selected, still editable. */
  sub_head_id: string | null
}

export interface Labourer extends MasterRow {
  phone: string | null
  village: string | null
  /**
   * A maistry who brings a crew. The crew is different people each time, so
   * the app tracks the lead and a head-count, not twelve named individuals.
   */
  is_group_lead: Bool
  daily_rate_paise: number
  /** null means "half of daily_rate_paise", which is the usual arrangement. */
  half_day_rate_paise: number | null
  /**
   * A crew's women are usually on a different day rate. Only meaningful for a
   * group lead; null falls back to the daily rate.
   */
  female_rate_paise: number | null
  /** Pre-fills the count on the attendance screen for a group lead. */
  typical_group_size: number | null
  note: string | null
}

/* ------------------------------------------------------------------ *
 * Transactions
 * ------------------------------------------------------------------ */

export type EntryKind = 'income' | 'expense' | 'transfer'

/**
 * One table for all three kinds of money movement, discriminated by `kind`.
 * A single table is what makes the day book, the running balance and the
 * dashboard one query each instead of three unioned ones.
 *
 * A bank-to-cash withdrawal is a TRANSFER, not an expense. Recording it as an
 * expense permanently overstates spending and breaks the cash balance.
 */
export interface Entry extends BaseRow {
  kind: EntryKind
  date: ISODate

  head_id: string | null
  sub_head_id: string | null
  activity_id: string | null

  /** income: money in. expense: money out. transfer: the FROM side. */
  account_id: string | null
  /** transfer only: the TO side. */
  to_account_id: string | null

  quantity_milli: number | null
  unit_id: string | null
  rate_paise: number | null

  /** Always positive. Direction comes from `kind`, never from a sign. */
  amount_paise: number

  /** Buyer, trader or shop. Free text — this is not a contacts app. */
  party_name: string | null
  note: string | null
  photo_id: string | null

  /**
   * Set when this expense IS a wage payment, linking back to the labour
   * ledger. Such entries are created by the payment screen, not by hand.
   */
  labour_payment_id: string | null

  is_deleted: Bool
}

export interface Photo extends BaseRow {
  entry_id: string | null
  /** WebP data URL, resized on capture. Bills are read, not framed. */
  data: string
  bytes: number
}

/* ------------------------------------------------------------------ *
 * Labour
 * ------------------------------------------------------------------ */

/** One engagement, created by the calendar screen: who, what work, which crop. */
export interface WorkSession extends BaseRow {
  head_id: string | null
  activity_id: string | null
  sub_head_id: string | null
  note: string | null
  is_deleted: Bool
}

export const FULL_DAY = 1000
export const HALF_DAY = 500

/**
 * ONE ROW PER LABOURER PER DAY. The core table of the app.
 *
 * Attendance records work, not money. It builds the labourer's running khata
 * and every worked-day statistic, and it moves nothing in the books — on the
 * cash basis this app uses, the expense appears when the wage is PAID.
 */
export interface Attendance extends BaseRow {
  work_session_id: string
  /** The individual, or the group lead standing for the whole crew. */
  labourer_id: string
  date: ISODate

  is_group: Bool
  /**
   * Total people: male_count + female_count. Kept as its own column because
   * every existing row, report and query counts on it.
   */
  group_size: number
  /**
   * A crew is rarely interchangeable people. Six men and four women on
   * different day rates is the normal case, and one head-count times one rate
   * cannot express it. Both rates are snapshotted like every other rate.
   */
  male_count: number
  female_count: number
  male_rate_paise: number
  female_rate_paise: number
  /** Optional free-text list, for the rare case the crew is known. */
  member_names: string | null

  /** FULL_DAY or HALF_DAY. */
  day_fraction: number

  /**
   * SNAPSHOT of the rate at the moment this was recorded, per person per day.
   *
   * Raising a labourer's rate in Settings must never rewrite what last season
   * cost. This is the single easiest bug to introduce in this app: read the
   * rate off `labourers` at report time and every historical figure changes.
   */
  rate_paise: number

  /** day_fraction / 1000 x rate_paise x group_size. See lib/labour.ts. */
  amount_paise: number

  /** Denormalised from the session so crop costing is one indexed read. */
  head_id: string | null
  activity_id: string | null

  note: string | null
  is_deleted: Bool
}

export type PaymentMode = 'cash' | 'upi' | 'bank'

/**
 * Money actually handed to a labourer. THIS is the expense, dated the day it
 * was paid, and it creates the matching row in `entries`.
 */
export interface LabourPayment extends BaseRow {
  labourer_id: string
  date: ISODate
  account_id: string
  amount_paise: number
  mode: PaymentMode
  /**
   * Display only. An advance is arithmetically just a payment made while the
   * balance is at or below zero — there is deliberately no second code path,
   * because two ways of moving the same money is how ledgers stop balancing.
   */
  is_advance: Bool
  note: string | null
  /** The expense row this payment created. */
  entry_id: string | null
  is_deleted: Bool
}

/**
 * Links a payment to the work days it settles, oldest first by default.
 *
 * This is what keeps crop-wise costing accurate on a cash basis: the payment
 * is the expense, but the CROP it belongs to is known only through the work
 * days it pays for. A payment with no work yet to settle (a pure advance) has
 * no allocations until the labourer turns up.
 */
export interface PaymentAllocation {
  id: string
  payment_id: string
  attendance_id: string
  amount_paise: number
  created_at: ISOInstant
}

/* ------------------------------------------------------------------ *
 * Settings and history
 * ------------------------------------------------------------------ */

/** Key/value store for the farm profile, language and backup state. */
export interface Setting {
  key: string
  value: string
}

export type ChangeAction = 'create' | 'update' | 'delete' | 'restore'

/**
 * A plain history of edits. Not a hash chain — that belongs to a shared book
 * several people write to. One farmer on one phone needs to be able to answer
 * "what did I change last Tuesday", and nothing more.
 */
export interface ChangeLog {
  id: string
  table_name: string
  row_id: string
  action: ChangeAction
  summary: string | null
  at: ISOInstant
}

/* ------------------------------------------------------------------ *
 * Derived shapes used across screens
 * ------------------------------------------------------------------ */

/** A labourer's position in the wage ledger. */
export interface LabourBalance {
  labourer_id: string
  /** Total of every attendance row. */
  earned_paise: number
  /** Total of every payment. */
  paid_paise: number
  /** earned - paid. Positive: you owe them. Negative: they hold your advance. */
  balance_paise: number
  days_worked: number
  last_worked_on: ISODate | null
  last_paid_on: ISODate | null
}
