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
  axisFormat,
  height = 300,
}: {
  categories: string[]
  series: BarSeries[]
  axisFormat: (v: number) => string
  height?: number
}): string {
  if (!categories.length || !series.length) return ''

  const padL = 92
  const padR = 14
  const padT = 16
  const padB = series.length > 1 ? 62 : 44

  const plotW = W - padL - padR
  const plotH = height - padT - padB

  const peak = Math.max(0, ...series.flatMap((s) => s.values))
  const max = niceMax(peak)

  const bandW = plotW / categories.length
  // A gap either side of each group, then the bars packed inside it.
  const groupW = bandW * 0.66
  const barW = Math.max(3, groupW / series.length)

  const gridLines = [0, 0.25, 0.5, 0.75, 1]
    .map((f) => {
      const gy = padT + plotH - f * plotH
      return `<line x1="${padL}" y1="${gy}" x2="${W - padR}" y2="${gy}" class="grid"/>
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
          return `<rect x="${(groupX + j * barW).toFixed(1)}" y="${(padT + plotH - drawn).toFixed(1)}"
            width="${(barW - 2).toFixed(1)}" height="${drawn.toFixed(1)}" rx="2" fill="${s.color}"/>`
        })
        .join('')
    })
    .join('')

  const labels = categories
    .map((c, i) => {
      const cx = padL + i * bandW + bandW / 2
      return `<text x="${cx.toFixed(1)}" y="${padT + plotH + 22}" class="axis" text-anchor="middle">${escapeHtml(
        c,
      )}</text>`
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
  const cy = height / 2
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

  const centre = centreValue
    ? `<text x="${cx}" y="${cy - 2}" class="donut-value" text-anchor="middle">${escapeHtml(
        centreValue,
      )}</text>
       ${centreLabel ? `<text x="${cx}" y="${cy + 18}" class="axis" text-anchor="middle">${escapeHtml(centreLabel)}</text>` : ''}`
    : ''

  // The key sits to the right as a list, because slice labels on a donut this
  // size collide the moment two crops are close in value.
  const keyX = 340
  const rowH = 26
  const keyTop = cy - (positive.length * rowH) / 2 + rowH / 2
  const key = positive
    .map((s, i) => {
      const y = keyTop + i * rowH
      const pct = Math.round((s.value / total) * 100)
      return `<rect x="${keyX}" y="${y - 10}" width="12" height="12" rx="3" fill="${s.color}"/>
        <text x="${keyX + 20}" y="${y}" class="key">${escapeHtml(s.label)}</text>
        <text x="${W - 14}" y="${y}" class="key num" text-anchor="end">${pct}%</text>`
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
