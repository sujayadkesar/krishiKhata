import { useState } from 'react'
import { User, UsersRound, Phone, BookUser, ShieldCheck } from 'lucide-react'
import { useQuery } from '@/hooks/useQuery'
import { listLabourers, saveLabourer } from '@/data/masterData'
import { useI18n } from '@/i18n'
import { Button, Field, Input, MoneyInput, Select, Sheet, Switch, TextArea } from '@/components/ui'
import { formatRupees } from '@/lib/money'
import { canPickContact, pickContact } from '@/lib/contactPick'

/** The Kannada block. Decides which name column a picked contact goes in. */
const KANNADA = /[\u0C80-\u0CFF]/
import { MasterList, RowActions } from './MasterList'
import type { Bool, Employment, Labourer } from '@/db/types'

/**
 * Labourers, their wages, and which of them are group leads.
 *
 * A group lead (maistry) brings a crew that is different people each time, so
 * the app tracks the lead and a head-count rather than pretending to know
 * twelve names. `typical_group_size` only pre-fills the attendance screen —
 * the count is set per day, because twelve on Monday and eight on Wednesday is
 * the normal case, not the exception.
 *
 * Changing a wage here affects FUTURE work only. Past attendance rows carry
 * their own snapshot; see CLAUDE.md rule 6.
 */

interface Draft {
  id?: string
  name_en: string
  name_kn: string
  phone: string
  village: string
  is_group_lead: Bool
  employment: Employment
  monthly_salary_paise: number | null
  daily_rate_paise: number | null
  half_day_rate_paise: number | null
  female_rate_paise: number | null
  typical_group_size: string
  note: string
}

const blank = (): Draft => ({
  name_en: '', name_kn: '', phone: '', village: '',
  is_group_lead: 0, employment: 'casual', monthly_salary_paise: null,
  daily_rate_paise: null, half_day_rate_paise: null,
  female_rate_paise: null, typical_group_size: '', note: '',
})

