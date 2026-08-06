import { useEffect, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { Page, Shell } from '@/components/Shell'
import { Button, Confirm, DateInput, Field, Input, MoneyInput, TextArea } from '@/components/ui'
import { useQuery } from '@/hooks/useQuery'
import { deleteEntry, getEntry, saveEntry } from '@/data/entries'
import { useI18n } from '@/i18n'
import { formatDate } from '@/lib/date'
import { formatRupees } from '@/lib/money'
import { formatQuantityLabel } from './format'
import { back, navigate } from '@/router'
import type { EntryKind } from '@/db/types'

/**
 * One entry, editable.
 *
 * Entries are editable here rather than corrected by a reversal row. That
 * differs from goshala-ledger deliberately: immutability there exists to make
 * multi-device sync safe, and this app has neither sync nor a second device,
 * so it would buy nothing and cost a farmer the ability to fix a typo.
 *
 * What is editable is the date, the amount and the words. Re-categorising to a
 * different crop or a different kind of spend is rare enough that deleting and
 * re-entering is clearer than a form that can silently change what a figure
 * means.
 */

const COLOR: Record<EntryKind, string> = {
  income: 'var(--color-income)',
  expense: 'var(--color-expense)',
  transfer: 'var(--color-transfer)',
}

export function EntryDetailScreen({ id }: { id: string }) {
  const { t, lang, nameOf } = useI18n()
  const { data: entry, loading } = useQuery(() => getEntry(id), [id])

  const [date, setDate] = useState('')
  const [amountPaise, setAmountPaise] = useState<number | null>(null)
  const [party, setParty] = useState('')
  const [note, setNote] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!entry) return
    setDate(entry.date)
    setAmountPaise(entry.amount_paise)
    setParty(entry.party_name ?? '')
    setNote(entry.note ?? '')
  }, [entry])

  if (loading) {
    return (
      <Shell title={t('common.loading')} onBack={back} right={<span />}>
        <Page>
          <p style={{ color: 'var(--text-faint)' }}>{t('common.loading')}</p>
        </Page>
      </Shell>
    )
  }

  if (!entry) {
    return (
      <Shell title={t('common.empty')} onBack={back} right={<span />}>
        <Page>
          <p style={{ color: 'var(--text-faint)' }}>{t('common.empty')}</p>
        </Page>
      </Shell>
    )
  }

  const name = (en: string | null, kn: string | null) =>
    en ? nameOf({ name_en: en, name_kn: kn ?? en }) : null

  const facts: [string, string | null][] = [
    [t('entry.head'), name(entry.head_name_en, entry.head_name_kn)],
    [t('entry.subHead'), name(entry.sub_head_name_en, entry.sub_head_name_kn)],
    [t('entry.activity'), name(entry.activity_name_en, entry.activity_name_kn)],
    [
      entry.kind === 'transfer' ? t('entry.from') : t('entry.account'),
      name(entry.account_name_en, entry.account_name_kn),
    ],
    [t('entry.to'), name(entry.to_account_name_en, entry.to_account_name_kn)],
    [t('entry.quantity'), formatQuantityLabel(entry, lang) || null],
  ]

  const isWagePayment = !!entry.labour_payment_id

  async function submit() {
    if (!entry || !amountPaise) return
    await saveEntry({
      id: entry.id,
      kind: entry.kind,
      date,
      head_id: entry.head_id,
      sub_head_id: entry.sub_head_id,
      activity_id: entry.activity_id,
      account_id: entry.account_id,
      to_account_id: entry.to_account_id,
      quantity_milli: entry.quantity_milli,
      unit_id: entry.unit_id,
      rate_paise: entry.rate_paise,
      amount_paise: amountPaise,
      party_name: party.trim() || null,
      note: note.trim() || null,
      photo_id: entry.photo_id,
      labour_payment_id: entry.labour_payment_id,
    })
    setSaved(true)
    setTimeout(() => setSaved(false), 1600)
  }

  return (
    <Shell title={t(`kind.${entry.kind}` as 'kind.income')} onBack={back} right={<span />}>
      <Page>
        <div className="card p-4 text-center">
          <p className="text-3xl font-semibold tnum" style={{ color: COLOR[entry.kind] }}>
            {formatRupees(entry.amount_paise)}
          </p>
          <p className="text-sm mt-1" style={{ color: 'var(--text-faint)' }}>
            {formatDate(entry.date, lang)}
          </p>
        </div>

        <div className="card divide-y" style={{ borderColor: 'var(--border)' }}>
          {facts
            .filter(([, v]) => v)
            .map(([label, value]) => (
              <div key={label} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <span className="text-sm" style={{ color: 'var(--text-faint)' }}>
                  {label}
                </span>
                <span className="text-sm font-medium text-right">{value}</span>
              </div>
            ))}
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
            <Field label={t('common.date')}>
              <DateInput value={date} onChange={setDate} />
            </Field>

            <Field label={t('common.amount')}>
              <MoneyInput paise={amountPaise} onChange={setAmountPaise} />
            </Field>

            {entry.kind !== 'transfer' ? (
              <Field label={entry.kind === 'income' ? t('entry.buyer') : t('entry.shop')}>
                <Input value={party} onChange={setParty} />
              </Field>
            ) : null}

            <Field label={t('common.note')}>
              <TextArea value={note} onChange={setNote} />
            </Field>

            <Button full onClick={submit} disabled={!amountPaise}>
              {saved ? t('entry.saved') : t('common.save')}
            </Button>
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
