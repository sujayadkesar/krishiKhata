import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Resvg } from '@resvg/resvg-js'
import { logoSvg } from '../src/components/logoArt.ts'

/**
 * The Play Store listing graphics.
 *
 *   npm run store-assets
 *
 * Generated rather than drawn in an editor, for the same reason the app icon
 * is: the palette here is THE APP'S palette, pulled from the same tokens the
 * screens use, so a listing cannot drift away from the product it is selling.
 * Change a colour in one place and regenerate.
 *
 * The phone screens below are RECONSTRUCTIONS of the real interface at real
 * proportions, not captures. They are accurate to what the app shows — same
 * layout, same colours, same figures the seeded data produces — but if you
 * want captures from an actual device, take them and use these as the frame
 * design. Play requires screenshots to represent the app honestly, and these
 * do; a real capture is simply better still.
 */

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const out = join(root, 'play-assets')
mkdirSync(out, { recursive: true })

/* ------------------------------------------------------------------ *
 * The app's own tokens. Kept identical to src/index.css.
 * ------------------------------------------------------------------ */

const C = {
  forest: '#12502c',
  forestDeep: '#0d3b20',
  leaf: '#6fbf3f',
  brand: '#e35b0d',
  brandSoft: '#fef4ec',
  brandLight: '#f4a26c',
  ground: '#fdf7ef',
  card: '#ffffff',
  border: '#efe4d5',
  ink: '#1a1411',
  soft: '#5b5146',
  faint: '#8b7f71',
  income: '#04796b',
  expense: '#c62828',
  paleGreen: '#a7cbb5',
}

const LATIN = 'Segoe UI'
const KANNADA = 'Nirmala UI'

const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/**
 * How wide a run of text actually renders.
 *
 * MEASURED, not estimated. A first attempt guessed widths from character
 * counts and was wrong by 10–20% depending on how many combining marks a word
 * carried, which made words overlap — worse than the problem it was solving.
 * The rasteriser can report the ink box of anything it draws, so it is asked.
 *
 * Cached because the same handful of labels are drawn across five screenshots
 * and each measurement is a full parse.
 */
const measured = new Map()
function widthOf(text, size, family) {
  const key = `${family}|${size}|${text}`
  const hit = measured.get(key)
  if (hit !== undefined) return hit

  const probe = `<svg xmlns="http://www.w3.org/2000/svg" width="6000" height="${size * 3}"><text x="0" y="${size * 2}" font-family="${family}" font-size="${size}">${esc(text)}</text></svg>`
  let w
  try {
    const box = new Resvg(probe, { font: { loadSystemFonts: true } }).getBBox()
    // From the origin, not just the ink: the left sidebearing is part of the
    // advance and dropping it shifts every following word left.
    w = box ? box.x + box.width : size * 0.6 * [...text].length
  } catch {
    w = size * 0.6 * [...text].length
  }
  measured.set(key, w)
  return w
}

/**
 * A text run.
 *
 * MULTI-WORD KANNADA IS LAID OUT WORD BY WORD, and it has to be. The
 * rasteriser drops the space between two Kannada words — "ಆದಾಯ ಮತ್ತು ಖರ್ಚು"
 * comes out as "ಆದಾಯಮತ್ತುಖರ್ಚು" — regardless of xml:space, doubled spaces,
 * tspan offsets, or which Indic font is asked for. For an app whose whole
 * point is that it speaks Kannada properly, a listing full of run-together
 * words is the worst possible first impression, so each word is measured and
 * placed with the gap put back by hand.
 */
function txt(x, y, s, { size = 24, fill = C.ink, weight = 400, anchor = 'start', kn = false } = {}) {
  const family = kn ? KANNADA : LATIN
  const attrs = `font-family="${family}" font-size="${size}" font-weight="${weight}" fill="${fill}"`

  const words = String(s).split(' ').filter(Boolean)
  if (!kn || words.length < 2) {
    return `<text x="${x}" y="${y}" ${attrs} text-anchor="${anchor}">${esc(s)}</text>`
  }

  // Generous on purpose. The measurement is an INK box, so a letter with a
  // subscript that trails to the right — ಆಗಸ್ಟ್ — measures narrower than it
  // occupies, and Kannada has no ascender pattern to make a word boundary
  // obvious the way Latin does. Too much air reads as styling; too little
  // reads as a spelling mistake.
  const gap = 0.52 * size
  const widths = words.map((w) => widthOf(w, size, family))
  const total = widths.reduce((a, b) => a + b, 0) + gap * (words.length - 1)
  let cursor = anchor === 'middle' ? x - total / 2 : anchor === 'end' ? x - total : x

  return words
    .map((w, i) => {
      const out = `<text x="${cursor}" y="${y}" ${attrs} text-anchor="start">${esc(w)}</text>`
      cursor += widths[i] + gap
      return out
    })
    .join('')
}

