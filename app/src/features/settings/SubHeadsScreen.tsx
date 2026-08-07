import { useState } from 'react'
import { Tags, HardHat } from 'lucide-react'
import { useQuery } from '@/hooks/useQuery'
import { listAllSubHeads, listHeads, saveSubHead } from '@/data/masterData'
import { useI18n } from '@/i18n'
import { Button, Field, Input, Select, Sheet, Switch } from '@/components/ui'
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
  head_id: string | null
  used_for: 'income' | 'expense' | 'both'
}

const blank = (): Draft => ({
  name_en: '', name_kn: '', is_labour: 0, head_id: null, used_for: 'expense',
})

export function SubHeadsScreen() {
  const { t, nameOf } = useI18n()
  const [showInactive, setShowInactive] = useState(false)
  const { data, loading } = useQuery(() => listAllSubHeads(showInactive), [showInactive])
  const { data: heads } = useQuery(() => listHeads(false), [])
  const [draft, setDraft] = useState<Draft | null>(null)
  const [editing, setEditing] = useState<SubHead | null>(null)

  const headName = (id: string | null) => {
    const h = (heads ?? []).find((x) => x.id === id)
    return h ? nameOf(h) : undefined
  }

  const valid = !!draft && (draft.name_kn.trim() !== '' || draft.name_en.trim() !== '')

  async function submit() {
    if (!draft) return
    const name = draft.name_kn.trim() || draft.name_en.trim()
    await saveSubHead({
      id: draft.id,
      name_en: draft.name_en.trim() || name,
      name_kn: draft.name_kn.trim() || name,
      is_labour: draft.used_for === 'income' ? 0 : draft.is_labour,
      head_id: draft.head_id,
      used_for: draft.used_for,
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
      subtitleOf={(s) =>
        [
          s.used_for === 'income' ? t('subhead.gradeOf') : null,
          headName(s.head_id),
          s.is_labour ? 'Wages paid to people' : null,
        ]
          .filter(Boolean)
          .join(' ') || undefined
      }
      onAdd={() => {
        setEditing(null)
        setDraft(blank())
      }}
      onEdit={(s) => {
        setEditing(s)
        setDraft({
          id: s.id,
          name_en: s.name_en,
          name_kn: s.name_kn,
          is_labour: s.is_labour,
          head_id: s.head_id,
          used_for: s.used_for,
        })
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

            <Field
              label={t('subhead.usedFor')}
              hint={
                draft.used_for === 'income'
                  ? 'A grade a crop is sold in — first class, second class.'
                  : 'A kind of spending — fertilizer, transport, labour.'
              }
            >
              <Select
                value={draft.used_for}
                onChange={(v) => setDraft({ ...draft, used_for: v })}
                options={[
                  { value: 'expense', label: t('kind.expense') },
                  { value: 'income', label: t('subhead.incomeGrade') },
                ]}
              />
            </Field>

            {/* A grade belongs to its crop. Fertilizer belongs to none. */}
            <Field
              label={t('subhead.belongsTo')}
              hint={
                draft.used_for === 'income'
                  ? 'Grades must belong to a crop.'
                  : 'Leave blank to use it on every crop.'
              }
            >
              <Select
                value={draft.head_id ?? ''}
                onChange={(v) => setDraft({ ...draft, head_id: v || null })}
                options={[
                  { value: '', label: t('common.all') },
                  ...(heads ?? []).map((h) => ({ value: h.id, label: nameOf(h) })),
                ]}
              />
            </Field>

            {draft.used_for !== 'income' ? (
              <div className="card px-4 py-2">
                <Switch
                  checked={draft.is_labour === 1}
                  onChange={(v) => setDraft({ ...draft, is_labour: v ? 1 : 0 })}
                  label="This is wages paid to people"
                />
              </div>
            ) : null}

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
