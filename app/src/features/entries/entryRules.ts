import type { EntryKind } from '@/db/types'

/**
 * What an entry still needs before it can be saved.
 *
 * Pure, and in its own file with no React and no database, so the gate in
 * `scripts/checks.mjs` can prove it. This rule decides whether a sale gets
 * recorded at all: too strict and the farmer gives up and writes nothing down,
 * too loose and a season's report comes out with a large uncategorised row
 * nobody can explain months later. It is worth asserting rather than eyeballing.
 *
 * Every requirement is conditional on the thing EXISTING. A crop with no
 * varieties set up is never asked for one; a farm that has entered no land is
 * never asked for a plot.
 */

export type MissingKey =
  | 'amount'
  | 'head'
  | 'subHead'
  | 'variety'
  | 'grade'
  | 'plot'
  | 'account'
  | 'toAccount'

export interface RuleDraft {
  kind: EntryKind
  head_id: string | null
  sub_head_id: string | null
  plot_id: string | null
  account_id: string | null
  to_account_id: string | null
  amount_paise: number | null
}

export interface RuleContext {
  /** Top-level sub-heads available for this head and direction. */
  topLevelCount: number
  /** Rows beneath the chosen top-level one — grades, where there are any. */
  childCount: number
  /** The top-level row implied by the stored leaf, or null. */
  parentSubHeadId: string | null
  /** Whether the farm has entered any plots at all. */
  hasPlots: boolean
}

export function missingFor(draft: RuleDraft, ctx: RuleContext): MissingKey[] {
  const missing: MissingKey[] = []
  const isTransfer = draft.kind === 'transfer'

  if (!draft.amount_paise || draft.amount_paise <= 0) missing.push('amount')
  if (!isTransfer && !draft.head_id) missing.push('head')

  // Categorising is not optional where a category exists to choose.
  if (!isTransfer && draft.head_id && ctx.topLevelCount > 0 && !draft.sub_head_id) {
    missing.push(draft.kind === 'income' ? 'variety' : 'subHead')
  }

  // A variety that HAS grades must be taken down to one of them: "G9" alone is
  // not a price, and first and second class fetch different money.
  //
  // The null check is load-bearing. With nothing chosen at all both sides are
  // null and compare equal, which asked a transfer — which has no crop, so no
  // variety and no grade — for a grade it could never be given.
  if (
    ctx.childCount > 0 &&
    draft.sub_head_id != null &&
    draft.sub_head_id === ctx.parentSubHeadId
  ) {
    missing.push('grade')
  }

  // A transfer moves money between the farm's own accounts and never touches a
  // piece of land, so it is the one kind that never carries a plot.
  if (!isTransfer && ctx.hasPlots && !draft.plot_id) missing.push('plot')

  if (!draft.account_id) missing.push('account')
  if (isTransfer && (!draft.to_account_id || draft.to_account_id === draft.account_id)) {
    missing.push('toAccount')
  }

  return missing
}