const rect = (x, y, w, h, fill, r = 0, extra = '') =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}" ${extra}/>`

/** The mark, stripped of its own <svg> so it can be placed and scaled. */
function mark(size, x, y) {
  const inner = logoSvg({ size: 64, bare: true }).replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '')
  const s = size / 64
  return `<g transform="translate(${x} ${y}) scale(${s})">${inner}</g>`
}

/**
 * The ornament from the printed reports, reused here.
 *
 * A listing and a statement that share one piece of decoration read as coming
 * from the same place, which is the entire job of a brand mark.
 */
function ornament(x, y, w) {
  const half = w / 2 - 46
  return `<g transform="translate(${x} ${y})">
    <rect x="0" y="-1" width="${half}" height="2.5" fill="${C.brand}" opacity=".45"/>
    <rect x="${w - half}" y="-1" width="${half}" height="2.5" fill="${C.brand}" opacity=".45"/>
    <path d="M${w / 2 - 34} 0 L${w / 2 - 21} -13 L${w / 2 - 8} 0 L${w / 2 - 21} 13 Z" fill="${C.brand}"/>
    <path d="M${w / 2 - 4} 0 L${w / 2} -5 L${w / 2 + 4} 0 L${w / 2} 5 Z" fill="${C.brandLight}"/>
    <path d="M${w / 2 + 8} 0 L${w / 2 + 21} -13 L${w / 2 + 34} 0 L${w / 2 + 21} 13 Z" fill="${C.brand}"/>
  </g>`
}

/* ------------------------------------------------------------------ *
 * The phone, and the screens inside it
 * ------------------------------------------------------------------ */

const SCREEN_W = 752
const SCREEN_H = 1412

/** A hardware frame so a screen reads as a phone rather than a web page. */
function phone(x, y, screen) {
  return `<g transform="translate(${x} ${y})">
    <rect x="0" y="0" width="${SCREEN_W + 28}" height="${SCREEN_H + 28}" rx="58" fill="${C.ink}"/>
    <rect x="4" y="4" width="${SCREEN_W + 20}" height="${SCREEN_H + 20}" rx="54" fill="#2c2620"/>
    <clipPath id="scr${x}${y}"><rect x="14" y="14" width="${SCREEN_W}" height="${SCREEN_H}" rx="46"/></clipPath>
    <g clip-path="url(#scr${x}${y})"><g transform="translate(14 14)">${screen}</g></g>
  </g>`
}

/** Header bar shared by every screen. */
function appHeader(title, kn = true) {
  return `${rect(0, 0, SCREEN_W, 96, C.card)}
    ${rect(0, 95, SCREEN_W, 1.5, C.border)}
    ${mark(46, 22, 26)}
    ${txt(84, 62, title, { size: 30, weight: 600, kn })}`
}

/** Bottom navigation, with one item lit. */
function appNav(activeIndex) {
  const items = [
    ['ಮುಖಪುಟ', 'M4 10 12 3l8 7v10H4z'],
    ['ವ್ಯವಹಾರ', 'M5 3h14v18l-3-2-2 2-2-2-2 2-3-2z'],
    ['ಸೇರಿಸಿ', 'M12 5v14M5 12h14'],
    ['ಕೆಲಸಗಾರರು', 'M8 11a4 4 0 100-8 4 4 0 000 8zM2 21a6 6 0 0112 0'],
    ['ಸೆಟ್ಟಿಂಗ್ಸ್', 'M12 8a4 4 0 100 8 4 4 0 000-8z'],
  ]
  const w = SCREEN_W / 5
  const y = SCREEN_H - 116
  return `${rect(0, y, SCREEN_W, 116, C.card)}${rect(0, y, SCREEN_W, 1.5, C.border)}` +
    items.map(([label, d], i) => {
      const on = i === activeIndex
      const cx = w * i + w / 2
      const colour = on ? C.brand : C.faint
      const add = i === 2
      return `<g transform="translate(${cx} ${y + 34})">
        ${add ? `<circle cx="0" cy="4" r="27" fill="${C.brand}"/>` : ''}
        <g transform="translate(-12 -8) scale(1)" fill="none" stroke="${add ? '#fff' : colour}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"/></g>
        ${txt(0, 52, label, { size: 17, fill: colour, weight: on ? 600 : 400, anchor: 'middle', kn: true })}
      </g>`
    }).join('')
}

