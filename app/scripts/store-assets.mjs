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
 * Generated from the app's own tokens — the same palette, mark and ornament
 * the product uses — so the listing cannot drift away from the thing it sells.
 *
 * EVERYTHING HERE IS IN ENGLISH, and that is a decision rather than laziness.
 * The rasteriser's Kannada shaping is not trustworthy: it drops the space
 * between two Kannada words and mis-forms conjuncts, and no combination of
 * xml:space, tspan offsets, hand-measured word placement or alternate Indic
 * fonts fixed it. A listing full of malformed Kannada is the worst possible
 * first impression for an app whose whole claim is that it speaks Kannada
 * properly — far worse than an English listing. The default store listing is
 * en-IN and the app genuinely has an English mode, so this is both honest and
 * clean. For a Kannada (kn-IN) listing, take real captures off a phone: the
 * app's own WebView shapes Kannada correctly.
 *
 * NO REAL PEOPLE. The farm, its village and every worker name are invented.
 * A store listing is public forever.
 */

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const out = join(root, 'play-assets')
mkdirSync(out, { recursive: true })

/* ------------------------------------------------------------------ *
 * The app's own tokens. Kept identical to src/index.css.
 * ------------------------------------------------------------------ */

const C = {
  forest: '#12502c',
  forestMid: '#17572f',
  forestDeep: '#0a3319',
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
  transfer: '#1d4ed8',
  amber: '#fdf3e0',
  amberLine: '#f2cc86',
  amberInk: '#8a5605',
  pale: '#a7cbb5',
}

const FONT = 'Segoe UI'

const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

function txt(x, y, s, { size = 24, fill = C.ink, weight = 400, anchor = 'start', track = 0 } = {}) {
  const ls = track ? ` letter-spacing="${track}"` : ''
  return `<text x="${x}" y="${y}" font-family="${FONT}" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}"${ls}>${esc(s)}</text>`
}

const rect = (x, y, w, h, fill, r = 0, extra = '') =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}" ${extra}/>`

/** The mark, stripped of its own <svg> so it can be placed and scaled. */
function mark(size, x, y) {
  const inner = logoSvg({ size: 64, bare: true }).replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '')
  return `<g transform="translate(${x} ${y}) scale(${size / 64})">${inner}</g>`
}

/**
 * The ornament from the printed reports, reused here.
 *
 * A listing and a statement that share one piece of decoration read as coming
 * from the same place, which is the whole job of a mark.
 */
function ornament(cx, y, w, colour = C.brand, light = C.brandLight) {
  const arm = w / 2 - 52
  return `<g transform="translate(${cx} ${y})">
    <rect x="${-w / 2}" y="-1.2" width="${arm}" height="2.4" fill="${colour}" opacity=".5"/>
    <rect x="${w / 2 - arm}" y="-1.2" width="${arm}" height="2.4" fill="${colour}" opacity=".5"/>
    <path d="M-38 0 L-24 -14 L-10 0 L-24 14 Z" fill="${colour}"/>
    <path d="M-4 0 L0 -5 L4 0 L0 5 Z" fill="${light}"/>
    <path d="M10 0 L24 -14 L38 0 L24 14 Z" fill="${colour}"/>
  </g>`
}

/* ------------------------------------------------------------------ *
 * The device
 * ------------------------------------------------------------------ */

const SCREEN_W = 760
const SCREEN_H = 1440

function phone(screen) {
  return `<g>
    <rect x="0" y="0" width="${SCREEN_W + 30}" height="${SCREEN_H + 30}" rx="62" fill="#221d18"/>
    <rect x="5" y="5" width="${SCREEN_W + 20}" height="${SCREEN_H + 20}" rx="58" fill="#3a322a"/>
    <clipPath id="screenClip"><rect x="15" y="15" width="${SCREEN_W}" height="${SCREEN_H}" rx="50"/></clipPath>
    <g clip-path="url(#screenClip)"><g transform="translate(15 15)">${screen}</g></g>
  </g>`
}

