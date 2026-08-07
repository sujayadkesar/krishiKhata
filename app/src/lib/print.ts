import { registerPlugin, Capacitor } from '@capacitor/core'
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'
import { buildPrintDocument } from './printDoc'

/**
 * Getting a report out of the app.
 *
 * `window.print()` does nothing inside an Android WebView, and `window.open()`
 * is worse — it returns null or throws, so the "fallback" that opened a new
 * window silently did nothing at all on a phone. That is why no PDF ever
 * appeared.
 *
 * There are now three routes, tried in order, and the caller is told which one
 * ran so it can say something useful:
 *
 *   1. The native print bridge. Chromium's own print layout, so pagination is
 *      decided by the engine that laid the document out, the text stays
 *      selectable, and Kannada is shaped exactly as on screen.
 *   2. Write the document to a file and hand it to the Android share sheet.
 *      The farmer can send it on WhatsApp, or open it and print from there.
 *   3. On the web only, a print window.
 *
 * Every failure is reported rather than swallowed. A report that cannot be
 * produced must say so; silence is what made this look broken.
 */

export interface PdfPrintResult {
  /** Absolute file URI, present only when a file was written. */
  uri?: string
  how: 'file' | 'dialog' | 'shared'
}

interface PdfPrintPlugin {
  printToFile(options: { html: string; fileName: string; jobName: string }): Promise<{
    uri?: string
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
 * Save the document as an HTML file and offer it to the share sheet.
 *
 * HTML rather than PDF because the app cannot render a PDF itself without
 * reintroducing the glyph-ordering problem that ruins Kannada. Every Android
 * phone opens HTML in a browser, where "Print → Save as PDF" is two taps and
 * uses a real shaping engine.
 */
async function shareAsFile(html: string, fileName: string, title: string): Promise<PdfPrintResult> {
  const name = fileName.replace(/\.pdf$/, '.html')

  const written = await Filesystem.writeFile({
    path: name,
    data: html,
    directory: Directory.Cache,
    encoding: Encoding.UTF8,
    recursive: true,
  })

  await Share.share({
    title,
    text: title,
    url: written.uri,
    dialogTitle: title,
  })

  return { how: 'shared', uri: written.uri }
}

export async function printReport(
  bodyHtml: string,
  title: string,
  fileName: string,
): Promise<PdfPrintResult> {
  const html = await buildPrintDocument(bodyHtml, title)

  if (isNativeApp()) {
    const failures: string[] = []

    try {
      const result = await PdfPrint.printToFile({ html, fileName, jobName: title })
      return result
    } catch (err) {
      failures.push(`print bridge: ${err instanceof Error ? err.message : String(err)}`)
    }

    try {
      return await shareAsFile(html, fileName, title)
    } catch (err) {
      failures.push(`share: ${err instanceof Error ? err.message : String(err)}`)
    }

    throw new Error(`Could not produce the report. ${failures.join('; ')}`)
  }

  // Web. Popups are commonly blocked, so say so plainly instead of appearing
  // to do nothing.
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
  return { how: 'dialog' }
}

/**
 * Save without printing — for handing a statement to somebody on WhatsApp.
 * On the web this downloads; on Android it opens the share sheet.
 */
export async function shareReport(
  bodyHtml: string,
  title: string,
  fileName: string,
): Promise<PdfPrintResult> {
  const html = await buildPrintDocument(bodyHtml, title)

  if (isNativeApp()) return shareAsFile(html, fileName, title)

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName.replace(/\.pdf$/, '.html')
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  return { how: 'shared' }
}
