/**
 * The Krishi Khata mark, as data.
 *
 * The artwork lives here rather than inside the component because four things
 * have to draw the same mark and only one of them is React: the app header,
 * the printed letterhead (an HTML string handed to a print engine), the web
 * favicon, and the Android adaptive icon. When the paths were duplicated the
 * launcher icon and the statement head drifted apart within a week.
 *
 * Everything is authored in a 64x64 box. The Android vector wraps these same
 * strings in a group scaled 1.125 and translated 18, which maps 64 into the
 * 108 adaptive viewport's safe zone — so there is no second copy to keep in
 * step there either.
 *
 * The mark itself: an open ledger, a sprout rising out of the gutter, and a
 * rupee at the point where the two meet. Few shapes and large ones, because it
 * has to survive being a 48px launcher icon and a one-colour print.
 */

export const LOGO_VIEWBOX = '0 0 64 64'

/** Rounded-tile radius, for the versions that carry a background. */
export const LOGO_TILE_RADIUS = 15

export const LOGO_COLORS = {
  tile: '#12502c',
  cover: '#8b4a24',
  coverShade: '#753c1c',
  page: '#ffffff',
  pageShade: '#e9f0eb',
  rule: '#a9cfb8',
  stem: '#4a9d66',
  leafFront: '#6fbf3f',
  leafBack: '#3d9b58',
  /*
   * The coin is a solid green disc with a pale rupee cut into it, not a pale
   * disc with a green rupee. It sits on the white page, and cream on white is
   * the one pairing that disappears at launcher size — which is the size that
   * matters most.
   */
  coin: '#3f8f5c',
  ink: '#fffaf2',
} as const

export const LOGO_PATHS = {
  /** Book covers: outer edges ride high, the gutter sags. */
  coverLeft: 'M32 40.5C25 35 17 33.5 9 35.5V50.5C17 48.5 25 50 32 55.5Z',
  coverRight: 'M32 40.5C39 35 47 33.5 55 35.5V50.5C47 48.5 39 50 32 55.5Z',
  /** Pages, inset inside the covers on all four sides. */
  pageLeft: 'M32 42C26 37.5 19.5 36.5 13 38V48.5C19.5 47 26 48 32 52.5Z',
  pageRight: 'M32 42C38 37.5 44.5 36.5 51 38V48.5C44.5 47 38 48 32 52.5Z',
  /** Ruled lines, following the slope of each page. */
  rules:
    'M17.5 42.4L27.5 44.5M17.5 45.9L27.5 48M46.5 42.4L36.5 44.5M46.5 45.9L36.5 48',
  stem: 'M32 42V23',
  leafFront: 'M32.5 27.5C33.5 19 39.5 12.5 47.5 10.5C47.5 19.5 41.5 26.5 32.5 27.5Z',
  leafBack: 'M31.5 30C30.5 21.5 24.5 15 16.5 13C16.5 22 22.5 29 31.5 30Z',
  /**
   * The coin behind the rupee, as a path rather than a <circle>: Android's
   * VectorDrawable has no circle element, and one shape shared by every
   * renderer is the whole point of this file.
   */
  coin: 'M37.7 44.4A5.7 5.7 0 0 1 26.3 44.4A5.7 5.7 0 0 1 37.7 44.4Z',
  /**
   * The rupee, in its own 24x24 space so it can be lifted straight from an
   * icon set and stay recognisable. `RUPEE_TRANSFORM` places it in the coin.
   */
  rupee: 'M6 3h12M6 8h12M6 13l8.5 8M6 13h3M9 13c6.667 0 6.667-10 0-10',
} as const

export const LOGO_COIN = { cx: 32, cy: 44.4, r: 5.7 } as const

/** 24-space rupee -> the coin at 64-space. Scale first, then translate. */
export const RUPEE_SCALE = 0.45
export const RUPEE_TRANSLATE = { x: 26.6, y: 39 } as const
/** Stroke widths are given in the rupee's own 24-space. */
export const RUPEE_STROKE = 2.8

export const STEM_STROKE = 3.1
export const RULE_STROKE = 1.05

/**
 * The mark as a standalone SVG string.
 *
 * For the printed letterhead and the favicon, which are strings rather than
 * components. `mono` is the statement version — one ink, no tile — because a
 * dark green square at the top of every page wastes toner and looks cheap on
 * the paper these actually get printed on.
 */
export function logoSvg(
  opts: { size?: number; mono?: boolean; bare?: boolean; className?: string } = {},
): string {
  const { size = 64, mono = false, bare = false, className } = opts
  const c = LOGO_COLORS
  const cls = className ? ` class="${className}"` : ''

  const tile =
    bare || mono
      ? ''
      : `<rect width="64" height="64" rx="${LOGO_TILE_RADIUS}" fill="${c.tile}"/>`

  const ink = mono ? 'currentColor' : null

  const body = mono
    ? `<path d="${LOGO_PATHS.leafBack}" fill="currentColor" opacity=".55"/>
<path d="${LOGO_PATHS.leafFront}" fill="currentColor"/>
<path d="${LOGO_PATHS.stem}" stroke="currentColor" stroke-width="${STEM_STROKE}" stroke-linecap="round" fill="none"/>
<path d="${LOGO_PATHS.coverLeft}" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/>
<path d="${LOGO_PATHS.coverRight}" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/>
<path d="${LOGO_PATHS.coin}" fill="#fff" stroke="currentColor" stroke-width="1.6"/>`
    : `<path d="${LOGO_PATHS.coverLeft}" fill="${c.cover}"/>
<path d="${LOGO_PATHS.coverRight}" fill="${c.coverShade}"/>
<path d="${LOGO_PATHS.pageLeft}" fill="${c.page}"/>
<path d="${LOGO_PATHS.pageRight}" fill="${c.pageShade}"/>
<path d="${LOGO_PATHS.rules}" stroke="${c.rule}" stroke-width="${RULE_STROKE}" stroke-linecap="round" fill="none"/>
<path d="${LOGO_PATHS.stem}" stroke="${c.stem}" stroke-width="${STEM_STROKE}" stroke-linecap="round" fill="none"/>
<path d="${LOGO_PATHS.leafBack}" fill="${c.leafBack}"/>
<path d="${LOGO_PATHS.leafFront}" fill="${c.leafFront}"/>
<path d="${LOGO_PATHS.coin}" fill="${c.coin}"/>`

  const rupee = `<g transform="translate(${RUPEE_TRANSLATE.x} ${RUPEE_TRANSLATE.y}) scale(${RUPEE_SCALE})"><path d="${LOGO_PATHS.rupee}" fill="none" stroke="${ink ?? c.ink}" stroke-width="${RUPEE_STROKE}" stroke-linecap="round" stroke-linejoin="round"/></g>`

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${LOGO_VIEWBOX}" width="${size}" height="${size}"${cls}>${tile}${body}${rupee}</svg>`
}
