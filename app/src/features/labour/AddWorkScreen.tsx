import { useEffect, useMemo, useState } from 'react'
import { Check, Users } from 'lucide-react'
import { Page, Shell } from '@/components/Shell'
import {
  Button, ChipSingle, Field, Input, MoneyInput, QuantityInput, Select, TextArea,
} from '@/components/ui'
import { MonthCalendar, type DaySelection } from '@/components/MonthCalendar'
import { SearchMultiSelect } from '@/components/SearchPicker'
import { MissingHint } from '@/features/entries/EntryForm'
import { useQuery } from '@/hooks/useQuery'
import {
  getSetting, listActivities, listCropHeads, listLabourersByUse, listPlots, listSubHeads,
  listUnits, setSetting,
} from '@/data/masterData'
import { recordedFractions, saveWorkSession } from '@/data/labour'
import { useI18n } from '@/i18n'
import { formatRupees } from '@/lib/money'
import { attendanceAmountPaise, crewWagePaise } from '@/lib/labour'
import { lineTotalPaise } from '@/lib/quantity'
import { FULL_DAY, HALF_DAY } from '@/db/types'
import { addMonths, monthEnd, monthStart, todayISO } from '@/lib/date'
import { back, navigate } from '@/router'
import type { ISODate, WorkBasis } from '@/db/types'

