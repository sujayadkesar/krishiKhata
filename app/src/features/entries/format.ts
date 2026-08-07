import { formatQuantity } from '@/lib/quantity'
import { formatPaise } from '@/lib/money'
import { formatDate as fmtDate } from '@/lib/date'
import type { Lang } from '@/i18n/strings'
import type { EntryRow } from '@/data/entries'

export const formatDate = fmtDate

/**
 * "12.5 kg @ ₹40" — the line a farmer scans to check a sale was priced right.
 *
 * Returns empty when the entry carries no quantity, so expenses and transfers
 * do not show a stray unit.
 */
export function formatQuantityLabel(e: EntryRow, lang: Lang): string {
  if (e.quantity_milli == null) return ''

  const unit = (lang === 'en' ? e.unit_short_en : e.unit_short_kn) ?? ''
  const qty = `${formatQuantity(e.quantity_milli)}${unit ? ' ' + unit : ''}`

  if (e.rate_paise == null) return qty
  // Rates are whole rupees far more often than not; the paise only clutter it.
  const showPaise = e.rate_paise % 100 !== 0
  return `${qty} @ ₹${formatPaise(e.rate_paise, { decimals: showPaise })}`
}
