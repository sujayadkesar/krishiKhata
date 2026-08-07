/**
 * Dates in this app are plain `YYYY-MM-DD` business dates — the day the farmer
 * says a thing happened, not an instant in time.
 *
 * Never build one with `toISOString()`. That converts to UTC first, so any
 * evening entry east of Greenwich comes back as the previous day, and in India
 * that silently moves every entry after 05:30 IST... which is all of them.
 * Everything here works in local time on purpose.
 */

export type ISODate = string // YYYY-MM-DD

const pad = (n: number) => String(n).padStart(2, '0')

/** Local-time `YYYY-MM-DD` for a Date. */
export function toISODate(d: Date): ISODate {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function todayISO(): ISODate {
  return toISODate(new Date())
}

/** Parse `YYYY-MM-DD` into a local Date at midnight. */
export function fromISODate(iso: ISODate): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function isValidISODate(v: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false
  const d = fromISODate(v)
  return toISODate(d) === v
}

export function addDays(iso: ISODate, days: number): ISODate {
  const d = fromISODate(iso)
  d.setDate(d.getDate() + days)
  return toISODate(d)
}

export function addMonths(iso: ISODate, months: number): ISODate {
  const d = fromISODate(iso)
  const day = d.getDate()
  d.setDate(1)
  d.setMonth(d.getMonth() + months)
  // Clamp: 31 Jan + 1 month is 28/29 Feb, not 2/3 March.
  d.setDate(Math.min(day, daysInMonth(d.getFullYear(), d.getMonth())))
  return toISODate(d)
}

export function daysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate()
}

export function daysBetween(a: ISODate, b: ISODate): number {
  const ms = fromISODate(b).getTime() - fromISODate(a).getTime()
  return Math.round(ms / 86_400_000)
}

export function monthStart(iso: ISODate): ISODate {
  const d = fromISODate(iso)
  return toISODate(new Date(d.getFullYear(), d.getMonth(), 1))
}

export function monthEnd(iso: ISODate): ISODate {
  const d = fromISODate(iso)
  return toISODate(new Date(d.getFullYear(), d.getMonth() + 1, 0))
}

/* ------------------------------------------------------------------ *
 * Financial year — India runs 1 April to 31 March.
 * ------------------------------------------------------------------ */

/** The FY a date falls in, identified by its starting calendar year. */
export function financialYearOf(iso: ISODate): number {
  const d = fromISODate(iso)
  return d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1
}

export function financialYearRange(fyStartYear: number): { from: ISODate; to: ISODate } {
  return { from: `${fyStartYear}-04-01`, to: `${fyStartYear + 1}-03-31` }
}

/** "2026-27", the way it is written on every Indian statement. */
export function financialYearLabel(fyStartYear: number): string {
  return `${fyStartYear}-${String((fyStartYear + 1) % 100).padStart(2, '0')}`
}

/* ------------------------------------------------------------------ *
 * Display
 * ------------------------------------------------------------------ */

const MONTHS_EN = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]
const MONTHS_KN = [
  'ಜನವರಿ', 'ಫೆಬ್ರವರಿ', 'ಮಾರ್ಚ್', 'ಏಪ್ರಿಲ್', 'ಮೇ', 'ಜೂನ್',
  'ಜುಲೈ', 'ಆಗಸ್ಟ್', 'ಸೆಪ್ಟೆಂಬರ್', 'ಅಕ್ಟೋಬರ್', 'ನವೆಂಬರ್', 'ಡಿಸೆಂಬರ್',
]
const MONTHS_EN_FULL = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

/** Sunday-first, matching the calendar grid. */
export const WEEKDAYS_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
export const WEEKDAYS_KN = ['ಭಾನು', 'ಸೋಮ', 'ಮಂಗಳ', 'ಬುಧ', 'ಗುರು', 'ಶುಕ್ರ', 'ಶನಿ']

/**
 * Mirrors the i18n language, but a date is never printed twice.
 * "06 ಆಗಸ್ಟ್ 2026 · 06 Aug 2026" helps nobody, so 'both' follows Kannada.
 */
export type Lang = 'kn' | 'en' | 'both'

export function monthName(monthIndex: number, lang: Lang, full = false): string {
  if (lang !== 'en') return MONTHS_KN[monthIndex]
  return full ? MONTHS_EN_FULL[monthIndex] : MONTHS_EN[monthIndex]
}

/** "06 Aug 2026" / "06 ಆಗಸ್ಟ್ 2026" */
export function formatDate(iso: ISODate, lang: Lang = 'kn'): string {
  const d = fromISODate(iso)
  return `${pad(d.getDate())} ${monthName(d.getMonth(), lang)} ${d.getFullYear()}`
}

/** "Aug 2026" / "ಆಗಸ್ಟ್ 2026" */
export function formatMonth(iso: ISODate, lang: Lang = 'kn'): string {
  const d = fromISODate(iso)
  return `${monthName(d.getMonth(), lang)} ${d.getFullYear()}`
}

export function weekdayName(iso: ISODate, lang: Lang = 'kn'): string {
  const i = fromISODate(iso).getDay()
  return lang === 'en' ? WEEKDAYS_EN[i] : WEEKDAYS_KN[i]
}

/* ------------------------------------------------------------------ *
 * Calendar grid — used by the labour attendance screen.
 * ------------------------------------------------------------------ */

export interface CalendarCell {
  iso: ISODate
  day: number
  inMonth: boolean
  isToday: boolean
  isFuture: boolean
}

/**
 * A 6x7 grid of cells covering the given month, padded with the surrounding
 * months so every row is full. Always 42 cells, so the calendar does not change
 * height as the farmer pages through months — a shifting layout makes people
 * mis-tap, and a mis-tap here records a day somebody did not work.
 */
export function calendarGrid(year: number, monthIndex: number): CalendarCell[] {
  const first = new Date(year, monthIndex, 1)
  const start = new Date(year, monthIndex, 1 - first.getDay())
  const today = todayISO()

  const cells: CalendarCell[] = []
  for (let i = 0; i < 42; i++) {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)
    const iso = toISODate(d)
    cells.push({
      iso,
      day: d.getDate(),
      inMonth: d.getMonth() === monthIndex,
      isToday: iso === today,
      isFuture: iso > today,
    })
  }
  return cells
}
