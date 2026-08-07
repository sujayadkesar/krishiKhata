import { useEffect, useMemo, useState } from 'react'
import { Check } from 'lucide-react'
import { Page, Shell } from '@/components/Shell'
import {
  Button, ChipSingle, DateInput, Field, Input, MoneyInput, QuantityInput, Select, TextArea,
} from '@/components/ui'
import { useQuery } from '@/hooks/useQuery'
import {
  getHeadUnits, listAccounts, listActivities, listHeads, listSubHeads,
} from '@/data/masterData'
import { saveEntry } from '@/data/entries'
import { useI18n } from '@/i18n'
import { addDays, todayISO } from '@/lib/date'
import { lineTotalPaise } from '@/lib/quantity'
import { formatRupees } from '@/lib/money'
import { navigate } from '@/router'
import type { EntryKind } from '@/db/types'

/**
 * The entry screen: income, expense and transfer behind three tabs.
 *
 * The tab is a real mode switch rather than three separate screens, because
 * the farmer often does not decide which one they are recording until they
 * have thought about it — money moving from the bank to the pocket feels like
 * an expense until you remember it is not.
 */

const KIND_COLOR: Record<EntryKind, string> = {
  income: 'var(--color-income)',
  expense: 'var(--color-expense)',
  transfer: 'var(--color-transfer)',
}

const KIND_SOFT: Record<EntryKind, string> = {
  income: 'var(--color-income-soft)',
  expense: 'var(--color-expense-soft)',
  transfer: 'var(--color-transfer-soft)',
}

