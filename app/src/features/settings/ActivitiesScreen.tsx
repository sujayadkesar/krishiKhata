import { useState } from 'react'
import { Hammer } from 'lucide-react'
import { useQuery } from '@/hooks/useQuery'
import { listActivities, listSubHeads, listUnits, saveActivity } from '@/data/masterData'
import { useI18n } from '@/i18n'
import { Button, Field, Input, MoneyInput, Select, Sheet } from '@/components/ui'
import { MasterList, RowActions } from './MasterList'
import type { Activity, WorkBasis } from '@/db/types'

/**
 * Activities are the granular level the brief asked for: not "labour" but
 * "labour for cutting" as against "labour for spraying".
 *
 * This is the layer that turns "₹8,000 on Banana" into something a farmer can
 * act on, so the list is meant to grow. Adding one is two fields.
 */

interface Draft {
  id?: string
  name_en: string
  name_kn: string
  sub_head_id: string | null
  /**
   * How this work is normally paid for.
   *
   * Tractor ploughing is hourly, spraying is per litre, plucking is an agreed
   * figure. Stating it once here means the work screen arrives already shaped
   * the right way, instead of the farmer re-deciding every time and sometimes
   * getting it wrong.
   */
  default_basis: WorkBasis
  default_rate_paise: number | null
  default_unit_id: string | null
}

const blank = (): Draft => ({
  name_en: '', name_kn: '', sub_head_id: null,
  default_basis: 'day', default_rate_paise: null, default_unit_id: null,
})

export function ActivitiesScreen() {
  const { t, nameOf } = useI18n()
  const [showInactive, setShowInactive] = useState(false)
  const { data, loading } = useQuery(() => listActivities(showInactive), [showInactive])
  const { data: subHeads } = useQuery(() => listSubHeads(false), [])
  const { data: units } = useQuery(() => listUnits(false), [])
  const [draft, setDraft] = useState<Draft | null>(null)
  const [editing, setEditing] = useState<Activity | null>(null)

  const subHeadName = (id: string | null) => {
    const s = (subHeads ?? []).find((x) => x.id === id)
    return s ? nameOf(s) : undefined
  }

  const valid = !!draft && (draft.name_kn.trim() !== '' || draft.name_en.trim() !== '')

  async function submit() {
    if (!draft) return
    const name = draft.name_kn.trim() || draft.name_en.trim()
    await saveActivity({
      id: draft.id,
      name_en: draft.name_en.trim() || name,
      name_kn: draft.name_kn.trim() || name,
      sub_head_id: draft.sub_head_id,
      default_basis: draft.default_basis,
      default_rate_paise: draft.default_basis === 'day' ? null : draft.default_rate_paise,
      default_unit_id: draft.default_basis === 'piece' ? draft.default_unit_id : null,
    })
    setDraft(null)
    setEditing(null)
  }

  return (
    <MasterList
      title={t('set.activities')}
      table="activities"
      items={data ?? []}
      loading={loading}
      showInactive={showInactive}
      onShowInactiveChange={setShowInactive}
      leadingOf={() => <Hammer size={19} style={{ color: 'var(--color-brand-600)' }} />}
      subtitleOf={(a) => subHeadName(a.sub_head_id)}
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
          sub_head_id: a.sub_head_id,
          default_basis: a.default_basis,
          default_rate_paise: a.default_rate_paise,
          default_unit_id: a.default_unit_id,
        })
      }}
    >
      <Sheet
        open={!!draft}
        onClose={() => {
          setDraft(null)
          setEditing(null)
        }}
        title={editing ? nameOf(editing) : t('set.activities')}
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
                placeholder="ಕೊಯ್ಲು"
                autoFocus
              />
            </Field>
            <Field label="Name (English)">
              <Input
                value={draft.name_en}
                onChange={(v) => setDraft({ ...draft, name_en: v })}
                placeholder="Harvesting"
              />
            </Field>

            <Field
              label={t('entry.subHead')}
              hint="Pre-selected when this work is chosen. Still changeable on the entry."
            >
              <Select
                value={draft.sub_head_id}
                onChange={(v) => setDraft({ ...draft, sub_head_id: v })}
                placeholder={t('common.select')}
                options={(subHeads ?? []).map((s) => ({ value: s.id, label: nameOf(s) }))}
              />
            </Field>

            <Field
              label={t('labour.basis')}
              hint="Pre-selected when this work is chosen. Still changeable on the day."
            >
              <Select
                value={draft.default_basis}
                onChange={(v) => setDraft({ ...draft, default_basis: v })}
                options={[
                  { value: 'day', label: t('labour.basisDay') },
                  { value: 'hour', label: t('labour.basisHour') },
                  { value: 'piece', label: t('labour.basisPiece') },
                  { value: 'lump', label: t('labour.basisLump') },
                ]}
              />
            </Field>

            {draft.default_basis === 'hour' || draft.default_basis === 'lump' ? (
              <Field
                label={draft.default_basis === 'hour' ? t('labour.hourRate') : t('labour.agreedAmount')}
                hint="The usual figure. Left empty is fine — it is only a starting point."
              >
                <MoneyInput
                  paise={draft.default_rate_paise}
                  onChange={(p) => setDraft({ ...draft, default_rate_paise: p })}
                />
              </Field>
            ) : null}

            {draft.default_basis === 'piece' ? (
              <Field label={t('entry.unit')} hint="Litres, bags — what the work is counted in.">
                <Select
                  value={draft.default_unit_id}
                  onChange={(v) => setDraft({ ...draft, default_unit_id: v })}
                  placeholder={t('common.select')}
                  options={(units ?? []).map((u) => ({ value: u.id, label: nameOf(u) }))}
                />
              </Field>
            ) : null}

            {editing ? (
              <RowActions
                item={editing}
                table="activities"
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
