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
    margin: 13mm 11mm 16mm;
  }

  * { box-sizing: border-box; }

  body {
    margin: 0;
    font-family: 'Noto Sans Kannada', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
    font-size: 10.5pt;
    line-height: 1.45;
    color: #16201a;
    background: #fff;
    /* Without these the browser drops every background when printing, and a
       statement whose header bands have vanished looks unfinished. */
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .doc { max-width: 188mm; margin: 0 auto; }

  /* ---------------------------------------------------------- letterhead - */

  .lh {
    display: flex;
    align-items: center;
    gap: 13px;
    padding-bottom: 11px;
    margin-bottom: 0;
    border-bottom: 2.5px solid #12502c;
  }
  .lh-logo { width: 44px; height: 44px; flex: none; }
  .lh-main { flex: 1; min-width: 0; }
  .lh-app {
    font-size: 15pt;
    font-weight: 600;
    color: #12502c;
    line-height: 1.15;
    letter-spacing: 0; /* never set tracking: it takes Kannada apart */
  }
  .lh-farm { font-size: 11.5pt; font-weight: 600; margin-top: 3px; }
  .lh-sub { font-size: 8.5pt; color: #58685e; font-weight: 400; }
  .lh-right { text-align: right; font-size: 8.5pt; color: #58685e; line-height: 1.5; }

  /* The title sits in a tinted band under the rule so the eye lands on it
     before the numbers. */
  .title-band {
    background: #eef7f1;
    border-left: 4px solid #1b7a43;
    padding: 7px 11px;
    margin-bottom: 13px;
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 12px;
  }
  h1.title { font-size: 13pt; margin: 0; color: #0e3f23; }
  .period { font-size: 9pt; color: #4a5a51; white-space: nowrap; }

  /* ------------------------------------------------------------- tables - */

  table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
  th, td { padding: 6px 8px; text-align: left; vertical-align: top; }

  thead th {
    background: #12502c;
    color: #fff;
    font-size: 9pt;
    font-weight: 600;
    border: none;
  }
  thead th:first-child { border-top-left-radius: 4px; }
  thead th:last-child { border-top-right-radius: 4px; }

  tbody td { border-bottom: 1px solid #e6ece8; font-size: 10pt; }
  /* Zebra striping is what makes a wide row readable across seven columns. */
  tbody tr:nth-child(even) td { background: #f7faf8; }

  tfoot td {
    border-top: 2px solid #12502c;
    background: #eef7f1;
    font-weight: 600;
    font-size: 10.5pt;
  }

  .num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .muted { color: #7a8a80; font-size: 9pt; }
  .pos { color: #0f7b3e; font-weight: 600; }
  .neg { color: #c0392b; font-weight: 600; }
  .strong { font-weight: 600; }

  /* Nothing may be split across a page boundary. Page breaks belong to the
     print engine; this is how it is told what must stay together. */
  tr, .block, .card { break-inside: avoid; page-break-inside: avoid; }
  thead { display: table-header-group; }
  tfoot { display: table-footer-group; }

  h2.section {
    font-size: 11pt;
    margin: 18px 0 7px;
    padding: 0 0 4px 0;
    color: #12502c;
    border-bottom: 1.5px solid #a7d9bc;
    break-after: avoid;
    page-break-after: avoid;
  }

  /* ------------------------------------------------------- summary cards - */

  .totals { display: flex; gap: 9px; margin-bottom: 14px; flex-wrap: wrap; }
  .totals > div {
    flex: 1 1 0;
    min-width: 26mm;
    border: 1px solid #dfe7e2;
    border-top: 3px solid #1b7a43;
    border-radius: 5px;
    padding: 8px 10px;
    background: #fff;
  }
  .totals .k { font-size: 8pt; color: #58685e; margin-bottom: 2px; }
  .totals .v { font-size: 13.5pt; font-weight: 600; font-variant-numeric: tabular-nums; }
  .totals .sub { font-size: 8pt; color: #7a8a80; margin-top: 1px; }
  .totals > div.is-income { border-top-color: #0f7b3e; }
  .totals > div.is-expense { border-top-color: #c0392b; }
  .totals > div.is-neutral { border-top-color: #58685e; }

  /* ----------------------------------------------------------- callouts - */

  .note {
    font-size: 9pt;
    color: #7a5a12;
    border-left: 3px solid #f0c078;
    padding: 7px 10px;
    background: #fdf6e9;
    margin-bottom: 13px;
    border-radius: 0 4px 4px 0;
  }

  /* -------------------------------------------------------- bar in-table - */

  /* A proportion bar inside a cell reads faster than a percentage, and costs
     no image — which matters when the document has to survive being printed
     by whatever engine the phone has. */
  .bar { height: 6px; background: #e6ece8; border-radius: 3px; overflow: hidden; min-width: 22mm; }
  .bar > span { display: block; height: 100%; background: #1b7a43; }
  .bar.is-expense > span { background: #c0392b; }

  .foot {
    margin-top: 20px;
    padding-top: 8px;
    border-top: 1px solid #dfe7e2;
    font-size: 8pt;
    color: #7a8a80;
    display: flex;
    justify-content: space-between;
  }

  .sign {
    margin-top: 26px;
    display: flex;
    justify-content: flex-end;
  }
  .sign div {
    width: 58mm;
    border-top: 1px solid #58685e;
    padding-top: 4px;
    text-align: center;
    font-size: 8.5pt;
    color: #58685e;
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
