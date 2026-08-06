import { useEffect, useMemo, useState } from 'react'
import { Check, Users } from 'lucide-react'
import { Page, Shell } from '@/components/Shell'
import { Button, Field, Input, Select, Sheet, TextArea } from '@/components/ui'
import { MonthCalendar, type DaySelection } from '@/components/MonthCalendar'
import { useQuery } from '@/hooks/useQuery'
import { listActivities, listHeads, listLabourers, listSubHeads } from '@/data/masterData'
import { attendanceInMonth, saveWorkSession } from '@/data/labour'
import { useI18n } from '@/i18n'
import { formatRupees } from '@/lib/money'
import { attendanceAmountPaise } from '@/lib/labour'
import { FULL_DAY, HALF_DAY } from '@/db/types'
import { monthEnd, monthStart } from '@/lib/date'
import { back, navigate } from '@/router'
import type { ISODate } from '@/db/types'

/**
 * Recording work days.
 *
 * Several labourers can be selected at once, because three people doing the
 * same job on the same days is the normal case and entering it three times is
 * how a farmer stops entering it at all.
 *
 * The wage is snapshotted from each labourer as the rows are written. Raising
 * someone's rate in Settings later must never rewrite what this week cost.
 */

export function AddWorkScreen() {
  const { t, nameOf } = useI18n()

  const [year, setYear] = useState(() => new Date().getFullYear())
  const [monthIndex, setMonthIndex] = useState(() => new Date().getMonth())

  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [headId, setHeadId] = useState<string | null>(null)
  const [activityId, setActivityId] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [selection, setSelection] = useState<Map<ISODate, DaySelection>>(new Map())
  const [countSheetFor, setCountSheetFor] = useState<ISODate | null>(null)
  const [countDraft, setCountDraft] = useState('')
  const [saved, setSaved] = useState(false)

  const { data: labourers } = useQuery(() => listLabourers(false), [])
  const { data: heads } = useQuery(() => listHeads(false), [])
  const { data: activities } = useQuery(() => listActivities(false), [])
  const { data: subHeads } = useQuery(() => listSubHeads(false), [])

  const selected = useMemo(
    () => (labourers ?? []).filter((l) => selectedIds.includes(l.id)),
    [labourers, selectedIds],
  )

  // A group lead among the selection turns on crew sizes for every day.
  const lead = selected.find((l) => l.is_group_lead === 1) ?? null
  const defaultCount = lead?.typical_group_size ?? 1

  const from = monthStart(`${year}-${String(monthIndex + 1).padStart(2, '0')}-01`)
  const to = monthEnd(from)

  const { data: existing } = useQuery(
    () =>
      selectedIds.length === 1
        ? attendanceInMonth(selectedIds[0], from, to)
        : Promise.resolve([]),
    [selectedIds.join(','), from, to],
  )

  const alreadyRecorded = useMemo(
    () => new Set((existing ?? []).map((e) => e.date)),
    [existing],
  )

  // Re-base crew sizes when the lead changes, but leave days the farmer has
  // already overridden alone.
  useEffect(() => {
    setSelection((prev) => {
      if (prev.size === 0) return prev
      const next = new Map(prev)
      for (const [date, sel] of next) {
        if (sel.count === 1 || sel.count === defaultCount) next.set(date, { ...sel, count: defaultCount })
      }
      return next
    })
  }, [defaultCount])

  function cycle(date: ISODate) {
    setSelection((prev) => {
      const next = new Map(prev)
      const cur = next.get(date)
      if (!cur) next.set(date, { fraction: FULL_DAY, count: defaultCount })
      else if (cur.fraction === FULL_DAY) next.set(date, { ...cur, fraction: HALF_DAY })
      else next.delete(date)
      return next
    })
  }

  function openCount(date: ISODate) {
    if (!lead) return
    const cur = selection.get(date)
    setCountDraft(String(cur?.count ?? defaultCount))
    setCountSheetFor(date)
  }

  function applyCount() {
    if (!countSheetFor) return
    const n = Math.max(1, parseInt(countDraft, 10) || 1)
    setSelection((prev) => {
      const next = new Map(prev)
      const cur = next.get(countSheetFor) ?? { fraction: FULL_DAY, count: n }
      next.set(countSheetFor, { ...cur, count: n })
      return next
    })
    setCountSheetFor(null)
  }

  /** Live total, so the figure is known before it is committed. */
  const summary = useMemo(() => {
    let total = 0
    let days = 0
    let personDays = 0

    for (const [, sel] of selection) {
      for (const l of selected) {
        const size = l.is_group_lead ? sel.count : 1
        total += attendanceAmountPaise(sel.fraction, l.daily_rate_paise, l.half_day_rate_paise, size)
        personDays += (sel.fraction / FULL_DAY) * size
      }
      days += sel.fraction / FULL_DAY
    }
    return { total, days, personDays }
  }, [selection, selected])

  const valid = selectedIds.length > 0 && selection.size > 0

  async function submit() {
    if (!valid) return

    const activity = activities?.find((a) => a.id === activityId)
    const labourSubHead =
      activity?.sub_head_id ?? (subHeads ?? []).find((s) => s.is_labour === 1)?.id ?? null

    const days: Parameters<typeof saveWorkSession>[0]['days'] = []
    for (const [date, sel] of selection) {
      for (const l of selected) {
        days.push({
          labourer_id: l.id,
          date,
          day_fraction: sel.fraction,
          group_size: l.is_group_lead ? sel.count : 1,
          is_group: l.is_group_lead,
          daily_rate_paise: l.daily_rate_paise,
          half_day_rate_paise: l.half_day_rate_paise,
        })
      }
    }

    await saveWorkSession({
      head_id: headId,
      activity_id: activityId,
      sub_head_id: labourSubHead,
      note: note.trim() || null,
      days,
    })

    setSelection(new Map())
    setNote('')
    setSaved(true)
    setTimeout(() => setSaved(false), 1800)
  }

  if (labourers && labourers.length === 0) {
    return (
      <Shell title={t('labour.addWork')} onBack={back} right={<span />}>
        <Page>
          <div className="card p-6 text-center space-y-3">
            <Users size={28} className="mx-auto" style={{ color: 'var(--text-faint)' }} />
            <p className="text-sm" style={{ color: 'var(--text-soft)' }}>
              {t('labour.noLabourers')}
            </p>
            <Button onClick={() => navigate('/settings/labourers')}>{t('common.add')}</Button>
          </div>
        </Page>
      </Shell>
    )
  }

  return (
    <Shell title={t('labour.addWork')} onBack={back} right={<span />}>
      <Page>
        <Field label={t('labour.labourers')} hint="Pick everyone who did the same job on the same days.">
          <div className="flex flex-wrap gap-2">
            {(labourers ?? []).map((l) => {
              const on = selectedIds.includes(l.id)
              return (
                <button
                  key={l.id}
                  onClick={() =>
                    setSelectedIds((prev) =>
                      prev.includes(l.id) ? prev.filter((x) => x !== l.id) : [...prev, l.id],
                    )
                  }
                  className="rounded-full px-3.5 py-2 text-sm font-medium border"
                  style={{
                    minHeight: 42,
                    borderColor: on ? 'var(--color-brand-500)' : 'var(--border)',
                    background: on ? 'var(--color-brand-500)' : 'var(--surface)',
                    color: on ? '#fff' : 'var(--text-soft)',
                  }}
                >
                  {l.is_group_lead ? <Users size={13} className="inline mr-1 -mt-0.5" /> : null}
                  {nameOf(l)}
                </button>
              )
            })}
          </div>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label={t('entry.head')}>
            <Select
              value={headId}
              onChange={setHeadId}
              placeholder={t('common.select')}
              options={(heads ?? []).map((h) => ({ value: h.id, label: nameOf(h) }))}
            />
          </Field>
          <Field label={t('entry.activity')}>
            <Select
              value={activityId}
              onChange={setActivityId}
              placeholder={t('common.select')}
              options={(activities ?? []).map((a) => ({ value: a.id, label: nameOf(a) }))}
            />
          </Field>
        </div>

        <Field
          label={t('labour.selectDays')}
          hint={
            lead
              ? 'Tap once for a full day, again for half. Press and hold a day to change how many people came.'
              : 'Tap once for a full day, tap again for half a day.'
          }
        >
          <MonthCalendar
            year={year}
            monthIndex={monthIndex}
            selection={selection}
            onCycle={cycle}
            onLongPress={lead ? openCount : undefined}
            alreadyRecorded={alreadyRecorded}
            onMonthChange={(y, m) => {
              setYear(y)
              setMonthIndex(m)
            }}
          />
        </Field>

        {selection.size > 0 ? (
          <div className="card p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold">
                {summary.days} {t('labour.daysWorked')}
              </p>
              {summary.personDays !== summary.days ? (
                <p className="text-xs" style={{ color: 'var(--text-faint)' }}>
                  {summary.personDays} {t('labour.personDays')}
                </p>
              ) : null}
            </div>
            <p className="text-xl font-semibold tnum" style={{ color: 'var(--color-brand-600)' }}>
              {formatRupees(summary.total)}
            </p>
          </div>
        ) : null}

        <Field label={t('common.note')}>
          <TextArea value={note} onChange={setNote} />
        </Field>

        <div className="sticky bottom-2">
          <button
            onClick={submit}
            disabled={!valid}
            className="w-full rounded-xl py-4 font-semibold text-white text-lg flex items-center justify-center gap-2"
            style={{ background: 'var(--color-brand-500)', opacity: valid ? 1 : 0.45 }}
          >
            {saved ? (
              <>
                <Check size={20} /> {t('entry.saved')}
              </>
            ) : (
              `${t('common.save')} ${summary.total ? formatRupees(summary.total) : ''}`
            )}
          </button>
          <p className="text-center text-xs mt-2" style={{ color: 'var(--text-faint)' }}>
            This records work only. The expense appears when you pay.
          </p>
        </div>

        <Sheet
          open={!!countSheetFor}
          onClose={() => setCountSheetFor(null)}
          title={t('labour.groupSize')}
          footer={
            <Button full onClick={applyCount}>
              {t('common.done')}
            </Button>
          }
        >
          <Field label={t('labour.groupSize')} hint="Just for this day.">
            <Input
              value={countDraft}
              onChange={(v) => setCountDraft(v.replace(/\D/g, '').slice(0, 3))}
              inputMode="numeric"
              autoFocus
            />
          </Field>
          <div className="flex flex-wrap gap-2">
            {[4, 6, 8, 10, 12, 15, 20].map((n) => (
              <button
                key={n}
                onClick={() => setCountDraft(String(n))}
                className="rounded-full px-4 py-2 text-sm font-semibold border"
                style={{ borderColor: 'var(--border)', color: 'var(--text-soft)' }}
              >
                {n}
              </button>
            ))}
          </div>
        </Sheet>
      </Page>
    </Shell>
  )
}
