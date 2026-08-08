import { useState } from 'react'
import { MapPin } from 'lucide-react'
import { useQuery } from '@/hooks/useQuery'
import { listPlots, savePlot } from '@/data/masterData'
import { useI18n } from '@/i18n'
import { Button, Field, Input, QuantityInput, Segmented, Sheet, TextArea } from '@/components/ui'
import { formatQuantity } from '@/lib/quantity'
import { MasterList, RowActions } from './MasterList'
import type { AreaUnit, Plot } from '@/db/types'

/**
 * The pieces of land the farm is made of.
 *
 * Almost every farmer here works more than one — an inherited plot, a bought
 * one, a leased one — and until this existed the app could tell you what
 * banana made but not which land made it. That matters most for the leased
 * plot, which is the one where the answer decides whether to renew.
 *
 * Nothing forces a farmer with one plot to use this. The field is optional on
 * every screen, and a farm with no plots recorded behaves exactly as before.
 */

const AREA_UNITS: AreaUnit[] = ['acre', 'gunta', 'hectare']

interface Draft {
  id?: string
  name_en: string
  name_kn: string
  survey_no: string
  area_milli: number | null
  area_unit: AreaUnit
  village: string
  note: string
}

const blank = (): Draft => ({
  name_en: '',
  name_kn: '',
  survey_no: '',
  area_milli: null,
  // Acres are what people say out loud here; guntas are for the small ones.
  area_unit: 'acre',
  village: '',
  note: '',
})

export function PlotsScreen() {
  const { t, nameOf } = useI18n()
  const [showInactive, setShowInactive] = useState(false)
  const { data, loading } = useQuery(() => listPlots(showInactive), [showInactive])
  const [draft, setDraft] = useState<Draft | null>(null)
  const [editing, setEditing] = useState<Plot | null>(null)

  const valid = !!draft && (draft.name_kn.trim() !== '' || draft.name_en.trim() !== '')

  async function submit() {
    if (!draft) return
    const name = draft.name_kn.trim() || draft.name_en.trim()
    await savePlot({
      id: draft.id,
      name_en: draft.name_en.trim() || name,
      name_kn: draft.name_kn.trim() || name,
      survey_no: draft.survey_no.trim() || null,
      area_milli: draft.area_milli,
      area_unit: draft.area_milli == null ? null : draft.area_unit,
      village: draft.village.trim() || null,
      note: draft.note.trim() || null,
    })
    setDraft(null)
    setEditing(null)
  }

  /** "2.5 acre · Survey 114/2" — whatever of it the farmer actually filled in. */
  const describe = (p: Plot) =>
    [
      p.area_milli != null
        ? `${formatQuantity(p.area_milli)} ${t(`plot.${p.area_unit ?? 'acre'}` as 'plot.acre')}`
        : '',
      p.survey_no ? `${t('plot.surveyNo')} ${p.survey_no}` : '',
      p.village ?? '',
    ]
      .filter(Boolean)
      .join(' · ') || undefined

  return (
    <MasterList
      title={t('plot.title')}
      table="plots"
      items={data ?? []}
      loading={loading}
      showInactive={showInactive}
      onShowInactiveChange={setShowInactive}
      emptyHint={t('plot.hint')}
      leadingOf={() => <MapPin size={19} style={{ color: 'var(--color-brand-600)' }} />}
      subtitleOf={describe}
      onAdd={() => {
        setEditing(null)
        setDraft(blank())
      }}
      onEdit={(p) => {
        setEditing(p)
        setDraft({
          id: p.id,
          name_en: p.name_en,
          name_kn: p.name_kn,
          survey_no: p.survey_no ?? '',
          area_milli: p.area_milli,
          area_unit: p.area_unit ?? 'acre',
          village: p.village ?? '',
          note: p.note ?? '',
        })
      }}
    >
      <Sheet
        open={!!draft}
        onClose={() => {
          setDraft(null)
          setEditing(null)
        }}
        title={editing ? nameOf(editing) : t('plot.one')}
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
                placeholder="ಹೊಸತೋಟ"
                autoFocus
              />
            </Field>
            <Field label="Name (English)">
              <Input
                value={draft.name_en}
                onChange={(v) => setDraft({ ...draft, name_en: v })}
                placeholder="Hosatota"
              />
            </Field>

            <Field label={t('plot.area')}>
              <div className="grid grid-cols-2 gap-3">
                <QuantityInput
                  milli={draft.area_milli}
                  onChange={(v) => setDraft({ ...draft, area_milli: v })}
                />
                <Segmented
                  value={draft.area_unit}
                  onChange={(v) => setDraft({ ...draft, area_unit: v })}
                  options={AREA_UNITS.map((u) => ({
                    value: u,
                    label: t(`plot.${u}` as 'plot.acre'),
                  }))}
                />
              </div>
            </Field>

            <Field label={t('plot.surveyNo')}>
              <Input
                value={draft.survey_no}
                onChange={(v) => setDraft({ ...draft, survey_no: v })}
                placeholder="114/2"
              />
            </Field>

            <Field label={t('labour.village')}>
              <Input
                value={draft.village}
                onChange={(v) => setDraft({ ...draft, village: v })}
              />
            </Field>

            <Field label={t('common.note')}>
              <TextArea value={draft.note} onChange={(v) => setDraft({ ...draft, note: v })} />
            </Field>

            {editing ? (
              <RowActions
                item={editing}
                table="plots"
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
