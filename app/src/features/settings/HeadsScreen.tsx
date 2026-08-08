import { useEffect, useState } from 'react'
import { Sprout, Tags, ChevronRight } from 'lucide-react'
import { useQuery } from '@/hooks/useQuery'
import { getHeadUnits, listHeadsFor, listUnits, saveHead } from '@/data/masterData'
import { useI18n } from '@/i18n'
import { Button, ChipMulti, Field, Input, Sheet, Switch } from '@/components/ui'
import { navigate } from '@/router'
import { MasterList, RowActions } from './MasterList'
import type { Head, HeadUse } from '@/db/types'

/**
 * Heads, one side of the book at a time.
 *
 * "What you sell" and "what you spend on" are two lists because they are two
 * questions, and reading one combined list forced the farmer to work out which
 * rows were relevant to what they were doing. A crop answers both and is still
 * ONE row underneath — see `listHeadsFor` for why splitting it in the database
 * would quietly destroy crop profitability.
 *
 * The unit list is per head because honey is sold by the bottle AND by the
 * kilo while banana goes by kilo or by bunch. Offering every unit on every
 * crop turns a two-tap entry into a scroll through ten irrelevant options.
 * It only appears on the income side: nothing is sold by the bag on a bill
 * from the fertilizer shop.
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

/**
 * A crop entered from the sale side defaults to carrying costs too, because
 * every crop does. Something entered from the expense side does not default to
 * being sellable — a diesel bill is not a harvest.
 */
const blank = (side: Side): Draft => ({
  name_en: '',
  name_kn: '',
  used_for: side === 'income' ? 'both' : 'expense',
  color: 'emerald',
  unitIds: [],
})

export type Side = 'income' | 'expense'

export function HeadsScreen({ side }: { side: Side }) {
  const { t, nameOf, lang } = useI18n()
  const [showInactive, setShowInactive] = useState(false)
  const { data, loading } = useQuery(
    () => listHeadsFor(side, showInactive),
    [side, showInactive],
  )
  const { data: units } = useQuery(() => listUnits(false), [])
  const [draft, setDraft] = useState<Draft | null>(null)
  const [editing, setEditing] = useState<Head | null>(null)

  const bothLabel =
    side === 'income' ? 'Also record expenses against this' : 'Also record sales against this'

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
      title={side === 'income' ? t('set.incomeHeads') : t('set.expenseHeads')}
      table="heads"
      items={data ?? []}
      loading={loading}
      showInactive={showInactive}
      onShowInactiveChange={setShowInactive}
      leadingOf={(h) => (
        <Sprout size={19} style={{ color: SWATCH[h.color] ?? 'var(--color-brand-600)' }} />
      )}
      subtitleOf={(h) => (h.used_for === 'both' ? 'Sales and expenses' : undefined)}
      /* Straight from the head to the varieties and grades filed under it,
         because that is where the farmer is going next and hunting for it in
         another Settings screen is the step people give up on. */
      rightOf={(h) => (
        <button
          onClick={(e) => {
            e.stopPropagation()
            navigate(`/settings/sub-heads/${h.id}`)
          }}
          aria-label={t('set.varietiesGrades')}
          className="px-1.5"
          style={{ color: 'var(--color-brand-600)', minHeight: 32 }}
        >
          <Tags size={17} />
        </button>
      )}
      onAdd={() => {
        setEditing(null)
        setDraft(blank(side))
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
        title={
          editing
            ? nameOf(editing)
            : side === 'income'
              ? t('set.incomeHeads')
              : t('set.expenseHeads')
        }
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

            {/* One switch instead of a three-way "used for". The farmer is
                already in the list they meant; all that is left to say is
                whether this head also belongs on the other side. */}
            <div className="card px-4 py-2">
              <Switch
                checked={draft.used_for === 'both'}
                onChange={(v) => setDraft({ ...draft, used_for: v ? 'both' : side })}
                label={bothLabel}
              />
            </div>

            {side === 'income' ? (
              <Field
                label={t('set.allowedUnits')}
                hint="Tap in the order you use them — the first one is offered by default."
              >
                <ChipMulti
                  options={(units ?? []).map((u) => ({
                    value: u.id,
                    label: `${nameOf(u)} (${lang === 'en' ? u.short_en : u.short_kn})`,
                  }))}
                  selected={new Set(draft.unitIds)}
                  onToggle={toggleUnit}
                />
              </Field>
            ) : null}

            {editing ? (
              <button
                onClick={() => navigate(`/settings/sub-heads/${editing.id}`)}
                className="card w-full flex items-center gap-3 px-4 py-3 text-left"
              >
                <Tags size={18} style={{ color: 'var(--color-brand-600)' }} />
                <span className="flex-1 text-sm font-medium">{t('set.varietiesGrades')}</span>
                <ChevronRight size={16} style={{ color: 'var(--text-faint)' }} />
              </button>
            ) : null}

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
