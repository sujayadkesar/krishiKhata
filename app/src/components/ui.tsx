import { useEffect, useId, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { X, Check, ChevronDown } from 'lucide-react'
import { formatPaise, parseAmountToPaise } from '@/lib/money'
import { formatQuantity, parseQuantityToMilli } from '@/lib/quantity'
import { useI18n } from '@/i18n'

/**
 * The shared controls.
 *
 * Sizing is not decoration here: every tap target is at least 44px and every
 * text input is at least 16px, because anything smaller makes the Android
 * WebView zoom on focus and scroll the form out from under the farmer.
 */

/* ------------------------------------------------------------------ */

export function Button({
  children,
  onClick,
  variant = 'primary',
  disabled,
  type = 'button',
  full,
}: {
  children: ReactNode
  onClick?: () => void
  variant?: 'primary' | 'ghost' | 'danger' | 'soft'
  disabled?: boolean
  type?: 'button' | 'submit'
  full?: boolean
}) {
  const styles: Record<string, React.CSSProperties> = {
    primary: { background: 'var(--color-brand-500)', color: '#fff' },
    soft: { background: 'var(--color-brand-50)', color: 'var(--color-brand-700)' },
    ghost: { background: 'transparent', color: 'var(--text-soft)' },
    danger: { background: 'var(--color-expense-soft)', color: 'var(--color-expense)' },
  }

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`rounded-xl px-4 py-3 font-semibold ${full ? 'w-full' : ''}`}
      style={{ ...styles[variant], opacity: disabled ? 0.45 : 1 }}
    >
      {children}
    </button>
  )
}

/* ------------------------------------------------------------------ */

export function Field({
  label,
  children,
  hint,
  error,
  required,
}: {
  label: string
  children: ReactNode
  hint?: string
  error?: string | null
  required?: boolean
}) {
  return (
    <label className="block">
      <span className="field-label">
        {label}
        {required ? <span style={{ color: 'var(--color-expense)' }}> *</span> : null}
      </span>
      {children}
      {error ? (
        <span className="block mt-1 text-xs" style={{ color: 'var(--color-expense)' }}>
          {error}
        </span>
      ) : hint ? (
        <span className="block mt-1 text-xs" style={{ color: 'var(--text-faint)' }}>
          {hint}
        </span>
      ) : null}
    </label>
  )
}

export function Input({
  value,
  onChange,
  placeholder,
  type = 'text',
  inputMode,
  maxLength,
  autoFocus,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
  inputMode?: 'text' | 'numeric' | 'decimal' | 'tel'
  maxLength?: number
  autoFocus?: boolean
}) {
  return (
    <input
      className="field"
      type={type}
      inputMode={inputMode}
      value={value}
      maxLength={maxLength}
      autoFocus={autoFocus}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  )
}

export function TextArea({
  value,
  onChange,
  placeholder,
  rows = 2,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  rows?: number
}) {
  return (
    <textarea
      className="field"
      rows={rows}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  )
}

/**
 * Money in, integer paise out.
 *
 * Holds the raw text so a half-typed "12." is not destroyed by reformatting
 * under the farmer's fingers — the value is only normalised on blur.
 */
export function MoneyInput({
  paise,
  onChange,
  placeholder = '0',
  autoFocus,
}: {
  paise: number | null
  onChange: (p: number | null) => void
  placeholder?: string
  autoFocus?: boolean
}) {
  const [text, setText] = useState(() => (paise == null ? '' : formatPaise(paise)))
  const editing = useRef(false)

  useEffect(() => {
    if (editing.current) return
    setText(paise == null ? '' : formatPaise(paise))
  }, [paise])

  return (
    <div className="relative">
      <span
        className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
        style={{ color: 'var(--text-faint)' }}
      >
        ₹
      </span>
      <input
        className="field tnum pl-8"
        inputMode="decimal"
        value={text}
        autoFocus={autoFocus}
        placeholder={placeholder}
        onFocus={() => {
          editing.current = true
        }}
        onChange={(e) => {
          const raw = e.target.value
          setText(raw)
          onChange(raw.trim() === '' ? null : parseAmountToPaise(raw))
        }}
        onBlur={() => {
          editing.current = false
          const p = parseAmountToPaise(text)
          setText(p == null ? '' : formatPaise(p))
        }}
      />
    </div>
  )
}

/** Quantity in, integer milli-units out. */
export function QuantityInput({
  milli,
  onChange,
  suffix,
  allowFraction = true,
}: {
  milli: number | null
  onChange: (m: number | null) => void
  suffix?: string
  allowFraction?: boolean
}) {
  const [text, setText] = useState(() => (milli == null ? '' : formatQuantity(milli)))
  const editing = useRef(false)

  useEffect(() => {
    if (editing.current) return
    setText(milli == null ? '' : formatQuantity(milli))
  }, [milli])

  return (
    <div className="relative">
      <input
        className="field tnum"
        inputMode={allowFraction ? 'decimal' : 'numeric'}
        value={text}
        placeholder="0"
        onFocus={() => {
          editing.current = true
        }}
        onChange={(e) => {
          const raw = e.target.value
          setText(raw)
          onChange(raw.trim() === '' ? null : parseQuantityToMilli(raw))
        }}
        onBlur={() => {
          editing.current = false
          const m = parseQuantityToMilli(text)
          setText(m == null ? '' : formatQuantity(m))
        }}
      />
      {suffix ? (
        <span
          className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-sm"
          style={{ color: 'var(--text-faint)' }}
        >
          {suffix}
        </span>
      ) : null}
    </div>
  )
}

