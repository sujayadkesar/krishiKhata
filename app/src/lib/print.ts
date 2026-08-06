import { registerPlugin, Capacitor } from '@capacitor/core'
import { buildPrintDocument } from './printDoc'

/**
 * Getting a report out of the app as a PDF.
 *
 * `window.print()` does nothing inside an Android WebView, which is why apps
 * like this end up drawing their own PDFs — and why their Kannada comes out as
 * mis-ordered glyphs, because JS PDF libraries embed the font but place glyphs
 * left to right with no shaping engine.
 *
 * The platform can still PRINT the WebView: `createPrintDocumentAdapter()`
 * runs Chromium's real print layout and writes a proper PDF, with selectable
 * text and correctly shaped Kannada. It has to be reached from Java, hence the
 * bridge in PdfPrintPlugin.java.
 */

export interface PdfPrintResult {
  /** Absolute file URI, present only when written directly. */
  uri?: string
  /** 'file' — written silently. 'dialog' — handed to the system print sheet. */
  how: 'file' | 'dialog'
}

interface PdfPrintPlugin {
  printToFile(options: { html: string; fileName: string; jobName: string }): Promise<PdfPrintResult>
}

const PdfPrint = registerPlugin<PdfPrintPlugin>('PdfPrint')

export function isNativeApp(): boolean {
  return Capacitor.isNativePlatform()
}

/** A filename a farmer can find later: no spaces, dated, readable. */
export function reportFileName(title: string, from: string, to: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  return `krishi-khata-${slug || 'report'}-${from}-to-${to}.pdf`
}

/**
 * Print or share a report.
 *
 * On Android the document goes to the print framework. On the web it opens in
 * a new window and calls print() there, so the browser's own "Save as PDF" is
 * one step away without the app having to draw anything.
 */
export async function printReport(
  bodyHtml: string,
  title: string,
  fileName: string,
): Promise<PdfPrintResult> {
  const html = await buildPrintDocument(bodyHtml, title)

  if (isNativeApp()) {
    try {
      return await PdfPrint.printToFile({ html, fileName, jobName: title })
    } catch {
      // An APK built before this plugin existed rejects with "not implemented".
      // Falling through to the web path still shows the farmer the document.
    }
  }

  const win = window.open('', '_blank')
  if (!win) {
    throw new Error('The browser blocked the print window. Allow pop-ups and try again.')
  }

  win.document.open()
  win.document.write(html)
  win.document.close()

  // Waiting for the embedded font to be ready matters: printing before it
  // loads produces a document set in a fallback face, which for Kannada can
  // mean boxes. Bounded, because a stuck font must not block the report.
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
