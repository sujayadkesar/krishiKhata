import { registerPlugin, Capacitor } from '@capacitor/core'
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'
import { buildPrintDocument } from './printDoc'

/**
 * Getting a report out of the app, as an actual PDF.
 *
 * `window.print()` does nothing inside an Android WebView, and `window.open()`
 * is worse — it returns null or throws, so a "fallback" that opened a new
 * window silently did nothing on a phone.
 *
 * The route that works is Android's own print framework: the document is laid
 * out by Chromium in an offscreen WebView and written straight to a PDF file.
 * That matters more here than anywhere else, because a JS PDF library embeds
 * the Kannada font but places glyphs left to right, which takes ಬಾಳೆಕಾಯಿ
 * apart. The browser has a real shaping engine; this borrows it.
 *
 * The PDF bridge existed already and only the print path used it. `share`
 * wrote the raw HTML to a file and offered THAT — which is why every report
 * the farmer sent arrived as a web page instead of a PDF. Sharing now takes
 * the same PDF route, and falls back to HTML only when the bridge genuinely
 * fails.
 */

export interface PdfPrintResult {
  /** Absolute file URI, present only when a file was written. */
  uri?: string
  how: 'file' | 'dialog' | 'shared'
  /** What actually came out. 'html' means the PDF route was unavailable. */
  format: 'pdf' | 'html'
}

interface PdfPrintPlugin {
  printToFile(options: { html: string; fileName: string; jobName: string }): Promise<{
    uri?: string
    path?: string
    how: 'file' | 'dialog'
  }>
}

const PdfPrint = registerPlugin<PdfPrintPlugin>('PdfPrint')

export function isNativeApp(): boolean {
  return Capacitor.isNativePlatform()
}

/** A filename a farmer can find later: no spaces, dated, readable. */
export function reportFileName(title: string, from: string, to: string, ext = 'pdf'): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  return `krishi-khata-${slug || 'report'}-${from}-to-${to}.${ext}`
}

/**
 * Last resort: save the document as HTML and offer that instead.
 *
 * Only reached when the print bridge fails outright — some OEM builds refuse a
 * headless print. Every Android phone opens HTML in a browser, where
 * "Print → Save as PDF" is two taps and uses the same shaping engine, so this
 * is worse but never useless.
 */
async function shareAsHtml(
  html: string,
  fileName: string,
  title: string,
): Promise<PdfPrintResult> {
  const name = fileName.replace(/\.pdf$/, '.html')

  const written = await Filesystem.writeFile({
    path: name,
    data: html,
    directory: Directory.Cache,
    encoding: Encoding.UTF8,
    recursive: true,
  })

  await Share.share({ title, text: title, url: written.uri, dialogTitle: title })
  return { how: 'shared', uri: written.uri, format: 'html' }
}

/** Render to PDF through the native bridge. Throws if it cannot. */
async function writePdf(
  html: string,
  fileName: string,
  title: string,
): Promise<{ path?: string; uri?: string; how: 'file' | 'dialog' }> {
  return PdfPrint.printToFile({ html, fileName, jobName: title })
}

/**
 * Produce the report and hand it to the share sheet.
 *
 * Nothing is written quietly into the phone's storage for the farmer to go
 * looking for: the file goes to the share sheet and they decide whether it
 * lands in WhatsApp, Drive, or a printer.
 */
export async function shareReport(
  bodyHtml: string,
  title: string,
  fileName: string,
): Promise<PdfPrintResult> {
  const html = await buildPrintDocument(bodyHtml, title)

  if (isNativeApp()) {
    const failures: string[] = []

    try {
      const result = await writePdf(html, fileName, title)

      // 'dialog' means the system print sheet is already up because a headless
      // print was refused. The farmer finishes there; there is nothing to share.
      if (result.how === 'dialog') return { how: 'dialog', format: 'pdf' }

      const fileUrl = result.path ? `file://${result.path}` : result.uri
      if (fileUrl) {
        await Share.share({ title, text: title, url: fileUrl, dialogTitle: title })
        return { how: 'shared', uri: result.uri ?? fileUrl, format: 'pdf' }
      }
      failures.push('print bridge returned no file')
    } catch (err) {
      failures.push(`pdf: ${err instanceof Error ? err.message : String(err)}`)
    }

    try {
      return await shareAsHtml(html, fileName, title)
    } catch (err) {
      failures.push(`share: ${err instanceof Error ? err.message : String(err)}`)
    }

    throw new Error(`Could not produce the report. ${failures.join('; ')}`)
  }

  // Web is a development surface. The browser's own print dialog has "Save as
  // PDF" as its first destination and uses the same shaping engine the phone
  // does, so it produces the identical document.
  return printInBrowser(html)
}

/**
 * Print. On Android this is the same PDF, handed to the print sheet; on the
 * web it is the browser's print dialog.
 */
export async function printReport(
  bodyHtml: string,
  title: string,
  fileName: string,
): Promise<PdfPrintResult> {
  const html = await buildPrintDocument(bodyHtml, title)

  if (isNativeApp()) {
    const failures: string[] = []
    try {
      const result = await writePdf(html, fileName, title)
      return { ...result, format: 'pdf' }
    } catch (err) {
      failures.push(`print bridge: ${err instanceof Error ? err.message : String(err)}`)
    }
    try {
      return await shareAsHtml(html, fileName, title)
    } catch (err) {
      failures.push(`share: ${err instanceof Error ? err.message : String(err)}`)
    }
    throw new Error(`Could not produce the report. ${failures.join('; ')}`)
  }

  return printInBrowser(html)
}

async function printInBrowser(html: string): Promise<PdfPrintResult> {
  const win = window.open('', '_blank')
  if (!win) {
    throw new Error(
      'The browser blocked the print window. Allow pop-ups for this site, then try again.',
    )
  }

  win.document.open()
  win.document.write(html)
  win.document.close()

  // Printing before the embedded font is ready produces a document set in a
  // fallback face, which for Kannada can mean empty boxes. Bounded, because a
  // stuck font must not block the report entirely.
  await new Promise<void>((resolve) => {
    let done = false
    const finish = () => {
      if (!done) {
        done = true
        resolve()
      }
    }
    const fonts = (win.document as Document & { fonts?: FontFaceSet }).fonts
    if (fonts?.ready) void fonts.ready.then(finish)
    setTimeout(finish, 3000)
  })

  win.focus()
  win.print()
  return { how: 'dialog', format: 'pdf' }
}