const card = (x, y, w, h) => rect(x, y, w, h, C.card, 22, `stroke="${C.border}" stroke-width="1.5"`)

/** 1 — Home. The two big actions, the month, the balances. */
function screenHome() {
  const tiles = [
    ['ಆದಾಯ', '₹3.12 L', C.income],
    ['ಖರ್ಚು', '₹10,000', C.expense],
    ['ಉಳಿತಾಯ', '₹3.02 L', C.income],
    ['ಬಾಕಿ ಕೂಲಿ', '₹17,650', C.expense],
  ]
  return `${rect(0, 0, SCREEN_W, SCREEN_H, C.ground)}
  ${appHeader('ಕೃಷಿ ಖಾತೆ')}
  ${rect(28, 128, 340, 190, C.brand, 26)}
  <g transform="translate(198 212)" fill="none" stroke="#fff" stroke-width="4.5" stroke-linecap="round"><path d="M-22 0h44M0 -22v44"/></g>
  ${txt(198, 288, 'ಸೇರಿಸಿ', { size: 34, fill: '#fff', weight: 600, anchor: 'middle', kn: true })}
  ${card(384, 128, 340, 190)}
  <g transform="translate(554 210)" fill="none" stroke="${C.forest}" stroke-width="4" stroke-linecap="round"><rect x="-22" y="-20" width="44" height="40" rx="5"/><path d="M-11 -30v10M11 -30v10M-22 -6h44"/></g>
  ${txt(554, 288, 'ಕೆಲಸ', { size: 34, fill: C.forest, weight: 600, anchor: 'middle', kn: true })}
  ${txt(28, 372, 'ಈ ತಿಂಗಳು · ಆಗಸ್ಟ್ 2026', { size: 22, fill: C.faint, weight: 600, kn: true })}
  ${tiles.map(([label, value, colour], i) => {
    const x = 28 + (i % 2) * 348
    const y = 396 + Math.floor(i / 2) * 148
    return `${card(x, y, 340, 128)}
      ${txt(x + 24, y + 44, label, { size: 22, fill: C.soft, weight: 600, kn: true })}
      ${txt(x + 24, y + 92, value, { size: 42, fill: colour, weight: 700 })}`
  }).join('')}
  ${txt(28, 738, 'ಖಾತೆ ಶಿಲ್ಕು', { size: 22, fill: C.faint, weight: 600, kn: true })}
  ${card(28, 762, 696, 190)}
  ${[['ಕೈಯಲ್ಲಿನ ನಗದು', '₹4,18,888'], ['ಬ್ಯಾಂಕ್', '₹1,24,500'], ['UPI', '₹8,200']]
    .map(([n, v], i) => `${txt(56, 818 + i * 56, n, { size: 26, weight: 500, kn: true })}
       ${txt(696, 818 + i * 56, v, { size: 26, weight: 600, anchor: 'end' })}`).join('')}
  ${txt(28, 1010, 'ಆದಾಯ ಮತ್ತು ಖರ್ಚು', { size: 22, fill: C.faint, weight: 600, kn: true })}
  ${card(28, 1034, 696, 232)}
  ${[[52, 96], [78, 40], [40, 120], [104, 58], [66, 88], [126, 46]].map(([a, b], i) => {
    const x = 76 + i * 104
    return `${rect(x, 1210 - a, 34, a, C.income, 5)}${rect(x + 38, 1210 - b, 34, b, C.brand, 5)}`
  }).join('')}
  ${appNav(0)}`
}

