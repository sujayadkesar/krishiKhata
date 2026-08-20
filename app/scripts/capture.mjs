import { mkdirSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'
import puppeteer from 'puppeteer-core'

/**
 * Real screenshots of the real app, in both languages.
 *
 *   npm run capture
 *
 * WHY A BROWSER AND NOT THE RASTERISER. The listing graphics used to draw
 * mock-ups of the interface, which was fine in English and unusable in
 * Kannada: resvg drops the space between Kannada words and mis-forms
 * conjuncts, and no amount of coaxing fixed it. Chromium shapes Indic text
 * correctly, and the app is a WebView app — so the honest way to picture it
 * is to run it and take a photograph.
 *
 * It drives the system Edge through puppeteer-core rather than downloading a
 * browser: the engine is already on the machine, and a 150 MB download to
 * take five screenshots is not a reasonable dependency.
 *
 * The dev server is used rather than the built bundle because the dev build
 * exposes `window.__kk`, which is how a farm's worth of believable figures is
 * put in before anything is photographed. An empty app photographs badly.
 */

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const out = join(root, 'play-assets', 'captures')
mkdirSync(out, { recursive: true })

const EDGE = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
].find((p) => existsSync(p))

if (!EDGE) {
  console.error('No Edge or Chrome found. Install one, or set EDGE by hand.')
  process.exit(1)
}

const PORT = 5199
const BASE = `http://localhost:${PORT}`

/**
 * A phone, at the proportions the frame expects.
 *
 * 400 x 758 CSS pixels at 2x gives an 800 x 1516 image — the same 0.528 aspect
 * the device frame is cut to, so nothing is stretched when it is composited.
 */
const VIEW = { width: 400, height: 758, deviceScaleFactor: 2 }

/* ------------------------------------------------------------------ *
 * A farm worth photographing
 * ------------------------------------------------------------------ */

/**
 * Runs INSIDE the page. Everything here goes through the app's own data
 * layer, so what gets photographed is what the app would really compute —
 * balances, allocations, crop profit and all.
 */
async function seed() {
  const { masterData, entries, labour, db } = window.__kk

  const already = await db.all("SELECT value FROM settings WHERE key = 'demo_seeded';")
  if (already.length) return 'already seeded'

  const heads = await masterData.listHeads(false)
  const accounts = await masterData.listAccounts(false)
  const units = await masterData.listUnits(false)
  const subs = await masterData.listSubHeads(false)
  const cash = accounts[0].id

  const head = (n) => heads.find((h) => h.name_en === n)?.id ?? null
  const unit = (n) => units.find((u) => u.short_en === n)?.id ?? units[0].id
  const sub = (n) => subs.find((s) => s.name_en.startsWith(n))?.id ?? null

  // Two plots, so the plot-wise figures mean something.
  const plotA = await masterData.savePlot({
    name_en: 'Hosatota', name_kn: 'ಹೊಸತೋಟ', survey_no: '112/2',
    area_milli: 3200, area_unit: 'acre', village: null, note: null,
  })
  await masterData.savePlot({
    name_en: 'Manetota', name_kn: 'ಮನೆತೋಟ', survey_no: '88/1',
    area_milli: 1500, area_unit: 'acre', village: null, note: null,
  })

  // Varieties under banana, which is the case the two-level model exists for.
  const banana = head('Banana')
  const varieties = await masterData.listSubHeadsFor(banana, 'income')
  const g9 = varieties.find((v) => v.name_en === 'G9')?.id ?? null

  const sale = (date, crop, amount, qty, u, variety) =>
    entries.saveEntry({
      kind: 'income', date, head_id: head(crop), sub_head_id: variety ?? null,
      plot_id: plotA, account_id: cash, quantity_milli: qty, unit_id: unit(u),
      rate_paise: qty ? Math.round((amount / qty) * 1000) : null,
      amount_paise: amount, party_name: null, note: null,
    })

  const spend = (date, crop, kind, amount) =>
    entries.saveEntry({
      kind: 'expense', date, head_id: head(crop), sub_head_id: sub(kind),
      plot_id: plotA, account_id: cash, amount_paise: amount,
      party_name: null, note: null,
    })

  const M = ['2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08']
  const sales = [
    ['Banana', [148000, 96000, 172000, 121000, 205000, 164000], 'kg', g9],
    ['Arecanut', [0, 84000, 0, 132000, 0, 96200], 'kg', null],
    ['Pepper', [42000, 0, 38000, 0, 51000, 42300], 'kg', null],
    ['Coconut', [18600, 12400, 0, 21000, 0, 18600], 'no.', null],
    ['Honey', [7325, 0, 5400, 0, 8100, 7325], 'btl', null],
  ]
  for (const [crop, amounts, u, variety] of sales) {
    amounts.forEach((a, i) => {
      if (!a) return
      void sale(`${M[i]}-14`, crop, a * 100, Math.round((a / 70) * 1000), u, variety)
    })
  }

  const spends = [
    ['Banana', 'Fertilizer', [12000, 9000, 14000, 8000, 16000, 11000]],
    ['Banana', 'Pesticide', [8000, 0, 9500, 0, 7200, 6100]],
    ['Arecanut', 'Transport', [4500, 3800, 0, 5200, 0, 4100]],
    ['Pepper', 'Irrigation', [0, 3200, 0, 2800, 0, 3700]],
    ['Coconut', 'Machinery', [5400, 0, 6200, 0, 4800, 0]],
  ]
  for (const [crop, kind, amounts] of spends) {
    amounts.forEach((a, i) => {
      if (!a) return
      void spend(`${M[i]}-20`, crop, kind, a * 100)
    })
  }

  // People, and enough work and payment that every state is visible: owed,
  // settled, holding an advance, and a spraying job still to be priced.
  const people = [
    ['Ramesh', 'ರಮೇಶ', 50000],
    ['Basava', 'ಬಸವ', 45000],
    ['Sushila', 'ಸುಶೀಲ', 40000],
    ['Manjunath', 'ಮಂಜುನಾಥ', 55000],
    ['Shanta', 'ಶಾಂತಾ', 40000],
  ]
  const ids = []
  for (const [en, kn, rate] of people) {
    ids.push(await masterData.saveLabourer({
      name_en: en, name_kn: kn, phone: null, village: null, is_group_lead: 0,
      employment: 'casual', monthly_salary_paise: null, daily_rate_paise: rate,
      half_day_rate_paise: null, female_rate_paise: null,
      typical_group_size: null, note: null,
    }))
  }

  const day = (i, n) =>
    Array.from({ length: n }, (_, k) => ({
      labourer_id: ids[i], date: `2026-08-${String(k + 2).padStart(2, '0')}`,
      day_fraction: 1000, is_group: 0,
      daily_rate_paise: people[i][2], half_day_rate_paise: null,
      male_count: 1, female_count: 0,
      male_rate_paise: people[i][2], female_rate_paise: 0,
    }))

  for (let i = 0; i < 5; i++) {
    await labour.saveWorkSession({
      head_id: banana, activity_id: null, sub_head_id: sub('Labour'),
      plot_id: plotA, note: null, days: day(i, [18, 12, 22, 6, 15][i]),
    })
  }

  // Paid in full, part-paid, over-paid (an advance), and untouched.
  await labour.recordPayment({ labourer_id: ids[2], date: '2026-08-28', account_id: cash, amount_paise: 22 * 40000, mode: 'cash', note: null, sub_head_id: sub('Labour') })
  await labour.recordPayment({ labourer_id: ids[0], date: '2026-08-26', account_id: cash, amount_paise: 9 * 50000, mode: 'cash', note: null, sub_head_id: sub('Labour') })
  await labour.recordPayment({ labourer_id: ids[3], date: '2026-08-27', account_id: cash, amount_paise: 8 * 55000, mode: 'cash', note: null, sub_head_id: sub('Labour') })

  // A spraying job, litres recorded, price not yet agreed.
  await labour.saveWorkSession({
    head_id: banana, activity_id: null, sub_head_id: sub('Labour'), plot_id: plotA,
    basis: 'piece', unit_id: unit('L'), rate_paise: null, note: null,
    days: [
      { labourer_id: ids[1], date: '2026-08-21', day_fraction: 1000, is_group: 0, daily_rate_paise: 0, half_day_rate_paise: null, male_count: 1, female_count: 0, male_rate_paise: 0, female_rate_paise: 0, quantity_milli: 120000 },
      { labourer_id: ids[1], date: '2026-08-22', day_fraction: 1000, is_group: 0, daily_rate_paise: 0, half_day_rate_paise: null, male_count: 1, female_count: 0, male_rate_paise: 0, female_rate_paise: 0, quantity_milli: 127500 },
    ],
  })

  await masterData.saveFarmProfile({
    farm_name: 'Hosatota Farm', owner_name: '', village: 'Yellapur', phone: '',
  })
  await masterData.setSetting('demo_seeded', '1')
  await db.saveNow()
  return 'seeded'
}

