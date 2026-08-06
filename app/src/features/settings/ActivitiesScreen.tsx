import { useState } from 'react'
import { Hammer } from 'lucide-react'
import { useQuery } from '@/hooks/useQuery'
import { listActivities, listSubHeads, saveActivity } from '@/data/masterData'
import { useI18n } from '@/i18n'
import { Button, Field, Input, Select, Sheet } from '@/components/ui'
import { MasterList, RowActions } from './MasterList'
import type { Activity } from '@/db/types'

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
}

const blank = (): Draft => ({ name_en: '', name_kn: '', sub_head_id: null })

export function ActivitiesScreen() {
  const { t, nameOf } = useI18n()
  const [showInactive, setShowInactive] = useState(false)
  const { data, loading } = useQuery(() => listActivities(showInactive), [showInactive])
  const { data: subHeads } = useQuery(() => listSubHeads(false), [])
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
