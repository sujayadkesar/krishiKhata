import { useState } from 'react'
import { User, UsersRound, Phone } from 'lucide-react'
import { useQuery } from '@/hooks/useQuery'
import { listLabourers, saveLabourer } from '@/data/masterData'
import { useI18n } from '@/i18n'
import { Button, Field, Input, MoneyInput, Sheet, Switch, TextArea } from '@/components/ui'
import { formatRupees } from '@/lib/money'
import { MasterList, RowActions } from './MasterList'
import type { Bool, Labourer } from '@/db/types'

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
  daily_rate_paise: number | null
  half_day_rate_paise: number | null
  female_rate_paise: number | null
  typical_group_size: string
  note: string
}

const blank = (): Draft => ({
  name_en: '', name_kn: '', phone: '', village: '',
  is_group_lead: 0, daily_rate_paise: null, half_day_rate_paise: null,
  female_rate_paise: null, typical_group_size: '', note: '',
})

export function LabourersScreen() {
  const { t, nameOf } = useI18n()
  const [showInactive, setShowInactive] = useState(false)
  const { data, loading } = useQuery(() => listLabourers(showInactive), [showInactive])
  const [draft, setDraft] = useState<Draft | null>(null)
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
          daily_rate_paise: l.daily_rate_paise,
          half_day_rate_paise: l.half_day_rate_paise,
          female_rate_paise: l.female_rate_paise,
          typical_group_size: l.typical_group_size ? String(l.typical_group_size) : '',
          note: l.note ?? '',
        })
      }}
    >
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
            <Field label="ಹೆಸರು (ಕನ್ನಡ)" required>
              <Input
                value={draft.name_kn}
                onChange={(v) => setDraft({ ...draft, name_kn: v })}
                placeholder="ರಮೇಶ"
                autoFocus
              />
            </Field>
            <Field label="Name (English)">
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

            <div className="card px-4 py-2">
              <Switch
                checked={draft.is_group_lead === 1}
                onChange={(v) => setDraft({ ...draft, is_group_lead: v ? 1 : 0 })}
                label={`${t('labour.groupLead')} — brings a crew`}
              />
            </div>

            {draft.is_group_lead === 1 ? (
              <Field
                label={t('labour.groupSize')}
                hint="Just the usual number. You set the real count for each day when recording work."
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
                hint="Crews are usually mixed and the two rates differ. Still editable on each day's entry."
              >
                <MoneyInput
                  paise={draft.female_rate_paise}
                  onChange={(p) => setDraft({ ...draft, female_rate_paise: p })}
                />
              </Field>
            ) : null}

            <Field
              label={t('labour.halfDayRate')}
              hint="Leave empty for half of the daily wage."
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
