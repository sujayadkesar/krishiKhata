import { readFileSync, mkdirSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer-core'

/**
 * The Play Store listing graphics, in Kannada and English.
 *
 *   npm run capture   (first — takes the real screenshots)
 *   npm run frames    (this — wraps them in the branded frames)
 *
 * BUILT IN A BROWSER, NOT A RASTERISER. Both the app screenshots and these
 * frames are rendered by Chromium, because Chromium is the only thing on hand
 * that shapes Kannada correctly. The SVG rasteriser this used to use dropped
 * the space between Kannada words and mis-formed conjuncts — fine for an
 * English listing, unusable for the Kannada one, which is the listing that
 * matters most for this app.
 *
 * The screenshots are the REAL app with a seeded farm in it, so every figure
 * on them is one the app actually computed.
 */

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const shots = join(root, 'play-assets', 'captures')
const out = join(root, 'play-assets')
mkdirSync(out, { recursive: true })

const EDGE = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
].find((p) => existsSync(p))

if (!EDGE) {
  console.error('No Edge or Chrome found.')
  process.exit(1)
}

const dataUri = (file) =>
  `data:image/png;base64,${readFileSync(join(shots, file)).toString('base64')}`

/* ------------------------------------------------------------------ *
 * Copy
 * ------------------------------------------------------------------ */

/**
 * Kannada headlines are built from the app's own vocabulary wherever
 * possible — the same words the farmer already reads on the screens below
 * them — rather than translated afresh, which is how a listing ends up
 * saying something the interface never says.
 */
const COPY = {
  en: [
    ['home', 'Offline', ['Your whole farm,', 'on one screen'], 'Income, expenses and wages at a glance'],
    ['entry', 'Fast entry', ['Record a sale', 'in four taps'], 'The form only asks what that crop needs'],
    ['team', 'Labour', ['Every worker’s', 'days and dues'], 'Day, hourly, piece-rate, lump sum or salary'],
    ['reports', 'Reports', ['Hand over a', 'real PDF statement'], 'On your own farm’s letterhead'],
    ['entries', 'Everything', ['Every entry,', 'in order'], 'Search by crop, plot, account or date'],
  ],
  kn: [
    ['home', 'ಆಫ್‌ಲೈನ್', ['ಇಡೀ ತೋಟದ ಲೆಕ್ಕ', 'ಒಂದೇ ಕಡೆ'], 'ಆದಾಯ, ಖರ್ಚು ಮತ್ತು ಕೂಲಿ — ಒಂದೇ ನೋಟದಲ್ಲಿ'],
    ['entry', 'ದಾಖಲು', ['ಮಾರಾಟ ದಾಖಲಿಸಲು', 'ಕೆಲವೇ ಸ್ಪರ್ಶ'], 'ಆ ಬೆಳೆಗೆ ಬೇಕಾದ ವಿವರ ಮಾತ್ರ ಕೇಳುತ್ತದೆ'],
    ['team', 'ಕೂಲಿ', ['ಪ್ರತಿ ಕೆಲಸಗಾರನ', 'ದಿನ ಮತ್ತು ಬಾಕಿ'], 'ದಿನ, ಗಂಟೆ, ಅಳತೆ, ಗುತ್ತಿಗೆ ಅಥವಾ ಸಂಬಳ'],
    ['reports', 'ವರದಿ', ['ನಿಜವಾದ PDF ವರದಿ', 'ಕೈಗೆ ಕೊಡಿ'], 'ನಿಮ್ಮದೇ ತೋಟದ ಹೆಸರಿನ ಲೆಟರ್‌ಹೆಡ್'],
    ['entries', 'ಎಲ್ಲವೂ', ['ಪ್ರತಿ ವ್ಯವಹಾರ', 'ಕ್ರಮವಾಗಿ'], 'ಬೆಳೆ, ಜಮೀನು ಅಥವಾ ದಿನಾಂಕದಿಂದ ಹುಡುಕಿ'],
  ],
}

const FEATURE = {
  en: {
    name: 'Krishi Khata',
    tagline: 'The farmer’s ledger',
    body: ['Income, expenses and every worker’s', 'wages — all of it offline.'],
    card: ['THIS MONTH', 'Income', ['Expense', 'Wages due', 'Net']],
  },
  kn: {
    name: 'ಕೃಷಿ ಖಾತೆ',
    tagline: 'ರೈತರ ಲೆಕ್ಕ ಪುಸ್ತಕ',
    body: ['ಆದಾಯ, ಖರ್ಚು ಮತ್ತು ಕೂಲಿ —', 'ಇಂಟರ್ನೆಟ್ ಇಲ್ಲದೆ ಕೆಲಸ ಮಾಡುತ್ತದೆ.'],
    card: ['ಈ ತಿಂಗಳು', 'ಆದಾಯ', ['ಖರ್ಚು', 'ಬಾಕಿ ಕೂಲಿ', 'ಉಳಿತಾಯ']],
  },
}

