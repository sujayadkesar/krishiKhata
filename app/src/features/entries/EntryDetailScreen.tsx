import { useCallback, useEffect, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { Page, Shell } from '@/components/Shell'
import { Button, Confirm, Field, MoneyInput, Segmented } from '@/components/ui'
import { useQuery } from '@/hooks/useQuery'
import { deleteEntry, getEntry, saveEntry } from '@/data/entries'
import { useI18n } from '@/i18n'
import { formatDate } from '@/lib/date'
import { formatRupees } from '@/lib/money'
import { back, navigate } from '@/router'
import { EntryFields, MissingHint } from './EntryForm'
import { blankDraft, useEntryForm } from './entryDraft'
import type { EntryDraft } from './entryDraft'
import type { EntryKind } from '@/db/types'

/**
 * One entry, fully editable.
 *
 * Entries are edited here rather than corrected by a reversal row. That
 * differs from goshala-ledger deliberately: immutability there exists to make
 * multi-device sync safe, and this app has neither sync nor a second device,
 * so it would buy nothing and cost a farmer the ability to fix a typo.
 *
 * EVERY field can be changed, including which crop and which kind of entry it
 * is. The screen used to allow only the date, the amount and the words, on the
 * reasoning that re-categorising was rare — it is not. Picking the wrong crop
 * on a hurried entry is the commonest mistake there is, and forcing a delete
 * and re-type for it is how entries end up missing altogether.
 */

const COLOR: Record<EntryKind, string> = {
  income: 'var(--color-income)',
  expense: 'var(--color-expense)',
  transfer: 'var(--color-transfer)',
}

const SOFT: Record<EntryKind, string> = {
  income: 'var(--color-income-soft)',
  expense: 'var(--color-expense-soft)',
  transfer: 'var(--color-transfer-soft)',
}

export function EntryDetailScreen({ id }: { id: string }) {
  const { t, lang } = useI18n()
  const { data: entry, loading } = useQuery(() => getEntry(id), [id])

  const [draft, setDraft] = useState<EntryDraft | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [saved, setSaved] = useState(false)

  const set = useCallback((patch: Partial<EntryDraft>) => {
    setDraft((d) => (d ? { ...d, ...patch } : d))
  }, [])

  useEffect(() => {
    if (!entry) return
    setDraft({
      kind: entry.kind,
      date: entry.date,
      head_id: entry.head_id,
      sub_head_id: entry.sub_head_id,
      activity_id: entry.activity_id,
      plot_id: entry.plot_id,
      account_id: entry.account_id,
      to_account_id: entry.to_account_id,
      unit_id: entry.unit_id,
      quantity_milli: entry.quantity_milli,
      rate_paise: entry.rate_paise,
      amount_paise: entry.amount_paise,
      party_name: entry.party_name ?? '',
      note: entry.note ?? '',
    })
  }, [entry])

  // An existing amount is what actually changed hands, so it must never be
  // silently recomputed from a rate the trader rounded away.
  const form = useEntryForm(draft ?? blankDraft(), set, { startAutoTotal: false })

  if (loading || (entry && !draft)) {
    return (
      <Shell title={t('common.loading')} onBack={back} right={<span />}>
        <Page>
          <p style={{ color: 'var(--text-faint)' }}>{t('common.loading')}</p>
        </Page>
      </Shell>
    )
  }

  if (!entry || !draft) {
    return (
      <Shell title={t('common.empty')} onBack={back} right={<span />}>
        <Page>
          <p style={{ color: 'var(--text-faint)' }}>{t('common.empty')}</p>
        </Page>
      </Shell>
    )
  }

  const isWagePayment = !!entry.labour_payment_id
  const kind = draft.kind

  async function submit() {
    if (!entry || !draft || !form.valid) return
    await saveEntry({
      id: entry.id,
      kind,
      date: draft.date,
      head_id: kind === 'transfer' ? null : draft.head_id,
      sub_head_id: kind === 'transfer' ? null : draft.sub_head_id,
      activity_id: kind === 'expense' ? draft.activity_id : null,
      plot_id: kind === 'transfer' ? null : draft.plot_id,
      account_id: draft.account_id,
      to_account_id: kind === 'transfer' ? draft.to_account_id : null,
      quantity_milli: kind === 'income' ? draft.quantity_milli : null,
      unit_id: kind === 'income' ? draft.unit_id : null,
      rate_paise: kind === 'income' ? draft.rate_paise : null,
      amount_paise: draft.amount_paise!,
      party_name: draft.party_name.trim() || null,
      note: draft.note.trim() || null,
      photo_id: entry.photo_id,
      labour_payment_id: entry.labour_payment_id,
    })
    setSaved(true)
    setTimeout(() => setSaved(false), 1600)
  }

  return (
    <Shell title={t(`kind.${kind}` as 'kind.income')} onBack={back} right={<span />}>
      <Page>
        <div
          className="card p-4 text-center"
          style={{ borderColor: 'transparent', background: SOFT[kind] }}
        >
          <p className="text-3xl font-semibold tnum" style={{ color: COLOR[kind] }}>
            {formatRupees(entry.amount_paise)}
          </p>
          <p className="text-sm mt-1" style={{ color: 'var(--text-faint)' }}>
            {formatDate(entry.date, lang)}
          </p>
        </div>

        {isWagePayment ? (
          <div
            className="card p-3 text-sm"
            style={{
              background: 'var(--color-earth-100)',
              borderColor: 'var(--color-earth-300)',
              color: 'var(--color-earth-700)',
            }}
          >
            This expense was created by a wage payment. Change it from the labour khata so
            the payment and what it settles stay in step.
            <button
              className="block mt-1 font-semibold underline"
              onClick={() => navigate('/labour')}
            >
              {t('labour.khata')} →
            </button>
          </div>
        ) : (
          <>
            {/* Changing the kind is allowed. It is rare, but a withdrawal
                recorded as an expense is exactly the mistake that overstates
                spending for a whole year, and it should be fixable in place. */}
            <Segmented
              value={kind}
              onChange={(k) => set({ kind: k, sub_head_id: null, activity_id: null })}
              options={(['income', 'expense', 'transfer'] as EntryKind[]).map((k) => ({
                value: k,
                label: t(`kind.${k}` as 'kind.income'),
                color: COLOR[k],
              }))}
            />

            <Field label={t('common.amount')}>
              <MoneyInput
                paise={draft.amount_paise}
                onChange={(p) => set({ amount_paise: p })}
              />
            </Field>

            <EntryFields draft={draft} set={set} form={form} />

            <div className="space-y-1.5">
              <MissingHint missing={form.missing} />
              <Button full onClick={submit} disabled={!form.valid}>
                {saved ? t('entry.saved') : t('common.save')}
              </Button>
            </div>
          </>
        )}

        <Button variant="danger" full onClick={() => setConfirming(true)}>
          <span className="inline-flex items-center gap-2 justify-center">
            <Trash2 size={16} /> {t('common.delete')}
          </span>
        </Button>

        <Confirm
          open={confirming}
          danger
          title={t('common.delete')}
          body="This entry will be removed from all reports and balances. It stays in the change history."
          confirmLabel={t('common.delete')}
          onConfirm={async () => {
            setConfirming(false)
            await deleteEntry(entry.id)
            navigate('/entries')
          }}
          onCancel={() => setConfirming(false)}
        />
      </Page>
    </Shell>
  )
}