/* ------------------------------------------------------------------ *
 * App chrome
 * ------------------------------------------------------------------ */

function appHeader(title) {
  return `${rect(0, 0, SCREEN_W, 104, C.card)}
    ${rect(0, 103, SCREEN_W, 1.5, C.border)}
    ${mark(48, 26, 28)}
    ${txt(90, 68, title, { size: 32, weight: 600 })}`
}

const NAV = [
  ['Home', 'M4 10.5 12 3.5l8 7V21H4z'],
  ['Entries', 'M5 3h14v18l-3-2-2 2-2-2-2 2-3-2z'],
  ['Add', 'M12 5v14M5 12h14'],
  ['Team', 'M9 11a4 4 0 100-8 4 4 0 000 8zM2 21a7 7 0 0114 0'],
  ['Settings', 'M12 8.5a3.5 3.5 0 100 7 3.5 3.5 0 000-7z'],
]

function appNav(active) {
  const w = SCREEN_W / 5
  const y = SCREEN_H - 124
  return `${rect(0, y, SCREEN_W, 124, C.card)}${rect(0, y, SCREEN_W, 1.5, C.border)}` +
    NAV.map(([label, d], i) => {
      const on = i === active
      const add = i === 2
      const cx = w * i + w / 2
      const colour = on ? C.brand : C.faint
      return `<g transform="translate(${cx} ${y + 38})">
        ${add ? `<circle cx="0" cy="2" r="29" fill="${C.brand}"/>` : ''}
        <g transform="translate(-12 -10)" fill="none" stroke="${add ? '#fff' : colour}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"/></g>
        ${txt(0, 56, label, { size: 19, fill: colour, weight: on ? 600 : 400, anchor: 'middle' })}
      </g>`
    }).join('')
}

const card = (x, y, w, h, fill = C.card) =>
  rect(x, y, w, h, fill, 24, `stroke="${C.border}" stroke-width="1.5"`)

/** A small uppercase section label, as the app uses. */
const label = (x, y, s) =>
  txt(x, y, s.toUpperCase(), { size: 21, fill: C.faint, weight: 600, track: 1.2 })

/* ------------------------------------------------------------------ *
 * Screens
 * ------------------------------------------------------------------ */

function screenHome() {
  const tiles = [
    ['Income', '₹3,12,425', C.income],
    ['Expense', '₹10,000', C.expense],
    ['Net', '₹3,02,425', C.income],
    ['Wages due', '₹17,650', C.expense],
  ]
  const bars = [[62, 104], [88, 44], [46, 128], [112, 62], [72, 96], [136, 50]]
  return `${rect(0, 0, SCREEN_W, SCREEN_H, C.ground)}
  ${appHeader('Krishi Khata')}

  ${rect(30, 136, 342, 196, C.brand, 28)}
  <g transform="translate(201 222)" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round"><path d="M-24 0h48M0 -24v48"/></g>
  ${txt(201, 300, 'Entry', { size: 36, fill: '#fff', weight: 600, anchor: 'middle' })}

  ${card(388, 136, 342, 196)}
  <g transform="translate(559 220)" fill="none" stroke="${C.forest}" stroke-width="4.2" stroke-linecap="round"><rect x="-24" y="-22" width="48" height="44" rx="6"/><path d="M-12 -32v10M12 -32v10M-24 -8h48"/></g>
  ${txt(559, 300, 'Work', { size: 36, fill: C.forest, weight: 600, anchor: 'middle' })}

  ${label(30, 388, 'This month · August')}
  ${tiles.map(([l, v, col], i) => {
    const x = 30 + (i % 2) * 350
    const y = 410 + Math.floor(i / 2) * 152
    return `${card(x, y, 342, 132)}
      ${txt(x + 26, y + 48, l, { size: 23, fill: C.soft, weight: 600 })}
      ${txt(x + 26, y + 98, v, { size: 40, fill: col, weight: 700 })}`
  }).join('')}

  ${label(30, 762, 'Balances')}
  ${card(30, 784, 700, 200)}
  ${[['Cash in hand', '₹4,18,888'], ['Bank', '₹1,24,500'], ['UPI', '₹8,200']]
    .map(([n, v], i) => `${txt(58, 844 + i * 58, n, { size: 27, weight: 500 })}
      ${txt(702, 844 + i * 58, v, { size: 27, weight: 600, anchor: 'end' })}`).join('')}

  ${label(30, 1042, 'Income against expense')}
  ${card(30, 1064, 700, 244)}
  ${bars.map(([a, b], i) => {
    const x = 78 + i * 106
    return `${rect(x, 1252 - a, 36, a, C.income, 6)}${rect(x + 42, 1252 - b, 36, b, C.brand, 6)}`
  }).join('')}
  ${rect(78, 1252, 604, 1.5, C.border)}
  <g transform="translate(470 1292)">
    ${rect(0, -15, 18, 18, C.income, 4)}${txt(28, 0, 'Income', { size: 20, fill: C.soft })}
    ${rect(124, -15, 18, 18, C.brand, 4)}${txt(152, 0, 'Expense', { size: 20, fill: C.soft })}
  </g>
  ${appNav(0)}`
}

