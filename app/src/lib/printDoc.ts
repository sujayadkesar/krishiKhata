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

  /* ---------------------------------------------------------- letterhead -
   *
   * A statement, not a printout. The farm's own name leads at the top of the
   * page with the mark beside it, its details underneath, then a rule, then
   * the document title centred below — the shape of a letter from an office
   * that keeps books, because that is what this is handed over as.
   */

  .lh { display: flex; align-items: center; gap: 14px; }
  .lh-logo { width: 46px; height: 46px; flex: none; }
  .lh-main { flex: 1; min-width: 0; }
  .lh-farm {
    font-size: 17pt;
    font-weight: 600;
    color: #12502c;
    line-height: 1.15;
    letter-spacing: 0; /* never set tracking: it takes Kannada apart */
  }
  .lh-owner { font-size: 10.5pt; font-weight: 600; margin-top: 2px; color: #3a3229; }
  .lh-sub { font-size: 8.5pt; color: #6b6157; font-weight: 400; margin-top: 1px; }
  .lh-right {
    text-align: right;
    font-size: 8.5pt;
    color: #6b6157;
    line-height: 1.5;
    flex: none;
  }

  .rule { border: 0; border-top: 2px solid #12502c; margin: 9px 0 0; }
  .rule-thin { border: 0; border-top: 0.75px solid #12502c; margin: 1.5px 0 12px; }

  .title-block { text-align: center; margin-bottom: 14px; }
  h1.title {
    font-size: 13.5pt;
    margin: 0;
    color: #12502c;
    text-transform: uppercase; /* a no-op on Kannada, which is the point */
    font-weight: 600;
  }
  .subject { font-size: 10.5pt; font-weight: 600; margin-top: 2px; }
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

  tbody td { border-bottom: 0.75px solid #ece4d8; font-size: 9.5pt; }
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

  h2.section {
    font-size: 9.5pt;
    margin: 16px 0 6px;
    padding: 0 0 3px 0;
    color: #12502c;
    font-weight: 600;
    text-transform: uppercase;
    border-bottom: 0.75px solid #cbbfa9;
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
  .totals > div.is-income { border-left: 2.5px solid #04796b; }
  .totals > div.is-expense { border-left: 2.5px solid #c62828; }
  .totals > div.is-neutral { border-left: 2.5px solid #8b7f71; }
  .totals > div.is-brand { border-left: 2.5px solid #12502c; }

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
  svg.chart .key { font-size: 17px; fill: #3a3229; }
  svg.chart .key.num { font-variant-numeric: tabular-nums; }
  svg.chart .donut-value { font-size: 26px; font-weight: 600; fill: #1a1411; }

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

  /* -------------------------------------------------------------- close - */

  .sign {
    margin-top: 22px;
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    gap: 20px;
    break-inside: avoid;
  }
  .sign .made {
    font-size: 8pt;
    color: #8b7f71;
    max-width: 90mm;
  }
  .sign .line {
    width: 58mm;
    border-top: 0.75px solid #6b6157;
    padding-top: 4px;
    text-align: center;
    font-size: 8.5pt;
    color: #3a3229;
  }

  .foot {
    margin-top: 14px;
    padding-top: 6px;
    border-top: 0.75px solid #ece4d8;
    font-size: 7.5pt;
    color: #a2968a;
    display: flex;
    justify-content: space-between;
    gap: 12px;
  }
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
