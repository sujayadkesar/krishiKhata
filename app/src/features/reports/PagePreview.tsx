import { useCallback, useLayoutEffect, useRef, useState } from 'react'

/**
 * The report, on screen, as the sheet of paper it will become.
 *
 * Two things this deliberately does NOT do.
 *
 * It does not reflow. A preview whose tables rearrange themselves to fit a
 * phone is not a preview of anything — the farmer approves one layout and
 * sends another. The document is laid out at full A4 and the whole page is
 * scaled down, so what is on screen is the PDF, small.
 *
 * It does not restyle. The iframe gets the complete document, stylesheet and
 * embedded font included, and nothing from the app's cascade reaches inside
 * it. Handing it the bare report markup instead is what made every preview
 * render as unstyled stacked text while the PDF itself came out correct.
 *
 * The height is measured from the document rather than guessed: srcdoc is
 * same-origin, so this is a read, not a hack. Guessing leaves either a clipped
 * last page or a screenful of empty grey under a short report.
 */

/** A4 at 96dpi is 794px; the slack leaves room for the sheet's drop shadow. */
const PAGE_PX = 820

/** One A4 page, used until the real height is known. */
const A4_PX = 1123

export function PagePreview({ doc }: { doc: string | null }) {
  const boxRef = useRef<HTMLDivElement>(null)
  const frameRef = useRef<HTMLIFrameElement>(null)
  const [scale, setScale] = useState(1)
  const [height, setHeight] = useState(A4_PX)

  const fit = useCallback(() => {
    const box = boxRef.current
    if (!box || !box.clientWidth) return
    setScale(Math.min(1, box.clientWidth / PAGE_PX))
  }, [])

  /**
   * Three ways of noticing the width, because one is not reliable enough to
   * hang the whole preview on.
   *
   * ResizeObserver is the precise one — it catches the box changing for
   * reasons the window does not, such as the keyboard opening. But its
   * callbacks are delivered with the rendering steps, so a WebView that is not
   * currently painting can sit on them, and a preview stuck at scale 1 is a
   * page running off the side of the screen. The window listeners cover
   * rotation, and the initial call covers first paint.
   */
  useLayoutEffect(() => {
    fit()
    const box = boxRef.current
    const observer = box ? new ResizeObserver(fit) : null
    observer?.observe(box!)
    window.addEventListener('resize', fit)
    window.addEventListener('orientationchange', fit)
    return () => {
      observer?.disconnect()
      window.removeEventListener('resize', fit)
      window.removeEventListener('orientationchange', fit)
    }
  }, [fit])

  const measure = useCallback(() => {
    const inner = frameRef.current?.contentDocument
    if (!inner?.body) return
    setHeight(Math.max(inner.body.scrollHeight, inner.documentElement.scrollHeight, A4_PX))
    // The document arriving is also the first moment the box has its real
    // width, so the fit is taken again here rather than trusted from mount.
    fit()
  }, [fit])

  return (
    <div
      ref={boxRef}
      className="flex-1 overflow-auto"
      style={{ background: '#ded5c8', minHeight: 0 }}
    >
      {/* Holds the scrollable height. A CSS transform does not affect layout,
          so without this the scaled page would have nothing to scroll. */}
      <div style={{ height: height * scale }}>
        <iframe
          ref={frameRef}
          title="preview"
          srcDoc={doc ?? ''}
          // The outer box scrolls the whole scaled page; an inner scrollbar
          // would fight it and land the farmer's thumb on the wrong one.
          scrolling="no"
          onLoad={() => {
            measure()
            // The embedded Kannada font applies a beat after load, and the
            // document gets taller when it does.
            setTimeout(measure, 400)
          }}
          style={{
            display: 'block',
            width: PAGE_PX,
            height,
            border: 0,
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
          }}
        />
      </div>
    </div>
  )
}