/** 2 — Recording a sale. Crop, variety, quantity, rate. */
function screenEntry() {
  const chip = (x, y, w, label, on) =>
    `${rect(x, y, w, 62, on ? C.brand : C.card, 31, `stroke="${on ? C.brand : C.border}" stroke-width="1.5"`)}
     ${txt(x + w / 2, y + 41, label, { size: 25, fill: on ? '#fff' : C.soft, weight: on ? 600 : 400, anchor: 'middle', kn: true })}`
  const field = (y, label, value, mono = false) =>
    `${txt(28, y, label, { size: 21, fill: C.soft, weight: 600, kn: true })}
     ${rect(28, y + 14, 696, 78, C.card, 16, `stroke="${C.border}" stroke-width="2"`)}
     ${txt(52, y + 65, value, { size: 29, fill: mono ? C.ink : C.soft, weight: mono ? 600 : 400, kn: !mono })}`

  return `${rect(0, 0, SCREEN_W, SCREEN_H, C.ground)}
  ${appHeader('ಸೇರಿಸಿ')}
  ${chip(28, 124, 218, 'ಆದಾಯ', true)}${chip(258, 124, 218, 'ಖರ್ಚು', false)}${chip(488, 124, 218, 'ವರ್ಗಾವಣೆ', false)}
  ${card(28, 214, 696, 150)}
  ${txt(376, 268, 'ಮೊತ್ತ', { size: 22, fill: C.faint, weight: 600, anchor: 'middle', kn: true })}
  ${txt(376, 336, '₹ 24,500', { size: 58, fill: C.income, weight: 700, anchor: 'middle' })}
  ${field(400, 'ಬೆಳೆ / ಶೀರ್ಷಿಕೆ', 'ಬಾಳೆಕಾಯಿ', true)}
  ${field(516, 'ತಳಿ', 'ಜಿ೯', true)}
  ${txt(28, 646, 'ಜಮೀನು', { size: 21, fill: C.soft, weight: 600, kn: true })}
  ${chip(28, 660, 200, 'ಹೊಸತೋಟ', true)}${chip(240, 660, 200, 'ಮನೆತೋಟ', false)}
  ${txt(28, 782, 'ಪ್ರಮಾಣ', { size: 21, fill: C.soft, weight: 600, kn: true })}
  ${rect(28, 796, 336, 78, C.card, 16, `stroke="${C.border}" stroke-width="2"`)}
  ${txt(52, 847, '350 ಕೆ.ಜಿ', { size: 29, weight: 600, kn: true })}
  ${txt(388, 782, 'ದರ / ಕೆ.ಜಿ', { size: 21, fill: C.soft, weight: 600, kn: true })}
  ${rect(388, 796, 336, 78, C.card, 16, `stroke="${C.border}" stroke-width="2"`)}
  ${txt(412, 847, '₹70', { size: 29, weight: 600 })}
  ${field(898, 'ಯಾವ ಖಾತೆಗೆ ಬಂತು', 'ಕೈಯಲ್ಲಿನ ನಗದು', true)}
  ${rect(28, 1042, 696, 96, C.income, 20)}
  ${txt(376, 1104, 'ಉಳಿಸಿ  ₹24,500', { size: 34, fill: '#fff', weight: 600, anchor: 'middle', kn: true })}
  ${appNav(2)}`
}

