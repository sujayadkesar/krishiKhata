import { useState } from 'react'
import { Tags, HardHat, ChevronRight, Plus, Pencil, EyeOff, Sprout } from 'lucide-react'
import { Page, Shell } from '@/components/Shell'
import { Button, Card, EmptyState, Field, Input, ListRow, Sheet, Switch, SectionHeader } from '@/components/ui'
import { useQuery } from '@/hooks/useQuery'
import {
  listHeads, listSubHeads, listSubHeadsOfHead, saveSubHead,
} from '@/data/masterData'
import { useI18n } from '@/i18n'
import { back, navigate } from '@/router'
import { MasterList, RowActions } from './MasterList'
import type { Bool, SubHead } from '@/db/types'

/**
 * Sub-heads, arranged the way the crop actually is.
 *
 * There are two genuinely different things in this table and the old screen
 * showed them as one flat list, which is why every crop was offered every
 * sub-head at entry time:
 *
 *   On the income side, a sub-head is what the crop was sold AS. Banana is
 *   not one thing — G9, Mitka and Karibale fetch different prices, and within
 *   each of them first and second class fetch different prices again. So this
 *   is a two-level tree per crop: variety, then grade.
 *
 *   On the expense side, a sub-head is a KIND OF SPEND. Most are global —
 *   fertilizer is fertilizer whatever it was applied to — but a crop can have
 *   its own, and only its own are offered against it.
 *
 * The screen is therefore per head. `/settings/sub-heads` lists the crops to
 * choose from plus the global spend types; `/settings/sub-heads/:headId` is
 * the tree for one crop.
 */

/* ------------------------------------------------------------------ *
 * The picker: which crop's varieties and grades to edit
 * ------------------------------------------------------------------ */

export function SubHeadsScreen() {
  const { t, nameOf } = useI18n()
  const { data: heads, loading } = useQuery(() => listHeads(false), [])

  return (
    <Shell title={t('set.subHeads')} onBack={back} right={<span />}>
      <Page>
        <section>
          <SectionHeader>{t('set.pickHead')}</SectionHeader>
          {loading ? (
            <EmptyState>{t('common.loading')}</EmptyState>
          ) : (
            <Card>
              {(heads ?? []).map((h) => (
                <ListRow
                  key={h.id}
                  title={nameOf(h)}
                  subtitle={t('set.varietiesGrades')}
                  leading={<Sprout size={19} style={{ color: 'var(--color-brand-600)' }} />}
                  right={<ChevronRight size={16} style={{ color: 'var(--text-faint)' }} />}
                  onClick={() => navigate(`/settings/sub-heads/${h.id}`)}
                />
              ))}
            </Card>
          )}
        </section>

        <section>
          <SectionHeader>{t('set.globalSpend')}</SectionHeader>
          <GlobalSpendTypes />
        </section>
      </Page>
    </Shell>
  )
}

/**
 * The kinds of spend that apply to every crop — fertilizer, transport, labour.
 *
 * Kept on the picker screen rather than behind another tap, because these are
 * what most farms actually edit and burying them under a crop that does not
 * own them would be a lie about where they live.
 */
function GlobalSpendTypes() {
  const { t, nameOf } = useI18n()
  const { data } = useQuery(() => listSubHeads(false), [])
  const global = (data ?? []).filter((s) => !s.head_id)

  return (
    <Card>
      {global.map((s) => (
        <ListRow
          key={s.id}
          title={nameOf(s)}
          subtitle={s.is_labour ? 'Wages paid to people' : undefined}
          leading={
            s.is_labour ? (
              <HardHat size={18} style={{ color: 'var(--color-earth-500)' }} />
            ) : (
              <Tags size={18} style={{ color: 'var(--color-brand-600)' }} />
            )
          }
          right={<ChevronRight size={16} style={{ color: 'var(--text-faint)' }} />}
          onClick={() => navigate('/settings/spend-types')}
        />
      ))}
      {global.length === 0 ? (
        <ListRow title={t('common.empty')} onClick={() => navigate('/settings/spend-types')} />
      ) : null}
    </Card>
  )
}

/* ------------------------------------------------------------------ *
 * Global spend types, as a plain master list
 * ------------------------------------------------------------------ */

