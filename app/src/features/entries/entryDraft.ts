import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@/hooks/useQuery'
import {
  getHeadUnits, listAccounts, listActivities, listHeads, listPlots, listSubHeadsFor,
} from '@/data/masterData'
import { missingFor } from './entryRules'
import type { MissingKey } from './entryRules'
import type { SubHead } from '@/db/types'
import type { StringKey } from '@/i18n/strings'

/** The rule returns stable keys; the interface needs words in two languages. */
const MISSING_LABEL: Record<MissingKey, StringKey> = {
  amount: 'common.amount',
  head: 'entry.head',
  subHead: 'entry.subHead',
  variety: 'entry.variety',
  grade: 'entry.grade',
  plot: 'entry.plot',
  account: 'entry.account',
  toAccount: 'entry.to',
}
import { useI18n } from '@/i18n'
import { lineTotalPaise } from '@/lib/quantity'
import { todayISO } from '@/lib/date'
import type { EntryKind, ISODate } from '@/db/types'

/**
 * One entry being edited, shared by the add screen and the edit screen.
 *
 * They were two separate forms, and the edit screen could only change the
 * date, the amount and the words. That is what made a mis-filed entry
 * unfixable: choosing the wrong crop meant deleting and re-typing everything.
 * Worse, a field added to one form never appeared on the other — the grade
 * chosen on a sale was being dropped on save for exactly that reason.
 *
 * One shape, one validation rule, both screens. The fields themselves are in
 * `EntryForm.tsx`, which exports components and nothing else.
 */

export interface EntryDraft {
  kind: EntryKind
  date: ISODate
  head_id: string | null
  /** Grade on the income side, kind of spend on the expense side. */
  sub_head_id: string | null
  activity_id: string | null
  plot_id: string | null
  account_id: string | null
  to_account_id: string | null
  unit_id: string | null
  quantity_milli: number | null
  rate_paise: number | null
  amount_paise: number | null
  party_name: string
  note: string
}

export function blankDraft(kind: EntryKind = 'income'): EntryDraft {
  return {
    kind,
    date: todayISO(),
    head_id: null,
    sub_head_id: null,
    activity_id: null,
    plot_id: null,
    account_id: null,
    to_account_id: null,
    unit_id: null,
    quantity_milli: null,
    rate_paise: null,
    amount_paise: null,
    party_name: '',
    note: '',
  }
}

export type Patch = (patch: Partial<EntryDraft>) => void

export interface EntryFormState {
  heads: ReturnType<typeof useHeadsList>
  /**
   * The top level of the sub-head tree for the chosen head and direction.
   * On the income side these are varieties (G9, Mitka); on the expense side
   * they are kinds of spend (Fertilizer, Transport).
   */
  subHeads: SubHead[]
  /**
   * The level below the chosen top-level row — grades, where the variety has
   * any. Empty when it is a leaf, which is the normal case for most crops.
   */
  childSubHeads: SubHead[]
  /** The top-level row currently in play, derived from the stored leaf. */
  parentSubHeadId: string | null
  activities: { id: string; name_en: string; name_kn: string; sub_head_id: string | null }[]
  accounts: { id: string; name_en: string; name_kn: string }[]
  plots: { id: string; name_en: string; name_kn: string }[]
  headUnits: { unit_id: string; short_en: string; short_kn: string; name_en: string; name_kn: string }[]
  unitShort: string
  computedTotal: number | null
  /** True while the amount is still being derived from quantity × rate. */
  autoTotal: boolean
  setAutoTotal: (v: boolean) => void
  /** Fields still needed before this can be saved, in form order. */
  missing: string[]
  valid: boolean
}

type HeadRow = { id: string; name_en: string; name_kn: string; used_for: string }
function useHeadsList(): HeadRow[] {
  const { data } = useQuery(() => listHeads(false), [])
  return (data ?? []) as HeadRow[]
}

/**
 * All the lists the form needs, plus what is still missing.
 *
 * `startAutoTotal` is false when editing: an existing amount is what actually
 * changed hands and must never be silently recomputed from a rate the trader
 * rounded away.
 */
