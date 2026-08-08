import {
  ChipSingle, DateInput, Field, Input, MoneyInput, QuantityInput, Select, TextArea,
} from '@/components/ui'
import { useI18n } from '@/i18n'
import { navigate } from '@/router'
import type { EntryDraft, EntryFormState, Patch } from './entryDraft'

/**
 * The visible half of the entry form: every field below the amount.
 *
 * The state, the lists and the validation live in `entryDraft.ts` — this file
 * exports components only, because a hook or a constant alongside them breaks
 * Fast Refresh for every screen underneath.
 *
 * The amount itself stays with the calling screen: the add screen makes it a
 * hero at the top because that is the field that is never skipped, and the
 * edit screen shows it in place among the others.
 */
export function EntryFields({
  draft,
  set,
  form,
}: {
  draft: EntryDraft
  set: Patch
  form: EntryFormState
}) {
  const { t, nameOf, lang } = useI18n()
  const kind = draft.kind

  const visibleHeads = form.heads.filter(
    (h) => h.used_for === 'both' || h.used_for === (kind === 'income' ? 'income' : 'expense'),
  )

  const activityOptions = form.activities.filter(
    (a) => !draft.sub_head_id || !a.sub_head_id || a.sub_head_id === draft.sub_head_id,
  )

  const accountOptions = form.accounts.map((a) => ({ value: a.id, label: nameOf(a) }))
  const sameAccount =
    kind === 'transfer' && !!draft.account_id && draft.account_id === draft.to_account_id

  return (
    <>
      <Field label={t('common.date')}>
        <DateInput value={draft.date} onChange={(v) => set({ date: v })} />
      </Field>

      {kind !== 'transfer' ? (
        <Field label={t('entry.head')} required>
          <ChipSingle
            options={visibleHeads.map((h) => ({ value: h.id, label: nameOf(h) }))}
            value={draft.head_id}
            onChange={(v) => set({ head_id: v })}
            onAdd={() => navigate(`/settings/heads/${kind === 'income' ? 'income' : 'expense'}`)}
          />
        </Field>
      ) : null}

      {/* Which piece of land. Shown as soon as the farmer has entered any, and
          required from then on: a plot recorded on some entries and not others
          gives a plot report that silently under-counts. A farm that has not
          entered land at all is never asked. */}
      {kind !== 'transfer' && form.plots.length > 0 ? (
        <Field label={t('plot.one')} hint={t('plot.hint')} required>
          <ChipSingle
            options={form.plots.map((p) => ({ value: p.id, label: nameOf(p) }))}
            value={draft.plot_id}
            onChange={(v) => set({ plot_id: v })}
            onAdd={() => navigate('/settings/plots')}
          />
        </Field>
      ) : null}

      {/* -------------------------------------------- variety and grade --
       *
       * Two levels, and the second appears only when the first has one. Under
       * Banana the varieties are G9, Mitka and Karibale; under each of those,
       * first and second class. Under Pepper there is usually neither, and the
       * farmer is asked for nothing.
       */}
      {kind !== 'transfer' && draft.head_id && form.subHeads.length > 0 ? (
        <Field label={kind === 'income' ? t('entry.variety') : t('entry.subHead')} required>
          <ChipSingle
            options={form.subHeads.map((s) => ({ value: s.id, label: nameOf(s) }))}
            value={form.parentSubHeadId}
            onChange={(v) => set({ sub_head_id: v, activity_id: null })}
            onAdd={() => navigate(`/settings/sub-heads/${draft.head_id}`)}
          />
        </Field>
      ) : null}

      {form.childSubHeads.length > 0 ? (
        <Field label={t('entry.grade')} required>
          <ChipSingle
            options={form.childSubHeads.map((s) => ({ value: s.id, label: nameOf(s) }))}
            value={draft.sub_head_id === form.parentSubHeadId ? null : draft.sub_head_id}
            onChange={(v) => set({ sub_head_id: v ?? form.parentSubHeadId })}
            onAdd={() => navigate(`/settings/sub-heads/${draft.head_id}`)}
          />
        </Field>
      ) : null}

      {/* ------------------------------------------------------ income -- */}
      {kind === 'income' ? (
        <>
          {form.headUnits.length > 1 ? (
            <Field label={t('entry.unit')}>
              <ChipSingle
                options={form.headUnits.map((u) => ({
                  value: u.unit_id,
                  label: `${nameOf(u)} (${lang === 'en' ? u.short_en : u.short_kn})`,
                }))}
                value={draft.unit_id}
                onChange={(v) => set({ unit_id: v })}
              />
            </Field>
          ) : null}

          <div className="grid grid-cols-2 gap-3">
            <Field label={t('entry.quantity')}>
              <QuantityInput
                milli={draft.quantity_milli}
                onChange={(v) => set({ quantity_milli: v })}
                suffix={form.unitShort}
              />
            </Field>
            <Field label={`${t('entry.rate')} / ${form.unitShort || '—'}`}>
              <MoneyInput paise={draft.rate_paise} onChange={(v) => set({ rate_paise: v })} />
            </Field>
          </div>
        </>
      ) : null}

      {/* ----------------------------------------------------- expense -- */}
      {kind === 'expense' ? (
        <Field
          label={t('entry.activity')}
          hint="The more exact this is, the more useful the crop report becomes."
        >
          <Select
            value={draft.activity_id}
            onChange={(v) => set({ activity_id: v })}
            placeholder={t('common.select')}
            options={activityOptions.map((a) => ({ value: a.id, label: nameOf(a) }))}
          />
        </Field>
      ) : null}

      {/* ---------------------------------------------------- transfer -- */}
      {kind === 'transfer' ? (
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('entry.from')}>
            <Select
              value={draft.account_id}
              onChange={(v) => set({ account_id: v })}
              placeholder={t('common.select')}
              options={accountOptions}
            />
          </Field>
          <Field label={t('entry.to')} error={sameAccount ? t('entry.sameAccount') : null}>
            <Select
              value={draft.to_account_id}
              onChange={(v) => set({ to_account_id: v })}
              placeholder={t('common.select')}
              options={accountOptions}
            />
          </Field>
        </div>
      ) : (
        <Field label={kind === 'income' ? t('entry.accountIn') : t('entry.accountOut')}>
          <Select
            value={draft.account_id}
            onChange={(v) => set({ account_id: v })}
            placeholder={t('common.select')}
            options={accountOptions}
          />
        </Field>
      )}

      {kind !== 'transfer' ? (
        <Field label={kind === 'income' ? t('entry.buyer') : t('entry.shop')}>
          <Input
            value={draft.party_name}
            onChange={(v) => set({ party_name: v })}
            placeholder={kind === 'income' ? 'ವ್ಯಾಪಾರಿ' : 'ಅಂಗಡಿ'}
          />
        </Field>
      ) : null}

      <Field label={t('common.note')}>
        <TextArea value={draft.note} onChange={(v) => set({ note: v })} />
      </Field>
    </>
  )
}

/** What is still needed, shown above a save button that will not fire. */
export function MissingHint({ missing }: { missing: string[] }) {
  const { t } = useI18n()
  if (!missing.length) return null
  return (
    <p
      className="text-xs text-center font-medium rounded-lg py-1.5 px-2"
      style={{ background: 'var(--color-earth-100)', color: 'var(--color-earth-700)' }}
    >
      {t('common.required')}: {missing.join(', ')}
    </p>
  )
}
