import { useEffect, useMemo, useState } from 'react'
import { Check, Info } from 'lucide-react'
import { Page, Shell } from '@/components/Shell'
import { DateInput, Field, MoneyInput, Select, TextArea } from '@/components/ui'
import { useQuery } from '@/hooks/useQuery'
import { listAccounts, listLabourers, listSubHeads } from '@/data/masterData'
import { labourBalances, openWork, recordPayment } from '@/data/labour'
import { useI18n } from '@/i18n'
import { formatRupees } from '@/lib/money'
import { matchFifo } from '@/lib/labour'
import { formatDate, todayISO } from '@/lib/date'
import { back } from '@/router'
import type { PaymentMode } from '@/db/types'
import type { PaymentDirection } from '@/data/labour'

/**
 * Paying wages.
 *
 * The preview underneath the amount is the important part of this screen. A
 * lump sum against ten days of work is exactly where a farmer and a labourer
 * disagree later, so the app shows which days the money settles BEFORE it is
 * committed, and says plainly when part of it is running ahead as an advance.
 */

export function PayScreen({ labourerId }: { labourerId?: string }) {
  const { t, nameOf, lang } = useI18n()

  const [selectedId, setSelectedId] = useState<string | null>(labourerId ?? null)
  const [date, setDate] = useState(todayISO())
  const [amountPaise, setAmountPaise] = useState<number | null>(null)
  const [accountId, setAccountId] = useState<string | null>(null)
  const [mode, setMode] = useState<PaymentMode>('cash')
  const [note, setNote] = useState('')
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [direction, setDirection] = useState<PaymentDirection>('out')

  const { data: labourers } = useQuery(() => listLabourers(false), [])
  const { data: accounts } = useQuery(() => listAccounts(false), [])
  const { data: subHeads } = useQuery(() => listSubHeads(false), [])
  const { data: balances } = useQuery(() => labourBalances(false), [])
  const { data: outstanding } = useQuery(
    () => (selectedId ? openWork(selectedId) : Promise.resolve([])),
    [selectedId],
  )

  useEffect(() => {
    if (!accountId && accounts?.length) setAccountId(accounts[0].id)
  }, [accounts, accountId])

  const balance = balances?.find((b) => b.labourer_id === selectedId)
  const owed = Math.max(0, balance?.balance_paise ?? 0)

  /**
   * The same FIFO function the write path uses, run here purely to show what
   * will happen. Using a different rule for the preview than for the write is
   * how a preview becomes a lie.
   */
  const preview = useMemo(() => {
    // Money coming back settles nothing — it reduces an advance already held.
    if (direction === 'in') return { allocs: [], advance: 0 }
    if (!amountPaise || !outstanding?.length) return { allocs: [], advance: amountPaise ?? 0 }
    const allocs = matchFifo(
      [{ payment_id: 'preview', date, unallocated_paise: amountPaise }],
      outstanding,
    )
    const used = allocs.reduce((s, a) => s + a.amount_paise, 0)
    return { allocs, advance: amountPaise - used }
  }, [amountPaise, outstanding, date, direction])

  const valid = !!selectedId && !!amountPaise && amountPaise > 0 && !!accountId

  async function submit() {
    if (!valid) return
    setError(null)
    const labourSubHead = (subHeads ?? []).find((s) => s.is_labour === 1)?.id ?? null

    try {
      await recordPayment({
        labourer_id: selectedId!,
        date,
        account_id: accountId!,
        amount_paise: amountPaise!,
        mode,
        note: note.trim() || null,
        sub_head_id: labourSubHead,
        direction,
      })
    } catch (err) {
      // Silence here is what made this look like the app simply refusing to
      // save. Whatever went wrong, the farmer should see it.
      setError(err instanceof Error ? err.message : String(err))
      return
    }

    setAmountPaise(null)
    setNote('')
    setSaved(true)
    setTimeout(() => setSaved(false), 1800)
  }

  const dayOf = (attendanceId: string) => outstanding?.find((w) => w.attendance_id === attendanceId)

  return (
    <Shell title={t('labour.pay')} onBack={back} right={<span />}>
      <Page>
        {/* Money moves both ways in a khata. A labourer who took an advance
            often returns part of it in cash rather than working it off, and
            with no way to record that the balance stays wrong forever. */}
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              ['out', t('labour.payOut'), 'var(--color-expense)'],
              ['in', t('labour.payIn'), 'var(--color-income)'],
            ] as [PaymentDirection, string, string][]
          ).map(([dir, label, colour]) => {
            const on = direction === dir
            return (
              <button
                key={dir}
                onClick={() => setDirection(dir)}
                className="rounded-xl py-3 font-semibold text-sm border"
                style={{
                  borderColor: on ? colour : 'var(--border)',
                  background: on ? colour : 'var(--surface-raised)',
                  color: on ? '#fff' : 'var(--text-soft)',
                }}
              >
                {label}
              </button>
            )
          })}
        </div>

        <Field label={t('labour.payTo')}>
          <Select
            value={selectedId}
            onChange={setSelectedId}
            placeholder={t('common.select')}
            options={(labourers ?? []).map((l) => {
              const b = balances?.find((x) => x.labourer_id === l.id)
              const suffix = b && b.balance_paise > 0 ? ` — ${formatRupees(b.balance_paise)}` : ''
              return { value: l.id, label: `${nameOf(l)}${suffix}` }
            })}
          />
        </Field>

        {selectedId ? (
          <div className="card p-4 flex items-center justify-between">
            <span className="text-sm font-semibold" style={{ color: 'var(--text-soft)' }}>
              {t('labour.outstanding')}
            </span>
            <span
              className="text-xl font-semibold tnum"
              style={{ color: owed > 0 ? 'var(--color-expense)' : 'var(--text-faint)' }}
            >
              {formatRupees(owed)}
            </span>
          </div>
        ) : null}

        <Field label={t('common.date')}>
          <DateInput value={date} onChange={setDate} />
        </Field>

        <Field label={t('common.amount')}>
          <MoneyInput paise={amountPaise} onChange={setAmountPaise} />
          {owed > 0 ? (
            <button
              className="mt-2 text-sm font-semibold"
              style={{ color: 'var(--color-brand-600)' }}
              onClick={() => setAmountPaise(owed)}
            >
              {t('common.all')} · {formatRupees(owed)}
            </button>
          ) : null}
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label={t('entry.accountOut')}>
            <Select
              value={accountId}
              onChange={setAccountId}
              options={(accounts ?? []).map((a) => ({ value: a.id, label: nameOf(a) }))}
            />
          </Field>
          <Field label="Mode">
            <Select
              value={mode}
              onChange={setMode}
              options={[
                { value: 'cash', label: 'Cash · ನಗದು' },
                { value: 'upi', label: 'UPI' },
                { value: 'bank', label: 'Bank' },
              ]}
            />
          </Field>
        </div>

        {/* What this payment will settle */}
        {amountPaise && preview.allocs.length > 0 ? (
          <div>
            <p className="field-label">{t('labour.settles')}</p>
            <div className="card divide-y" style={{ borderColor: 'var(--border)' }}>
              {preview.allocs.map((a) => {
                const w = dayOf(a.attendance_id)
                return (
                  <div
                    key={a.attendance_id}
                    className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm"
                  >
                    <span>{w ? formatDate(w.date, lang) : ''}</span>
                    <span className="tnum" style={{ color: 'var(--text-soft)' }}>
                      {formatRupees(a.amount_paise)}
                      {w && a.amount_paise < w.unpaid_paise ? (
                        <span style={{ color: 'var(--color-earth-700)' }}> (part)</span>
                      ) : null}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        ) : null}

        {amountPaise && preview.advance > 0 ? (
          <div
            className="card p-3 text-sm flex gap-2"
            style={{
              background: 'var(--color-earth-100)',
              borderColor: 'var(--color-earth-300)',
              color: 'var(--color-earth-700)',
            }}
          >
            <Info size={17} className="shrink-0 mt-0.5" />
            <span>
              {formatRupees(preview.advance)} of this is more than the work outstanding. It
              stays as an advance and is used up automatically the next time they work.
            </span>
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

        <div className="sticky bottom-2">
          <button
            onClick={submit}
            disabled={!valid}
            className="w-full rounded-xl py-4 font-semibold text-white text-lg flex items-center justify-center gap-2"
            style={{
              background: direction === 'in' ? 'var(--color-income)' : 'var(--color-expense)',
              opacity: valid ? 1 : 0.45,
            }}
          >
            {saved ? (
              <>
                <Check size={20} /> {t('entry.saved')}
              </>
            ) : (
              `${direction === 'in' ? t('labour.payIn') : t('labour.pay')} ${
                amountPaise ? formatRupees(amountPaise) : ''
              }`
            )}
          </button>
          <p className="text-center text-xs mt-2" style={{ color: 'var(--text-faint)' }}>
            {direction === 'in' ? t('labour.repayNote') : t('labour.payExpenseNote')}
          </p>
        </div>
      </Page>
    </Shell>
  )
}