/* ------------------------------------------------------------------ */

function waitForServer(url, tries = 60) {
  return new Promise((resolve, reject) => {
    const tick = async (n) => {
      try {
        const res = await fetch(url)
        if (res.ok) return resolve()
      } catch {
        // not up yet
      }
      if (n <= 0) return reject(new Error('dev server did not start'))
      setTimeout(() => tick(n - 1), 500)
    }
    tick(tries)
  })
}

const vite = spawn(
  process.platform === 'win32' ? 'npx.cmd' : 'npx',
  ['vite', '--port', String(PORT), '--strictPort'],
  { cwd: root, stdio: 'ignore', shell: process.platform === 'win32' },
)

const shutdown = () => {
  try { vite.kill() } catch { /* already gone */ }
}
process.on('exit', shutdown)
process.on('SIGINT', () => { shutdown(); process.exit(1) })

await waitForServer(BASE)

const browser = await puppeteer.launch({
  executablePath: EDGE,
  headless: 'new',
  args: ['--force-device-scale-factor=2', '--hide-scrollbars', '--font-render-hinting=none'],
})

const page = await browser.newPage()
await page.setViewport(VIEW)

// Language first, so the app boots straight into it and nothing has to
// re-render mid-capture.
await page.goto(BASE, { waitUntil: 'networkidle2' })
await page.evaluate(() => localStorage.setItem('kk.lang', 'kn'))
await page.reload({ waitUntil: 'networkidle2' })

// The dev handle is attached asynchronously after the bundle loads.
await page.waitForFunction('window.__kk && window.__kk.db', { timeout: 30000 })
console.log('seed:', await page.evaluate(seed))

const SHOTS = [
  ['home', '/'],
  ['entry', '/add'],
  ['team', '/labour'],
  ['reports', '/reports'],
  ['entries', '/entries'],
]

for (const lang of ['kn', 'en']) {
  await page.evaluate((l) => localStorage.setItem('kk.lang', l), lang)

  for (const [name, route] of SHOTS) {
    await page.goto(`${BASE}/#${route}`, { waitUntil: 'networkidle2' })
    await page.reload({ waitUntil: 'networkidle2' })
    // Recharts animates in; give it a beat to settle.
    await new Promise((r) => setTimeout(r, 1400))

    const file = join(out, `${lang}-${name}.png`)
    await page.screenshot({ path: file })
    console.log('captured', `captures/${lang}-${name}.png`)
  }
}

await browser.close()
shutdown()
console.log('\ndone — real screenshots in play-assets/captures/')
