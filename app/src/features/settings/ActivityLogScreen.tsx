import { useMemo, useState } from 'react'
import {
  ArrowDownLeft, ArrowUpRight, ChevronRight, CircleDot, HardHat, IndianRupee,
  Pencil, Plus, Settings2, Trash2,
} from 'lucide-react'
import { Page, Shell } from '@/components/Shell'
import { Button, Card, EmptyState, SectionHeader } from '@/components/ui'
import { useQuery } from '@/hooks/useQuery'
import { activityLog } from '@/data/activityLog'
import { useI18n } from '@/i18n'
import { formatDate } from '@/lib/date'
import { formatRupees } from '@/lib/money'
import { back, navigate } from '@/router'
import type { LogRow } from '@/data/activityLog'

/**
 * Everything that has been entered, changed or removed — newest first.
 *
 * THE QUESTION THIS ANSWERS is always the same one: a figure looks wrong, the
 * farmer suspects the app, and the only way to settle it is to see what was
 * actually recorded and when. "I don't remember entering that" had no answer
 * before this screen, and the suspicion lands on the app because nothing else
 * is available to blame.
 *
 * Grouped by the day the CHANGE was made, not the day the record is dated.
 * Those are different questions and this screen is about the first: "what did
 * I do on Tuesday evening" is how somebody retraces a mistake. The record's own
 * date is on the row.
 *
 * Every line goes somewhere. A log you cannot follow is a list of regrets.
 */

const ICON: Record<string, typeof Plus> = {
  create: Plus,
  update: Pencil,
  delete: Trash2,
  restore: CircleDot,
  price: IndianRupee,
}

const TONE: Record<string, string> = {
  create: 'var(--color-income)',
  update: 'var(--color-brand-600)',
  delete: 'var(--color-expense)',
  restore: 'var(--text-faint)',
  price: 'var(--color-earth-700)',
}

const PAGE = 100

export function ActivityLogScreen() {
  const { t, lang, nameOf } = useI18n()
  const [limit, setLimit] = useState(PAGE)
  const { data, loading } = useQuery(() => activityLog(limit), [limit])

  /** What kind of thing this row was about, in the farmer's words. */
  function describe(r: LogRow): string {
    switch (r.table_name) {
      case 'entries':
        return t('log.entry')
      case 'attendance':
        return t('log.workDay')
      case 'labour_payments':
        return t('log.payment')
      case 'work_sessions':
        return t('log.workSession')
      case 'labourers':
        return t('labour.labourer')
      case 'heads':
        return t('set.incomeHeads')
      case 'accounts':
        return t('set.accounts')
      case 'plots':
        return t('plot.one')
      case 'activities':
        return t('set.activities')
      case 'sub_heads':
        return t('set.spendTypes')
      default:
        return r.table_name
    }
  }

  const kindIcon = (r: LogRow) => {
    if (r.table_name === 'attendance' || r.table_name === 'work_sessions') return HardHat
    if (r.table_name === 'labour_payments') return IndianRupee
    if (r.table_name === 'entries') return r.amount_paise != null ? ArrowUpRight : ArrowDownLeft
    return Settings2
  }

  /* Grouped by the DAY THE CHANGE HAPPENED. The timestamp is a full ISO
     string, so the first ten characters are already the local business date
     it was written on. */
  const groups = useMemo(() => {
    const out = new Map<string, LogRow[]>()
    for (const r of data ?? []) {
      const day = r.at.slice(0, 10)
      const list = out.get(day)
      if (list) list.push(r)
      else out.set(day, [r])
    }
    return [...out.entries()]
  }, [data])

  return (
    <Shell title={t('log.title')} onBack={back} right={<span />}>
      <Page>
        <p className="text-sm px-1" style={{ color: 'var(--text-soft)' }}>
          {t('log.intro')}
        </p>

        {loading && !data ? (
          <EmptyState>{t('common.loading')}</EmptyState>
        ) : groups.length === 0 ? (
          <EmptyState>{t('common.empty')}</EmptyState>
        ) : (
          groups.map(([day, rows]) => (
            <section key={day}>
              <SectionHeader>{formatDate(day, lang)}</SectionHeader>
              <Card>
                {rows.map((r) => {
                  const Icon = ICON[r.action] ?? CircleDot
                  const Kind = kindIcon(r)
                  const tone = TONE[r.action] ?? 'var(--text-faint)'
                  const subject = nameOf({
                    name_en: r.subject_en ?? '',
                    name_kn: r.subject_kn ?? '',
                  })
                  return (
                    <button
                      key={r.id}
                      disabled={!r.route}
                      onClick={() => r.route && navigate(r.route)}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left"
                      style={{ opacity: r.route ? 1 : 0.6 }}
                    >
                      <span
                        className="grid place-items-center rounded-lg shrink-0 relative"
                        style={{
                          width: 34,
                          height: 34,
                          background: 'var(--surface-sunken)',
                          color: 'var(--text-faint)',
                        }}
                      >
                        <Kind size={16} />
                        <span
                          className="absolute -bottom-1 -right-1 grid place-items-center rounded-full"
                          style={{
                            width: 16,
                            height: 16,
                            background: tone,
                            color: '#fff',
                          }}
                        >
                          <Icon size={9} strokeWidth={3} />
                        </span>
                      </span>

                      <span className="flex-1 min-w-0 leading-tight">
                        <span className="block text-sm font-medium truncate">
                          {t(`log.${r.action}` as 'log.create')} · {describe(r)}
                          {/* A record that has since been removed still shows
                              here — "where did that ₹4,000 go" is asked months
                              later, and an absent row cannot answer it. */}
                          {r.gone ? (
                            <span className="ml-1.5 text-[11px]" style={{ color: 'var(--color-expense)' }}>
                              {t('log.removed')}
                            </span>
                          ) : null}
                        </span>
                        <span className="block text-xs truncate" style={{ color: 'var(--text-faint)' }}>
                          {[
                            r.at.slice(11, 16),
                            subject || null,
                            r.on_date && r.on_date !== day ? formatDate(r.on_date, lang) : null,
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </span>
                      </span>

                      {r.amount_paise != null ? (
                        <span className="tnum text-sm font-semibold shrink-0">
                          {formatRupees(Math.abs(r.amount_paise))}
                        </span>
                      ) : null}

                      {r.route ? (
                        <ChevronRight size={15} style={{ color: 'var(--text-faint)' }} />
                      ) : null}
                    </button>
                  )
                })}
              </Card>
            </section>
          ))
        )}

        {(data?.length ?? 0) >= limit ? (
          <Button variant="soft" full onClick={() => setLimit((n) => n + PAGE)}>
            {t('log.more')}
          </Button>
        ) : null}
      </Page>
    </Shell>
  )
}