function screenEntry() {
  const chip = (x, y, w, t, on) =>
    `${rect(x, y, w, 66, on ? C.brand : C.card, 33, `stroke="${on ? C.brand : C.border}" stroke-width="1.5"`)}
     ${txt(x + w / 2, y + 44, t, { size: 26, fill: on ? '#fff' : C.soft, weight: on ? 600 : 400, anchor: 'middle' })}`
  const field = (y, l, v) =>
    `${label(30, y, l)}
     ${rect(30, y + 16, 700, 84, C.card, 18, `stroke="${C.border}" stroke-width="2"`)}
     ${txt(56, y + 70, v, { size: 30, weight: 600 })}`

  return `${rect(0, 0, SCREEN_W, SCREEN_H, C.ground)}
  ${appHeader('Add entry')}

  ${chip(30, 132, 220, 'Income', true)}${chip(262, 132, 220, 'Expense', false)}${chip(494, 132, 236, 'Transfer', false)}

  ${card(30, 226, 700, 164)}
  ${label(380, 280, 'Amount')}
  ${txt(380, 354, '₹ 24,500', { size: 62, fill: C.income, weight: 700, anchor: 'middle' })}

  ${field(430, 'Crop', 'Banana')}
  ${field(552, 'Variety', 'G9')}

  ${label(30, 690, 'Plot')}
  ${chip(30, 706, 206, 'Hosatota', true)}${chip(248, 706, 206, 'Manetota', false)}

  ${label(30, 834, 'Quantity')}
  ${rect(30, 850, 340, 84, C.card, 18, `stroke="${C.border}" stroke-width="2"`)}
  ${txt(56, 904, '350 kg', { size: 30, weight: 600 })}
  ${label(390, 834, 'Rate / kg')}
  ${rect(390, 850, 340, 84, C.card, 18, `stroke="${C.border}" stroke-width="2"`)}
  ${txt(416, 904, '₹70', { size: 30, weight: 600 })}

  ${field(962, 'Received into', 'Cash in hand')}

  ${rect(30, 1114, 700, 104, C.income, 22)}
  ${txt(380, 1180, 'Save  ₹24,500', { size: 36, fill: '#fff', weight: 600, anchor: 'middle' })}
  ${appNav(2)}`
}

