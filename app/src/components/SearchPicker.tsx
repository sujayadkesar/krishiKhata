import { useI18n } from '@/i18n'
import { useMemo, useState } from 'react'
import { Check, ChevronDown, Search, X } from 'lucide-react'
import { Sheet } from './ui'

/**
 * Choosing from a list that has outgrown chips.
 *
 * Chips were right when there were four workers. At twenty they wrap into a
 * paragraph of buttons that has to be read rather than scanned, and the one
 * you want is never where it was last time. This is a field that opens a sheet
 * with a search box — the same shape whether one thing is being chosen or
 * several, so there is one interaction to learn.
 *
 * The search matches BOTH names. A farmer typing "ram" in English must find
 * ರಮೇಶ, because the keyboard in their hand is usually the English one even
 * when the app is in Kannada.
 */

export interface PickerOption {
  value: string
  label: string
  /** Anything else worth matching on — a code, a village, a phone number. */
  search?: string
  hint?: string
}

function matches(o: PickerOption, q: string): boolean {
  if (!q) return true
  const needle = q.trim().toLowerCase()
  return `${o.label} ${o.search ?? ''} ${o.hint ?? ''}`.toLowerCase().includes(needle)
}

/** The closed field: looks and behaves like the other inputs. */
function Trigger({
  text,
  placeholder,
  onOpen,
  onClear,
}: {
  text: string | null
  placeholder: string
  onOpen: () => void
  onClear?: () => void
}) {
  return (
    <div className="relative">
      <button
        onClick={onOpen}
        className="field w-full text-left pr-10 flex items-center"
        style={{ color: text ? 'var(--text)' : 'var(--text-faint)' }}
      >
        <span className="truncate">{text || placeholder}</span>
      </button>
      {text && onClear ? (
        <button
          onClick={onClear}
          aria-label="Clear"
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1"
          style={{ color: 'var(--text-faint)', minHeight: 0 }}
        >
          <X size={16} />
        </button>
      ) : (
        <ChevronDown
          size={18}
          className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
          style={{ color: 'var(--text-faint)' }}
        />
      )}
    </div>
  )
}

function SearchBox({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { t } = useI18n()
  return (
    <div className="relative">
      <Search
        size={17}
        className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
        style={{ color: 'var(--text-faint)' }}
      />
      <input
        className="field pl-10"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t('common.search')}
        autoFocus
      />
    </div>
  )
}

function Row({
  option,
  selected,
  onToggle,
}: {
  option: PickerOption
  selected: boolean
  onToggle: () => void
}) {
  return (
    <button
      onClick={onToggle}
      className="w-full flex items-center gap-3 px-3 py-3 text-left rounded-lg"
      style={{ background: selected ? 'var(--color-brand-50)' : 'transparent' }}
    >
      <span
        className="grid place-items-center rounded-md shrink-0"
        style={{
          width: 22,
          height: 22,
          border: `2px solid ${selected ? 'var(--color-brand-500)' : 'var(--border-strong)'}`,
          background: selected ? 'var(--color-brand-500)' : 'transparent',
          color: '#fff',
        }}
      >
        {selected ? <Check size={14} strokeWidth={3} /> : null}
      </span>
      <span className="flex-1 min-w-0">
        <span className="block font-medium truncate">{option.label}</span>
        {option.hint ? (
          <span className="block text-xs truncate" style={{ color: 'var(--text-faint)' }}>
            {option.hint}
          </span>
        ) : null}
      </span>
    </button>
  )
}

/** Choose several. The field shows how many, then their names. */
export function SearchMultiSelect({
  options,
  selected,
  onChange,
  title,
  placeholder = 'Select',
}: {
  options: PickerOption[]
  selected: string[]
  onChange: (next: string[]) => void
  title: string
  placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  const shown = useMemo(() => options.filter((o) => matches(o, query)), [options, query])
  const chosen = options.filter((o) => selected.includes(o.value))
  const label =
    chosen.length === 0
      ? null
      : chosen.length <= 2
        ? chosen.map((o) => o.label).join(', ')
        : `${chosen.length} selected · ${chosen[0].label}, ${chosen[1].label}…`

  const toggle = (value: string) =>
    onChange(
      selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value],
    )

  return (
    <>
      <Trigger
        text={label}
        placeholder={placeholder}
        onOpen={() => {
          setQuery('')
          setOpen(true)
        }}
        onClear={selected.length ? () => onChange([]) : undefined}
      />

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title={title}
        footer={
          <button
            onClick={() => setOpen(false)}
            className="w-full rounded-xl py-3.5 font-semibold text-white"
            style={{ background: 'var(--color-brand-500)' }}
          >
            {selected.length ? `Done · ${selected.length}` : 'Done'}
          </button>
        }
      >
        <SearchBox value={query} onChange={setQuery} />
        <div className="space-y-0.5 -mx-1">
          {shown.map((o) => (
            <Row
              key={o.value}
              option={o}
              selected={selected.includes(o.value)}
              onToggle={() => toggle(o.value)}
            />
          ))}
          {shown.length === 0 ? (
            <p className="text-sm text-center py-6" style={{ color: 'var(--text-faint)' }}>
              Nothing matches “{query}”
            </p>
          ) : null}
        </div>
      </Sheet>
    </>
  )
}

/** Choose one. Picking closes the sheet, because there is nothing left to do. */
export function SearchSelect({
  options,
  value,
  onChange,
  title,
  placeholder = 'Select',
  allowClear = false,
}: {
  options: PickerOption[]
  value: string | null
  onChange: (v: string | null) => void
  title: string
  placeholder?: string
  allowClear?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  const shown = useMemo(() => options.filter((o) => matches(o, query)), [options, query])
  const current = options.find((o) => o.value === value) ?? null

  return (
    <>
      <Trigger
        text={current?.label ?? null}
        placeholder={placeholder}
        onOpen={() => {
          setQuery('')
          setOpen(true)
        }}
        onClear={allowClear && value ? () => onChange(null) : undefined}
      />

      <Sheet open={open} onClose={() => setOpen(false)} title={title}>
        <SearchBox value={query} onChange={setQuery} />
        <div className="space-y-0.5 -mx-1">
          {shown.map((o) => (
            <Row
              key={o.value}
              option={o}
              selected={o.value === value}
              onToggle={() => {
                onChange(o.value)
                setOpen(false)
              }}
            />
          ))}
          {shown.length === 0 ? (
            <p className="text-sm text-center py-6" style={{ color: 'var(--text-faint)' }}>
              Nothing matches “{query}”
            </p>
          ) : null}
        </div>
      </Sheet>
    </>
  )
}
