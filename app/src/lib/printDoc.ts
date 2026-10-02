import kannadaRegular from '@fontsource/noto-sans-kannada/files/noto-sans-kannada-kannada-400-normal.woff2?url'
import kannadaSemiBold from '@fontsource/noto-sans-kannada/files/noto-sans-kannada-kannada-600-normal.woff2?url'

/**
 * Turning a rendered report into a standalone printable document.
 *
 * Two rules govern this file, and both were expensive lessons in the project
 * this one borrows its print pipeline from:
 *
 * 1. PAGE BREAKS BELONG TO THE PRINT ENGINE. They come from `@page` and
 *    `break-inside: avoid`, never from JavaScript measuring the DOM. The old
 *    approach measured the document in JS, chose break positions, then sliced a
 *    separately-rasterised image at those positions — two independent
 *    measurements of one document had to agree to the pixel on every device,
 *    and when they did not, a line came out through the middle of a table row.
 *
 * 2. THE FONT IS EMBEDDED. Android hands the HTML to a fresh WebView that has
 *    none of the app's bundled assets, so a document referencing the Kannada
 *    font by URL renders every crop name as empty boxes. It is inlined as
 *    base64 — about 28 KB a weight, which is nothing next to a report nobody
 *    can read.
 */

let fontCache: string | null = null

async function toBase64(url: string): Promise<string> {
  const res = await fetch(url)
  const buf = new Uint8Array(await res.arrayBuffer())
  let binary = ''
  // Chunked because String.fromCharCode(...bigArray) overflows the stack.
  for (let i = 0; i < buf.length; i += 8192) {
    binary += String.fromCharCode(...buf.subarray(i, i + 8192))
  }
  return btoa(binary)
}

/**
 * The @font-face block with both weights inlined.
 *
 * Deliberately best-effort: if the font cannot be read the document still
 * prints, falling back to whatever the device has. A slightly worse document
 * beats no document.
 */
async function fontFaces(): Promise<string> {
  if (fontCache !== null) return fontCache
  try {
    const [regular, semibold] = await Promise.all([
      toBase64(kannadaRegular),
      toBase64(kannadaSemiBold),
    ])
    fontCache = `
      @font-face{font-family:'Noto Sans Kannada';font-weight:400;font-display:block;
        src:url(data:font/woff2;base64,${regular}) format('woff2');}
      @font-face{font-family:'Noto Sans Kannada';font-weight:600;font-display:block;
        src:url(data:font/woff2;base64,${semibold}) format('woff2');}
    `
  } catch {
    fontCache = ''
  }
  return fontCache
}

/**
 * The document stylesheet.
 *
 * Self-contained rather than an extract of the app's Tailwind build: a report
 * has to survive being handed to a print engine with no cascade from the app,
 * and chasing which utility classes ended up in the output is exactly the kind
 * of coupling that breaks silently.
 *
 * No `letter-spacing` anywhere. If the rasteriser fallback is ever used,
 * html2canvas positions text grapheme by grapheme whenever tracking is set,
 * which takes Kannada apart.
 */