/** 3 — Which crop is paying. Income against real cost. */
function screenCrops() {
  const crops = [
    ['ಬಾಳೆಕಾಯಿ', 300, 128],
    ['ಅಡಿಕೆ', 244, 96],
    ['ಕಾಳುಮೆಣಸು', 176, 150],
    ['ತೆಂಗಿನಕಾಯಿ', 120, 54],
    ['ಜೇನುತುಪ್ಪ', 74, 30],
  ]
  return `${rect(0, 0, SCREEN_W, SCREEN_H, C.ground)}
  ${appHeader('ಕೃಷಿ ಖಾತೆ')}
  ${txt(28, 156, 'ಬೆಳೆವಾರು ಲಾಭ ನಷ್ಟ', { size: 22, fill: C.faint, weight: 600, kn: true })}
  ${card(28, 180, 696, 560)}
  ${crops.map(([name, inc, cost], i) => {
    const y = 232 + i * 104
    return `${txt(52, y + 6, name, { size: 24, weight: 500, kn: true })}
      ${rect(52, y + 20, inc * 1.5, 26, C.income, 5)}
      ${rect(52, y + 52, cost * 1.5, 26, C.brand, 5)}`
  }).join('')}
  <g transform="translate(430 706)">
    ${rect(0, -14, 20, 20, C.income, 4)}${txt(30, 3, 'ಆದಾಯ', { size: 21, fill: C.soft, kn: true })}
    ${rect(140, -14, 20, 20, C.brand, 4)}${txt(170, 3, 'ಖರ್ಚು', { size: 21, fill: C.soft, kn: true })}
  </g>
  ${txt(28, 792, 'ಖರ್ಚು ಎಲ್ಲಿ ಹೋಯಿತು', { size: 22, fill: C.faint, weight: 600, kn: true })}
  ${card(28, 816, 696, 452)}
  ${[['ಕೂಲಿ', 340, '₹58,400'], ['ಗೊಬ್ಬರ', 217, '₹37,200'], ['ಔಷಧಿ', 151, '₹25,900'], ['ಸಾಗಾಣಿಕೆ', 96, '₹16,400'], ['ನೀರಾವರಿ', 57, '₹9,700']]
    .map(([name, w, val], i) => {
      const y = 872 + i * 78
      return `${txt(52, y + 4, name, { size: 23, weight: 500, kn: true })}
        ${rect(212, y - 20, w, 34, C.brand, 6)}
        ${txt(700, y + 4, val, { size: 22, fill: C.soft, weight: 600, anchor: 'end' })}`
    }).join('')}
  ${appNav(0)}`
}

/** 4 — The team. Who is owed, and for how many days. */
function screenTeam() {
  const people = [
    ['ರಮೇಶ', 'W001 · 18 ದಿನ', '₹9,000', C.expense, 'ಕೊಡಬೇಕು'],
    ['ಗಣಪತಿ', 'W002 · 12 ದಿನ', '₹4,650', C.expense, 'ಕೊಡಬೇಕು'],
    ['ಸುಶೀಲ', 'W003 · 22 ದಿನ', '₹0', C.faint, 'ಚುಕ್ತಾ'],
    ['ಮಂಜುನಾಥ', 'W004 · 6 ದಿನ', '₹2,000', '#1d4ed8', 'ಮುಂಗಡ'],
    ['ಶಾಂತಾ', 'W005 · 15 ದಿನ', '₹4,000', C.expense, 'ಕೊಡಬೇಕು'],
  ]
  return `${rect(0, 0, SCREEN_W, SCREEN_H, C.ground)}
  ${appHeader('ಕೆಲಸಗಾರರು')}
  ${card(28, 128, 340, 130)}
  ${txt(52, 176, 'ಕೊಡಬೇಕಾದದ್ದು', { size: 21, fill: C.soft, weight: 600, kn: true })}
  ${txt(52, 226, '₹17,650', { size: 40, fill: C.expense, weight: 700 })}
  ${card(384, 128, 340, 130)}
  ${txt(408, 176, 'ಮುಂಗಡ', { size: 21, fill: C.soft, weight: 600, kn: true })}
  ${txt(408, 226, '₹2,000', { size: 40, fill: '#1d4ed8', weight: 700 })}
  ${rect(28, 282, 696, 118, '#fdf3e0', 20, `stroke="#f2cc86" stroke-width="1.5"`)}
  <g transform="translate(70 341)" fill="none" stroke="#8a5605" stroke-width="3" stroke-linecap="round"><path d="M0 -14c8 10 12 15 12 21a12 12 0 01-24 0c0-6 4-11 12-21z"/></g>
  ${txt(110, 328, 'ದರ ನಿಗದಿ ಬಾಕಿ', { size: 25, fill: '#8a5605', weight: 600, kn: true })}
  ${txt(110, 366, '247.5 ಲೀ ಸಿಂಪರಣೆ · ದರ ಒಪ್ಪಿಸಿ', { size: 21, fill: '#8a5605', kn: true })}
  ${txt(28, 448, 'ಖಾತೆ', { size: 22, fill: C.faint, weight: 600, kn: true })}
  ${card(28, 472, 696, 596)}
  ${people.map(([name, meta, amt, colour, state], i) => {
    const y = 528 + i * 116
    return `<circle cx="76" cy="${y + 12}" r="26" fill="${C.brandSoft}"/>
      <g transform="translate(64 ${y}) " fill="none" stroke="${C.brand}" stroke-width="2.4" stroke-linecap="round"><circle cx="12" cy="7" r="7"/><path d="M2 22a10 10 0 0120 0"/></g>
      ${txt(122, y + 6, name, { size: 27, weight: 600, kn: true })}
      ${txt(122, y + 40, meta, { size: 20, fill: C.faint, kn: true })}
      ${txt(700, y + 4, amt, { size: 27, fill: colour, weight: 700, anchor: 'end' })}
      ${txt(700, y + 38, state, { size: 19, fill: colour, anchor: 'end', kn: true })}`
  }).join('')}
  ${appNav(3)}`
}

