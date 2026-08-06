import { useMemo, useState } from 'react'
import { ArrowDownLeft, ArrowUpRight, ArrowLeftRight, Search } from 'lucide-react'
import { Page, Shell } from '@/components/Shell'
import { Card, EmptyState, Input } from '@/components/ui'
import { useQuery } from '@/hooks/useQuery'
import { listEntries } from '@/data/entries'
import { useI18n } from '@/i18n'
import { formatDate, formatQuantityLabel } from './format'
import { formatRupees } from '@/lib/money'
import { navigate } from '@/router'
import type { EntryKind } from '@/db/types'
import type { EntryRow } from '@/data/entries'

/**
 * The day book: everything recorded, newest first, grouped by day.
 *
 * Grouped by date rather than shown as a flat list because the question being
 * asked is almost always "what did I do on Tuesday", and a date heading
 * answers it without reading a column of repeated dates.
 */

const ICON: Record<EntryKind, typeof ArrowDownLeft> = {
  income: ArrowDownLeft,
  expense: ArrowUpRight,
  transfer: ArrowLeftRight,
}

const COLOR: Record<EntryKind, string> = {
  income: 'var(--color-income)',
  expense: 'var(--color-expense)',
  transfer: 'var(--color-transfer)',
}

type Filter = 'all' | EntryKind

export function EntriesScreen() {
  const { t, lang, nameOf } = useI18n()
  const [filter, setFilter] = useState<Filter>('all')
  const [search, setSearch] = useState('')

  const { data, loading } = useQuery(
    () => listEntries({ kind: filter === 'all' ? undefined : filter, search, limit: 400 }),
    [filter, search],
  )

  const groups = useMemo(() => {
    const map = new Map<string, EntryRow[]>()
    for (const e of data ?? []) {
      const list = map.get(e.date)
      if (list) list.push(e)
      else map.set(e.date, [e])
    }
    return [...map.entries()]
  }, [data])

  const describe = (e: EntryRow): string => {
    if (e.kind === 'transfer') {
      const from = nameOf({ name_en: e.account_name_en ?? '', name_kn: e.account_name_kn ?? '' })
      const to = nameOf({
        name_en: e.to_account_name_en ?? '',
        name_kn: e.to_account_name_kn ?? '',
      })
      return `${from} → ${to}`
    }

    const bits: string[] = []
    if (e.head_name_en) {
      bits.push(nameOf({ name_en: e.head_name_en, name_kn: e.head_name_kn ?? e.head_name_en }))
    }
    if (e.activity_name_en) {
      bits.push(
        nameOf({ name_en: e.activity_name_en, name_kn: e.activity_name_kn ?? e.activity_name_en }),
      )
    } else if (e.sub_head_name_en) {
      bits.push(
        nameOf({ name_en: e.sub_head_name_en, name_kn: e.sub_head_name_kn ?? e.sub_head_name_en }),
      )
    }
    return bits.join(' · ') || t(`kind.${e.kind}` as 'kind.income')
  }

  return (
    <Shell title={t('nav.entries')}>
      <Page>
        <div className="grid grid-cols-4 gap-2">
          {(['all', 'income', 'expense', 'transfer'] as Filter[]).map((f) => {
            const on = filter === f
            const colour = f === 'all' ? 'var(--color-brand-600)' : COLOR[f]
            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className="rounded-xl py-2.5 text-sm font-semibold border"
                style={{
                  borderColor: on ? colour : 'var(--border)',
                  background: on ? colour : 'var(--surface-raised)',
                  color: on ? '#fff' : 'var(--text-soft)',
                }}
              >
                {f === 'all' ? t('common.all') : t(`kind.${f}` as 'kind.income')}
              </button>
            )
          })}
        </div>

        <div className="relative">
          <Search
            size={17}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
            style={{ color: 'var(--text-faint)' }}
          />
          <div className="[&_input]:pl-10">
            <Input value={search} onChange={setSearch} placeholder={t('common.search')} />
          </div>
        </div>

        {loading ? (
          <EmptyState>{t('common.loading')}</EmptyState>
        ) : groups.length === 0 ? (
          <EmptyState>{t('common.empty')}</EmptyState>
        ) : (
          groups.map(([date, rows]) => (
            <div key={date}>
              <h2
                className="text-xs font-semibold mb-1.5 px-1"
                style={{ color: 'var(--text-faint)' }}
              >
                {formatDate(date, lang)}
              </h2>
              <Card>
                {rows.map((e) => {
                  const Icon = ICON[e.kind]
                  const qty = formatQuantityLabel(e, lang)
                  return (
                    <button
                      key={e.id}
                      onClick={() => navigate(`/entries/${e.id}`)}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left"
                    >
                      <span
                        className="grid place-items-center rounded-full shrink-0"
                        style={{
                          width: 34,
                          height: 34,
                          background: `color-mix(in srgb, ${COLOR[e.kind]} 12%, transparent)`,
                          color: COLOR[e.kind],
                        }}
                      >
                        <Icon size={17} />
                      </span>

                      <span className="flex-1 min-w-0">
                        <span className="block font-medium truncate">{describe(e)}</span>
                        <span
                          className="block text-xs truncate"
                          style={{ color: 'var(--text-faint)' }}
                        >
                          {[qty, e.party_name, e.note].filter(Boolean).join(' · ') || ' '}
                        </span>
                      </span>

                      <span
                        className="tnum font-semibold shrink-0"
                        style={{ color: COLOR[e.kind] }}
                      >
                        {e.kind === 'expense' ? '−' : e.kind === 'income' ? '+' : ''}
                        {formatRupees(e.amount_paise)}
                      </span>
                    </button>
                  )
                })}
              </Card>
            </div>
          ))
        )}
      </Page>
    </Shell>
  )
}