export function useEntryForm(
  draft: EntryDraft,
  set: Patch,
  { startAutoTotal }: { startAutoTotal: boolean },
): EntryFormState {
  const { t, lang } = useI18n()

  const heads = useHeadsList()
  const { data: activities } = useQuery(() => listActivities(false), [])
  const { data: accounts } = useQuery(() => listAccounts(false), [])
  const { data: plots } = useQuery(() => listPlots(false), [])
  const { data: headUnits } = useQuery(
    () => (draft.head_id ? getHeadUnits(draft.head_id) : Promise.resolve([])),
    [draft.head_id],
  )

  /**
   * Only the sub-heads that belong to this crop, on this side of the book.
   *
   * The form used to offer every sub-head in the database for every entry,
   * which is how a banana sale ended up filed under Fertilizer. Income and
   * expense are read separately because they are genuinely different lists:
   * under Banana the income side is G9 and Mitka, the expense side is manure
   * and spray, and neither belongs in the other's picker.
   */
  const direction = draft.kind === 'income' ? 'income' : 'expense'
  const { data: scoped } = useQuery(
    () => (draft.head_id ? listSubHeadsFor(draft.head_id, direction) : Promise.resolve([])),
    [draft.head_id, direction],
  )
  const tree = useMemo(() => scoped ?? [], [scoped])

  const [autoTotal, setAutoTotal] = useState(startAutoTotal)

  // When the crop changes, offer its default unit.
  useEffect(() => {
    if (!headUnits?.length) return
    const current = draft.unit_id
    if (current && headUnits.some((u) => u.unit_id === current)) return
    set({ unit_id: headUnits[0].unit_id })
    // `set` and `draft.unit_id` are read, not depended on: re-running whenever
    // the parent re-creates `set` would fight the farmer's own choice.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [headUnits])

  /**
   * The two levels of the tree, and which top-level row is in play.
   *
   * Only the deepest choice is stored, so the variety is recovered by walking
   * up from it. Storing both would let them disagree, and a sale filed under
   * "Mitka / First class" where Mitka is not the parent of that grade is a row
   * no report can make sense of.
   */
  const topLevel = useMemo(() => tree.filter((s) => !s.parent_id), [tree])
  const parentSubHeadId = useMemo(() => {
    const chosen = tree.find((s) => s.id === draft.sub_head_id)
    if (!chosen) return null
    return chosen.parent_id ?? chosen.id
  }, [tree, draft.sub_head_id])
  const childSubHeads = useMemo(
    () => (parentSubHeadId ? tree.filter((s) => s.parent_id === parentSubHeadId) : []),
    [tree, parentSubHeadId],
  )

  // A sub-head from another crop must not survive changing the crop.
  useEffect(() => {
    if (!draft.sub_head_id || !draft.head_id || !scoped) return
    if (tree.some((s) => s.id === draft.sub_head_id)) return
    set({ sub_head_id: null })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tree, scoped, draft.head_id])

  // Choosing the work pre-selects the kind of spend it usually belongs to.
  useEffect(() => {
    if (draft.kind !== 'expense' || !draft.activity_id) return
    const act = (activities ?? []).find((a) => a.id === draft.activity_id)
    if (act?.sub_head_id && act.sub_head_id !== draft.sub_head_id) {
      set({ sub_head_id: act.sub_head_id })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.activity_id, activities])

  const computedTotal = useMemo(
    () =>
      draft.quantity_milli != null && draft.rate_paise != null
        ? lineTotalPaise(draft.quantity_milli, draft.rate_paise)
        : null,
    [draft.quantity_milli, draft.rate_paise],
  )

  useEffect(() => {
    if (draft.kind !== 'income' || !autoTotal || computedTotal == null) return
    if (computedTotal === draft.amount_paise) return
    set({ amount_paise: computedTotal })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [computedTotal, draft.kind, autoTotal])

  const unit = headUnits?.find((u) => u.unit_id === draft.unit_id)
  // Unit codes stay single-language — "ಕೆ.ಜಿ · kg" inside a field suffix is noise.
  const unitShort = unit ? (lang === 'en' ? unit.short_en : unit.short_kn) : ''

  /**
   * What is still needed, decided by `entryRules.ts` and only labelled here.
   *
   * The rule itself is pure and lives apart from React so the gate can prove
   * it — it is the rule that decides whether a sale gets recorded at all.
   */
  const missing = missingFor(draft, {
    topLevelCount: topLevel.length,
    childCount: childSubHeads.length,
    parentSubHeadId,
    hasPlots: (plots ?? []).length > 0,
  }).map((key) => t(MISSING_LABEL[key]))

  return {
    heads,
    subHeads: topLevel,
    childSubHeads,
    parentSubHeadId,
    activities: activities ?? [],
    accounts: accounts ?? [],
    plots: plots ?? [],
    headUnits: headUnits ?? [],
    unitShort,
    computedTotal,
    autoTotal,
    setAutoTotal,
    missing,
    valid: missing.length === 0,
  }
}

