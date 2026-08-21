import { Banknote, Landmark, Smartphone } from 'lucide-react'
import type { AccountKind } from '@/db/types'

/**
 * How an account looks, authored once.
 *
 * Cash, the bank and UPI were three rows carrying the same grey wallet, which
 * made the balances on the home screen a list to READ rather than a thing to
 * recognise. A farmer glancing at their phone to see whether there is money in
 * hand should not have to read a Kannada word to find the right row.
 *
 * The colours are the ones already in the palette rather than three new ones:
 * cash is the earth yellow that means "held, physical" elsewhere in the app,
 * the bank is the ledger green, and UPI is the transfer blue that already
 * marks money moving between them. Nothing new to learn.
 *
 * Kept next to the mark rather than inside a screen because these appear in
 * four places — the home balances, the accounts list in Settings, the entry
 * form and the reports — and three of them drifting apart is how an app stops
 * looking like one app.
 */

const ACCOUNT_ICON = { cash: Banknote, bank: Landmark, upi: Smartphone }

const ACCOUNT_TONE: Record<AccountKind, { ink: string; wash: string }> = {
  cash: { ink: 'var(--color-earth-700)', wash: 'var(--color-earth-100)' },
  bank: { ink: 'var(--color-income)', wash: 'var(--color-income-soft)' },
  upi: { ink: 'var(--color-transfer)', wash: 'var(--color-transfer-soft)' },
}

/** The rounded tile an account wears wherever it is listed. */
export function AccountAvatar({ kind, size = 38 }: { kind: AccountKind; size?: number }) {
  const Icon = ACCOUNT_ICON[kind] ?? Banknote
  const tone = ACCOUNT_TONE[kind] ?? ACCOUNT_TONE.cash
  return (
    <span
      className="grid place-items-center rounded-xl shrink-0"
      style={{ width: size, height: size, background: tone.wash, color: tone.ink }}
    >
      <Icon size={Math.round(size * 0.5)} strokeWidth={2} />
    </span>
  )
}
