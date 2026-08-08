import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@/hooks/useQuery'
import {
  getHeadUnits, listAccounts, listActivities, listGrades, listHeads, listPlots, listSubHeads,
} from '@/data/masterData'
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
  subHeads: { id: string; name_en: string; name_kn: string }[]
  activities: { id: string; name_en: string; name_kn: string; sub_head_id: string | null }[]
  accounts: { id: string; name_en: string; name_kn: string }[]
  plots: { id: string; name_en: string; name_kn: string }[]
  grades: { id: string; name_en: string; name_kn: string }[]
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
  const { data: subHeads } = useQuery(() => listSubHeads(false), [])
  const { data: activities } = useQuery(() => listActivities(false), [])
  const { data: accounts } = useQuery(() => listAccounts(false), [])
  const { data: plots } = useQuery(() => listPlots(false), [])
  const { data: headUnits } = useQuery(
    () => (draft.head_id ? getHeadUnits(draft.head_id) : Promise.resolve([])),
    [draft.head_id],
  )
  // Grades belong to their crop: Banana has first class and second class, and
  // they mean nothing under Pepper.
  const { data: grades } = useQuery(
    () => (draft.head_id ? listGrades(draft.head_id) : Promise.resolve([])),
    [draft.head_id],
  )

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

  // A grade from another crop must not survive changing the crop.
  useEffect(() => {
    if (draft.kind !== 'income' || !draft.sub_head_id) return
    if ((grades ?? []).some((g) => g.id === draft.sub_head_id)) return
    set({ sub_head_id: null })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grades, draft.kind])

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
   * Categorising is not optional.
   *
   * An uncategorised entry costs nothing to make and quietly ruins the crop
   * report — a season's "where did the money go" comes out with a large blank
   * row nobody can explain months later.
   *
   * A grade is required only where the crop HAS grades. Most crops are sold
   * one way, and demanding a grade that was never set up would simply stop the
   * sale being recorded at all.
   */
  const missing: string[] = []
  if (!draft.amount_paise || draft.amount_paise <= 0) missing.push(t('common.amount'))
  if (draft.kind !== 'transfer' && !draft.head_id) missing.push(t('entry.head'))
  if (draft.kind === 'expense' && !draft.sub_head_id) missing.push(t('entry.subHead'))
  if (draft.kind === 'income' && draft.head_id && (grades ?? []).length > 0 && !draft.sub_head_id) {
    missing.push(t('entry.grade'))
  }
  if (!draft.account_id) missing.push(t('entry.account'))
  if (draft.kind === 'transfer') {
    if (!draft.to_account_id || draft.to_account_id === draft.account_id) missing.push(t('entry.to'))
  }

  return {
    heads,
    subHeads: subHeads ?? [],
    activities: activities ?? [],
    accounts: accounts ?? [],
    plots: plots ?? [],
    grades: grades ?? [],
    headUnits: headUnits ?? [],
    unitShort,
    computedTotal,
    autoTotal,
    setAutoTotal,
    missing,
    valid: missing.length === 0,
  }
}

