/**
 * Money is stored everywhere as an integer number of paise.
 *
 * Never store rupees as a float. 0.1 + 0.2 !== 0.3 in binary floating point,
 * and a ledger that drifts by a paise per row is a ledger nobody can reconcile
 * against the cash box. Every amount in the database is an integer; formatting
 * happens only at the edges.
 *
 * Ported from goshala-ledger, where this module is covered by its own check
 * suite and has been correct in production for a year.
 */

export const PAISE = 100

/** Parse farmer input ("1,250", "1250.50", "₹1,250") into integer paise. */
export function parseAmountToPaise(input: string | number): number | null {
  if (typeof input === 'number') {
    if (!Number.isFinite(input)) return null
    return Math.round(input * PAISE)
  }
  const cleaned = String(input)
    .replace(/[₹\s,]/g, '')
    .trim()
  if (cleaned === '' || cleaned === '.') return null
  if (!/^\d*\.?\d{0,2}$/.test(cleaned)) return null
  const n = Number(cleaned)
  if (!Number.isFinite(n)) return null
  return Math.round(n * PAISE)
}

/** Indian digit grouping: 1234567 -> "12,34,567" (last 3, then pairs). */
export function groupIndian(digits: string): string {
  if (digits.length <= 3) return digits
  const last3 = digits.slice(-3)
  const rest = digits.slice(0, -3)
  return rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + last3
}

/** 123456789 paise -> "12,34,567.89" */
export function formatPaise(paise: number, opts: { decimals?: boolean } = {}): string {
  const showDecimals = opts.decimals ?? true
  const neg = paise < 0
  const abs = Math.abs(Math.round(paise))
  const rupees = Math.floor(abs / PAISE)
  const rem = abs % PAISE
  let out = groupIndian(String(rupees))
  if (showDecimals) out += '.' + String(rem).padStart(2, '0')
  return (neg ? '-' : '') + out
}

/**
 * 123456789 paise -> "₹12,34,567.89"
 *
 * The minus sign goes OUTSIDE the rupee symbol: "-₹500.00", not "₹-500.00".
 * Negative figures are ordinary here — a labourer holding an advance shows a
 * negative balance on their khata — so this is read often enough to matter.
 */
export function formatINR(paise: number, opts: { decimals?: boolean } = {}): string {
  const sign = paise < 0 ? '-' : ''
  return sign + '₹' + formatPaise(Math.abs(paise), opts)
}

/**
 * Whole rupees for screens. Farm amounts are rarely fractional and a dashboard
 * tile reading "₹12,340" is quicker to take in than "₹12,340.00".
 */
export function formatRupees(paise: number): string {
  return formatINR(paise, { decimals: false })
}

/** Compact form for dashboard tiles: ₹1.24 L, ₹78.13 L, ₹1.2 Cr */
export function formatCompactINR(paise: number): string {
  const rupees = Math.round(paise / PAISE)
  const abs = Math.abs(rupees)
  const sign = rupees < 0 ? '-' : ''
  if (abs >= 1e7) return `${sign}₹${(abs / 1e7).toFixed(2)} Cr`
  if (abs >= 1e5) return `${sign}₹${(abs / 1e5).toFixed(2)} L`
  if (abs >= 1e3) return `${sign}₹${groupIndian(String(abs))}`
  return `${sign}₹${abs}`
}

const ONES = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
  'Seventeen', 'Eighteen', 'Nineteen',
]
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']

function twoDigits(n: number): string {
  if (n < 20) return ONES[n]
  const t = Math.floor(n / 10)
  const o = n % 10
  return TENS[t] + (o ? ' ' + ONES[o] : '')
}

function threeDigits(n: number): string {
  const h = Math.floor(n / 100)
  const rest = n % 100
  const parts: string[] = []
  if (h) parts.push(ONES[h] + ' Hundred')
  if (rest) parts.push(twoDigits(rest))
  return parts.join(' ')
}

/**
 * Statements and labour payment vouchers carry the amount in words, because a
 * figure alone can be altered after signing. Indian numbering: crore, lakh,
 * thousand, hundred.
 */
export function rupeesInWords(paise: number): string {
  const abs = Math.abs(Math.round(paise))
  const rupees = Math.floor(abs / PAISE)
  const pais = abs % PAISE

  if (rupees === 0 && pais === 0) return 'Rupees Zero Only'

  const crore = Math.floor(rupees / 1e7)
  const lakh = Math.floor((rupees % 1e7) / 1e5)
  const thousand = Math.floor((rupees % 1e5) / 1e3)
  const hundred = rupees % 1e3

  const parts: string[] = []
  if (crore) parts.push(threeDigits(crore) + ' Crore')
  if (lakh) parts.push(twoDigits(lakh) + ' Lakh')
  if (thousand) parts.push(twoDigits(thousand) + ' Thousand')
  if (hundred) parts.push(threeDigits(hundred))

  let out = 'Rupees ' + parts.join(' ')
  if (pais) out += ' and ' + twoDigits(pais) + ' Paise'
  return out.replace(/\s+/g, ' ').trim() + ' Only'
}
