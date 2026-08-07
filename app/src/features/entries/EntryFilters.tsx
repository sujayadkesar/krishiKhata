import { useMemo } from 'react'
import { SlidersHorizontal, X } from 'lucide-react'
import { Button, DateInput, Field, MoneyInput, Select, Sheet } from '@/components/ui'
import { useQuery } from '@/hooks/useQuery'
import {
  listAccounts, listActivities, listHeads, listSubHeads,
} from '@/data/masterData'
import { useI18n } from '@/i18n'
import { addMonths, financialYearOf, financialYearRange, monthEnd, monthStart, todayISO } from '@/lib/date'
import type { EntryFilter, EntrySort } from '@/data/entries'

/**
 * Filtering the day book.
 *
 * Kept in a sheet rather than on the screen because the list is what the
 * farmer came for; filters are the exception, not the default. The count of
 * active filters shows on the button, so it is never a mystery why the list
 * looks short — a hidden filter left on is the classic way a ledger appears
 * to have lost records.
 */

export function FilterButton({
  count,
  onClick,
}: {
  count: number
  onClick: () => void
}) {
  const on = count > 0
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 rounded-xl px-3.5 py-2.5 text-sm font-semibold border shrink-0"
      style={{
        borderColor: on ? 'var(--color-brand-500)' : 'var(--border)',
        background: on ? 'var(--color-brand-500)' : 'var(--surface-raised)',
        color: on ? '#fff' : 'var(--text-soft)',
      }}
    >
      <SlidersHorizontal size={15} />
      {count > 0 ? count : null}
    </button>
  )
}

const RANGES = [
  { id: 'month', kn: 'ಈ ತಿಂಗಳು', en: 'This month' },
  { id: 'last', kn: 'ಕಳೆದ ತಿಂಗಳು', en: 'Last month' },
  { id: 'fy', kn: 'ಈ ವರ್ಷ', en: 'This year' },
  { id: 'all', kn: 'ಎಲ್ಲಾ', en: 'All time' },
] as const

export function EntryFilterSheet({
  open,
  filter,
  onChange,
  onClose,
}: {
  open: boolean
  filter: EntryFilter
  onChange: (f: EntryFilter) => void
  onClose: () => void
}) {
  const { t, lang, nameOf } = useI18n()

  const { data: heads } = useQuery(() => listHeads(true), [])
  const { data: subHeads } = useQuery(() => listSubHeads(true), [])
  const { data: activities } = useQuery(() => listActivities(true), [])
  const { data: accounts } = useQuery(() => listAccounts(true), [])

  // Only offer work types that belong to the chosen kind of spend, otherwise
  // the list is forty entries long and useless.
  const activityOptions = useMemo(
    () =>
      (activities ?? []).filter(
        (a) => !filter.subHeadId || !a.sub_head_id || a.sub_head_id === filter.subHeadId,
      ),
    [activities, filter.subHeadId],
  )

  const set = (patch: Partial<EntryFilter>) => onChange({ ...filter, ...patch })

  const applyRange = (id: (typeof RANGES)[number]['id']) => {
    const today = todayISO()
    if (id === 'month') return set({ from: monthStart(today), to: monthEnd(today) })
    if (id === 'last') {
      const prev = addMonths(today, -1)
      return set({ from: monthStart(prev), to: monthEnd(prev) })
    }
    if (id === 'fy') {
      const r = financialYearRange(financialYearOf(today))
      return set({ from: r.from, to: r.to })
    }
    return set({ from: undefined, to: undefined })
  }

  const label = (kn: string, en: string) =>
    lang === 'en' ? en : lang === 'both' ? `${kn} · ${en}` : kn

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={label('ಸೋಸಿ', 'Filter')}
      footer={
        <div className="flex gap-2.5">
          <Button
            variant="ghost"
            full
            onClick={() => {
              onChange({ kind: filter.kind, search: filter.search, sort: filter.sort })
            }}
          >
            <span className="inline-flex items-center gap-1.5 justify-center">
              <X size={16} /> {label('ತೆರವು', 'Clear')}
            </span>
          </Button>
          <Button full onClick={onClose}>
            {t('common.done')}
          </Button>
        </div>
      }
    >
      <Field label={label('ಅವಧಿ', 'Period')}>
        <div className="flex flex-wrap gap-2 mb-3">
          {RANGES.map((r) => (
            <button
              key={r.id}
              onClick={() => applyRange(r.id)}
              className="rounded-full px-3.5 py-2 text-sm font-medium border"
              style={{ minHeight: 40, borderColor: 'var(--border)', color: 'var(--text-soft)' }}
            >
              {label(r.kn, r.en)}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <DateInput value={filter.from ?? ''} onChange={(v) => set({ from: v || undefined })} />
          <DateInput value={filter.to ?? ''} onChange={(v) => set({ to: v || undefined })} />
        </div>
      </Field>

      <Field label={t('entry.head')}>
        <Select
          value={filter.headId ?? ''}
          onChange={(v) => set({ headId: v || undefined })}
          options={[
            { value: '', label: t('common.all') },
            ...(heads ?? []).map((h) => ({ value: h.id, label: nameOf(h) })),
          ]}
        />
      </Field>

      <Field label={t('entry.subHead')}>
        <Select
          value={filter.subHeadId ?? ''}
          onChange={(v) => set({ subHeadId: v || undefined, activityId: undefined })}
          options={[
            { value: '', label: t('common.all') },
            ...(subHeads ?? []).map((s) => ({ value: s.id, label: nameOf(s) })),
          ]}
        />
      </Field>

      <Field label={t('entry.activity')}>
        <Select
          value={filter.activityId ?? ''}
          onChange={(v) => set({ activityId: v || undefined })}
          options={[
            { value: '', label: t('common.all') },
            ...activityOptions.map((a) => ({ value: a.id, label: nameOf(a) })),
          ]}
        />
      </Field>

      <Field label={t('entry.account')}>
        <Select
          value={filter.accountId ?? ''}
          onChange={(v) => set({ accountId: v || undefined })}
          options={[
            { value: '', label: t('common.all') },
            ...(accounts ?? []).map((a) => ({ value: a.id, label: nameOf(a) })),
          ]}
        />
      </Field>

      <Field label={label('ಮೊತ್ತ', 'Amount between')}>
        <div className="grid grid-cols-2 gap-3">
          <MoneyInput
            paise={filter.minPaise ?? null}
            onChange={(p) => set({ minPaise: p ?? undefined })}
          />
          <MoneyInput
            paise={filter.maxPaise ?? null}
            onChange={(p) => set({ maxPaise: p ?? undefined })}
          />
        </div>
      </Field>

      <Field label={label('ಜೋಡಣೆ', 'Sort by')}>
        <Select
          value={filter.sort ?? 'date-desc'}
          onChange={(v) => set({ sort: v as EntrySort })}
          options={[
            { value: 'date-desc', label: label('ಹೊಸದು ಮೊದಲು', 'Newest first') },
            { value: 'date-asc', label: label('ಹಳೆಯದು ಮೊದಲು', 'Oldest first') },
            { value: 'amount-desc', label: label('ದೊಡ್ಡ ಮೊತ್ತ ಮೊದಲು', 'Largest first') },
            { value: 'amount-asc', label: label('ಸಣ್ಣ ಮೊತ್ತ ಮೊದಲು', 'Smallest first') },
          ]}
        />
      </Field>
    </Sheet>
  )
}
