import { useEffect, useState } from 'react'
import { Sprout } from 'lucide-react'
import { useQuery } from '@/hooks/useQuery'
import { getHeadUnits, listHeads, listUnits, saveHead } from '@/data/masterData'
import { useI18n } from '@/i18n'
import { Button, ChipMulti, Field, Input, Select, Sheet } from '@/components/ui'
import { MasterList, RowActions } from './MasterList'
import type { Head, HeadUse } from '@/db/types'

/**
 * Crops and income heads, and the units each is sold in.
 *
 * The unit list is per head because honey is sold by the bottle AND by the
 * kilo while banana goes by kilo or by bunch. Offering every unit on every
 * crop turns a two-tap entry into a scroll through ten irrelevant options.
 *
 * The FIRST selected unit is the default, and the chip order shows it, so
 * there is no separate "which is default" control to explain.
 */

const COLORS = ['amber', 'rose', 'orange', 'yellow', 'lime', 'emerald', 'sky', 'violet', 'slate']

const SWATCH: Record<string, string> = {
  amber: '#f59e0b', rose: '#f43f5e', orange: '#f97316', yellow: '#eab308',
  lime: '#84cc16', emerald: '#10b981', sky: '#0ea5e9', violet: '#8b5cf6', slate: '#64748b',
}

interface Draft {
  id?: string
  name_en: string
  name_kn: string
  used_for: HeadUse
  color: string
  unitIds: string[]
}

const blank = (): Draft => ({
  name_en: '', name_kn: '', used_for: 'both', color: 'emerald', unitIds: [],
})

export function HeadsScreen() {
  const { t, nameOf, lang } = useI18n()
  const [showInactive, setShowInactive] = useState(false)
  const { data, loading } = useQuery(() => listHeads(showInactive), [showInactive])
  const { data: units } = useQuery(() => listUnits(false), [])
  const [draft, setDraft] = useState<Draft | null>(null)
  const [editing, setEditing] = useState<Head | null>(null)

  // Unit assignments live in their own table, so they are fetched when a head
  // is opened rather than joined into the list query.
  useEffect(() => {
    if (!editing) return
    let cancelled = false
    void getHeadUnits(editing.id).then((rows) => {
      if (cancelled) return
      setDraft((d) => (d && d.id === editing.id ? { ...d, unitIds: rows.map((r) => r.unit_id) } : d))
    })
    return () => {
      cancelled = true
    }
  }, [editing])

  const valid = !!draft && (draft.name_kn.trim() !== '' || draft.name_en.trim() !== '')

  async function submit() {
    if (!draft) return
    const name = draft.name_kn.trim() || draft.name_en.trim()
    await saveHead({
      id: draft.id,
      name_en: draft.name_en.trim() || name,
      name_kn: draft.name_kn.trim() || name,
      used_for: draft.used_for,
      color: draft.color,
      unitIds: draft.unitIds,
    })
    setDraft(null)
    setEditing(null)
  }

  function toggleUnit(id: string) {
    if (!draft) return
    const has = draft.unitIds.includes(id)
    setDraft({
      ...draft,
      unitIds: has ? draft.unitIds.filter((u) => u !== id) : [...draft.unitIds, id],
    })
  }

  return (
    <MasterList
      title={t('set.heads')}
      table="heads"
      items={data ?? []}
      loading={loading}
      showInactive={showInactive}
      onShowInactiveChange={setShowInactive}
      leadingOf={(h) => (
        <Sprout size={19} style={{ color: SWATCH[h.color] ?? 'var(--color-brand-600)' }} />
      )}
      subtitleOf={(h) =>
        h.used_for === 'both' ? 'Income & expense' : h.used_for === 'income' ? 'Income only' : 'Expense only'
      }
      onAdd={() => {
        setEditing(null)
        setDraft(blank())
      }}
      onEdit={(h) => {
        setEditing(h)
        setDraft({
          id: h.id,
          name_en: h.name_en,
          name_kn: h.name_kn,
          used_for: h.used_for,
          color: h.color,
          unitIds: [],
        })
      }}
    >
      <Sheet
        open={!!draft}
        onClose={() => {
          setDraft(null)
          setEditing(null)
        }}
        title={editing ? nameOf(editing) : t('set.heads')}
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
                placeholder="ಬಾಳೆಕಾಯಿ"
                autoFocus
              />
            </Field>

            <Field label="Name (English)">
              <Input
                value={draft.name_en}
                onChange={(v) => setDraft({ ...draft, name_en: v })}
                placeholder="Banana"
              />
            </Field>

            <Field label="Used for">
              <Select
                value={draft.used_for}
                onChange={(v) => setDraft({ ...draft, used_for: v })}
                options={[
                  { value: 'both', label: 'Income & expense' },
                  { value: 'income', label: 'Income only' },
                  { value: 'expense', label: 'Expense only' },
                ]}
              />
            </Field>

            <Field
              label={t('set.allowedUnits')}
              hint="Tap in the order you use them — the first one is offered by default."
            >
              <ChipMulti
                options={(units ?? []).map((u) => ({
                  value: u.id,
                  label: `${nameOf(u)} (${lang === 'kn' ? u.short_kn : u.short_en})`,
                }))}
                selected={new Set(draft.unitIds)}
                onToggle={toggleUnit}
              />
            </Field>

            <Field label="Colour" hint="Used for this crop everywhere — charts, lists, statements.">
              <div className="flex flex-wrap gap-2">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setDraft({ ...draft, color: c })}
                    aria-label={c}
                    className="rounded-full"
                    style={{
                      width: 36,
                      height: 36,
                      minHeight: 36,
                      background: SWATCH[c],
                      outline: draft.color === c ? '3px solid var(--text)' : 'none',
                      outlineOffset: 2,
                    }}
                  />
                ))}
              </div>
            </Field>

            {editing ? (
              <RowActions
                item={editing}
                table="heads"
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
