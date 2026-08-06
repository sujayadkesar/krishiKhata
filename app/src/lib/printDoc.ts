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
  @page { size: A4; margin: 14mm 12mm; }

  * { box-sizing: border-box; }

  body {
    margin: 0;
    font-family: 'Noto Sans Kannada', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
    font-size: 11pt;
    line-height: 1.45;
    color: #101a14;
    background: #fff;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .doc { max-width: 186mm; margin: 0 auto; }

  /* Letterhead */
  .lh { display: flex; align-items: flex-start; gap: 12px;
        border-bottom: 2px solid #12502c; padding-bottom: 10px; margin-bottom: 14px; }
  .lh-logo { width: 46px; height: 46px; flex: none; }
  .lh-main { flex: 1; }
  .lh-app { font-size: 15pt; font-weight: 600; color: #12502c; line-height: 1.2; }
  .lh-farm { font-size: 12pt; font-weight: 600; margin-top: 2px; }
  .lh-sub { font-size: 9pt; color: #4a5a51; }
  .lh-right { text-align: right; font-size: 9pt; color: #4a5a51; }

  h1.title { font-size: 13pt; margin: 0 0 2px; }
  .period { font-size: 9.5pt; color: #4a5a51; margin-bottom: 12px; }

  table { width: 100%; border-collapse: collapse; margin-bottom: 14px; }
  th, td { padding: 5px 7px; text-align: left; vertical-align: top; }
  thead th { background: #eef7f1; border-bottom: 1.5px solid #a7d9bc;
             font-size: 9.5pt; font-weight: 600; }
  tbody td { border-bottom: 1px solid #e3e9e5; font-size: 10pt; }
  tfoot td { border-top: 1.5px solid #12502c; font-weight: 600; font-size: 10.5pt; }
  .num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .muted { color: #6b7c72; font-size: 9pt; }
  .pos { color: #0f7b3e; }
  .neg { color: #c0392b; }

  /* A row must not be split across a page. */
  tr, .block { break-inside: avoid; page-break-inside: avoid; }
  thead { display: table-header-group; }
  tfoot { display: table-footer-group; }

  h2.section { font-size: 11.5pt; margin: 16px 0 6px; padding-bottom: 3px;
               border-bottom: 1px solid #d9e0dc; break-after: avoid; }

  .totals { display: flex; gap: 10px; margin-bottom: 14px; }
  .totals div { flex: 1; border: 1px solid #d9e0dc; border-radius: 6px; padding: 7px 9px; }
  .totals .k { font-size: 8.5pt; color: #4a5a51; }
  .totals .v { font-size: 13pt; font-weight: 600; font-variant-numeric: tabular-nums; }

  .note { font-size: 9pt; color: #4a5a51; border-left: 3px solid #f0c078;
          padding: 5px 9px; background: #fdf1dd; margin-bottom: 12px; }

  .foot { margin-top: 18px; padding-top: 7px; border-top: 1px solid #d9e0dc;
          font-size: 8.5pt; color: #6b7c72; display: flex; justify-content: space-between; }
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