/** 5 — The statement. A real document with the farm's own letterhead. */
function screenReport() {
  const row = (y, a, b, c) =>
    `${txt(96, y, a, { size: 19, kn: true })}${txt(470, y, b, { size: 19, anchor: 'end' })}${txt(636, y, c, { size: 19, anchor: 'end' })}`
  return `${rect(0, 0, SCREEN_W, SCREEN_H, '#ded5c8')}
  ${rect(0, 0, SCREEN_W, 112, C.card)}${rect(0, 111, SCREEN_W, 1.5, C.border)}
  ${txt(28, 52, 'ಸಂಪೂರ್ಣ ವರದಿ', { size: 28, weight: 600, kn: true })}
  ${txt(28, 88, '2026-08-01 — 2026-08-31', { size: 20, fill: C.faint })}
  ${rect(486, 26, 100, 62, C.card, 14, `stroke="${C.border}" stroke-width="2"`)}
  ${txt(536, 66, 'ಹಿಂದೆ', { size: 22, fill: C.soft, anchor: 'middle', kn: true })}
  ${rect(598, 26, 132, 62, C.brand, 14)}
  ${txt(664, 66, 'Share', { size: 22, fill: '#fff', weight: 600, anchor: 'middle' })}
  <g transform="translate(56 148)">
    ${rect(0, 0, 640, 1180, C.card, 6, 'stroke="#cdbfae" stroke-width="1"')}
    ${rect(28, 28, 584, 76, C.forest, 5)}
    ${mark(52, 40, 40)}
    ${txt(106, 62, 'ತಾಳಿಬಗಿಲು', { size: 25, fill: '#fff', weight: 600, kn: true })}
    ${txt(106, 90, 'Ganapati Adkesar', { size: 17, fill: '#cfe4d6' })}
    ${txt(592, 62, 'ಕೃಷಿ ಖಾತೆ', { size: 15, fill: '#a7cbb5', anchor: 'end', kn: true })}
    ${txt(592, 84, 'Krishi Khata', { size: 15, fill: '#a7cbb5', anchor: 'end' })}
    ${txt(320, 130, 'Yellapur · 9482185679', { size: 16, fill: C.faint, anchor: 'middle' })}
    ${ornament(28, 156, 584)}
    ${txt(320, 208, 'ಸಂಪೂರ್ಣ ವರದಿ', { size: 27, fill: C.forest, weight: 600, anchor: 'middle', kn: true })}
    ${txt(320, 240, '01 ಆಗಸ್ಟ್ 2026 — 31 ಆಗಸ್ಟ್ 2026', { size: 17, fill: C.soft, anchor: 'middle', kn: true })}
    ${[['ಆದಾಯ', '₹3,12,425', C.income], ['ಖರ್ಚು', '₹10,000', C.expense], ['ಉಳಿತಾಯ', '₹3,02,425', C.income], ['ಕೂಲಿ ಬಾಕಿ', '₹17,650', C.ink]]
      .map(([l, v, col], i) => {
        const x = 28 + i * 148
        return `${rect(x, 268, 136, 88, '#faf6ef', 4, 'stroke="#e6dccd" stroke-width="1"')}
          ${rect(x, 268, 136, 3, col)}
          ${txt(x + 12, 300, l, { size: 14, fill: C.soft, kn: true })}
          ${txt(x + 12, 334, v, { size: 21, fill: col, weight: 700 })}`
      }).join('')}
    ${txt(28, 406, 'ಬೆಳೆವಾರು ಲಾಭ', { size: 18, fill: C.forest, weight: 600, kn: true })}
    ${rect(28, 418, 584, 2, C.forest)}
    ${['ಬೆಳೆ'].map(() => `${txt(96, 452, 'ಬೆಳೆ', { size: 15, fill: C.faint, kn: true })}${txt(470, 452, 'ಆದಾಯ', { size: 15, fill: C.faint, anchor: 'end', kn: true })}${txt(636, 452, 'ಲಾಭ', { size: 15, fill: C.faint, anchor: 'end', kn: true })}`).join('')}
    ${[['ಬಾಳೆಕಾಯಿ', '₹1,48,000', '₹92,400'], ['ಅಡಿಕೆ', '₹96,200', '₹61,800'], ['ಕಾಳುಮೆಣಸು', '₹42,300', '₹18,900'], ['ತೆಂಗಿನಕಾಯಿ', '₹18,600', '₹9,200'], ['ಜೇನುತುಪ್ಪ', '₹7,325', '₹4,100']]
      .map(([a, b, c], i) => `${rect(28, 468 + i * 40, 584, 1, '#ece4d8')}${row(496 + i * 40, a, b, c)}`).join('')}
    ${rect(28, 668, 584, 1.6, C.forest)}
    ${txt(96, 696, 'ಒಟ್ಟು', { size: 18, weight: 700, kn: true })}
    ${txt(470, 696, '₹3,12,425', { size: 18, weight: 700, anchor: 'end' })}
    ${txt(636, 696, '₹1,86,400', { size: 18, weight: 700, anchor: 'end' })}
    ${txt(28, 764, 'ಕೂಲಿ ಬಾಕಿ', { size: 18, fill: C.forest, weight: 600, kn: true })}
    ${rect(28, 776, 584, 2, C.forest)}
    ${[['ರಮೇಶ', '18', '₹9,000'], ['ಗಣಪತಿ', '12', '₹4,650'], ['ಶಾಂತಾ', '15', '₹4,000']]
      .map(([a, b, c], i) => `${rect(28, 796 + i * 40, 584, 1, '#ece4d8')}${row(824 + i * 40, a, b, c)}`).join('')}
    ${ornament(28, 986, 584)}
    ${txt(320, 1026, 'ಇದು ಕಂಪ್ಯೂಟರ್‌ನಿಂದ ತಯಾರಾದ ವರದಿ. ಸಹಿ ಅಗತ್ಯವಿಲ್ಲ.', { size: 14, fill: C.faint, anchor: 'middle', kn: true })}
  </g>`
}