function screenCrops() {
  const crops = [
    ['Banana', 312, 122],
    ['Arecanut', 248, 92],
    ['Pepper', 180, 146],
    ['Coconut', 118, 52],
    ['Honey', 70, 28],
  ]
  const spend = [
    ['Labour', 330, '₹58,400'],
    ['Fertilizer', 210, '₹37,200'],
    ['Spray', 146, '₹25,900'],
    ['Transport', 93, '₹16,400'],
    ['Irrigation', 55, '₹9,700'],
  ]
  return `${rect(0, 0, SCREEN_W, SCREEN_H, C.ground)}
  ${appHeader('Krishi Khata')}

  ${label(30, 164, 'Which crop is paying')}
  ${card(30, 186, 700, 580)}
  ${crops.map(([n, inc, cost], i) => {
    const y = 246 + i * 108
    return `${txt(58, y + 4, n, { size: 25, weight: 500 })}
      ${rect(58, y + 20, inc, 28, C.income, 6)}
      ${rect(58, y + 54, cost, 28, C.brand, 6)}`
  }).join('')}
  <g transform="translate(452 734)">
    ${rect(0, -15, 20, 20, C.income, 4)}${txt(30, 2, 'Income', { size: 22, fill: C.soft })}
    ${rect(130, -15, 20, 20, C.brand, 4)}${txt(160, 2, 'Cost', { size: 22, fill: C.soft })}
  </g>

  ${label(30, 826, 'Where the money went')}
  ${card(30, 848, 700, 460)}
  ${spend.map(([n, w, v], i) => {
    const y = 910 + i * 80
    return `${txt(58, y + 4, n, { size: 24, weight: 500 })}
      ${rect(238, y - 20, w, 34, C.brand, 7)}
      ${txt(702, y + 4, v, { size: 23, fill: C.soft, weight: 600, anchor: 'end' })}`
  }).join('')}
  ${appNav(0)}`
}

function screenTeam() {
  const people = [
    ['Ramesh', 'W001 · 18 days', '₹9,000', C.expense, 'Owed'],
    ['Basava', 'W002 · 12 days', '₹4,650', C.expense, 'Owed'],
    ['Sushila', 'W003 · 22 days', '₹0', C.faint, 'Settled'],
    ['Manjunath', 'W004 · 6 days', '₹2,000', C.transfer, 'Advance'],
    ['Shanta', 'W005 · 15 days', '₹4,000', C.expense, 'Owed'],
  ]
  return `${rect(0, 0, SCREEN_W, SCREEN_H, C.ground)}
  ${appHeader('Team')}

  ${card(30, 136, 342, 138)}
  ${txt(58, 186, 'You owe', { size: 23, fill: C.soft, weight: 600 })}
  ${txt(58, 240, '₹17,650', { size: 42, fill: C.expense, weight: 700 })}
  ${card(388, 136, 342, 138)}
  ${txt(416, 186, 'Advance held', { size: 23, fill: C.soft, weight: 600 })}
  ${txt(416, 240, '₹2,000', { size: 42, fill: C.transfer, weight: 700 })}

  ${rect(30, 300, 700, 126, C.amber, 22, `stroke="${C.amberLine}" stroke-width="1.5"`)}
  <g transform="translate(78 364)" fill="none" stroke="${C.amberInk}" stroke-width="3.2" stroke-linecap="round"><path d="M0 -16c9 11 13 17 13 23a13 13 0 01-26 0c0-6 4-12 13-23z"/></g>
  ${txt(120, 352, 'Waiting to be priced', { size: 27, fill: C.amberInk, weight: 600 })}
  ${txt(120, 392, '247.5 L spraying · set the rate', { size: 22, fill: C.amberInk })}

  ${label(30, 480, 'Khata')}
  ${card(30, 502, 700, 620)}
  ${people.map(([n, meta, amt, col, state], i) => {
    const y = 562 + i * 120
    return `<circle cx="82" cy="${y + 12}" r="28" fill="${C.brandSoft}"/>
      <g transform="translate(69 ${y - 1})" fill="none" stroke="${C.brand}" stroke-width="2.4" stroke-linecap="round"><circle cx="13" cy="8" r="7"/><path d="M2 24a11 11 0 0122 0"/></g>
      ${txt(132, y + 6, n, { size: 28, weight: 600 })}
      ${txt(132, y + 42, meta, { size: 21, fill: C.faint })}
      ${txt(702, y + 4, amt, { size: 28, fill: col, weight: 700, anchor: 'end' })}
      ${txt(702, y + 40, state, { size: 20, fill: col, anchor: 'end' })}`
  }).join('')}
  ${appNav(3)}`
}

