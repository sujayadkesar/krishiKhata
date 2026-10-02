import { escapeHtml } from '@/lib/printDoc'

/**
 * Charts for printed documents, drawn as static SVG.
 *
 * Recharts cannot be used here and neither can any other chart library: the
 * document is handed to a print engine as inert HTML, with no JavaScript, no
 * canvas and no React. Rasterising a chart to an image instead would be worse
 * — html2canvas positions text grapheme by grapheme, which takes Kannada crop
 * names apart, and that is the whole reason this pipeline prints HTML rather
 * than drawing a PDF.
 *
 * So: real SVG, real <text>, shaped by the browser, selectable in the PDF and
 * sharp at any zoom. Everything is authored in a fixed viewBox and scaled to
 * the page with width:100%.
 */

export interface BarSeries {
  label: string
  color: string
  values: number[]
}

/** Round an axis maximum up to something a person would choose. */
function niceMax(value: number): number {
  if (value <= 0) return 1
  const magnitude = 10 ** Math.floor(Math.log10(value))
  const scaled = value / magnitude
  const step = scaled <= 1 ? 1 : scaled <= 2 ? 2 : scaled <= 2.5 ? 2.5 : scaled <= 5 ? 5 : 10
  return step * magnitude
}

const W = 1000

/**
 * Grouped vertical bars — income against expense, month by month.
 *
 * The one chart a farmer reads first, because the shape of a year says more
 * than the totals do: two tall orange bars in June is a story, ₹73,200 is not.
 */
