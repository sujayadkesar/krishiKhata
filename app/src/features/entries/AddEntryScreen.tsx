import { useCallback, useEffect, useState } from 'react'
import { Check } from 'lucide-react'
import { Page, Shell } from '@/components/Shell'
import { MoneyInput, Segmented } from '@/components/ui'
import { saveEntry } from '@/data/entries'
import { useI18n } from '@/i18n'
import { formatRupees } from '@/lib/money'
import { navigate } from '@/router'
import { EntryFields, MissingHint } from './EntryForm'
import { blankDraft, useEntryForm } from './entryDraft'
import type { EntryDraft } from './entryDraft'
import type { EntryKind } from '@/db/types'

/**
 * The entry screen: income, expense and transfer behind three tabs.
 *
 * The tab is a real mode switch rather than three separate screens, because
 * the farmer often does not decide which one they are recording until they
 * have thought about it — money moving from the bank to the pocket feels like
 * an expense until you remember it is not.
 *
 * The fields themselves live in EntryForm, shared with the edit screen, so a
 * field can never exist on one and not the other.
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
  const { t } = useI18n()

  const [draft, setDraft] = useState<EntryDraft>(() => blankDraft('income'))
  const [saved, setSaved] = useState(false)

  const set = useCallback((patch: Partial<EntryDraft>) => {
    setDraft((d) => ({ ...d, ...patch }))
  }, [])

  const form = useEntryForm(draft, set, { startAutoTotal: true })
  const { kind } = draft

  // Default to the first account so the commonest case is zero taps.
  useEffect(() => {
    if (!draft.account_id && form.accounts.length) set({ account_id: form.accounts[0].id })
  }, [form.accounts, draft.account_id, set])

  async function submit() {
    if (!form.valid) return
    await saveEntry({
      kind,
      date: draft.date,
      head_id: kind === 'transfer' ? null : draft.head_id,
      // Income keeps the grade here too — it is the same column, and a grade
      // is exactly the sub-head of a sale.
      sub_head_id: kind === 'transfer' ? null : draft.sub_head_id,
      activity_id: kind === 'expense' ? draft.activity_id : null,
      // A transfer moves money between accounts; it happens on no land.
      plot_id: kind === 'transfer' ? null : draft.plot_id,
      account_id: draft.account_id,
      to_account_id: kind === 'transfer' ? draft.to_account_id : null,
      quantity_milli: kind === 'income' ? draft.quantity_milli : null,
      unit_id: kind === 'income' ? draft.unit_id : null,
      rate_paise: kind === 'income' ? draft.rate_paise : null,
      amount_paise: draft.amount_paise!,
      party_name: draft.party_name.trim() || null,
      note: draft.note.trim() || null,
    })

    // Keep the account and the date: the next entry is usually the same day
    // out of the same pocket, and re-picking both every time is what makes a
    // farmer stop recording the small ones.
    setDraft({ ...blankDraft(kind), date: draft.date, account_id: draft.account_id })
    form.setAutoTotal(true)
    setSaved(true)
    setTimeout(() => setSaved(false), 1800)
  }

  return (
    <Shell title={t('nav.add')}>
      <Page>
        <Segmented
          value={kind}
          onChange={(k) => {
            // sub_head_id means a GRADE on the income side and a KIND OF SPEND
            // on the expense side. Carrying one across the switch would file a
            // banana sale under Fertilizer.
            set({ kind: k, sub_head_id: null, activity_id: null })
            form.setAutoTotal(true)
          }}
          options={(['income', 'expense', 'transfer'] as EntryKind[]).map((k) => ({
            value: k,
            label: t(`kind.${k}` as 'kind.income'),
            color: KIND_COLOR[k],
          }))}
        />

        {/* The amount leads. It is the one field that is never skipped, and
            putting it first means the commonest entry is two taps and a
            number rather than a scroll to the bottom of a form. */}
        <div
          className="card p-4 text-center"
          style={{ background: KIND_SOFT[kind], borderColor: 'transparent' }}
        >
          <p
            className="text-[11px] font-bold uppercase mb-1.5"
            style={{ color: KIND_COLOR[kind], letterSpacing: '0.05em' }}
          >
            {t('common.amount')}
          </p>
          <div className="[&_input]:text-center [&_input]:text-3xl [&_input]:font-bold [&_input]:h-16 [&_input]:bg-transparent [&_input]:border-0 [&_input]:shadow-none [&_span]:hidden">
            <MoneyInput
              paise={draft.amount_paise}
              onChange={(p) => {
                set({ amount_paise: p })
                // Once the farmer types a total by hand it stops being
                // recomputed. The trader rounds ₹1,247.50 to ₹1,250 and the
                // app must not argue with the money that changed hands.
                if (kind === 'income') form.setAutoTotal(false)
              }}
            />
          </div>
          {kind === 'income' && form.computedTotal != null && form.autoTotal ? (
            <p className="text-xs" style={{ color: KIND_COLOR[kind] }}>
              {t('entry.totalHint')}
            </p>
          ) : null}
        </div>

        <EntryFields draft={draft} set={set} form={form} />

        {/* Quantity × rate fills the amount above until the farmer types one
            themselves. This offers the computed figure back. */}
        {kind === 'income' &&
        !form.autoTotal &&
        form.computedTotal != null &&
        form.computedTotal !== draft.amount_paise ? (
          <button
            onClick={() => {
              set({ amount_paise: form.computedTotal })
              form.setAutoTotal(true)
            }}
            className="press w-full card p-3 text-sm text-left"
            style={{ color: 'var(--text-soft)' }}
          >
            {t('entry.totalHint')} = <strong>{formatRupees(form.computedTotal)}</strong>
            <span style={{ color: 'var(--color-brand-600)' }}> · {t('entry.useThis')}</span>
          </button>
        ) : null}

        <div className="sticky bottom-2 pt-1 space-y-1.5">
          {/* A greyed-out button with no explanation is the commonest way an
              app loses an entry: the farmer taps it twice, decides it is
              broken, and puts the phone away. Say what is still needed. */}
          {!saved ? <MissingHint missing={form.missing} /> : null}
          <button
            onClick={submit}
            disabled={!form.valid}
            className="w-full rounded-xl py-4 font-semibold text-white text-lg flex items-center justify-center gap-2"
            style={{ background: KIND_COLOR[kind], opacity: form.valid ? 1 : 0.45 }}
          >
            {saved ? (
              <>
                <Check size={20} /> {t('entry.saved')}
              </>
            ) : (
              `${t('common.save')} ${draft.amount_paise ? formatRupees(draft.amount_paise) : ''}`
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