function screenReport() {
  const X = 60
  const W = 640
  const row = (y, a, b, c) =>
    `${txt(X + 40, y, a, { size: 20 })}
     ${txt(X + 430, y, b, { size: 20, anchor: 'end' })}
     ${txt(X + 600, y, c, { size: 20, anchor: 'end' })}`

  return `${rect(0, 0, SCREEN_W, SCREEN_H, '#ded5c8')}
  ${rect(0, 0, SCREEN_W, 120, C.card)}${rect(0, 119, SCREEN_W, 1.5, C.border)}
  ${txt(30, 56, 'Complete farm report', { size: 29, weight: 600 })}
  ${txt(30, 94, '01 Aug 2026 — 31 Aug 2026', { size: 21, fill: C.faint })}
  ${rect(486, 28, 104, 64, C.card, 15, `stroke="${C.border}" stroke-width="2"`)}
  ${txt(538, 70, 'Back', { size: 23, fill: C.soft, anchor: 'middle' })}
  ${rect(602, 28, 128, 64, C.brand, 15)}
  ${txt(666, 70, 'Share', { size: 23, fill: '#fff', weight: 600, anchor: 'middle' })}

  ${rect(X, 152, W, 1216, C.card, 6, 'stroke="#c7b9a6" stroke-width="1"')}

  ${rect(X + 26, 180, W - 52, 84, C.forest, 6)}
  ${mark(56, X + 40, 194)}
  ${txt(X + 110, 218, 'Hosatota Farm', { size: 27, fill: '#fff', weight: 600 })}
  ${txt(X + 110, 248, 'Yellapur, Uttara Kannada', { size: 17, fill: '#cfe4d6' })}
  ${txt(X + W - 40, 232, 'Krishi Khata', { size: 16, fill: '#a7cbb5', anchor: 'end' })}

  ${ornament(X + W / 2, 292, W - 52)}
  ${txt(X + W / 2, 344, 'COMPLETE FARM REPORT', { size: 26, fill: C.forest, weight: 700, anchor: 'middle', track: 1 })}
  ${txt(X + W / 2, 378, 'Financial year 2026-27', { size: 19, fill: C.soft, anchor: 'middle' })}

  ${[['INCOME', '₹3,12,425', C.income], ['EXPENSE', '₹10,000', C.expense], ['NET', '₹3,02,425', C.income], ['WAGES DUE', '₹17,650', C.ink]]
    .map(([l, v, col], i) => {
      const x = X + 26 + i * 147
      return `${rect(x, 406, 135, 92, '#faf6ef', 4, 'stroke="#e6dccd" stroke-width="1"')}
        ${rect(x, 406, 135, 3.5, col)}
        ${txt(x + 12, 442, l, { size: 13, fill: C.soft, weight: 600, track: .6 })}
        ${txt(x + 12, 478, v, { size: 21, fill: col, weight: 700 })}`
    }).join('')}

  ${txt(X + 26, 552, 'CROP-WISE PROFIT', { size: 18, fill: C.forest, weight: 700, track: .8 })}
  ${rect(X + 26, 564, W - 52, 2, C.forest)}
  ${txt(X + 40, 598, 'Crop', { size: 15, fill: C.faint, weight: 600 })}
  ${txt(X + 430, 598, 'Income', { size: 15, fill: C.faint, weight: 600, anchor: 'end' })}
  ${txt(X + 600, 598, 'Profit', { size: 15, fill: C.faint, weight: 600, anchor: 'end' })}
  ${[['Banana', '₹1,48,000', '₹92,400'], ['Arecanut', '₹96,200', '₹61,800'], ['Pepper', '₹42,300', '₹18,900'], ['Coconut', '₹18,600', '₹9,200'], ['Honey', '₹7,325', '₹4,100']]
    .map(([a, b, c], i) => `${rect(X + 26, 614 + i * 42, W - 52, 1, '#ece4d8')}${row(644 + i * 42, a, b, c)}`).join('')}
  ${rect(X + 26, 824, W - 52, 1.8, C.forest)}
  ${txt(X + 40, 856, 'Total', { size: 20, weight: 700 })}
  ${txt(X + 430, 856, '₹3,12,425', { size: 20, weight: 700, anchor: 'end' })}
  ${txt(X + 600, 856, '₹1,86,400', { size: 20, weight: 700, anchor: 'end' })}

  ${txt(X + 26, 928, 'WAGES DUE', { size: 18, fill: C.forest, weight: 700, track: .8 })}
  ${rect(X + 26, 940, W - 52, 2, C.forest)}
  ${txt(X + 40, 974, 'Name', { size: 15, fill: C.faint, weight: 600 })}
  ${txt(X + 430, 974, 'Days', { size: 15, fill: C.faint, weight: 600, anchor: 'end' })}
  ${txt(X + 600, 974, 'Balance', { size: 15, fill: C.faint, weight: 600, anchor: 'end' })}
  ${[['Ramesh', '18', '₹9,000'], ['Basava', '12', '₹4,650'], ['Shanta', '15', '₹4,000']]
    .map(([a, b, c], i) => `${rect(X + 26, 990 + i * 42, W - 52, 1, '#ece4d8')}${row(1020 + i * 42, a, b, c)}`).join('')}

  ${ornament(X + W / 2, 1204, W - 52)}
  ${txt(X + W / 2, 1248, 'Computer generated from the farm’s own records.', { size: 15, fill: C.faint, anchor: 'middle' })}
  ${txt(X + W / 2, 1274, 'No signature required.', { size: 15, fill: C.faint, anchor: 'middle' })}`
}