export function LabourersScreen() {
  const { t, nameOf } = useI18n()
  const [showInactive, setShowInactive] = useState(false)
  const { data, loading } = useQuery(() => listLabourers(showInactive), [showInactive])
  const [draft, setDraft] = useState<Draft | null>(null)
  /**
   * The reassurance, shown once before the phone book is ever opened.
   *
   * "This app wants your contacts" is a sentence people have learnt to
   * distrust, and rightly. Here it is not what happens — the picker is the
   * system's own and only the one person chosen ever reaches the app — so the
   * farmer is told that BEFORE anything opens, not buried in a policy.
   */
  const [askContact, setAskContact] = useState(false)
  const [contactError, setContactError] = useState<string | null>(null)

  async function fromPhoneBook() {
    setAskContact(false)
    setContactError(null)
    try {
      const picked = await pickContact()
      if (picked.cancelled) return
      setDraft((d) =>
        d
          ? {
              ...d,
              // The English column takes the contact's name as stored. One
              // already saved in Kannada goes into the Kannada column too;
              // a Latin-script name is NOT transliterated by guesswork,
              // because a wrong Kannada spelling of somebody's name is
              // worse than an empty field.
              name_en: picked.name || d.name_en,
              name_kn: d.name_kn || (KANNADA.test(picked.name ?? '') ? (picked.name ?? '') : d.name_kn),
              phone: picked.phone || d.phone,
            }
          : d,
      )
    } catch (e) {
      setContactError(e instanceof Error ? e.message : String(e))
    }
  }
  const [editing, setEditing] = useState<Labourer | null>(null)

  const valid = !!draft && (draft.name_kn.trim() !== '' || draft.name_en.trim() !== '')

  async function submit() {
    if (!draft) return
    const name = draft.name_kn.trim() || draft.name_en.trim()
    const size = parseInt(draft.typical_group_size, 10)
    await saveLabourer({
      id: draft.id,
      name_en: draft.name_en.trim() || name,
      name_kn: draft.name_kn.trim() || name,
      phone: draft.phone.trim() || null,
      village: draft.village.trim() || null,
      is_group_lead: draft.is_group_lead,
      employment: draft.employment,
      monthly_salary_paise:
        draft.employment === 'monthly' ? draft.monthly_salary_paise : null,
      daily_rate_paise: draft.daily_rate_paise ?? 0,
      half_day_rate_paise: draft.half_day_rate_paise,
      female_rate_paise: draft.female_rate_paise,
      typical_group_size: draft.is_group_lead && Number.isFinite(size) ? size : null,
      note: draft.note.trim() || null,
    })
    setDraft(null)
    setEditing(null)
  }

  return (
    <MasterList
      whereUsed={t('set.whereWorkers')}
      title={t('labour.labourers')}
      table="labourers"
      items={data ?? []}
      loading={loading}
      showInactive={showInactive}
      onShowInactiveChange={setShowInactive}
      emptyHint={t('labour.noLabourers')}
      leadingOf={(l) =>
        l.is_group_lead ? (
          <UsersRound size={19} style={{ color: 'var(--color-earth-500)' }} />
        ) : (
          <User size={19} style={{ color: 'var(--color-brand-600)' }} />
        )
      }
      subtitleOf={(l) => {
        const bits: string[] = []
        if (l.is_group_lead) {
          bits.push(
            l.typical_group_size
              ? `${t('labour.groupLead')} · ~${l.typical_group_size}`
              : t('labour.groupLead'),
          )
        }
        if (l.village) bits.push(l.village)
        if (l.phone) bits.push(l.phone)
        return bits.join(' · ') || undefined
      }}
      rightOf={(l) => (
        <span className="tnum text-sm mr-1" style={{ color: 'var(--text-soft)' }}>
          {formatRupees(l.daily_rate_paise)}
        </span>
      )}
      onAdd={() => {
        setEditing(null)
        setDraft(blank())
      }}
      onEdit={(l) => {
        setEditing(l)
        setDraft({
          id: l.id,
          name_en: l.name_en,
          name_kn: l.name_kn,
          phone: l.phone ?? '',
          village: l.village ?? '',
          is_group_lead: l.is_group_lead,
          employment: l.employment,
          monthly_salary_paise: l.monthly_salary_paise,
          daily_rate_paise: l.daily_rate_paise,
          half_day_rate_paise: l.half_day_rate_paise,
          female_rate_paise: l.female_rate_paise,
          typical_group_size: l.typical_group_size ? String(l.typical_group_size) : '',
          note: l.note ?? '',
        })
      }}
    >
      <Sheet
        open={askContact}
        onClose={() => setAskContact(false)}
        title={t('contact.privacyTitle')}
        footer={
          <div className="grid grid-cols-2 gap-3">
            <Button variant="soft" full onClick={() => setAskContact(false)}>
              {t('common.cancel')}
            </Button>
            <Button full onClick={fromPhoneBook}>
              {t('contact.open')}
            </Button>
          </div>
        }
      >
        <div className="flex flex-col items-center text-center px-1 pt-1 pb-2">
          <span
            className="grid place-items-center rounded-2xl mb-3"
            style={{ width: 56, height: 56, background: 'var(--color-income-soft)', color: 'var(--color-income)' }}
          >
            <ShieldCheck size={28} />
          </span>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--text-soft)' }}>
            {t('contact.privacyBody')}
          </p>
        </div>
        <ul className="flex flex-col gap-2">
          {(['contact.pt1', 'contact.pt2', 'contact.pt3'] as const).map((k) => (
            <li key={k} className="card flex items-start gap-2.5 px-3.5 py-3">
              <ShieldCheck size={16} className="shrink-0 mt-0.5" style={{ color: 'var(--color-income)' }} />
              <span className="text-sm leading-snug">{t(k)}</span>
            </li>
          ))}
        </ul>
      </Sheet>

      <Sheet
        open={!!draft}
        onClose={() => {
          setDraft(null)
          setEditing(null)
        }}
        title={editing ? nameOf(editing) : t('labour.labourer')}
        footer={
          <Button full onClick={submit} disabled={!valid}>
            {t('common.save')}
          </Button>
        }
      >
        {draft ? (
          <>
            {/* Only on a real phone. The web preview has no contacts app, and
                a button that always fails is worse than no button. */}
            {canPickContact() && !draft.id ? (
              <button
                onClick={() => setAskContact(true)}
                className="w-full flex items-center gap-3 rounded-xl px-4 py-3.5 text-left active:scale-[.99] transition"
                style={{
                  background: 'var(--color-brand-50)',
                  border: '1px solid var(--color-brand-200)',
                }}
              >
                <span
                  className="grid place-items-center rounded-xl shrink-0"
                  style={{
                    width: 38,
                    height: 38,
                    background: 'var(--color-brand-100)',
                    color: 'var(--color-brand-700)',
                  }}
                >
                  <BookUser size={20} />
                </span>
                <span className="flex-1 leading-tight">
                  <span
                    className="block text-sm font-semibold"
                    style={{ color: 'var(--color-brand-800)' }}
                  >
                    {t('contact.fromPhone')}
                  </span>
                  <span className="block text-xs" style={{ color: 'var(--color-brand-700)', opacity: 0.85 }}>
                    {t('contact.fromPhoneHint')}
                  </span>
                </span>
              </button>
            ) : null}

            {contactError ? (
              <p className="text-sm" style={{ color: 'var(--color-expense)' }}>
                {contactError}
              </p>
            ) : null}

            <Field label="ಹೆಸರು (ಕನ್ನಡ)" required>
              <Input
                value={draft.name_kn}
                onChange={(v) => setDraft({ ...draft, name_kn: v })}
                placeholder="ರಮೇಶ"
                autoFocus
              />
            </Field>
            <Field label={t('set.nameEn')}>
              <Input
                value={draft.name_en}
                onChange={(v) => setDraft({ ...draft, name_en: v })}
                placeholder="Ramesh"
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label={t('labour.phone')}>
                <Input
                  value={draft.phone}
                  onChange={(v) => setDraft({ ...draft, phone: v.replace(/[^\d+ ]/g, '') })}
                  inputMode="tel"
                  maxLength={15}
                  placeholder="98450 00000"
                />
              </Field>
              <Field label={t('labour.village')}>
                <Input
                  value={draft.village}
                  onChange={(v) => setDraft({ ...draft, village: v })}
                  placeholder="ಕರಡೊಳ್ಳಿ"
                />
              </Field>
            </div>

            {/* A fixed hand and a daily labourer are paid on entirely
                different clocks, and every field below this depends on which
                one it is. */}
            <Field label={t('labour.employment')}>
              <Select
                value={draft.employment}
                onChange={(v) => setDraft({ ...draft, employment: v })}
                options={[
                  { value: 'casual', label: t('labour.casual') },
                  { value: 'monthly', label: t('labour.monthly') },
                ]}
              />
            </Field>

            {draft.employment === 'monthly' ? (
              <Field
                label={t('labour.monthlySalary')}
                hint={t('set.salaryHint')}
              >
                <MoneyInput
                  paise={draft.monthly_salary_paise}
                  onChange={(p) => setDraft({ ...draft, monthly_salary_paise: p })}
                />
              </Field>
            ) : null}

            {draft.employment === 'casual' ? (
              <div className="card px-4 py-2">
                <Switch
                  checked={draft.is_group_lead === 1}
                  onChange={(v) => setDraft({ ...draft, is_group_lead: v ? 1 : 0 })}
                  label={`${t('labour.groupLead')} — brings a crew`}
                />
              </div>
            ) : null}

            {draft.is_group_lead === 1 ? (
              <Field
                label={t('labour.groupSize')}
                hint={t('set.groupSizeHint')}
              >
                <Input
                  value={draft.typical_group_size}
                  onChange={(v) =>
                    setDraft({ ...draft, typical_group_size: v.replace(/\D/g, '').slice(0, 3) })
                  }
                  inputMode="numeric"
                  placeholder="12"
                />
              </Field>
            ) : null}

            {/* Day rates are meaningless for a salaried worker, and leaving
                them on screen invites somebody to fill one in and then wonder
                why it never appears anywhere. */}
            {draft.employment === 'casual' ? (
              <>
            <Field
              label={t('labour.dayRate')}
              hint={
                draft.is_group_lead === 1
                  ? 'Per person, per day — not for the whole crew.'
                  : 'Changing this affects future work only. Past records keep the wage they were entered with.'
              }
            >
              <MoneyInput
                paise={draft.daily_rate_paise}
                onChange={(p) => setDraft({ ...draft, daily_rate_paise: p })}
              />
            </Field>

            {draft.is_group_lead === 1 ? (
              <Field
                label={t('labour.womenRate')}
                hint={t('set.mixedRateHint')}
              >
                <MoneyInput
                  paise={draft.female_rate_paise}
                  onChange={(p) => setDraft({ ...draft, female_rate_paise: p })}
                />
              </Field>
            ) : null}

            <Field
              label={t('labour.halfDayRate')}
              hint={t('set.halfDayHint')}
            >
              <MoneyInput
                paise={draft.half_day_rate_paise}
                onChange={(p) => setDraft({ ...draft, half_day_rate_paise: p })}
                placeholder={
                  draft.daily_rate_paise
                    ? formatRupees(Math.round(draft.daily_rate_paise / 2)).replace('₹', '')
                    : '0'
                }
              />
            </Field>
              </>
            ) : null}

            <Field label={t('common.note')}>
              <TextArea
                value={draft.note}
                onChange={(v) => setDraft({ ...draft, note: v })}
                placeholder="Comes with own tools"
              />
            </Field>

            {editing?.phone ? (
              <a
                href={`tel:${editing.phone}`}
                className="flex items-center gap-2 text-sm font-semibold"
                style={{ color: 'var(--color-brand-600)' }}
              >
                <Phone size={16} /> {editing.phone}
              </a>
            ) : null}

            {editing ? (
              <RowActions
                item={editing}
                table="labourers"
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