/* ------------------------------------------------------------------ *
 * The shared look
 * ------------------------------------------------------------------ */

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Kannada:wght@400;600;700&family=Inter:wght@400;600;700&display=swap');

  * { margin: 0; padding: 0; box-sizing: border-box; }

  :root {
    --forest: #12502c;
    --forest-deep: #0a3319;
    --brand: #e35b0d;
    --brand-light: #f4a26c;
    --ground: #fdf7ef;
    --pale: #a7cbb5;
    --leaf: #6fbf3f;
  }

  body {
    font-family: 'Inter', 'Noto Sans Kannada', system-ui, sans-serif;
    -webkit-font-smoothing: antialiased;
  }

  /* Kannada needs its own face and a looser line, because the glyphs carry
     more detail per character and stack marks above and below. */
  body.kn, body.kn .headline, body.kn .eyebrow, body.kn .sub {
    font-family: 'Noto Sans Kannada', 'Inter', sans-serif;
  }

  .shot {
    width: 1080px;
    height: 1920px;
    background: var(--ground);
    position: relative;
    overflow: hidden;
  }

  .band {
    position: absolute;
    inset: 0 0 auto 0;
    height: 592px;
    background:
      radial-gradient(60% 70% at 78% 8%, rgba(111,191,63,.20), transparent 70%),
      linear-gradient(150deg, #17572f 0%, var(--forest) 45%, var(--forest-deep) 100%);
  }
  .band::after {
    content: '';
    position: absolute;
    left: -50px; bottom: -120px;
    width: 352px; height: 352px;
    border-radius: 50%;
    background: var(--brand);
    opacity: .09;
  }

  .cap { position: relative; text-align: center; padding: 0 84px; }

  .eyebrow {
    color: var(--brand-light);
    font-weight: 700;
    font-size: 25px;
    letter-spacing: .3em;
    text-transform: uppercase;
    padding-top: 128px;
  }
  body.kn .eyebrow { letter-spacing: .12em; }

  .headline {
    color: #fff;
    font-weight: 700;
    font-size: 66px;
    line-height: 1.16;
    margin-top: 34px;
    text-wrap: balance;
  }
  body.kn .headline { font-size: 58px; line-height: 1.32; }

  .sub {
    color: var(--pale);
    font-size: 31px;
    line-height: 1.4;
    margin-top: 26px;
  }
  body.kn .sub { font-size: 27px; }

  .orn {
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
    top: 496px;
  }

  /*
   * Sized to FIT, not cropped.
   *
   * The captures are 800x1516, so at any given width the device is 1.895
   * times as tall plus its bezel. At 760px wide that came to 1470px starting
   * at y=558 — a hundred pixels past the bottom of the canvas, taking the
   * navigation bar with it, which is the one element that says "this is an
   * app" rather than a web page.
   */
  .device {
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
    top: 558px;
    width: 714px;
    padding: 14px;
    border-radius: 58px;
    background: linear-gradient(160deg, #3a322a, #221d18 60%);
    box-shadow: 0 26px 54px rgba(58,38,20,.34);
  }
  .device img {
    display: block;
    width: 686px;
    height: auto;
    border-radius: 45px;
  }

  /* ---------------------------------------------------- feature graphic - */

  .feature {
    width: 1024px;
    height: 500px;
    position: relative;
    overflow: hidden;
    background:
      radial-gradient(55% 70% at 85% 6%, rgba(111,191,63,.22), transparent 70%),
      linear-gradient(135deg, #18572f 0%, var(--forest) 50%, var(--forest-deep) 100%);
    display: flex;
    align-items: center;
    gap: 52px;
    padding: 0 64px;
  }
  .feature::after {
    content: '';
    position: absolute;
    left: -110px; bottom: -160px;
    width: 360px; height: 360px;
    border-radius: 50%;
    background: var(--brand);
    opacity: .10;
  }
  .fg-left { position: relative; flex: 1; }
  .fg-mark { width: 118px; height: 118px; display: block; }
  .fg-name { color: #fff; font-weight: 700; font-size: 60px; margin-top: 22px; line-height: 1.05; }
  .fg-rule { width: 78px; height: 5px; background: var(--brand); border-radius: 3px; margin: 18px 0 0; }
  .fg-tag { color: var(--brand-light); font-weight: 600; font-size: 29px; margin-top: 22px; }
  .fg-body { color: var(--pale); font-size: 23px; line-height: 1.42; margin-top: 18px; }
  body.kn .fg-name { font-size: 54px; }
  body.kn .fg-tag { font-size: 26px; }
  body.kn .fg-body { font-size: 21px; }

  .fg-card {
    position: relative;
    width: 358px;
    background: #fff;
    border-radius: 22px;
    padding: 30px;
    box-shadow: 0 14px 30px rgba(4,23,12,.42);
    flex: none;
  }
  .fg-card .k { color: #8b7f71; font-weight: 700; font-size: 16px; letter-spacing: .12em; text-transform: uppercase; }
  .fg-card .big { color: #04796b; font-weight: 700; font-size: 45px; margin-top: 12px; }
  .fg-card .lbl { color: #5b5146; font-size: 19px; margin-top: 4px; }
  .fg-card hr { border: 0; border-top: 1.5px solid #efe4d5; margin: 20px 0; }
  .fg-card .row { display: flex; justify-content: space-between; font-size: 21px; color: #5b5146; margin-top: 16px; }
  .fg-card .row b { font-weight: 700; }
`

/** The ornament from the printed reports, so the listing matches the paper. */
const ORNAMENT = `
<svg width="300" height="28" viewBox="0 0 300 28" xmlns="http://www.w3.org/2000/svg">
  <rect x="0" y="12.6" width="98" height="2.4" fill="#e35b0d" opacity=".5"/>
  <rect x="202" y="12.6" width="98" height="2.4" fill="#e35b0d" opacity=".5"/>
  <path d="M112 13.8 L126 0 L140 13.8 L126 27.6 Z" fill="#e35b0d"/>
  <path d="M146 13.8 L150 9 L154 13.8 L150 18.6 Z" fill="#f4a26c"/>
  <path d="M160 13.8 L174 0 L188 13.8 L174 27.6 Z" fill="#e35b0d"/>
</svg>`

const markSvg = readFileSync(join(root, 'public', 'logo.svg'), 'utf8')

const page = (lang, body) => `<!doctype html><html><head><meta charset="utf-8">
<style>${CSS}</style></head><body class="${lang}">${body}</body></html>`

const shotHtml = (lang, eyebrow, headline, sub, img) => `
<div class="shot">
  <div class="band"></div>
  <div class="cap">
    <div class="eyebrow">${eyebrow}</div>
    <div class="headline">${headline.join('<br>')}</div>
    <div class="sub">${sub}</div>
  </div>
  <div class="orn">${ORNAMENT}</div>
  <div class="device"><img src="${img}"></div>
</div>`

const featureHtml = (f) => `
<div class="feature">
  <div class="fg-left">
    <div class="fg-mark">${markSvg}</div>
    <div class="fg-name">${f.name}</div>
    <div class="fg-rule"></div>
    <div class="fg-tag">${f.tagline}</div>
    <div class="fg-body">${f.body.join('<br>')}</div>
  </div>
  <div class="fg-card">
    <div class="k">${f.card[0]}</div>
    <div class="big">₹3,28,225</div>
    <div class="lbl">${f.card[1]}</div>
    <hr>
    <div class="row"><span>${f.card[2][0]}</span><b style="color:#c62828">₹42,600</b></div>
    <div class="row"><span>${f.card[2][1]}</span><b style="color:#1a1411">₹15,900</b></div>
    <div class="row"><span>${f.card[2][2]}</span><b style="color:#04796b">₹2,85,625</b></div>
  </div>
</div>`

/* ------------------------------------------------------------------ */

const browser = await puppeteer.launch({
  executablePath: EDGE,
  headless: 'new',
  args: ['--hide-scrollbars', '--font-render-hinting=none'],
})

const tab = await browser.newPage()

async function snap(html, width, height, file) {
  await tab.setViewport({ width, height, deviceScaleFactor: 1 })

  /*
   * 'load', not 'networkidle0'.
   *
   * The screenshot frames embed a megabyte of base64 PNG, and the idle
   * heuristic never settles with a data URI that large — the first frame
   * rendered and every one after it timed out. Waiting for the two things
   * that actually matter is both faster and deterministic: the webfonts
   * (Kannada would otherwise rasterise in a fallback face) and the image
   * itself being decoded rather than merely fetched.
   */
  await tab.setContent(html, { waitUntil: 'load', timeout: 60000 })
  await tab.evaluate(async () => {
    await document.fonts.ready
    await Promise.all(
      [...document.images].map((img) => (img.complete ? img.decode().catch(() => {}) : null)),
    )
  })
  await new Promise((r) => setTimeout(r, 200))

  await tab.screenshot({ path: join(out, file), clip: { x: 0, y: 0, width, height } })
  console.log('wrote play-assets/' + file)
}

for (const lang of ['en', 'kn']) {
  const suffix = lang === 'en' ? '' : '-kn'

  await snap(page(lang, featureHtml(FEATURE[lang])), 1024, 500, `feature-graphic${suffix}-1024x500.png`)

  let i = 0
  for (const [name, eyebrow, headline, sub] of COPY[lang]) {
    i += 1
    const img = dataUri(`${lang}-${name}.png`)
    await snap(
      page(lang, shotHtml(lang, eyebrow, headline, sub, img)),
      1080, 1920,
      `screenshot${suffix}-0${i}-${name}.png`,
    )
  }
}

await browser.close()
console.log('\ndone')