/* ------------------------------------------------------------------ *
 * Screenshot frame
 * ------------------------------------------------------------------ */

const SHOT_W = 1080
const SHOT_H = 1920
const BAND = 592

/**
 * One screenshot: an eyebrow, a headline, then the device.
 *
 * The caption sits ABOVE the phone because the store scrolls these
 * horizontally at thumbnail size, where the first line of text is often the
 * only thing anybody reads. The eyebrow gives each frame a one-word subject,
 * so five screenshots read as a sequence rather than five variations of the
 * same picture.
 */
function shot(eyebrow, headline, sub, screen) {
  const top = BAND - 34
  const scale = (SHOT_H - top - 40) / (SCREEN_H + 30)
  const w = (SCREEN_W + 30) * scale

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SHOT_W}" height="${SHOT_H}" viewBox="0 0 ${SHOT_W} ${SHOT_H}">
  <defs>
    <linearGradient id="band" x1="0.1" y1="0" x2="0.9" y2="1">
      <stop offset="0" stop-color="${C.forestMid}"/>
      <stop offset="1" stop-color="${C.forestDeep}"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.78" cy="0.1" r="0.72">
      <stop offset="0" stop-color="${C.leaf}" stop-opacity=".17"/>
      <stop offset="1" stop-color="${C.leaf}" stop-opacity="0"/>
    </radialGradient>
    <filter id="drop" x="-35%" y="-25%" width="170%" height="150%">
      <feDropShadow dx="0" dy="22" stdDeviation="26" flood-color="#3a2614" flood-opacity="0.30"/>
    </filter>
  </defs>

  ${rect(0, 0, SHOT_W, SHOT_H, C.ground)}
  ${rect(0, 0, SHOT_W, BAND, 'url(#band)')}
  ${rect(0, 0, SHOT_W, BAND, 'url(#glow)')}
  <circle cx="126" cy="${BAND - 46}" r="176" fill="${C.brand}" opacity=".09"/>

  ${txt(SHOT_W / 2, 152, eyebrow.toUpperCase(), { size: 25, fill: C.brandLight, weight: 700, anchor: 'middle', track: 4.5 })}
  ${headline.map((line, i) => txt(SHOT_W / 2, 248 + i * 78, line, { size: 66, fill: '#fff', weight: 700, anchor: 'middle' })).join('')}
  ${txt(SHOT_W / 2, 248 + headline.length * 78 + 20, sub, { size: 31, fill: C.pale, anchor: 'middle' })}
  ${ornament(SHOT_W / 2, BAND - 92, 300)}

  <g transform="translate(${(SHOT_W - w) / 2} ${top}) scale(${scale})" filter="url(#drop)">${phone(screen)}</g>
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
      <stop offset="0" stop-color="#18572f"/>
      <stop offset="0.55" stop-color="${C.forest}"/>
      <stop offset="1" stop-color="${C.forestDeep}"/>
    </linearGradient>
    <radialGradient id="fglow" cx="0.85" cy="0.08" r="0.7">
      <stop offset="0" stop-color="${C.leaf}" stop-opacity=".18"/>
      <stop offset="1" stop-color="${C.leaf}" stop-opacity="0"/>
    </radialGradient>
    <filter id="cardShadow" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="0" dy="12" stdDeviation="18" flood-color="#04170c" flood-opacity="0.45"/>
    </filter>
  </defs>

  ${rect(0, 0, W, H, 'url(#fg)')}
  ${rect(0, 0, W, H, 'url(#fglow)')}
  <circle cx="70" cy="448" r="180" fill="${C.brand}" opacity=".10"/>

  ${mark(118, 64, 72)}
  ${txt(64, 268, 'Krishi Khata', { size: 62, fill: '#fff', weight: 700 })}
  ${rect(66, 292, 78, 5, C.brand, 3)}
  ${txt(64, 350, 'The farmer’s ledger', { size: 30, fill: C.brandLight, weight: 600 })}
  ${txt(64, 402, 'Income, expenses and every worker’s', { size: 23, fill: C.pale })}
  ${txt(64, 434, 'wages — all of it offline.', { size: 23, fill: C.pale })}

  <g transform="translate(614 96)" filter="url(#cardShadow)">
    ${rect(0, 0, 358, 308, '#ffffff', 22)}
    ${txt(30, 56, 'THIS MONTH', { size: 17, fill: C.faint, weight: 700, track: 1.4 })}
    ${txt(30, 110, '₹3,12,425', { size: 46, fill: C.income, weight: 700 })}
    ${txt(30, 140, 'Income', { size: 20, fill: C.soft })}
    ${rect(30, 166, 298, 1.5, C.border)}
    ${[['Expense', '₹10,000', C.expense], ['Wages due', '₹17,650', C.ink], ['Net', '₹3,02,425', C.income]]
      .map(([l, v, col], i) => `${txt(30, 206 + i * 44, l, { size: 22, fill: C.soft })}
        ${txt(328, 206 + i * 44, v, { size: 23, fill: col, weight: 700, anchor: 'end' })}`).join('')}
  </g>
