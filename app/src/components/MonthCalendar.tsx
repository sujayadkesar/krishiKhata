import { useRef } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { calendarGrid, monthName, WEEKDAYS_EN, WEEKDAYS_KN } from '@/lib/date'
import { FULL_DAY, HALF_DAY } from '@/db/types'
import { useI18n } from '@/i18n'
import type { ISODate } from '@/db/types'

/**
 * The month grid used to record which days somebody worked.
 *
 * This exists because farmers do not update the app daily. They come back after
 * a week and remember "Ramesh came Monday, Wednesday, Friday, Saturday" —
 * entering that as four separate forms is enough friction that it does not get
 * entered at all. Tapping four squares takes seconds.
 *
 * A tap cycles full day → half day → clear. Half days are common enough on a
 * farm to deserve a tap rather than a separate control, and the cycle means one
 * gesture covers every state without a mode to remember.
 *
 * The grid is always six rows, so it does not change height between months —
 * a shifting layout makes people mis-tap, and a mis-tap here records a day
 * somebody did not work.
 */

export interface DaySelection {
  fraction: number
  /** Crew size for this specific day; 12 on Monday and 8 on Wednesday is normal. */
  count: number
}

export function MonthCalendar({
  year,
  monthIndex,
  selection,
  onCycle,
  onLongPress,
  alreadyRecorded,
  onMonthChange,
}: {
  year: number
  monthIndex: number
  selection: Map<ISODate, DaySelection>
  onCycle: (date: ISODate) => void
  onLongPress?: (date: ISODate) => void
  /** Dates already saved, so the farmer does not record the same day twice. */
  alreadyRecorded?: Set<ISODate>
  onMonthChange: (year: number, monthIndex: number) => void
}) {
  const { lang } = useI18n()
  const weekdays = lang === 'kn' ? WEEKDAYS_KN : WEEKDAYS_EN
  const cells = calendarGrid(year, monthIndex)

  // Long-press without hijacking the tap: a timer that the tap cancels.
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const longFired = useRef(false)

  const startPress = (date: ISODate) => {
    if (!onLongPress) return
    longFired.current = false
    pressTimer.current = setTimeout(() => {
      longFired.current = true
      onLongPress(date)
    }, 450)
  }

  const endPress = (date: ISODate, enabled: boolean) => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current)
      pressTimer.current = null
    }
    if (longFired.current || !enabled) return
    onCycle(date)
  }

  const step = (delta: number) => {
    const d = new Date(year, monthIndex + delta, 1)
    onMonthChange(d.getFullYear(), d.getMonth())
  }

  return (
    <div className="card p-3 select-none">
      <div className="flex items-center justify-between mb-2">
        <button onClick={() => step(-1)} aria-label="Previous month" className="p-2">
          <ChevronLeft size={20} />
        </button>
        <span className="font-semibold">
          {monthName(monthIndex, lang, true)} {year}
        </span>
        <button onClick={() => step(1)} aria-label="Next month" className="p-2">
          <ChevronRight size={20} />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-1">
        {weekdays.map((w) => (
          <div
            key={w}
            className="text-center text-[11px] font-semibold py-1"
            style={{ color: 'var(--text-faint)' }}
          >
            {w}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((cell) => {
          const sel = selection.get(cell.iso)
          const enabled = cell.inMonth && !cell.isFuture
          const recorded = alreadyRecorded?.has(cell.iso)

          const full = sel?.fraction === FULL_DAY
          const half = sel?.fraction === HALF_DAY

          return (
            <button
              key={cell.iso}
              disabled={!enabled}
              onPointerDown={() => enabled && startPress(cell.iso)}
              onPointerUp={() => endPress(cell.iso, enabled)}
              onPointerLeave={() => {
                if (pressTimer.current) {
                  clearTimeout(pressTimer.current)
                  pressTimer.current = null
                }
              }}
              onContextMenu={(e) => e.preventDefault()}
              className="relative aspect-square rounded-lg flex flex-col items-center justify-center"
              style={{
                minHeight: 42,
                background: full
                  ? 'var(--color-brand-500)'
                  : half
                    ? 'var(--color-brand-100)'
                    : 'transparent',
                color: full
                  ? '#fff'
                  : !enabled
                    ? 'var(--text-faint)'
                    : half
                      ? 'var(--color-brand-700)'
                      : 'var(--text)',
                opacity: cell.inMonth ? (cell.isFuture ? 0.3 : 1) : 0.25,
                border: cell.isToday && !full ? '1.5px solid var(--color-brand-400)' : '1.5px solid transparent',
                fontWeight: full || half ? 700 : 400,
              }}
            >
              <span className="tnum text-sm leading-none">{cell.day}</span>

              {half ? <span className="text-[9px] leading-none mt-0.5">½</span> : null}

              {sel && sel.count > 1 ? (
                <span
                  className="absolute -top-1 -right-1 rounded-full text-[10px] font-bold tnum px-1"
                  style={{ background: 'var(--color-earth-500)', color: '#fff', minWidth: 16 }}
                >
                  {sel.count}
                </span>
              ) : null}

              {recorded && !sel ? (
                <span
                  className="absolute bottom-1 rounded-full"
                  style={{ width: 4, height: 4, background: 'var(--color-earth-500)' }}
                />
              ) : null}
            </button>
          )
        })}
      </div>
    </div>
  )
}