export function groupedBars({
  categories,
  series,
  subLabels,
  axisFormat,
  height = 300,
}: {
  categories: string[]
  series: BarSeries[]
  /**
   * A second line under each category — days worked, hours run.
   *
   * Money alone does not answer "was that a lot of work or a high rate",
   * which is the question behind every month a farmer looks twice at. The
   * count belongs on the same chart as the money, not in a table below it.
   */
  subLabels?: string[]
  axisFormat: (v: number) => string
  height?: number
}): string {
  if (!categories.length || !series.length) return ''

  const padL = 92
  const padR = 14
  const padT = 30
  const padB = (series.length > 1 ? 62 : 44) + (subLabels ? 16 : 0)

  const plotW = W - padL - padR
  const plotH = height - padT - padB

  const peak = Math.max(0, ...series.flatMap((s) => s.values))
  const max = niceMax(peak)

  const bandW = plotW / categories.length
  // A gap either side of each group, then the bars packed inside it.
  const groupW = bandW * 0.72
  const barW = Math.max(3, groupW / series.length)

  /*
   * THREE GRIDLINES, NOT FIVE.
   *
   * Five ruled lines behind six pairs of bars is more line than chart — the
   * grid was competing with the data it was supposed to measure. Bottom,
   * middle and top is enough to judge a height against, and the middle one is
   * dashed so it reads as a guide rather than as part of the drawing.
   */
  const gridLines = [0, 0.5, 1]
    .map((f) => {
      const gy = padT + plotH - f * plotH
      const dash = f === 0.5 ? ' stroke-dasharray="5 6"' : ''
      return `<line x1="${padL}" y1="${gy}" x2="${W - padR}" y2="${gy}" class="grid"${dash}/>
        <text x="${padL - 10}" y="${gy + 5}" class="axis" text-anchor="end">${escapeHtml(
          axisFormat(max * f),
        )}</text>`
    })
    .join('')

  const bars = categories
    .map((_, i) => {
      const groupX = padL + i * bandW + (bandW - groupW) / 2
      return series
        .map((s, j) => {
          const v = Math.max(0, s.values[i] ?? 0)
          const h = (v / max) * plotH
          // Zero-height rects vanish; a hairline says "recorded, but nothing".
          const drawn = v > 0 ? Math.max(h, 1.5) : 0
          if (drawn === 0) return ''
          const x = groupX + j * barW
          const y = padT + plotH - drawn
          /* The figure above the bar, when there are few enough bars for it to
             fit. It is what turns the chart from a shape into a reading: a
             farmer can then take the number off it without going back to the
             table underneath. */
          const label =
            categories.length <= 7
              ? `<text x="${(x + (barW - 2) / 2).toFixed(1)}" y="${(y - 7).toFixed(1)}"
                  class="axis bar-value" text-anchor="middle">${escapeHtml(axisFormat(v))}</text>`
              : ''
          return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}"
            width="${(barW - 2).toFixed(1)}" height="${drawn.toFixed(1)}" rx="3" fill="${s.color}"/>${label}`
        })
        .join('')
    })
    .join('')

  const labels = categories
    .map((c, i) => {
      const cx = padL + i * bandW + bandW / 2
      const sub = subLabels?.[i]
      return `<text x="${cx.toFixed(1)}" y="${padT + plotH + 22}" class="axis" text-anchor="middle">${escapeHtml(
        c,
      )}</text>${
        sub
          ? `<text x="${cx.toFixed(1)}" y="${padT + plotH + 38}" class="axis sub" text-anchor="middle">${escapeHtml(sub)}</text>`
          : ''
      }`
    })
    .join('')

  return `<svg class="chart" viewBox="0 0 ${W} ${height}" role="img" xmlns="http://www.w3.org/2000/svg">
    ${gridLines}
    <line x1="${padL}" y1="${padT + plotH}" x2="${W - padR}" y2="${padT + plotH}" class="axis-line"/>
    ${bars}
    ${labels}
    ${series.length > 1 ? legend(series, height - 14) : ''}
  </svg>`
}

function legend(series: { label: string; color: string }[], y: number): string {
  // Laid out from the centre so the row stays balanced whatever the labels are.
  const itemW = 190
  const totalW = series.length * itemW
  const startX = (W - totalW) / 2
  return series
    .map((s, i) => {
      const x = startX + i * itemW
      return `<rect x="${x}" y="${y - 10}" width="12" height="12" rx="3" fill="${s.color}"/>
        <text x="${x + 19}" y="${y}" class="key">${escapeHtml(s.label)}</text>`
    })
    .join('')
}

/**
 * A donut — where the income came from, or where the spending went.
 *
 * Drawn with stroke-dasharray on one circle per slice rather than arc paths:
 * arcs need a large-arc flag that flips at 180°, and getting that wrong turns
 * a 60% slice inside out. Dash offsets cannot.
 */
export function donut({
  slices,
  centreLabel,
  centreValue,
  height = 300,
}: {
  slices: { label: string; value: number; color: string }[]
  centreLabel?: string
  centreValue?: string
  height?: number
}): string {
  const positive = slices.filter((s) => s.value > 0)
  if (!positive.length) return ''

  const total = positive.reduce((s, x) => s + x.value, 0)
  if (total <= 0) return ''

  const cx = 175
  // Lifted when there is a caption, so the caption has clear paper under the
  // ring rather than sitting on its bottom edge.
  const cy = height / 2 - (centreLabel ? 12 : 0)
  const r = Math.min(105, cy - 18)
  const circumference = 2 * Math.PI * r
  const stroke = 42

  let offset = 0
  const rings = positive
    .map((s) => {
      const fraction = s.value / total
      const dash = fraction * circumference
      // -90deg so the first slice starts at twelve o'clock, where a reader
      // expects it, rather than at three.
      const ring = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${s.color}"
        stroke-width="${stroke}" stroke-dasharray="${dash.toFixed(2)} ${(circumference - dash).toFixed(2)}"
        stroke-dashoffset="${(-offset).toFixed(2)}" transform="rotate(-90 ${cx} ${cy})"/>`
      offset += dash
      return ring
    })
    .join('')

  /*
   * The figure goes in the hole; the words go UNDER the ring.
   *
   * Both used to sit in the middle, and the hole is 168 units across while
   * "ಒಟ್ಟು ಗಳಿಕೆ · Total earned" is half as wide again — so the caption ran
   * out through the doughnut on both sides and printed over the slices. The
   * number is short enough to fit anywhere; the label is not, and below the
   * ring it has the whole width.
   */
  const centre = centreValue
    ? `<text x="${cx}" y="${cy + 9}" class="donut-value" text-anchor="middle">${escapeHtml(
        centreValue,
      )}</text>
       ${centreLabel ? `<text x="${cx}" y="${(cy + r + stroke / 2 + 20).toFixed(1)}" class="axis" text-anchor="middle">${escapeHtml(centreLabel)}</text>` : ''}`
    : ''

  // The key sits to the right as a list, because slice labels on a donut this
  // size collide the moment two crops are close in value.
  const keyX = 400
  const rowH = 26
  const keyTop = cy - (positive.length * rowH) / 2 + rowH / 2
  const key = positive
    .map((s, i) => {
      const y = keyTop + i * rowH
      const pct = Math.round((s.value / total) * 100)
      return `<rect x="${keyX}" y="${y - 10}" width="12" height="12" rx="3" fill="${s.color}"/>
        <text x="${keyX + 20}" y="${y}" class="key">${escapeHtml(s.label)}</text>
        <text x="860" y="${y}" class="key num" text-anchor="end">${pct}%</text>`
    })
    .join('')

  return `<svg class="chart" viewBox="0 0 ${W} ${height}" role="img" xmlns="http://www.w3.org/2000/svg">
    ${rings}${centre}${key}
  </svg>`
}

/**
 * A ranked horizontal bar list — biggest spend first.
 *
 * Reads faster than a donut once there are more than five or six categories,
 * which "where the money went" always is.
 */
export function rankedBars({
  rows,
  color,
  height,
}: {
  rows: { label: string; value: number; note: string }[]
  color: string
  height?: number
}): string {
  const positive = rows.filter((r) => r.value > 0)
  if (!positive.length) return ''

  const rowH = 30
  const padT = 6
  const h = height ?? padT * 2 + positive.length * rowH
  const labelW = 320
  const valueW = 150
  const barX = labelW + 12
  const barMax = W - barX - valueW - 14

  const peak = Math.max(...positive.map((r) => r.value))

  const bars = positive
    .map((r, i) => {
      const y = padT + i * rowH + rowH / 2
      const w = Math.max(2, (r.value / peak) * barMax)
      return `<text x="0" y="${y + 6}" class="key">${escapeHtml(r.label)}</text>
        <rect x="${barX}" y="${y - 7}" width="${w.toFixed(1)}" height="14" rx="3" fill="${color}"/>
        <text x="${W}" y="${y + 6}" class="key num" text-anchor="end">${escapeHtml(r.note)}</text>`
    })
    .join('')

  return `<svg class="chart" viewBox="0 0 ${W} ${h}" role="img" xmlns="http://www.w3.org/2000/svg">${bars}</svg>`
}

/**
 * The months as calendars, with the days worked filled in.
 *
 * A bar chart says a worker did nineteen days in August. A calendar says they
 * came every day of the first week, nothing in the second, and every Monday
 * after that — which is the thing a farmer and a worker actually argue about,
 * and the thing neither of them can reconstruct from a total. It is also the
 * one piece of this statement that a worker who does not read numbers can
 * check against their own memory of the month.
 *
 * Drawn as squares in the chart's own 1000-unit viewBox, three months a row.
 * Full days are solid, half days are half-toned and carry a mark, and a day
 * nobody worked is a faint outline — so the shape of the month is legible
 * before a single number is read.
 */
export function workCalendar({
  days,
  months,
  weekdayInitials,
  monthLabel,
}: {
  /** Date to fraction, in milli-units. Only days worked need be present. */
  days: Map<string, number>
  /** "2026-08" strings, in order, each drawn as its own block. */
  months: string[]
  /** Seven single letters, starting Sunday. */
  weekdayInitials: string[]
  monthLabel: (ym: string) => string
}): string {
  if (months.length === 0) return ''

  const perRow = 3
  const gap = 26
  const blockW = (W - gap * (perRow - 1)) / perRow
  const cell = blockW / 7
  // Six week rows always, so a month starting on a Saturday is the same height
  // as one starting on a Monday and the grid below it does not jump.
  const blockH = 26 + 14 + 6 * cell
  const rows = Math.ceil(months.length / perRow)
  const height = rows * blockH + (rows - 1) * 16

  const blocks = months
    .map((ym, i) => {
      const col = i % perRow
      const row = Math.floor(i / perRow)
      const ox = col * (blockW + gap)
      const oy = row * (blockH + 16)

      const [y, m] = ym.split('-').map(Number)
      // Local arithmetic only: `new Date(y, m - 1, 1)` is midnight local, and
      // getDay/getDate never touch UTC. A UTC-built date would shift the first
      // of the month across a weekday boundary for half the world.
      const first = new Date(y, m - 1, 1)
      const startDow = first.getDay()
      const daysInMonth = new Date(y, m, 0).getDate()

      const heads = weekdayInitials
        .map(
          (w, d) =>
            `<text x="${(ox + d * cell + cell / 2).toFixed(1)}" y="${(oy + 38).toFixed(1)}"
               class="cal-dow" text-anchor="middle">${escapeHtml(w)}</text>`,
        )
        .join('')

      const cells: string[] = []
      for (let day = 1; day <= daysInMonth; day += 1) {
        const index = startDow + day - 1
        const cx = ox + (index % 7) * cell
        const cy = oy + 46 + Math.floor(index / 7) * cell
        const iso = `${ym}-${String(day).padStart(2, '0')}`
        const fraction = days.get(iso) ?? 0
        const worked = fraction > 0
        const half = worked && fraction < 1000

        const pad = 2.5
        cells.push(
          `<rect x="${(cx + pad).toFixed(1)}" y="${(cy + pad).toFixed(1)}"
             width="${(cell - pad * 2).toFixed(1)}" height="${(cell - pad * 2).toFixed(1)}"
             rx="3"
             fill="${worked ? (half ? '#cfe4de' : '#04796b') : '#fbf7f0'}"
             stroke="${worked ? 'none' : '#ece4d8'}" stroke-width="1"/>
           <text x="${(cx + cell / 2).toFixed(1)}" y="${(cy + cell / 2 + 5).toFixed(1)}"
             class="cal-day" text-anchor="middle"
             fill="${worked && !half ? '#ffffff' : '#6b6157'}">${day}</text>`,
        )
      }

      return `<text x="${ox.toFixed(1)}" y="${(oy + 16).toFixed(1)}" class="cal-month">${escapeHtml(
        monthLabel(ym),
      )}</text>${heads}${cells.join('')}`
    })
    .join('')

  return `<svg class="chart" viewBox="0 0 ${W} ${height.toFixed(0)}" role="img" xmlns="http://www.w3.org/2000/svg">
    ${blocks}
  </svg>`
}