const STYLES = `
  @page {
    size: A4;
    margin: 12mm 11mm 14mm;
  }

  * { box-sizing: border-box; }

  body {
    margin: 0;
    font-family: 'Noto Sans Kannada', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
    font-size: 10pt;
    line-height: 1.45;
    color: #1a1411;
    background: #fff;
    /* Without these the browser drops every background when printing, and a
       statement whose header bands have vanished looks unfinished. */
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .doc { max-width: 188mm; margin: 0 auto; }

  /*
   * ON SCREEN, THE SAME DOCUMENT IS A SHEET OF PAPER.
   *
   * The preview and the PDF are one string, so the farmer approves exactly
   * what gets sent. That only works if the preview is the page rather than the
   * markup: @page margins do not exist on screen, so without this the document
   * rendered edge to edge with no letterhead spacing and every table full
   * width — which is what made the preview look broken while the PDF was fine.
   *
   * Sized in millimetres, not pixels, so it is genuinely A4. The screen shows
   * it small; ReportsScreen scales the whole page down to the phone's width
   * rather than reflowing it, because a preview that reflows is not a preview.
   */
  @media screen {
    html { background: #ded5c8; }
    body { padding: 0; }
    .doc {
      width: 210mm;
      max-width: 210mm;
      min-height: 297mm;
      margin: 5mm auto;
      padding: 12mm 11mm 14mm;
      background: #fff;
      box-shadow: 0 1px 10px rgba(26, 20, 17, 0.22);
    }
  }

  /* ---------------------------------------------------------- letterhead -
   *
   * A statement, not a printout: the mark and the farm's name on a light
   * panel, its details under them, then space, then an ornament, then space,
   * then the title. The shape of a letter from an office that keeps books,
   * because that is what this gets handed over as.
   *
   * IT USED TO BE A SOLID GREEN BAND. Reversed white out of #12502c across
   * the full width, it was the loudest thing on a page of figures and it made
   * every report look like the same template rather than the farm's own
   * paper. It is now a pale panel with ONE green edge, which leaves the green
   * to mean something where it is used — the totals rule, the section marks.
   *
   * The spacing is deliberate and generous. Head, rule, title and body ran
   * into each other before, and a letterhead that touches its own title reads
   * as a mistake rather than a design.
   */

  .lh {
    position: relative;
    display: flex;
    align-items: center;
    gap: 13px;
    padding: 11px 14px;
    background: linear-gradient(100deg, #f4f8f3 0%, #fdfbf7 58%, #fffefc 100%);
    border: 0.75px solid #dfe3d8;
    border-left: 3.5px solid #12502c;
    border-radius: 5px;
    overflow: hidden;
    margin-bottom: 15px;
  }
  .lh-logo { width: 42px; height: 42px; flex: none; position: relative; }
  .lh-main { flex: 1; min-width: 0; position: relative; }
  .lh-farm {
    font-size: 16pt;
    font-weight: 600;
    line-height: 1.15;
    color: #12502c;
    letter-spacing: 0; /* never set tracking: it takes Kannada apart */
  }
  .lh-owner { font-size: 9.5pt; margin-top: 1px; color: #4a4238; }
  .lh-contact { font-size: 8.5pt; color: #8b7f71; margin-top: 2px; }
  .lh-right {
    position: relative;
    text-align: right;
    font-size: 8pt;
    color: #6f7f72;
    line-height: 1.45;
    flex: none;
    padding-left: 12px;
    border-left: 0.75px solid #dfe3d8;
  }

  /* The artwork. Two leaves and a pair of furrows, at the opacity of a
     watermark — enough that the paper looks like somebody designed it, not so
     much that a figure printed over it becomes hard to read. */
  .lh-art {
    position: absolute;
    top: 0;
    right: 0;
    height: 100%;
    width: 190px;
    pointer-events: none;
  }

  /* The one repeated piece of decoration. Inline SVG, because a border-image
     is the first thing a print engine drops. It is the DESIGN LINE between
     the letterhead and the title, so it is given room on both sides. */
  .orn { display: block; width: 100%; height: 15px; margin: 0 0 11px; }

  .title-block { text-align: center; margin-bottom: 20px; }
  h1.title {
    font-size: 13.5pt;
    margin: 0;
    color: #12502c;
    text-transform: uppercase; /* a no-op on Kannada, which is the point */
    font-weight: 600;
  }
  .subject { font-size: 10.5pt; font-weight: 600; margin-top: 2px; }

  /*
   * WHO THE STATEMENT IS ABOUT.
   *
   * On a worker's statement the name was the same size as the period beneath
   * it, so the document read as a report that happened to mention somebody
   * rather than as that person's own record. It is the thing they look for
   * first when it is handed to them, and the thing a second worker checks to
   * be sure it is not theirs.
   */
  .who { margin-top: 6px; }
  .who-name {
    display: block;
    font-size: 17pt;
    font-weight: 600;
    line-height: 1.2;
    color: #1a1411;
    letter-spacing: 0; /* never set tracking: it takes Kannada apart */
  }
  .who-meta { display: block; font-size: 9pt; color: #6b6157; margin-top: 2px; }
  .period { font-size: 9pt; color: #6b6157; margin-top: 2px; }

  /* ------------------------------------------------------------- tables - */

  table { width: 100%; border-collapse: collapse; margin-bottom: 14px; }
  th, td { padding: 5.5px 8px; text-align: left; vertical-align: top; }

  /*
   * Ruled, not filled. A block of dark green behind every header made the
   * page look like a dashboard screenshot; a statement is carried by its
   * alignment and its rules, and it also survives a low toner cartridge.
   */
  thead th {
    background: #f6f1e9;
    color: #3a3229;
    font-size: 8.5pt;
    font-weight: 600;
    border-bottom: 1.2px solid #12502c;
    text-transform: uppercase;
  }

  /*
   * BANDED, NOT RULED. Every row used to carry its own hairline, so a work
   * table of sixteen days was sixteen lines stacked down the page and the
   * document read as ruled paper rather than as a statement. Alternate rows
   * are tinted instead: the eye tracks across a row just as well, and the
   * page loses fifteen lines per table.
   */
  tbody td { font-size: 9.5pt; }
  tbody tr:nth-child(even) td { background: #faf7f1; }
  tbody tr.group td {
    background: #faf6ef;
    font-weight: 600;
    font-size: 8.5pt;
    text-transform: uppercase;
    color: #6b6157;
    border-bottom: 0.75px solid #ddd0bd;
  }
  /* An indented continuation line — the detail under a head. */
  tbody td.indent { padding-left: 22px; color: #6b6157; font-size: 9pt; }

  tfoot td {
    border-top: 1.2px solid #12502c;
    border-bottom: 2.5px double #12502c;
    font-weight: 600;
    font-size: 10pt;
  }

  .num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .muted { color: #8b7f71; font-size: 8.5pt; }
  .pos { color: #04796b; font-weight: 600; }
  .neg { color: #c62828; font-weight: 600; }
  .strong { font-weight: 600; }

  /* Nothing may be split across a page boundary. Page breaks belong to the
     print engine; this is how it is told what must stay together. */
  tr, .block, .card, .chart-block { break-inside: avoid; page-break-inside: avoid; }
  thead { display: table-header-group; }
  tfoot { display: table-footer-group; }
  .page-break { break-before: page; page-break-before: always; }

  /* A green tick to the left rather than a rule underneath. The rule ran the
     full width of the page for every section, which was most of the lines in
     the document and none of the meaning. */
  h2.section {
    font-size: 9.5pt;
    margin: 18px 0 7px;
    padding: 1px 0 1px 9px;
    color: #12502c;
    font-weight: 600;
    text-transform: uppercase;
    border-left: 3px solid #12502c;
    break-after: avoid;
    page-break-after: avoid;
  }
  h2.section:first-child { margin-top: 0; }

  /* ------------------------------------------------------- summary tiles -
   *
   * A fixed four-across grid rather than a flex row that reflows: eight tiles
   * settling into 3+3+2 on one device and 4+4 on another means two farmers
   * comparing the same report see different documents.
   */

  .totals {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 7px;
    margin-bottom: 14px;
  }
  .totals > div {
    border: 0.75px solid #e4dacb;
    border-radius: 4px;
    padding: 7px 9px;
    background: #fffdfa;
  }
  .totals .k {
    font-size: 7.5pt;
    color: #8b7f71;
    margin-bottom: 1px;
    text-transform: uppercase;
    font-weight: 600;
  }
  .totals .v { font-size: 13pt; font-weight: 600; font-variant-numeric: tabular-nums; }
  .totals .sub { font-size: 7.5pt; color: #8b7f71; margin-top: 1px; }
  .totals > div.is-income {
    border-left: 2.5px solid #04796b;
    background: #f1f8f6;
    border-color: #cfe4de;
    border-left-color: #04796b;
  }
  .totals > div.is-expense {
    border-left: 2.5px solid #c62828;
    background: #fdf4f3;
    border-color: #f0d5d3;
    border-left-color: #c62828;
  }
  .totals > div.is-neutral { border-left: 2.5px solid #8b7f71; }
  .totals > div.is-brand {
    border-left: 2.5px solid #12502c;
    background: #f4f8f3;
    border-color: #d9e3d6;
    border-left-color: #12502c;
  }

  /* ------------------------------------------------------------- charts -
   *
   * Real SVG with real text, so Kannada is shaped by the browser and the
   * labels stay selectable in the PDF. See features/reports/charts.ts.
   */

  /*
   * Type sizes here are in the chart's own 1000-unit viewBox, NOT points. The
   * charts are drawn 1000 wide and scaled to the 188mm text column, which is
   * about 710 CSS px — a factor of roughly 0.71. So 15 units lands near 8pt
   * and 17 units near 9pt, which is what keeps a chart label smaller than the
   * body text beside it instead of shouting over it.
   */
  .chart-block { margin-bottom: 14px; }
  svg.chart { width: 100%; height: auto; display: block; }
  svg.chart .grid { stroke: #ece4d8; stroke-width: 1; }
  svg.chart .axis-line { stroke: #cbbfa9; stroke-width: 1.5; }
  svg.chart text { font-family: inherit; }
  svg.chart .axis { font-size: 15px; fill: #8b7f71; }
  svg.chart .axis.sub { font-size: 13px; fill: #a2968a; }
  /* The figure printed over a bar has to hold its own against the colour
     beneath it, so it is darker and heavier than an axis tick. */
  svg.chart .bar-value { font-size: 15px; fill: #4a4238; font-weight: 600;
    font-variant-numeric: tabular-nums; }
  svg.chart .key { font-size: 17px; fill: #3a3229; }
  svg.chart .key.num { font-variant-numeric: tabular-nums; }
  svg.chart .donut-value { font-size: 26px; font-weight: 600; fill: #1a1411; }

  /* The worked-days calendar. Sizes are viewBox units, like every other chart
     here — roughly x0.71 to reach page points. */
  svg.chart .cal-month { font-size: 19px; font-weight: 600; fill: #12502c; }
  svg.chart .cal-dow { font-size: 14px; fill: #a2968a; }
  svg.chart .cal-day { font-size: 14px; font-variant-numeric: tabular-nums; }

  /* Two charts side by side, where both are small enough to read. */
  .chart-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }

  /* ----------------------------------------------------------- callouts - */

  .note {
    font-size: 8.5pt;
    color: #7a5a12;
    border-left: 2.5px solid #f2cc86;
    padding: 6px 10px;
    background: #fdf6e9;
    margin-bottom: 12px;
    border-radius: 0 3px 3px 0;
  }

  /* -------------------------------------------------------- bar in-table - */

  /* A proportion bar inside a cell reads faster than a percentage, and costs
     no image — which matters when the document has to survive being printed
     by whatever engine the phone has. */
  .bar { height: 5px; background: #f0e9de; border-radius: 3px; overflow: hidden; min-width: 20mm; }
  .bar > span { display: block; height: 100%; background: #04796b; }
  .bar.is-expense > span { background: #c62828; }
  .bar.is-brand > span { background: #12502c; }

  /* -------------------------------------------------------- money trail -
   *
   * What a worker actually wants to see: every rupee they took, on the left
   * in red, and every rupee they gave back, on the right in green, each with
   * its date. It used to be one column with a minus sign in front of the
   * returns, which is correct bookkeeping and completely unreadable across a
   * yard gate — the two things that must not be confused looked identical.
   *
   * Two fixed columns, never a reflowing row: if the sides swapped on a
   * narrower device, red-is-taken would stop being true.
   */
  .trail {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 11px;
    margin-bottom: 12px;
    break-inside: avoid;
    page-break-inside: avoid;
  }
  .trail-col {
    border: 0.75px solid #e4dacb;
    border-radius: 5px;
    overflow: hidden;
    background: #fffdfa;
  }
  .trail-col.is-out { border-color: #f0d5d3; }
  .trail-col.is-in { border-color: #cfe4de; }
  .trail-head {
    font-size: 8pt;
    font-weight: 600;
    text-transform: uppercase;
    padding: 5px 9px;
    color: #fff;
    display: flex;
    justify-content: space-between;
    gap: 8px;
  }
  .is-out .trail-head { background: #c62828; }
  .is-in .trail-head { background: #04796b; }
  .trail-row {
    display: flex;
    align-items: baseline;
    gap: 7px;
    padding: 4.5px 9px;
  }
  .trail-row:nth-child(odd) { background: #faf7f1; }
  .trail-row .d { font-size: 8pt; color: #8b7f71; white-space: nowrap; }
  .trail-row .t { flex: 1; min-width: 0; font-size: 9pt; }
  .trail-row .a {
    font-variant-numeric: tabular-nums;
    font-weight: 600;
    font-size: 9.5pt;
    white-space: nowrap;
  }
  .is-out .trail-row .a { color: #c62828; }
  .is-in .trail-row .a { color: #04796b; }
  .trail-none { padding: 12px 9px; text-align: center; font-size: 8.5pt; color: #a2968a; }
  .trail-sum {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    padding: 5.5px 9px;
    font-size: 9.5pt;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    border-top: 1px solid #e4dacb;
    background: #fdfbf7;
  }
  .trail-net {
    display: flex;
    justify-content: space-between;
    gap: 10px;
    padding: 7px 12px;
    margin-bottom: 14px;
    border-radius: 4px;
    background: #f6f1e9;
    border: 0.75px solid #e4dacb;
    font-weight: 600;
    font-size: 10pt;
    font-variant-numeric: tabular-nums;
    break-inside: avoid;
  }

  /* -------------------------------------------------------------- close - */

  /* The close. No signature rule: nobody signs a printout from a phone, and
     an empty line at the bottom made every report look unfinished. */
  .close { margin-top: 16px; break-inside: avoid; }
  .close-made {
    text-align: center;
    font-size: 8pt;
    color: #8b7f71;
    margin-top: 2px;
  }

  .foot {
    margin-top: 8px;
    font-size: 7.5pt;
    color: #a2968a;
    display: flex;
    justify-content: space-between;
    gap: 12px;
  }
  .foot span:nth-child(2) { text-align: center; flex: 1; }
  .foot span:last-child { text-align: right; }
`

/** Wrap rendered report markup into a complete, self-contained document. */
export async function buildPrintDocument(bodyHtml: string, title: string): Promise<string> {
  const faces = await fontFaces()
  return `<!doctype html>
<html lang="kn-IN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>${faces}${STYLES}</style>
</head>
<body><div class="doc">${bodyHtml}</div></body>
</html>`
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