</svg>`
}

/* ------------------------------------------------------------------ */

function render(svg, name, width) {
  const png = new Resvg(svg, {
    font: { loadSystemFonts: true, defaultFontFamily: FONT },
    fitTo: { mode: 'width', value: width },
  }).render().asPng()
  writeFileSync(join(out, name), png)
  console.log(`wrote play-assets/${name}  ${(png.length / 1024).toFixed(0)} KB`)
}

render(featureGraphic(), 'feature-graphic-1024x500.png', 1024)

const SHOTS = [
  ['home', 'Offline', ['Your whole farm,', 'on one screen'], 'Income, expenses and wages at a glance', screenHome],
  ['entry', 'Fast entry', ['Record a sale', 'in four taps'], 'The form only asks what that crop needs', screenEntry],
  ['crops', 'Profit', ['Know which crop', 'is actually paying'], 'Income against real cost, wages included', screenCrops],
  ['team', 'Labour', ['Every worker’s', 'days and dues'], 'Day, hourly, piece-rate, lump sum or salary', screenTeam],
  ['report', 'Reports', ['Hand over a', 'real PDF statement'], 'Your own letterhead, ready to hand over', screenReport],
]

SHOTS.forEach(([slug, eyebrow, headline, sub, screen], i) => {
  render(shot(eyebrow, headline, sub, screen()), `screenshot-0${i + 1}-${slug}.png`, SHOT_W)
})
