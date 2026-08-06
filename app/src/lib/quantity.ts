/**
 * Quantities are integer thousandths of a unit ("milli-units").
 *
 * Same reasoning as money: 12.5 kg, 2.75 quintal and half a bottle of honey all
 * have to survive a round trip and add up exactly. Three decimal places is
 * enough for anything sold off a farm and keeps every total in integer maths.
 */

export const MILLI = 1000

/** Parse "12.5", "12,5 kg", "1,250" into integer milli-units. */
export function parseQuantityToMilli(input: string | number): number | null {
  if (typeof input === 'number') {
    if (!Number.isFinite(input)) return null
    return Math.round(input * MILLI)
  }
  const cleaned = String(input).replace(/[\s,]/g, '').trim()
  if (cleaned === '' || cleaned === '.') return null
  if (!/^\d*\.?\d{0,3}$/.test(cleaned)) return null
  const n = Number(cleaned)
  if (!Number.isFinite(n)) return null
  return Math.round(n * MILLI)
}

/**
 * Trailing zeroes are dropped: 12000 -> "12", 12500 -> "12.5".
 * A farmer reading "12.000 kg" has to stop and check they are not looking at
 * twelve thousand.
 */
export function formatQuantity(milli: number): string {
  const neg = milli < 0
  const abs = Math.abs(Math.round(milli))
  const whole = Math.floor(abs / MILLI)
  const frac = abs % MILLI
  let out = String(whole)
  if (frac) out += '.' + String(frac).padStart(3, '0').replace(/0+$/, '')
  return (neg ? '-' : '') + out
}

/**
 * quantity x rate, both integers, result in paise.
 *
 * rate_paise is the price of ONE unit, so the product carries an extra factor
 * of MILLI that has to come back out. Rounding happens once, here, rather than
 * at each call site where it would land differently every time.
 */
export function lineTotalPaise(quantityMilli: number, ratePaise: number): number {
  return Math.round((quantityMilli * ratePaise) / MILLI)
}

/**
 * The inverse, for "what rate did I actually get?" on a total the trader
 * rounded. Returns null rather than Infinity when there is no quantity.
 */
export function impliedRatePaise(quantityMilli: number, totalPaise: number): number | null {
  if (quantityMilli === 0) return null
  return Math.round((totalPaise * MILLI) / quantityMilli)
}
