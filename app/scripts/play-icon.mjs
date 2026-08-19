import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Resvg } from '@resvg/resvg-js'
import { logoSvg } from '../src/components/logoArt.ts'

/**
 * The Play Store icon, and proofs at the sizes it will actually be seen.
 *
 *   npm run play-icon
 *
 * Play wants a 512x512 PNG with SQUARE corners: the store and the launcher
 * each apply their own mask, and an icon that arrives pre-rounded gets rounded
 * twice, which shows as a pale fringe along the curve.
 *
 * The proofs at 192 and 48 are the point of this script. An icon is designed
 * at 512 and lived with at 48, and detail that reads on the canvas turns to
 * mud on a home screen — the only way to know is to look at it small.
 */

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const out = join(root, 'play-assets')
mkdirSync(out, { recursive: true })

/** The mark on its tile, square-cornered, with the store's breathing room. */
function storeIcon() {
  const inner = logoSvg({ size: 512, bare: true })
    .replace(/^<svg[^>]*>/, '')
    .replace(/<\/svg>$/, '')

  /*
   * Fitted to the ARTWORK's bounds, not to its 64x64 canvas.
   *
   * The mark occupies x 9-55 and y 10.5-55.5 inside that canvas, so it already
   * carries about 14% of margin of its own. Scaling the whole canvas down to
   * leave "room for the mask" applied that margin a second time and produced
   * an icon floating in a field of green — which at 48px is a smudge with a
   * lot of nothing around it.
   *
   * So: centre the artwork's real bounding box on the tile, and scale it to
   * fill ~80%, which is the proportion Play's own icons sit at.
   */
  const CX = 32, CY = 33, SCALE = 1.12

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="512" height="512">
<rect width="64" height="64" fill="#12502c"/>
<g transform="translate(32 32) scale(${SCALE}) translate(${-CX} ${-CY})">${inner}</g>
</svg>`
}

function render(svg, size, name) {
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: size } }).render().asPng()
  writeFileSync(join(out, name), png)
  console.log('wrote play-assets/' + name, `${size}x${size}`, `${(png.length / 1024).toFixed(1)} KB`)
}

const icon = storeIcon()
render(icon, 512, 'play-icon-512.png')
render(icon, 192, 'proof-192.png')
render(icon, 48, 'proof-48.png')
