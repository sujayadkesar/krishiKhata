import { all } from '@/db/db'
import type { ISODate } from '@/db/types'

/**
 * "When did I enter that, and what did I change?"
 *
 * The question this answers is always the same one: a figure looks wrong, the
 * farmer suspects the app, and the only way to settle it is to see what was
 * actually recorded and when. `change_log` has held that since the first
 * version and nothing ever read it — the trail existed and was unreachable.
 *
 * Every row resolves to somewhere to go. A log you cannot follow is a list of
 * regrets, so each line carries the route to the record it describes and the
 * name of whatever it was about. Soft-deleted rows still resolve: "where did
 * that ₹4,000 go" is asked months later, and the answer is a row that is
 * marked deleted rather than a row that is gone.
 *
 * It is NOT an audit log in the tamper-proof sense, and the project
 * deliberately has no hash chain — see CLAUDE.md. One farmer on one phone
 * needs to retrace their own steps, not prove anything to a third party.
 */

export type LogAction = 'create' | 'update' | 'delete' | 'restore' | 'price'

export interface LogRow {
  id: string
  table_name: string
  row_id: string
  action: LogAction
  summary: string | null
  /** Full ISO timestamp — this is the one place the TIME matters, not the date. */
  at: string

  /** The business date of the record, where it has one. */
  on_date: ISODate | null
  /** Rupees involved, for the figure on the right. */
  amount_paise: number | null
  /** What it was about: a crop, a worker, an account. */
  subject_en: string | null
  subject_kn: string | null
  /** Where tapping it should go. Null when the record cannot be reached. */
  route: string | null
  /** Whether the record it points at is now deleted. */
  gone: number
}

/**
 * The trail, newest first.
 *
 * One query with a LEFT JOIN per table rather than four queries merged in
 * JavaScript: the log is one ordered thing, and paging it in JS would mean
 * fetching everything to show twenty rows.
 *
 * The route for an attendance row or a payment is that WORKER'S khata, not the
 * row itself — there is no screen for a single attendance row, and the khata is
 * where it can be seen in context and corrected.
 */
export function activityLog(limit = 200, offset = 0): Promise<LogRow[]> {
  return all<LogRow>(
    `SELECT c.id, c.table_name, c.row_id, c.action, c.summary, c.at,

            COALESCE(e.date, a.date, lp.date) AS on_date,
            COALESCE(e.amount_paise, a.amount_paise, lp.amount_paise) AS amount_paise,

            COALESCE(eh.name_en, ah.name_en, al.name_en, pl.name_en, sw.name_en,
                     acc.name_en, lab.name_en, u.name_en, sh.name_en, pt.name_en,
                     hd.name_en, act.name_en)
              AS subject_en,
            COALESCE(eh.name_kn, ah.name_kn, al.name_kn, pl.name_kn, sw.name_kn,
                     acc.name_kn, lab.name_kn, u.name_kn, sh.name_kn, pt.name_kn,
                     hd.name_kn, act.name_kn)
              AS subject_kn,

            CASE c.table_name
              WHEN 'entries'         THEN '/entries/' || c.row_id
              WHEN 'attendance'      THEN '/labour/khata/' || COALESCE(a.labourer_id, '')
              WHEN 'labour_payments' THEN '/labour/khata/' || COALESCE(lp.labourer_id, '')
              WHEN 'work_sessions'   THEN '/labour/khata/' || COALESCE(ws_first.labourer_id, '')
              WHEN 'labourers'       THEN '/labour/khata/' || c.row_id
              WHEN 'heads'           THEN '/settings/crops'
              WHEN 'accounts'        THEN '/settings/accounts'
              WHEN 'plots'           THEN '/settings/plots'
              WHEN 'activities'      THEN '/settings/activities'
              WHEN 'sub_heads'       THEN '/settings/spend-types'
              WHEN 'units'           THEN '/settings/accounts'
              ELSE NULL
            END AS route,

            COALESCE(e.is_deleted, a.is_deleted, lp.is_deleted, 0) AS gone

       FROM change_log c

       LEFT JOIN entries e          ON c.table_name = 'entries'         AND e.id = c.row_id
       LEFT JOIN heads eh           ON eh.id = e.head_id
       LEFT JOIN attendance a       ON c.table_name = 'attendance'      AND a.id = c.row_id
       LEFT JOIN heads ah           ON ah.id = a.head_id
       LEFT JOIN labourers al       ON al.id = a.labourer_id
       LEFT JOIN labour_payments lp ON c.table_name = 'labour_payments' AND lp.id = c.row_id
       LEFT JOIN labourers pl       ON pl.id = lp.labourer_id

       -- A session has many rows; the first one is enough to find the person.
       LEFT JOIN (
         SELECT work_session_id, MIN(labourer_id) AS labourer_id
           FROM attendance GROUP BY work_session_id
       ) ws_first ON c.table_name = 'work_sessions' AND ws_first.work_session_id = c.row_id
       LEFT JOIN labourers sw ON sw.id = ws_first.labourer_id

       -- Master data names itself.
       LEFT JOIN accounts   acc ON c.table_name = 'accounts'   AND acc.id = c.row_id
       LEFT JOIN labourers  lab ON c.table_name = 'labourers'  AND lab.id = c.row_id
       LEFT JOIN units      u   ON c.table_name = 'units'      AND u.id   = c.row_id
       LEFT JOIN sub_heads  sh  ON c.table_name = 'sub_heads'  AND sh.id  = c.row_id
       LEFT JOIN plots      pt  ON c.table_name = 'plots'      AND pt.id  = c.row_id
       LEFT JOIN heads      hd  ON c.table_name = 'heads'      AND hd.id  = c.row_id
       LEFT JOIN activities act ON c.table_name = 'activities' AND act.id = c.row_id

      ORDER BY c.at DESC
      LIMIT ? OFFSET ?;`,
    [Math.max(1, Math.min(limit, 1000)), Math.max(0, offset)],
  )
}

/** How many lines there are, so the screen knows when to stop offering more. */
export async function activityLogCount(): Promise<number> {
  const rows = await all<{ n: number }>('SELECT COUNT(*) AS n FROM change_log;')
  return rows[0]?.n ?? 0
}
