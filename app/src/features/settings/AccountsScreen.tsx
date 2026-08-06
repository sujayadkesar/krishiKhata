import { useState } from 'react'
import { Banknote, Landmark, Smartphone } from 'lucide-react'
import { useQuery } from '@/hooks/useQuery'
import { listAccounts, saveAccount } from '@/data/masterData'
import { useI18n } from '@/i18n'
import { Button, Field, Input, MoneyInput, Select, Sheet } from '@/components/ui'
import { formatRupees } from '@/lib/money'
import { MasterList, RowActions } from './MasterList'
import type { Account, AccountKind } from '@/db/types'

const ICONS = { cash: Banknote, bank: Landmark, upi: Smartphone }

interface Draft {
  id?: string
  name_en: string
  name_kn: string
  kind: AccountKind
  opening_balance_paise: number | null
  bank_name: string
  account_last4: string
}

const blank = (): Draft => ({
  name_en: '',
  name_kn: '',
  kind: 'bank',
  opening_balance_paise: null,
  bank_name: '',
  account_last4: '',
})

export function AccountsScreen() {
  const { t, nameOf } = useI18n()
  const [showInactive, setShowInactive] = useState(false)
  const { data, loading } = useQuery(() => listAccounts(showInactive), [showInactive])
  const [draft, setDraft] = useState<Draft | null>(null)
  const [editing, setEditing] = useState<Account | null>(null)

  const accounts = data ?? []
  // One of the two names is enough; the other is filled in from it on save,
  // so a farmer who only types Kannada is never blocked by an English field.
  const valid = !!draft && (draft.name_kn.trim() !== '' || draft.name_en.trim() !== '')

  async function submit() {
    if (!draft) return
    const name = draft.name_en.trim() || draft.name_kn.trim()
    await saveAccount({
      id: draft.id,
      name_en: draft.name_en.trim() || name,
      name_kn: draft.name_kn.trim() || name,
      kind: draft.kind,
      opening_balance_paise: draft.opening_balance_paise ?? 0,
      bank_name: draft.bank_name.trim() || null,
      account_last4: draft.account_last4.trim() || null,
    })
    setDraft(null)
    setEditing(null)
  }

  return (
    <MasterList
      title={t('set.accounts')}
      table="accounts"
      items={accounts}
      loading={loading}
      showInactive={showInactive}
      onShowInactiveChange={setShowInactive}
      leadingOf={(a) => {
        const Icon = ICONS[a.kind]
        return <Icon size={19} style={{ color: 'var(--color-brand-600)' }} />
      }}
      subtitleOf={(a) =>
        a.bank_name ? `${a.bank_name}${a.account_last4 ? ` ••${a.account_last4}` : ''}` : a.kind
      }
      rightOf={(a) => (
        <span className="tnum text-sm mr-1" style={{ color: 'var(--text-soft)' }}>
          {formatRupees(a.opening_balance_paise)}
        </span>
      )}
      onAdd={() => {
        setEditing(null)
        setDraft(blank())
      }}
      onEdit={(a) => {
        setEditing(a)
        setDraft({
          id: a.id,
          name_en: a.name_en,
          name_kn: a.name_kn,
          kind: a.kind,
          opening_balance_paise: a.opening_balance_paise,
          bank_name: a.bank_name ?? '',
          account_last4: a.account_last4 ?? '',
        })
      }}
    >
      <Sheet
        open={!!draft}
        onClose={() => {
          setDraft(null)
          setEditing(null)
        }}
        title={editing ? nameOf(editing) : t('set.accounts')}
        footer={
          <Button full onClick={submit} disabled={!valid}>
            {t('common.save')}
          </Button>
        }
      >
        {draft ? (
          <>
            <Field label="ಹೆಸರು (ಕನ್ನಡ)" required>
              <Input
                value={draft.name_kn}
                onChange={(v) => setDraft({ ...draft, name_kn: v })}
                placeholder="ಕೆನರಾ ಬ್ಯಾಂಕ್"
                autoFocus
              />
            </Field>

            <Field label="Name (English)">
              <Input
                value={draft.name_en}
                onChange={(v) => setDraft({ ...draft, name_en: v })}
                placeholder="Canara Bank"
              />
            </Field>

            <Field label="Type">
              <Select
                value={draft.kind}
                onChange={(v) => setDraft({ ...draft, kind: v })}
                options={[
                  { value: 'cash', label: 'Cash · ನಗದು' },
                  { value: 'bank', label: 'Bank · ಬ್ಯಾಂಕ್' },
                  { value: 'upi', label: 'UPI' },
                ]}
              />
            </Field>

            {draft.kind !== 'cash' ? (
              <div className="grid grid-cols-2 gap-3">
                <Field label="Bank">
                  <Input
                    value={draft.bank_name}
                    onChange={(v) => setDraft({ ...draft, bank_name: v })}
                    placeholder="Canara"
                  />
                </Field>
                <Field label="Last 4 digits">
                  <Input
                    value={draft.account_last4}
                    onChange={(v) => setDraft({ ...draft, account_last4: v.replace(/\D/g, '') })}
                    inputMode="numeric"
                    maxLength={4}
                    placeholder="4821"
                  />
                </Field>
              </div>
            ) : null}

            <Field
              label={t('set.openingBalance')}
              hint="What is in this account today. Every balance the app shows builds on this, so it is worth getting right once."
            >
              <MoneyInput
                paise={draft.opening_balance_paise}
                onChange={(p) => setDraft({ ...draft, opening_balance_paise: p })}
              />
            </Field>

            {editing ? (
              <RowActions
                item={editing}
                table="accounts"
                onDone={() => {
                  setDraft(null)
                  setEditing(null)
                }}
              />
            ) : null}
          </>
        ) : null}
      </Sheet>
    </MasterList>
  )
}