/** What each way of being paid means, in the farmer's own terms. */
const BASIS_HINT: Record<WorkBasis, string> = {
  day: 'A day rate, times the days they came.',
  hour: 'Machinery and its operator, by the hour at an agreed rate.',
  piece: 'Paid per litre or per bag. The price is agreed when the job finishes.',
  lump: 'One agreed figure for the whole job.',
  salary: 'A fixed worker, paid by the month.',
}

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
  const [plotId, setPlotId] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [selection, setSelection] = useState<Map<ISODate, DaySelection>>(new Map())
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /**
   * How this job is paid for.
   *
   * A day rate was the only thing the app could express, and most of the work
   * on this farm is not a day rate. Spraying is per litre at a price agreed
   * afterwards; coconut plucking is whatever was asked; a fixed worker draws
   * a month. Each needs different fields, so this choice comes first and the
   * rest of the form follows it.
   */
  const [basis, setBasis] = useState<WorkBasis>('day')
  /** Piece work: litres per selected day, and what they are measured in. */
  const [quantity, setQuantity] = useState<number | null>(null)
  const [unitId, setUnitId] = useState<string | null>(null)
  /** Lump-sum work: the figure agreed for the job. */
  const [lumpAmount, setLumpAmount] = useState<number | null>(null)
  /** Hourly work: what the machine and its operator cost per hour. */
  const [hourRate, setHourRate] = useState<number | null>(null)

  /**
   * Crew composition, shown as plain fields.
   *
   * This was a press-and-hold on a calendar day, which nobody discovers — a
   * gesture with no affordance is a feature that does not exist. It now sits
   * on the screen as two number fields, applied to every day selected.
   */
  const [males, setMales] = useState('')
  const [females, setFemales] = useState('')
  const [maleRate, setMaleRate] = useState<number | null>(null)
  const [femaleRate, setFemaleRate] = useState<number | null>(null)

  /**
   * A day rate for workers who do not have one yet.
   *
   * A worker could be added without a rate — the field is optional, because
   * often nobody has settled it yet — and every day recorded for them then
   * came out at ₹0. Filling the rate in on the worker afterwards did not fix
   * those days and never can: the rate on an attendance row is a snapshot,
   * and rewriting it would rewrite what last season cost too.
   *
   * So the rate is asked for HERE, at the moment the work is recorded, and
   * written onto these days only. Days already recorded at zero are repaired
   * from Team → work waiting for a price.
   */
  const [dayRate, setDayRate] = useState<number | null>(null)

  /**
   * Who worked a HALF day, when the rest of the crew worked a full one.
   *
   * Twelve people turn up for the same job; eleven stay all day and one leaves
   * at noon. There was no way to say that — the calendar sets one fraction for
   * everybody — so the farmer had to save eleven people, then start the whole
   * form again for the twelfth: same crop, same work, same plot, same date,
   * typed twice. Most people will not do that, so the half day quietly became
   * a full one.
   *
   * An override set, not a fraction per person: the common case is that
   * everybody matches the calendar, and only the exceptions are worth storing.
   */
  const [halfDayIds, setHalfDayIds] = useState<string[]>([])

  /*
   * MOST-USED FIRST, not alphabetical.
   *
   * Four or five people come most weeks; a dozen came twice last year. The
   * alphabet knows nothing about that difference, so the names picked daily
   * sat below names never picked at all. Ninety days is the window — long
   * enough to survive a quiet fortnight, short enough that last season's crew
   * does not outrank this season's.
   */
  const usageSince = useMemo(() => addMonths(todayISO(), -3), [])
  const { data: labourers } = useQuery(() => listLabourersByUse(usageSince, false), [usageSince])
  /*
   * CROPS ONLY.
   *
   * This asked `listHeads`, which returns every head the farm has — so the
   * crop picker on a worker's attendance offered Vehicle, Household and
   * Personal. Nobody weeds a car. Work happens on land, so the list is the
   * land.
   */
  const { data: heads } = useQuery(() => listCropHeads(false), [])
  const { data: activities } = useQuery(() => listActivities(false), [])
  const { data: subHeads } = useQuery(() => listSubHeads(false), [])
  const { data: plots } = useQuery(() => listPlots(false), [])
  const { data: units } = useQuery(() => listUnits(false), [])

  /**
   * What the last session was for, offered again.
   *
   * The crop, the work and the plot are the same for days on end — a farm
   * harvests arecanut for a fortnight — and re-picking all three every time is
   * most of the typing on this screen. They are restored on arrival and stay
   * fully editable; nothing is guessed that the farmer cannot see and change.
   */
  useEffect(() => {
    let cancelled = false
    void Promise.all([
      getSetting('work.lastHead'),
      getSetting('work.lastActivity'),
      getSetting('work.lastPlot'),
    ]).then(([h, a, pl]) => {
      if (cancelled) return
      if (h) setHeadId((v) => v ?? h)
      if (a) setActivityId((v) => v ?? a)
      if (pl) setPlotId((v) => v ?? pl)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const selected = useMemo(
    () => (labourers ?? []).filter((l) => selectedIds.includes(l.id)),
    [labourers, selectedIds],
  )

  // A group lead among the selection turns on crew sizes for every day.
  const lead = selected.find((l) => l.is_group_lead === 1) ?? null
  const maleCount = lead ? Math.max(0, parseInt(males, 10) || 0) : 1
  const femaleCount = lead ? Math.max(0, parseInt(females, 10) || 0) : 0
  const defaultCount = Math.max(1, maleCount + femaleCount)

  // Rates default to the lead's own, and stay editable because a crew's rate
  // is negotiated per job as often as not.
  useEffect(() => {
    if (!lead) return
    setMaleRate((r) => r ?? lead.daily_rate_paise)
    setFemaleRate((r) => r ?? lead.female_rate_paise ?? lead.daily_rate_paise)
    setMales((m) => m || String(lead.typical_group_size ?? ''))
  }, [lead])

  /**
   * Choosing the work sets how it is paid for.
   *
   * "Tractor ploughing" is hourly at a rate that barely moves; restating that
   * every time is how the wrong basis gets picked and a day's hire lands in
   * the books as a day's wage. Everything it sets stays editable below.
   */
  const activity = (activities ?? []).find((a) => a.id === activityId) ?? null
  useEffect(() => {
    if (!activity) return
    setBasis(activity.default_basis)
    if (activity.default_unit_id) setUnitId(activity.default_unit_id)
    if (activity.default_rate_paise != null) {
      if (activity.default_basis === 'hour') setHourRate(activity.default_rate_paise)
      if (activity.default_basis === 'lump') setLumpAmount(activity.default_rate_paise)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activityId, activities])

  const chosenUnit = (units ?? []).find((u) => u.id === unitId)
  const unitShort = chosenUnit ? nameOf(chosenUnit) : ''

  const from = monthStart(`${year}-${String(monthIndex + 1).padStart(2, '0')}-01`)
  const to = monthEnd(from)

  /*
   * EVERY selected person's existing days, not just the first.
   *
   * This asked only when exactly one person was picked, so recording a crew
   * showed a blank calendar even where half of them were already down for
   * those days — and the duplicate it invited is the exact bug that doubled a
   * worker's wage. A day is marked when ANYONE selected is already fully
   * booked on it, because that is the day that cannot be saved.
   */
  const { data: booked } = useQuery(
    () => recordedFractions(selectedIds, from, to),
    [selectedIds.join(','), from, to],
  )

  const alreadyRecorded = useMemo(() => {
    const out = new Set<ISODate>()
    if (!booked) return out
    for (const [key, used] of booked) {
      if (used >= FULL_DAY) out.add(key.split('|')[1] as ISODate)
    }
    return out
  }, [booked])

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

  /** Live total, so the figure is known before it is committed. */
  const summary = useMemo(() => {
    let total = 0
    let days = 0
    let personDays = 0

    // Piece work has NO total yet, and that is the whole point of it: the
    // price is agreed when the job finishes. Showing a zero here would be
    // read as "this work is worth nothing".
    if (basis === 'piece') {
      return {
        total: null,
        days: selection.size,
        personDays: selection.size * selected.length,
      }
    }

    // Hours are known and so is the rate, so the figure is real right away.
    if (basis === 'hour') {
      const perPerson = lineTotalPaise(quantity ?? 0, hourRate ?? 0)
      return {
        total: perPerson * selected.length * selection.size,
        days: selection.size,
        personDays: selection.size * selected.length,
      }
    }

    if (basis === 'lump') {
      return {
        total: (lumpAmount ?? 0) * selected.length,
        days: selection.size,
        personDays: selection.size * selected.length,
      }
    }

    for (const [, sel] of selection) {
      for (const l of selected) {
        if (l.is_group_lead) {
          total += crewWagePaise(
            sel.fraction,
            maleCount,
            maleRate ?? l.daily_rate_paise,
            femaleCount,
            femaleRate ?? l.daily_rate_paise,
          )
          personDays += (sel.fraction / FULL_DAY) * Math.max(1, maleCount + femaleCount)
        } else {
          // Inlined rather than calling fractionFor: a closure over halfDayIds
          // would have to be a dependency of this memo, and the rule is the
          // one line below.
          const f = halfDayIds.includes(l.id)
            ? Math.min(sel.fraction, HALF_DAY)
            : sel.fraction
          total += attendanceAmountPaise(
            f,
            l.daily_rate_paise > 0 ? l.daily_rate_paise : (dayRate ?? 0),
            l.half_day_rate_paise,
            1,
          )
          personDays += f / FULL_DAY
        }
      }
      days += sel.fraction / FULL_DAY
    }
    return { total: total as number | null, days, personDays }
  }, [
    selection, selected, maleCount, femaleCount, maleRate, femaleRate,
    basis, lumpAmount, quantity, hourRate, dayRate, halfDayIds,
  ])

  /**
   * What fraction of the day ONE person worked.
   *
   * The calendar sets the day; this is the exception. Clamped rather than
   * multiplied, so marking somebody half on a day that is already a half day
   * leaves them at a half rather than inventing a quarter nobody worked.
   */
  const fractionFor = (labourerId: string, dayFraction: number) =>
    halfDayIds.includes(labourerId) ? Math.min(dayFraction, HALF_DAY) : dayFraction

  /* Somebody deselected should not keep a half-day mark waiting for them. */
  useEffect(() => {
    setHalfDayIds((ids) => ids.filter((id) => selectedIds.includes(id)))
  }, [selectedIds])

  /* A worker's own rate wins. The field only stands in where there is none. */
  const rateFor = (l: { daily_rate_paise: number }) =>
    l.daily_rate_paise > 0 ? l.daily_rate_paise : (dayRate ?? 0)

  /* Who on this screen has no rate of their own. Named, so the farmer knows
     whose wage they are being asked to settle rather than just seeing a
     field appear. */
  const unrated = selected.filter((l) => l.is_group_lead !== 1 && l.daily_rate_paise <= 0)

  // A plot is required once the farm has entered any, matching the entry form:
  // labour recorded against no land leaves a hole in every plot report, and
  // wages are usually the largest thing in it.
  const needsPlot = (plots ?? []).length > 0 && !plotId
  const needsQuantity = (basis === 'piece' || basis === 'hour') && (!quantity || quantity <= 0)
  const needsUnit = basis === 'piece' && !unitId
  const needsHourRate = basis === 'hour' && (!hourRate || hourRate <= 0)
  const needsLump = basis === 'lump' && (!lumpAmount || lumpAmount <= 0)
  /*
   * A day of work worth ₹0 is never what anybody meant. It used to save
   * silently, and the farmer found out months later when the crop's labour
   * cost read zero. The button now says what is missing.
   */
  const needsDayRate =
    basis === 'day' && selection.size > 0 && selectedIds.length > 0 && (summary.total ?? 0) <= 0
  const valid =
    selectedIds.length > 0 &&
    selection.size > 0 &&
    !needsPlot &&
    !needsQuantity &&
    !needsUnit &&
    !needsHourRate &&
    !needsLump &&
    !needsDayRate

  async function submit() {
    if (!valid) return

    const activity = activities?.find((a) => a.id === activityId)
    const labourSubHead =
      activity?.sub_head_id ?? (subHeads ?? []).find((s) => s.is_labour === 1)?.id ?? null

    const days: Parameters<typeof saveWorkSession>[0]['days'] = []
    for (const [date, sel] of selection) {
      for (const l of selected) {
        const isCrew = l.is_group_lead === 1
        days.push({
          labourer_id: l.id,
          date,
          day_fraction: fractionFor(l.id, sel.fraction),
          is_group: l.is_group_lead,
          daily_rate_paise: rateFor(l),
          half_day_rate_paise: l.half_day_rate_paise,
          male_count: isCrew ? maleCount : 1,
          female_count: isCrew ? femaleCount : 0,
          male_rate_paise: isCrew ? (maleRate ?? rateFor(l)) : rateFor(l),
          female_rate_paise: isCrew ? (femaleRate ?? rateFor(l)) : 0,
          // The quantity is per person per day: two people spraying 100 litres
          // each is 200 litres of work, and the price is per litre sprayed.
          quantity_milli: basis === 'piece' || basis === 'hour' ? quantity : null,
          amount_paise: basis === 'lump' ? lumpAmount : null,
        })
      }
    }

    try {
      await saveWorkSession({
        head_id: headId,
        activity_id: activityId,
        sub_head_id: labourSubHead,
        plot_id: plotId,
        basis,
        unit_id: basis === 'piece' ? unitId : null,
        // Hourly work knows its rate now. Piece work deliberately does not —
        // it is priced when the job finishes, from the Team screen.
        rate_paise: basis === 'hour' ? hourRate : null,
        note: note.trim() || null,
        days,
      })
    } catch (err) {
      // The data layer refuses to book somebody twice in one day and names who.
      // Said in Kannada here rather than handing the farmer a raw message.
      const code = (err as { code?: string } | null)?.code
      const detail = err instanceof Error ? err.message : String(err)
      setError(code === 'ALREADY_RECORDED' ? `${t('labour.alreadyRecorded')} ${detail}` : detail)
      return
    }

    setSelection(new Map())
    setNote('')
    setQuantity(null)
    setLumpAmount(null)
    setHourRate(null)
    setDayRate(null)
    setHalfDayIds([])

    // Offered again next time. Saved after the write, so a session that failed
    // to save never teaches the form the wrong thing.
    void setSetting('work.lastHead', headId ?? '')
    void setSetting('work.lastActivity', activityId ?? '')
    void setSetting('work.lastPlot', plotId ?? '')
    setError(null)
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
        <Field label={t('labour.labourers')} hint="Pick everyone who did the same job on the same days." required>
          <SearchMultiSelect
            title={t('labour.labourers')}
            placeholder={t('common.select')}
            options={(labourers ?? []).map((l) => ({
              value: l.id,
              label: nameOf(l),
              // Searchable by both names and by code, because the keyboard in
              // the farmer's hand is usually the English one either way.
              search: `${l.name_en} ${l.name_kn} ${l.code ?? ''}`,
              hint: [
                l.is_group_lead ? t('labour.groupLead') : null,
                l.employment === 'monthly' ? t('labour.monthly') : null,
                l.village,
              ]
                .filter(Boolean)
                .join(' · '),
            }))}
            selected={selectedIds}
            onChange={setSelectedIds}
          />
        </Field>

        {/*
          How the work is paid for, chosen before anything else, because it
          decides what the rest of the form even asks. Four chips rather than a
          dropdown: it is the shape of the whole screen, so it should be
          visible rather than hidden behind a tap.
        */}
        <Field label={t('labour.basis')} hint={BASIS_HINT[basis]}>
          <ChipSingle
            options={[
              { value: 'day', label: t('labour.basisDay') },
              { value: 'hour', label: t('labour.basisHour') },
              { value: 'piece', label: t('labour.basisPiece') },
              { value: 'lump', label: t('labour.basisLump') },
            ]}
            value={basis}
            onChange={(v) => setBasis((v as WorkBasis) ?? 'day')}
          />
        </Field>

        {basis === 'hour' ? (
          <div className="grid grid-cols-2 gap-3">
            <Field label={t('labour.hoursPerDay')} required>
              <QuantityInput milli={quantity} onChange={setQuantity} suffix={t('labour.hours')} />
            </Field>
            <Field label={t('labour.hourRate')} required>
              <MoneyInput paise={hourRate} onChange={setHourRate} />
            </Field>
          </div>
        ) : null}

        {basis === 'piece' ? (
          <div className="grid grid-cols-2 gap-3">
            <Field label={t('labour.quantityPerDay')} required>
              <QuantityInput milli={quantity} onChange={setQuantity} suffix={unitShort} />
            </Field>
            <Field label={t('entry.unit')} required>
              <Select
                value={unitId}
                onChange={setUnitId}
                placeholder={t('common.select')}
                options={(units ?? []).map((u) => ({ value: u.id, label: nameOf(u) }))}
              />
            </Field>
          </div>
        ) : null}

        {basis === 'lump' ? (
          <Field label={t('labour.agreedAmount')} hint={t('labour.lumpHint')} required>
            <MoneyInput paise={lumpAmount} onChange={setLumpAmount} />
          </Field>
        ) : null}

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

        {/* Which land the crew was on. Every day in this session carries it,
            which is right: a crew moves to another plot on another day, and
            that is another session. */}
        {(plots ?? []).length > 0 ? (
          <Field label={t('plot.one')} required>
            <Select
              value={plotId}
              onChange={setPlotId}
              placeholder={t('common.select')}
              options={(plots ?? []).map((p) => ({ value: p.id, label: nameOf(p) }))}
            />
          </Field>
        ) : null}

        {/* Crew composition, on the screen rather than behind a long-press. */}
        {lead ? (
          <div className="card p-3.5 space-y-3">
            <p className="text-sm font-semibold">{t('labour.crewForTheDay')}</p>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t('labour.men')}>
                <Input
                  value={males}
                  onChange={(v) => setMales(v.replace(/\D/g, '').slice(0, 3))}
                  inputMode="numeric"
                  placeholder="0"
                />
              </Field>
              <Field label={t('labour.women')}>
                <Input
                  value={females}
                  onChange={(v) => setFemales(v.replace(/\D/g, '').slice(0, 3))}
                  inputMode="numeric"
                  placeholder="0"
                />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t('labour.menRate')}>
                <MoneyInput paise={maleRate} onChange={setMaleRate} />
              </Field>
              <Field label={t('labour.womenRate')}>
                <MoneyInput paise={femaleRate} onChange={setFemaleRate} />
              </Field>
            </div>
            {maleCount + femaleCount > 0 ? (
              <p className="text-xs" style={{ color: 'var(--text-faint)' }}>
                {maleCount + femaleCount} {t('labour.peopleTotal')} ·{' '}
                {formatRupees(
                  crewWagePaise(FULL_DAY, maleCount, maleRate ?? 0, femaleCount, femaleRate ?? 0),
                )}{' '}
                {t('labour.perDay')}
              </p>
            ) : null}
          </div>
        ) : null}

        {/* Only when somebody selected has no rate of their own. A farmer whose
            workers all have rates never sees this. */}
        {basis === 'day' && unrated.length > 0 ? (
          <Field
            label={t('labour.dayRate')}
            hint={`${unrated.map((l) => nameOf(l)).join(', ')} — ${t('labour.noRateYet')}`}
            required
          >
            <MoneyInput paise={dayRate} onChange={setDayRate} />
          </Field>
        ) : null}

        <Field
          label={t('labour.selectDays')}
          hint={t('labour.tapHint')}
        >
          <MonthCalendar
            year={year}
            monthIndex={monthIndex}
            selection={selection}
            onCycle={cycle}
            alreadyRecorded={alreadyRecorded}
            onMonthChange={(y, m) => {
              setYear(y)
              setMonthIndex(m)
            }}
          />
        </Field>

        {/*
          Who worked only half of it.

          Shown only when it can matter: day work, more than one person, and at
          least one day picked. For a single worker the calendar already says
          full or half with a tap, and a second control for the same fact would
          be two places to get it wrong.
        */}
        {basis === 'day' && selected.length > 1 && selection.size > 0 ? (
          <Field label={t('labour.whoHalfDay')} hint={t('labour.whoHalfDayHint')}>
            <div className="card rows overflow-hidden">
              {selected.map((l) => {
                const half = halfDayIds.includes(l.id)
                return (
                  <button
                    key={l.id}
                    onClick={() =>
                      setHalfDayIds((ids) =>
                        half ? ids.filter((x) => x !== l.id) : [...ids, l.id],
                      )
                    }
                    className="w-full flex items-center gap-3 px-4 py-3 text-left"
                  >
                    <span className="flex-1 font-medium truncate">{nameOf(l)}</span>
                    <span
                      className="text-sm font-semibold rounded-lg px-3 py-1.5 tnum"
                      style={{
                        background: half ? 'var(--color-brand-100)' : 'var(--surface-sunken)',
                        color: half ? 'var(--color-brand-700)' : 'var(--text-soft)',
                      }}
                    >
                      {half ? `½ ${t('labour.day')}` : `1 ${t('labour.day')}`}
                    </span>
                  </button>
                )
              })}
            </div>
          </Field>
        ) : null}

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
            {/* Piece work has no figure yet, and saying so is more honest than
                showing ₹0 — which reads as "this work earned nothing". */}
            <p
              className="text-xl font-semibold tnum text-right"
              style={{
                color: summary.total == null ? 'var(--text-faint)' : 'var(--color-brand-600)',
                fontSize: summary.total == null ? '0.8125rem' : undefined,
              }}
            >
              {summary.total == null ? t('labour.notPricedYet') : formatRupees(summary.total)}
            </p>
          </div>
        ) : null}

        <Field label={t('common.note')}>
          <TextArea value={note} onChange={setNote} />
        </Field>

        {error ? (
          <div
            className="card p-3 text-sm"
            style={{ background: 'var(--color-expense-soft)', color: 'var(--color-expense)' }}
          >
            {error}
          </div>
        ) : null}

        <div className="sticky bottom-2 space-y-1.5">
          {/* Say what is still needed. A greyed-out button with no explanation
              is the commonest way an app loses a day's work. */}
          {!saved && !valid ? (
            <MissingHint
              missing={[
                selectedIds.length === 0 ? t('labour.labourer') : null,
                selection.size === 0 ? t('labour.daysWorked') : null,
                needsPlot ? t('plot.one') : null,
              ].filter((x): x is string => !!x)}
            />
          ) : null}
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
            {t('labour.recordsWorkOnly')}
          </p>
        </div>
      </Page>
    </Shell>
  )
}