export function AddEntryScreen() {
  const { t, nameOf, lang } = useI18n()

  const [kind, setKind] = useState<EntryKind>('income')
  const [date, setDate] = useState(todayISO())
  const [headId, setHeadId] = useState<string | null>(null)
  const [subHeadId, setSubHeadId] = useState<string | null>(null)
  const [activityId, setActivityId] = useState<string | null>(null)
  const [accountId, setAccountId] = useState<string | null>(null)
  const [toAccountId, setToAccountId] = useState<string | null>(null)
  const [unitId, setUnitId] = useState<string | null>(null)
  const [quantityMilli, setQuantityMilli] = useState<number | null>(null)
  const [ratePaise, setRatePaise] = useState<number | null>(null)
  const [amountPaise, setAmountPaise] = useState<number | null>(null)
  const [party, setParty] = useState('')
  const [note, setNote] = useState('')
  const [saved, setSaved] = useState(false)

  /**
   * Once the farmer types a total by hand it stops being recomputed. The
   * trader rounds ₹1,247.50 to ₹1,250 and the app must not argue with the
   * money that actually changed hands.
   */
  const [totalTouched, setTotalTouched] = useState(false)

  const { data: heads } = useQuery(() => listHeads(false), [])
  const { data: subHeads } = useQuery(() => listSubHeads(false), [])
  const { data: activities } = useQuery(() => listActivities(false), [])
  const { data: accounts } = useQuery(() => listAccounts(false), [])
  const { data: headUnits } = useQuery(
    () => (headId ? getHeadUnits(headId) : Promise.resolve([])),
    [headId],
  )

  // Default to the first account so the commonest case is zero taps.
  useEffect(() => {
    if (!accountId && accounts?.length) setAccountId(accounts[0].id)
  }, [accounts, accountId])

  // When the crop changes, offer its default unit.
  useEffect(() => {
    if (!headUnits?.length) return
    setUnitId((current) =>
      current && headUnits.some((u) => u.unit_id === current) ? current : headUnits[0].unit_id,
    )
  }, [headUnits])

  // Choosing the work pre-selects the kind of spend it usually belongs to.
  useEffect(() => {
    if (!activityId) return
    const act = activities?.find((a) => a.id === activityId)
    if (act?.sub_head_id) setSubHeadId(act.sub_head_id)
  }, [activityId, activities])

  const computedTotal = useMemo(
    () =>
      quantityMilli != null && ratePaise != null ? lineTotalPaise(quantityMilli, ratePaise) : null,
    [quantityMilli, ratePaise],
  )

  useEffect(() => {
    if (kind !== 'income' || totalTouched) return
    if (computedTotal != null) setAmountPaise(computedTotal)
  }, [computedTotal, kind, totalTouched])

  const visibleHeads = (heads ?? []).filter(
    (h) => h.used_for === 'both' || h.used_for === (kind === 'income' ? 'income' : 'expense'),
  )

  const activityOptions = (activities ?? []).filter(
    (a) => !subHeadId || !a.sub_head_id || a.sub_head_id === subHeadId,
  )

  const sameAccount = kind === 'transfer' && !!accountId && accountId === toAccountId
  const valid =
    !!amountPaise &&
    amountPaise > 0 &&
    !!accountId &&
    (kind !== 'transfer' || (!!toAccountId && !sameAccount))

  function reset() {
    setHeadId(null)
    setSubHeadId(null)
    setActivityId(null)
    setUnitId(null)
    setQuantityMilli(null)
    setRatePaise(null)
    setAmountPaise(null)
    setParty('')
    setNote('')
    setTotalTouched(false)
  }

  async function submit() {
    if (!valid) return
    await saveEntry({
      kind,
      date,
      head_id: kind === 'transfer' ? null : headId,
      sub_head_id: kind === 'expense' ? subHeadId : null,
      activity_id: kind === 'expense' ? activityId : null,
      account_id: accountId,
      to_account_id: kind === 'transfer' ? toAccountId : null,
      quantity_milli: kind === 'income' ? quantityMilli : null,
      unit_id: kind === 'income' ? unitId : null,
      rate_paise: kind === 'income' ? ratePaise : null,
      amount_paise: amountPaise!,
      party_name: party.trim() || null,
      note: note.trim() || null,
    })
    reset()
    setSaved(true)
    setTimeout(() => setSaved(false), 1800)
  }

  const accountOptions = (accounts ?? []).map((a) => ({ value: a.id, label: nameOf(a) }))
  const unit = headUnits?.find((u) => u.unit_id === unitId)
  // Unit codes stay single-language — "ಕೆ.ಜಿ · kg" inside a field suffix is noise.
  const unitShort = unit ? (lang === 'en' ? unit.short_en : unit.short_kn) : ''

  return (
    <Shell title={t('nav.add')}>
      <Page>
        {/* Mode switch */}
        <div className="grid grid-cols-3 gap-2">
          {(['income', 'expense', 'transfer'] as EntryKind[]).map((k) => {
            const on = kind === k
            return (
              <button
                key={k}
                onClick={() => {
                  setKind(k)
                  setTotalTouched(false)
                }}
                className="rounded-xl py-3 font-semibold text-sm border"
                style={{
                  borderColor: on ? KIND_COLOR[k] : 'var(--border)',
                  background: on ? KIND_SOFT[k] : 'var(--surface-raised)',
                  color: on ? KIND_COLOR[k] : 'var(--text-soft)',
                }}
              >
                {t(`kind.${k}` as 'kind.income')}
              </button>
            )
          })}
        </div>

        <Field label={t('common.date')}>
          <div className="flex gap-2">
            <div className="flex-1">
              <DateInput value={date} onChange={setDate} />
            </div>
            <Button variant={date === todayISO() ? 'soft' : 'ghost'} onClick={() => setDate(todayISO())}>
              {t('common.today')}
            </Button>
            <Button
              variant={date === addDays(todayISO(), -1) ? 'soft' : 'ghost'}
              onClick={() => setDate(addDays(todayISO(), -1))}
            >
              {t('common.yesterday')}
            </Button>
          </div>
        </Field>

        {kind !== 'transfer' ? (
          <Field label={t('entry.head')}>
            <ChipSingle
              options={visibleHeads.map((h) => ({ value: h.id, label: nameOf(h) }))}
              value={headId}
              onChange={setHeadId}
            />
          </Field>
        ) : null}

        {/* ---------------------------------------------------- income -- */}
        {kind === 'income' ? (
          <>
            {headUnits && headUnits.length > 1 ? (
              <Field label={t('entry.unit')}>
                <ChipSingle
                  options={headUnits.map((u) => ({
                    value: u.unit_id,
                    label: `${nameOf(u)} (${lang === 'en' ? u.short_en : u.short_kn})`,
                  }))}
                  value={unitId}
                  onChange={setUnitId}
                />
              </Field>
            ) : null}

            <div className="grid grid-cols-2 gap-3">
              <Field label={t('entry.quantity')}>
                <QuantityInput
                  milli={quantityMilli}
                  onChange={setQuantityMilli}
                  suffix={unitShort}
                />
              </Field>
              <Field label={`${t('entry.rate')} / ${unitShort || '—'}`}>
                <MoneyInput paise={ratePaise} onChange={setRatePaise} />
              </Field>
            </div>
          </>
        ) : null}

        {/* --------------------------------------------------- expense -- */}
        {kind === 'expense' ? (
          <>
            <Field label={t('entry.subHead')}>
              <ChipSingle
                options={(subHeads ?? []).map((s) => ({ value: s.id, label: nameOf(s) }))}
                value={subHeadId}
                onChange={(v) => {
                  setSubHeadId(v)
                  setActivityId(null)
                }}
              />
            </Field>

            <Field
              label={t('entry.activity')}
              hint="The more exact this is, the more useful the crop report becomes."
            >
              <Select
                value={activityId}
                onChange={setActivityId}
                placeholder={t('common.select')}
                options={activityOptions.map((a) => ({ value: a.id, label: nameOf(a) }))}
              />
            </Field>
          </>
        ) : null}

        {/* -------------------------------------------------- transfer -- */}
        {kind === 'transfer' ? (
          <div className="grid grid-cols-2 gap-3">
            <Field label={t('entry.from')}>
              <Select value={accountId} onChange={setAccountId} options={accountOptions} />
            </Field>
            <Field label={t('entry.to')} error={sameAccount ? t('entry.sameAccount') : null}>
              <Select
                value={toAccountId}
                onChange={setToAccountId}
                placeholder={t('common.select')}
                options={accountOptions}
              />
            </Field>
          </div>
        ) : (
          <Field label={kind === 'income' ? t('entry.accountIn') : t('entry.accountOut')}>
            <Select value={accountId} onChange={setAccountId} options={accountOptions} />
          </Field>
        )}

        <Field
          label={t('common.total')}
          hint={
            kind === 'income' && computedTotal != null && !totalTouched
              ? `${t('entry.totalHint')} = ${formatRupees(computedTotal)}`
              : kind === 'income' && totalTouched
                ? 'Using the amount you typed, not quantity × rate.'
                : undefined
          }
        >
          <MoneyInput
            paise={amountPaise}
            onChange={(p) => {
              setAmountPaise(p)
              if (kind === 'income') setTotalTouched(true)
            }}
          />
        </Field>

        {kind !== 'transfer' ? (
          <Field label={kind === 'income' ? t('entry.buyer') : t('entry.shop')}>
            <Input
              value={party}
              onChange={setParty}
              placeholder={kind === 'income' ? 'ವ್ಯಾಪಾರಿ' : 'ಅಂಗಡಿ'}
            />
          </Field>
        ) : null}

        <Field label={t('common.note')}>
          <TextArea value={note} onChange={setNote} />
        </Field>

        <div className="sticky bottom-2 pt-1">
          <button
            onClick={submit}
            disabled={!valid}
            className="w-full rounded-xl py-4 font-semibold text-white text-lg flex items-center justify-center gap-2"
            style={{ background: KIND_COLOR[kind], opacity: valid ? 1 : 0.45 }}
          >
            {saved ? (
              <>
                <Check size={20} /> {t('entry.saved')}
              </>
            ) : (
              `${t('common.save')} ${amountPaise ? formatRupees(amountPaise) : ''}`
            )}
          </button>
        </div>

        <button
          className="w-full text-sm font-semibold"
          style={{ color: 'var(--text-faint)' }}
          onClick={() => navigate('/entries')}
        >
          {t('nav.entries')} →
        </button>
      </Page>
    </Shell>
  )
}