export function Select<T extends string>({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: T | null
  onChange: (v: T) => void
  options: { value: T; label: string }[]
  placeholder?: string
}) {
  return (
    <div className="relative">
      <select
        className="field appearance-none pr-10"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value as T)}
      >
        {placeholder ? (
          <option value="" disabled>
            {placeholder}
          </option>
        ) : null}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown
        size={18}
        className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
        style={{ color: 'var(--text-faint)' }}
      />
    </div>
  )
}

export function DateInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      className="field tnum"
      type="date"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  )
}

export function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
}) {
  const id = useId()
  return (
    <div className="flex items-center justify-between gap-3 py-1">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <button
        id={id}
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className="relative rounded-full transition-colors shrink-0"
        style={{
          width: 48,
          height: 28,
          minHeight: 28,
          background: checked ? 'var(--color-brand-500)' : 'var(--border)',
        }}
      >
        <span
          className="absolute top-1 rounded-full bg-white transition-all"
          style={{ width: 20, height: 20, left: checked ? 24 : 4 }}
        />
      </button>
    </div>
  )
}

/** Multi-select chips — used for which units a crop is sold in. */
export function ChipMulti<T extends string>({
  options,
  selected,
  onToggle,
}: {
  options: { value: T; label: string }[]
  selected: Set<T>
  onToggle: (v: T) => void
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = selected.has(o.value)
        return (
          <button
            key={o.value}
            onClick={() => onToggle(o.value)}
            className="rounded-full px-3.5 py-2 text-sm font-medium border"
            style={{
              minHeight: 40,
              borderColor: on ? 'var(--color-brand-500)' : 'var(--border)',
              background: on ? 'var(--color-brand-50)' : 'var(--surface)',
              color: on ? 'var(--color-brand-700)' : 'var(--text-soft)',
            }}
          >
            {on ? <Check size={14} className="inline mr-1 -mt-0.5" /> : null}
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

/* ------------------------------------------------------------------ */

/**
 * A bottom sheet.
 *
 * Forms open from the bottom rather than as a centre dialog because that is
 * where the thumb already is, and because the keyboard pushes a bottom sheet
 * up naturally instead of covering a centred one.
 */
export function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  footer?: ReactNode
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    // Stop the page behind from scrolling with the sheet.
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <button
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 w-full"
        style={{ background: 'rgba(0,0,0,.45)', minHeight: 0 }}
      />
      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-2xl rounded-t-2xl max-h-[92dvh] flex flex-col"
        style={{ background: 'var(--surface)' }}
      >
        <header
          className="flex items-center gap-3 px-4 py-3 border-b shrink-0"
          style={{ borderColor: 'var(--border)' }}
        >
          <h2 className="flex-1 font-semibold text-lg">{title}</h2>
          <button onClick={onClose} aria-label="Close" style={{ color: 'var(--text-faint)' }}>
            <X size={22} />
          </button>
        </header>

        <div className="overflow-y-auto px-4 py-4 space-y-4 flex-1">{children}</div>

        {footer ? (
          <footer
            className="px-4 py-3 border-t shrink-0"
            style={{
              borderColor: 'var(--border)',
              paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))',
            }}
          >
            {footer}
          </footer>
        ) : null}
      </div>
    </div>
  )
}

export function Confirm({
  open,
  title,
  body,
  confirmLabel,
  onConfirm,
  onCancel,
  danger,
}: {
  open: boolean
  title: string
  body: string
  confirmLabel: string
  onConfirm: () => void
  onCancel: () => void
  danger?: boolean
}) {
  const { t } = useI18n()
  return (
    <Sheet open={open} onClose={onCancel} title={title}>
      <p className="text-sm" style={{ color: 'var(--text-soft)' }}>
        {body}
      </p>
      <div className="flex gap-2.5 pt-1">
        <Button variant="ghost" onClick={onCancel} full>
          {t('common.cancel')}
        </Button>
        <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm} full>
          {confirmLabel}
        </Button>
      </div>
    </Sheet>
  )
}

/* ------------------------------------------------------------------ */

export function SectionHeader({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 mb-2">
      <h2 className="text-sm font-semibold" style={{ color: 'var(--text-soft)' }}>
        {children}
      </h2>
      {action}
    </div>
  )
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="card p-6 text-center text-sm" style={{ color: 'var(--text-faint)' }}>
      {children}
    </div>
  )
}

export function ListRow({
  title,
  subtitle,
  right,
  onClick,
  muted,
  leading,
}: {
  title: string
  subtitle?: ReactNode
  right?: ReactNode
  onClick?: () => void
  muted?: boolean
  leading?: ReactNode
}) {
  const inner = (
    <>
      {leading}
      <span className="flex-1 min-w-0 text-left">
        <span className="block font-medium truncate" style={{ opacity: muted ? 0.5 : 1 }}>
          {title}
        </span>
        {subtitle ? (
          <span className="block text-xs truncate" style={{ color: 'var(--text-faint)' }}>
            {subtitle}
          </span>
        ) : null}
      </span>
      {right}
    </>
  )

  const className = 'w-full flex items-center gap-3 px-4 py-3'
  if (!onClick) return <div className={className}>{inner}</div>
  return (
    <button className={className} onClick={onClick}>
      {inner}
    </button>
  )
}

export function Card({ children }: { children: ReactNode }) {
  return (
    <div className="card divide-y overflow-hidden" style={{ borderColor: 'var(--border)' }}>
      {children}
    </div>
  )
}