interface SpendDraft {
  id?: string
  name_en: string
  name_kn: string
  is_labour: Bool
}

export function SpendTypesScreen() {
  const { t, nameOf } = useI18n()
  const [showInactive, setShowInactive] = useState(false)
  const { data, loading } = useQuery(() => listSubHeads(showInactive), [showInactive])
  const [draft, setDraft] = useState<SpendDraft | null>(null)
  const [editing, setEditing] = useState<SubHead | null>(null)

  const items = (data ?? []).filter((s) => !s.head_id && !s.parent_id)
  const valid = !!draft && (draft.name_kn.trim() !== '' || draft.name_en.trim() !== '')

  async function submit() {
    if (!draft) return
    const name = draft.name_kn.trim() || draft.name_en.trim()
    await saveSubHead({
      id: draft.id,
      name_en: draft.name_en.trim() || name,
      name_kn: draft.name_kn.trim() || name,
      is_labour: draft.is_labour,
      head_id: null,
      used_for: 'expense',
      parent_id: null,
    })
    setDraft(null)
    setEditing(null)
  }

  return (
    <MasterList
      title={t('set.globalSpend')}
      table="sub_heads"
      items={items}
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
        setDraft({ name_en: '', name_kn: '', is_labour: 0 })
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
        title={editing ? nameOf(editing) : t('set.globalSpend')}
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

/* ------------------------------------------------------------------ *
 * One crop's tree
 * ------------------------------------------------------------------ */

interface TreeDraft {
  id?: string
  name_en: string
  name_kn: string
  used_for: 'income' | 'expense'
  /** Set when adding a grade beneath a variety. */
  parent_id: string | null
  is_labour: Bool
}

export function HeadSubHeadsScreen({ headId }: { headId: string }) {
  const { t, nameOf } = useI18n()
  const [showInactive, setShowInactive] = useState(false)
  const { data: heads } = useQuery(() => listHeads(true), [])
  const { data, loading } = useQuery(
    () => listSubHeadsOfHead(headId, showInactive),
    [headId, showInactive],
  )
  const [draft, setDraft] = useState<TreeDraft | null>(null)

  const head = (heads ?? []).find((h) => h.id === headId)
  const rows = data ?? []
  const varieties = rows.filter((s) => s.used_for !== 'expense' && !s.parent_id)
  const ownSpend = rows.filter((s) => s.used_for === 'expense' && !s.parent_id)
  const childrenOf = (id: string) => rows.filter((s) => s.parent_id === id)

  const valid = !!draft && (draft.name_kn.trim() !== '' || draft.name_en.trim() !== '')

  async function submit() {
    if (!draft) return
    const name = draft.name_kn.trim() || draft.name_en.trim()
    await saveSubHead({
      id: draft.id,
      name_en: draft.name_en.trim() || name,
      name_kn: draft.name_kn.trim() || name,
      is_labour: draft.used_for === 'income' ? 0 : draft.is_labour,
      head_id: headId,
      used_for: draft.used_for,
      parent_id: draft.parent_id,
    })
    setDraft(null)
  }

  const add = (used_for: 'income' | 'expense', parent_id: string | null = null) =>
    setDraft({ name_en: '', name_kn: '', used_for, parent_id, is_labour: 0 })

  const open = (s: SubHead) =>
    setDraft({
      id: s.id,
      name_en: s.name_en,
      name_kn: s.name_kn,
      used_for: s.used_for === 'income' ? 'income' : 'expense',
      parent_id: s.parent_id,
      is_labour: s.is_labour,
    })

  const editing = draft?.id ? rows.find((s) => s.id === draft.id) : undefined

  return (
    <Shell title={head ? nameOf(head) : t('set.varietiesGrades')} onBack={back} right={<span />}>
      <Page>
        {loading ? <EmptyState>{t('common.loading')}</EmptyState> : null}

        {/* ------------------------------------------------ income -- */}
        <section>
          <SectionHeader>{t('set.varietiesGrades')}</SectionHeader>
          <Card>
            {varieties.map((v) => (
              <div key={v.id}>
                <ListRow
                  title={nameOf(v)}
                  muted={!v.is_active}
                  leading={<Sprout size={18} style={{ color: 'var(--color-income)' }} />}
                  onClick={() => open(v)}
                  right={
                    <span className="flex items-center gap-1">
                      {!v.is_active ? (
                        <EyeOff size={15} style={{ color: 'var(--text-faint)' }} />
                      ) : null}
                      <Pencil size={15} style={{ color: 'var(--text-faint)' }} />
                    </span>
                  }
                />
                {/* Grades sit indented under their variety, because that is
                    the relationship — "First class" on its own means nothing
                    once there are three varieties. */}
                <div style={{ paddingLeft: 22 }}>
                  {childrenOf(v.id).map((g) => (
                    <ListRow
                      key={g.id}
                      title={nameOf(g)}
                      muted={!g.is_active}
                      leading={
                        <span
                          style={{
                            width: 8, height: 8, borderRadius: 999,
                            background: 'var(--border-strong)', display: 'block',
                          }}
                        />
                      }
                      onClick={() => open(g)}
                      right={<Pencil size={14} style={{ color: 'var(--text-faint)' }} />}
                    />
                  ))}
                  <button
                    onClick={() => add('income', v.id)}
                    className="w-full text-left px-4 py-2.5 text-sm font-semibold"
                    style={{ color: 'var(--color-brand-600)' }}
                  >
                    <Plus size={14} className="inline -mt-0.5 mr-1" />
                    {t('set.addGrade')}
                  </button>
                </div>
              </div>
            ))}
            {varieties.length === 0 ? (
              <ListRow title={t('common.empty')} subtitle="Sold one way only" />
            ) : null}
          </Card>
          <div className="mt-2">
            <Button variant="soft" full onClick={() => add('income')}>
              <span className="inline-flex items-center gap-2 justify-center">
                <Plus size={17} /> {t('set.addVariety')}
              </span>
            </Button>
          </div>
        </section>

        {/* ----------------------------------------------- expense -- */}
        <section>
          <SectionHeader>{t('kind.expense')}</SectionHeader>
          <Card>
            {ownSpend.map((s) => (
              <ListRow
                key={s.id}
                title={nameOf(s)}
                muted={!s.is_active}
                leading={<Tags size={18} style={{ color: 'var(--color-expense)' }} />}
                onClick={() => open(s)}
                right={<Pencil size={15} style={{ color: 'var(--text-faint)' }} />}
              />
            ))}
            {ownSpend.length === 0 ? (
              <ListRow title={t('set.globalSpend')} subtitle="No spend types of its own" />
            ) : null}
          </Card>
          <div className="mt-2">
            <Button variant="soft" full onClick={() => add('expense')}>
              <span className="inline-flex items-center gap-2 justify-center">
                <Plus size={17} /> {t('common.add')}
              </span>
            </Button>
          </div>
        </section>

        <div className="card px-4 py-2">
          <Switch
            checked={showInactive}
            onChange={setShowInactive}
            label={t('set.showInactive')}
          />
        </div>

        <Sheet
          open={!!draft}
          onClose={() => setDraft(null)}
          title={
            draft?.parent_id
              ? t('set.addGrade')
              : draft?.used_for === 'income'
                ? t('set.addVariety')
                : t('set.subHeads')
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
                  placeholder={draft.used_for === 'income' ? 'ಜಿ೯' : 'ಗೊಬ್ಬರ'}
                  autoFocus
                />
              </Field>
              <Field label="Name (English)">
                <Input
                  value={draft.name_en}
                  onChange={(v) => setDraft({ ...draft, name_en: v })}
                  placeholder={draft.used_for === 'income' ? 'G9' : 'Fertilizer'}
                />
              </Field>

              {draft.used_for === 'expense' ? (
                <div className="card px-4 py-2">
                  <Switch
                    checked={draft.is_labour === 1}
                    onChange={(v) => setDraft({ ...draft, is_labour: v ? 1 : 0 })}
                    label="This is wages paid to people"
                  />
                </div>
              ) : null}

              {editing ? (
                <RowActions item={editing} table="sub_heads" onDone={() => setDraft(null)} />
              ) : null}
            </>
          ) : null}
        </Sheet>
      </Page>
    </Shell>
  )
}
