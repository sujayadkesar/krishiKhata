import { useState } from 'react'
import type { ReactNode } from 'react'
import { Plus, EyeOff, Trash2, Pencil } from 'lucide-react'
import { Page, Shell } from '@/components/Shell'
import { Button, Card, Confirm, EmptyState, ListRow, Switch } from '@/components/ui'
import { useI18n } from '@/i18n'
import { back } from '@/router'
import { remove, setActive } from '@/data/masterData'
import type { MasterRow } from '@/db/types'

/**
 * The scaffolding every master-data screen shares: the list, the add button,
 * the show-inactive toggle and the remove flow. Each screen supplies only its
 * own form.
 *
 * The remove flow is the part worth sharing. "Delete" means delete when
 * nothing references the row and deactivate when something does, and the
 * message afterwards has to say which happened — otherwise a farmer taps
 * delete, sees the row vanish from the list, and is later surprised to find it
 * still named on last year's statement.
 */

export interface MasterListProps<T extends MasterRow> {
  title: string
  table: string
  items: T[]
  loading: boolean
  /** What each row shows under the name. */
  subtitleOf?: (item: T) => ReactNode
  rightOf?: (item: T) => ReactNode
  leadingOf?: (item: T) => ReactNode
  onAdd: () => void
  onEdit: (item: T) => void
  /** The add/edit sheet, rendered by the calling screen. */
  children?: ReactNode
  showInactive: boolean
  onShowInactiveChange: (v: boolean) => void
  emptyHint?: string
}

export function MasterList<T extends MasterRow>({
  title,
  table,
  items,
  loading,
  subtitleOf,
  rightOf,
  leadingOf,
  onAdd,
  onEdit,
  children,
  showInactive,
  onShowInactiveChange,
  emptyHint,
}: MasterListProps<T>) {
  const { t, nameOf } = useI18n()
  const [pendingRemove, setPendingRemove] = useState<T | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  async function doRemove() {
    const item = pendingRemove
    if (!item) return
    setPendingRemove(null)
    const result = await remove(table, item.id, item.name_en)
    setNotice(
      result === 'deleted'
        ? `${nameOf(item)} removed.`
        : `${nameOf(item)} is used by existing records, so it has been hidden rather than deleted. Your old entries and reports are unchanged.`,
    )
  }

  return (
    <Shell
      title={title}
      onBack={back}
      right={
        <button onClick={onAdd} aria-label={t('common.add')} style={{ color: 'var(--color-brand-600)' }}>
          <Plus size={24} />
        </button>
      }
    >
      <Page>
        {notice ? (
          <div
            className="card p-3 text-sm"
            style={{ background: 'var(--color-earth-100)', borderColor: 'var(--color-earth-300)', color: 'var(--color-earth-700)' }}
          >
            {notice}
            <button className="block mt-1 font-semibold underline" onClick={() => setNotice(null)}>
              {t('common.close')}
            </button>
          </div>
        ) : null}

        {loading ? (
          <EmptyState>{t('common.loading')}</EmptyState>
        ) : items.length === 0 ? (
          <EmptyState>{emptyHint ?? t('common.empty')}</EmptyState>
        ) : (
          <Card>
            {items.map((item) => (
              <ListRow
                key={item.id}
                title={nameOf(item)}
                subtitle={subtitleOf?.(item)}
                muted={!item.is_active}
                leading={leadingOf?.(item)}
                onClick={() => onEdit(item)}
                right={
                  <span className="flex items-center gap-1">
                    {rightOf?.(item)}
                    {!item.is_active ? (
                      <EyeOff size={16} style={{ color: 'var(--text-faint)' }} />
                    ) : null}
                    <Pencil size={16} style={{ color: 'var(--text-faint)' }} />
                  </span>
                }
              />
            ))}
          </Card>
        )}

        <div className="card px-4 py-2">
          <Switch checked={showInactive} onChange={onShowInactiveChange} label={t('set.showInactive')} />
        </div>

        <Button variant="soft" full onClick={onAdd}>
          <span className="inline-flex items-center gap-2 justify-center">
            <Plus size={18} /> {t('common.add')}
          </span>
        </Button>

        {children}

        <Confirm
          open={!!pendingRemove}
          danger
          title={t('common.delete')}
          body={
            pendingRemove
              ? `Remove "${nameOf(pendingRemove)}"? If any records already use it, it will be hidden instead of deleted so your reports stay correct.`
              : ''
          }
          confirmLabel={t('common.delete')}
          onConfirm={doRemove}
          onCancel={() => setPendingRemove(null)}
        />
      </Page>
    </Shell>
  )
}

/** The delete / reactivate pair shown at the bottom of every edit sheet. */
export function RowActions<T extends MasterRow>({
  item,
  table,
  onDone,
}: {
  item: T
  table: string
  onDone: () => void
}) {
  const { t, nameOf } = useI18n()
  const [confirming, setConfirming] = useState(false)

  return (
    <>
      <div className="flex gap-2.5 pt-2">
        {item.is_active ? (
          <Button
            variant="ghost"
            full
            onClick={async () => {
              await setActive(table, item.id, false)
              onDone()
            }}
          >
            {t('set.inactive')}
          </Button>
        ) : (
          <Button
            variant="soft"
            full
            onClick={async () => {
              await setActive(table, item.id, true)
              onDone()
            }}
          >
            {t('common.done')}
          </Button>
        )}
        <Button variant="danger" full onClick={() => setConfirming(true)}>
          <span className="inline-flex items-center gap-2 justify-center">
            <Trash2 size={16} /> {t('common.delete')}
          </span>
        </Button>
      </div>

      <Confirm
        open={confirming}
        danger
        title={t('common.delete')}
        body={`Remove "${nameOf(item)}"? If any records already use it, it will be hidden instead of deleted so your reports stay correct.`}
        confirmLabel={t('common.delete')}
        onConfirm={async () => {
          setConfirming(false)
          await remove(table, item.id, item.name_en)
          onDone()
        }}
        onCancel={() => setConfirming(false)}
      />
    </>
  )
}