/* ------------------------------------------------------------------ *
 * Screenshots
 * ------------------------------------------------------------------ */

const SHOT_W = 1080
const SHOT_H = 1920

/**
 * One screenshot: a headline band, then the phone.
 *
 * The caption sits ABOVE the device because the store scrolls these
 * horizontally at thumbnail size, where the first line of text is often the
 * only thing anybody reads.
 */
function shot(headline, sub, screen) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SHOT_W}" height="${SHOT_H}" viewBox="0 0 ${SHOT_W} ${SHOT_H}">
  <defs>
    <linearGradient id="band" x1="0" y1="0" x2="0.6" y2="1">
      <stop offset="0" stop-color="${C.forest}"/>
      <stop offset="1" stop-color="${C.forestDeep}"/>
    </linearGradient>
  </defs>
  ${rect(0, 0, SHOT_W, SHOT_H, C.ground)}
  ${rect(0, 0, SHOT_W, 560, 'url(#band)')}
  <circle cx="980" cy="90" r="190" fill="${C.leaf}" opacity=".07"/>
  <circle cx="120" cy="470" r="150" fill="${C.brand}" opacity=".08"/>
  ${headline.map((line, i) => txt(SHOT_W / 2, 196 + i * 74, line, { size: 60, fill: '#fff', weight: 700, anchor: 'middle' })).join('')}
  ${txt(SHOT_W / 2, 196 + headline.length * 74 + 26, sub, { size: 32, fill: C.paleGreen, anchor: 'middle' })}
  ${ornament(SHOT_W / 2 - 150, 496, 300)}
  ${(() => {
    /*
     * Scaled to FIT, not cropped.
     *
     * At full size the device ran 144px past the bottom of the canvas and took
     * the navigation bar with it — which is the one part of a screenshot that
     * tells somebody this is an app rather than a web page.
     */
    const top = 566
    const scale = (SHOT_H - top - 26) / (SCREEN_H + 28)
    const w = (SCREEN_W + 28) * scale
    return `<g transform="translate(${(SHOT_W - w) / 2} ${top}) scale(${scale})">${phone(0, 0, screen)}</g>`
  })()}
