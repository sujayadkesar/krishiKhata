import { useState } from 'react'
import { Tags, HardHat } from 'lucide-react'
import { useQuery } from '@/hooks/useQuery'
import { listSubHeads, saveSubHead } from '@/data/masterData'
import { useI18n } from '@/i18n'
import { Button, Field, Input, Sheet, Switch } from '@/components/ui'
import { MasterList, RowActions } from './MasterList'
import type { Bool, SubHead } from '@/db/types'

/**
 * Sub-heads are the NATURE of a spend: labour, fertilizer, transport.
 *
 * `is_labour` is not cosmetic. Wage payments are posted against a labour
 * sub-head, and the reports use the flag to separate money paid to people from
 * money paid to shops — which is the split a farmer actually asks about.
 */

interface Draft {
  id?: string
  name_en: string
  name_kn: string
  is_labour: Bool
}

const blank = (): Draft => ({ name_en: '', name_kn: '', is_labour: 0 })

export function SubHeadsScreen() {
  const { t, nameOf } = useI18n()
  const [showInactive, setShowInactive] = useState(false)
  const { data, loading } = useQuery(() => listSubHeads(showInactive), [showInactive])
  const [draft, setDraft] = useState<Draft | null>(null)
  const [editing, setEditing] = useState<SubHead | null>(null)

  const valid = !!draft && (draft.name_kn.trim() !== '' || draft.name_en.trim() !== '')

  async function submit() {
    if (!draft) return
    const name = draft.name_kn.trim() || draft.name_en.trim()
    await saveSubHead({
      id: draft.id,
      name_en: draft.name_en.trim() || name,
      name_kn: draft.name_kn.trim() || name,
      is_labour: draft.is_labour,
    })
    setDraft(null)
    setEditing(null)
  }

  return (
    <MasterList
      title={t('set.subHeads')}
      table="sub_heads"
      items={data ?? []}
      loading={loading}
      showInactive={showInactive}
      onShowInactiveChange={setShowInactive}
      leadingOf={(s) =>
        s.is_labour ? (
          <HardHat size={19} style={{ color: 'var(--color-earth-500)' }} />
        ) : (
          <Tags size={19} style={{ color: 'var(--color-brand-600)' }} />
        )
      }
      subtitleOf={(s) => (s.is_labour ? 'Wages paid to people' : undefined)}
      onAdd={() => {
        setEditing(null)
        setDraft(blank())
      }}
      onEdit={(s) => {
        setEditing(s)
        setDraft({ id: s.id, name_en: s.name_en, name_kn: s.name_kn, is_labour: s.is_labour })
      }}
    >
      <Sheet
        open={!!draft}
        onClose={() => {
          setDraft(null)
          setEditing(null)
        }}
        title={editing ? nameOf(editing) : t('set.subHeads')}
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
                placeholder="ಗೊಬ್ಬರ"
                autoFocus
              />
            </Field>
            <Field label="Name (English)">
              <Input
                value={draft.name_en}
                onChange={(v) => setDraft({ ...draft, name_en: v })}
                placeholder="Fertilizer"
              />
            </Field>

            <div className="card px-4 py-2">
              <Switch
                checked={draft.is_labour === 1}
                onChange={(v) => setDraft({ ...draft, is_labour: v ? 1 : 0 })}
                label="This is wages paid to people"
              />
            </div>

            {editing ? (
              <RowActions
                item={editing}
                table="sub_heads"
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