</svg>`
}

/* ------------------------------------------------------------------ *
 * Feature graphic
 * ------------------------------------------------------------------ */

function featureGraphic() {
  const W = 1024
  const H = 500
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="fg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#164f2d"/>
      <stop offset="0.55" stop-color="${C.forest}"/>
      <stop offset="1" stop-color="${C.forestDeep}"/>
    </linearGradient>
  </defs>
  ${rect(0, 0, W, H, 'url(#fg)')}
  <circle cx="905" cy="70" r="210" fill="${C.leaf}" opacity=".08"/>
  <circle cx="60" cy="450" r="170" fill="${C.brand}" opacity=".10"/>

  <!-- Ruled lines: the ledger this is named after, kept faint. -->
  ${Array.from({ length: 7 }, (_, i) => rect(596, 132 + i * 42, 372, 2, '#ffffff', 1, 'opacity=".06"')).join('')}

  ${mark(132, 74, 106)}

  ${txt(74, 300, 'ಕೃಷಿ ಖಾತೆ', { size: 62, fill: '#fff', weight: 700, kn: true })}
  ${txt(74, 356, 'Krishi Khata', { size: 40, fill: C.brandLight, weight: 600 })}
  ${rect(74, 386, 74, 5, C.brand, 3)}
  ${txt(74, 432, 'A farmer’s ledger. Income, expenses,', { size: 25, fill: C.paleGreen })}
  ${txt(74, 466, 'wages — all offline.', { size: 25, fill: C.paleGreen })}

  <!-- The product, abstracted: the three figures a farmer opens it for. -->
  <g transform="translate(596 112)">
    ${rect(0, 0, 372, 276, '#ffffff', 20, 'opacity=".97"')}
    ${txt(28, 52, 'ಈ ತಿಂಗಳು', { size: 20, fill: C.faint, weight: 600, kn: true })}
    ${txt(28, 104, '₹3,12,425', { size: 44, fill: C.income, weight: 700 })}
    ${txt(28, 134, 'ಆದಾಯ', { size: 19, fill: C.soft, kn: true })}
    ${rect(28, 158, 316, 1.5, C.border)}
    ${[['ಖರ್ಚು', '₹10,000', C.expense], ['ಕೂಲಿ ಬಾಕಿ', '₹17,650', C.ink]]
      .map(([l, v, col], i) => `${txt(28, 196 + i * 46, l, { size: 21, fill: C.soft, kn: true })}
        ${txt(344, 196 + i * 46, v, { size: 23, fill: col, weight: 700, anchor: 'end' })}`).join('')}
  </g>
</svg>`
}

/* ------------------------------------------------------------------ */

function render(svg, name, width) {
  const png = new Resvg(svg, {
    font: { loadSystemFonts: true, defaultFontFamily: LATIN },
    fitTo: { mode: 'width', value: width },
  }).render().asPng()
  writeFileSync(join(out, name), png)
  console.log(`wrote play-assets/${name}  ${(png.length / 1024).toFixed(0)} KB`)
}

render(featureGraphic(), 'feature-graphic-1024x500.png', 1024)

const SHOTS = [
  ['01-home', [['Your whole farm,', 'on one screen']], 'Income, expenses and wages at a glance', screenHome()],
  ['02-entry', [['Record a sale', 'in four taps']], 'The form only asks what that crop needs', screenEntry()],
  ['03-crops', [['Know which crop', 'is actually paying']], 'Income against real cost, wages included', screenCrops()],
  ['04-team', [['Every worker’s', 'days and dues']], 'Day, hourly, piece-rate, lump sum or salary', screenTeam()],
  ['05-report', [['Hand over a', 'real PDF statement']], 'Your own letterhead, Kannada that renders', screenReport()],
]

for (const [name, headline, sub, screen] of SHOTS) {
  render(shot(headline[0], sub, screen), `screenshot-${name}.png`, SHOT_W)
}
