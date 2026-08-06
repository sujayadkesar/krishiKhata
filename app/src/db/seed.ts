import { one, saveNow, tx } from './db'
import { seedId } from '@/lib/ids'

/**
 * First-run master data.
 *
 * Every seeded row uses a FIXED id derived from its slug. Random ids would
 * give a restored backup a second "Banana" head sitting alongside the original
 * and split every report between them.
 *
 * All of this is editable in Settings — it exists so the farmer can record
 * something within a minute of installing, not because these are the only
 * possible answers. The Kannada is the everyday word rather than the literary
 * one, for the same reason.
 */

const now = () => new Date().toISOString()

type Row = Record<string, string | number | null>

interface SeedTable {
  table: string
  columns: string[]
  rows: Row[]
}

/* ------------------------------------------------------------------ */

const UNITS: [slug: string, en: string, kn: string, shortEn: string, shortKn: string, frac: 0 | 1][] = [
  ['kg', 'Kilogram', 'ಕಿಲೋಗ್ರಾಂ', 'kg', 'ಕೆ.ಜಿ', 1],
  ['quintal', 'Quintal', 'ಕ್ವಿಂಟಾಲ್', 'qtl', 'ಕ್ವಿ', 1],
  ['ton', 'Ton', 'ಟನ್', 't', 'ಟನ್', 1],
  ['bottle', 'Bottle', 'ಬಾಟಲಿ', 'btl', 'ಬಾಟಲಿ', 1],
  ['litre', 'Litre', 'ಲೀಟರ್', 'L', 'ಲೀ', 1],
  ['bunch', 'Bunch', 'ಗೊನೆ', 'bunch', 'ಗೊನೆ', 0],
  ['box', 'Box', 'ಪೆಟ್ಟಿಗೆ', 'box', 'ಪೆಟ್ಟಿಗೆ', 0],
  ['bag', 'Bag', 'ಚೀಲ', 'bag', 'ಚೀಲ', 0],
  ['piece', 'Number', 'ಸಂಖ್ಯೆ', 'no.', 'ಸಂ', 0],
  ['dozen', 'Dozen', 'ಡಜನ್', 'dz', 'ಡಜನ್', 0],
]

const HEADS: [slug: string, en: string, kn: string, use: string, color: string][] = [
  ['banana', 'Banana', 'ಬಾಳೆಕಾಯಿ', 'both', 'amber'],
  ['pepper', 'Pepper', 'ಕಾಳುಮೆಣಸು', 'both', 'rose'],
  ['arecanut', 'Arecanut', 'ಅಡಿಕೆ', 'both', 'orange'],
  ['honey', 'Honey', 'ಜೇನುತುಪ್ಪ', 'both', 'yellow'],
  ['coconut', 'Coconut', 'ತೆಂಗಿನಕಾಯಿ', 'both', 'lime'],
  ['general', 'General / Farm-wide', 'ಸಾಮಾನ್ಯ', 'both', 'slate'],
]

/** Which units each head may be sold in; the first is offered by default. */
const HEAD_UNITS: Record<string, string[]> = {
  banana: ['kg', 'bunch', 'box'],
  pepper: ['kg', 'quintal', 'bag'],
  arecanut: ['kg', 'quintal', 'bag'],
  honey: ['bottle', 'kg', 'litre'],
  coconut: ['piece', 'kg', 'bag'],
  general: ['kg', 'piece'],
}

const SUB_HEADS: [slug: string, en: string, kn: string, isLabour: 0 | 1][] = [
  ['labour', 'Labour', 'ಕೂಲಿ', 1],
  ['fertilizer', 'Fertilizer & Manure', 'ಗೊಬ್ಬರ', 0],
  ['pesticide', 'Pesticide & Spray', 'ಔಷಧಿ', 0],
  ['seeds', 'Seeds & Saplings', 'ಬೀಜ ಮತ್ತು ಸಸಿ', 0],
  ['transport', 'Transport', 'ಸಾಗಾಣಿಕೆ', 0],
  ['machinery', 'Machinery & Fuel', 'ಯಂತ್ರ ಮತ್ತು ಇಂಧನ', 0],
  ['irrigation', 'Irrigation', 'ನೀರಾವರಿ', 0],
  ['tools', 'Tools & Equipment', 'ಸಲಕರಣೆ', 0],
  ['land_lease', 'Land Lease', 'ಗುತ್ತಿಗೆ', 0],
  ['electricity', 'Electricity', 'ವಿದ್ಯುತ್', 0],
  ['repairs', 'Repairs', 'ದುರಸ್ತಿ', 0],
  ['misc', 'Miscellaneous', 'ಇತರೆ', 0],
]

/**
 * The granular work. This is the level the brief asked for: not "labour" but
 * "labour for cutting" as against "labour for spraying".
 */
const ACTIVITIES: [slug: string, en: string, kn: string, subHead: string][] = [
  ['harvest', 'Harvesting / Cutting', 'ಕೊಯ್ಲು', 'labour'],
  ['fert_apply', 'Fertilizer application', 'ಗೊಬ್ಬರ ಹಾಕುವುದು', 'labour'],
  ['spraying', 'Spraying', 'ಔಷಧಿ ಸಿಂಪರಣೆ', 'labour'],
  ['weeding', 'Weeding', 'ಕಳೆ ತೆಗೆಯುವುದು', 'labour'],
  ['pruning', 'Pruning', 'ಕತ್ತರಿಸುವುದು', 'labour'],
  ['planting', 'Planting', 'ನಾಟಿ', 'labour'],
  ['digging', 'Digging pits', 'ಗುಂಡಿ ತೋಡುವುದು', 'labour'],
  ['loading', 'Loading / Unloading', 'ಲೋಡ್ ಮಾಡುವುದು', 'labour'],
  ['watering', 'Watering', 'ನೀರು ಹಾಯಿಸುವುದು', 'labour'],
  ['mulching', 'Mulching', 'ಮಲ್ಚಿಂಗ್', 'labour'],
  ['cleaning', 'Cleaning', 'ಸ್ವಚ್ಛಗೊಳಿಸುವುದು', 'labour'],
  ['watchman', 'Watchman', 'ಕಾವಲು', 'labour'],
  ['goods_purchase', 'Goods purchased', 'ಸಾಮಗ್ರಿ ಖರೀದಿ', 'misc'],
  ['vehicle_hire', 'Vehicle hire', 'ವಾಹನ ಬಾಡಿಗೆ', 'transport'],
]

/* ------------------------------------------------------------------ */

function buildSeed(): SeedTable[] {
  const ts = now()

  const units: Row[] = UNITS.map(([slug, en, kn, se, sk, frac], i) => ({
    id: seedId(`unit:${slug}`),
    name_en: en, name_kn: kn, short_en: se, short_kn: sk,
    allows_fraction: frac, is_active: 1, sort_order: i,
    created_at: ts, updated_at: ts,
  }))

  const heads: Row[] = HEADS.map(([slug, en, kn, use, color], i) => ({
    id: seedId(`head:${slug}`),
    name_en: en, name_kn: kn, used_for: use, color, icon: null,
    is_active: 1, sort_order: i, created_at: ts, updated_at: ts,
  }))

  const headUnits: Row[] = []
  for (const [headSlug, unitSlugs] of Object.entries(HEAD_UNITS)) {
    unitSlugs.forEach((u, i) => {
      headUnits.push({
        head_id: seedId(`head:${headSlug}`),
        unit_id: seedId(`unit:${u}`),
        is_default: i === 0 ? 1 : 0,
      })
    })
  }

  const subHeads: Row[] = SUB_HEADS.map(([slug, en, kn, isLabour], i) => ({
    id: seedId(`sub:${slug}`),
    name_en: en, name_kn: kn, is_labour: isLabour,
    is_active: 1, sort_order: i, created_at: ts, updated_at: ts,
  }))

  const activities: Row[] = ACTIVITIES.map(([slug, en, kn, sub], i) => ({
    id: seedId(`act:${slug}`),
    name_en: en, name_kn: kn, sub_head_id: seedId(`sub:${sub}`),
    is_active: 1, sort_order: i, created_at: ts, updated_at: ts,
  }))

  const accounts: Row[] = [
    {
      id: seedId('acct:cash'),
      name_en: 'Cash in Hand', name_kn: 'ಕೈಯಲ್ಲಿನ ನಗದು', kind: 'cash',
      opening_balance_paise: 0, bank_name: null, account_last4: null,
      is_active: 1, sort_order: 0, created_at: ts, updated_at: ts,
    },
  ]

  return [
    {
      table: 'units',
      columns: ['id', 'name_en', 'name_kn', 'short_en', 'short_kn', 'allows_fraction', 'is_active', 'sort_order', 'created_at', 'updated_at'],
      rows: units,
    },
    {
      table: 'heads',
      columns: ['id', 'name_en', 'name_kn', 'used_for', 'color', 'icon', 'is_active', 'sort_order', 'created_at', 'updated_at'],
      rows: heads,
    },
    { table: 'head_units', columns: ['head_id', 'unit_id', 'is_default'], rows: headUnits },
    {
      table: 'sub_heads',
      columns: ['id', 'name_en', 'name_kn', 'is_labour', 'is_active', 'sort_order', 'created_at', 'updated_at'],
      rows: subHeads,
    },
    {
      table: 'activities',
      columns: ['id', 'name_en', 'name_kn', 'sub_head_id', 'is_active', 'sort_order', 'created_at', 'updated_at'],
      rows: activities,
    },
    {
      table: 'accounts',
      columns: ['id', 'name_en', 'name_kn', 'kind', 'opening_balance_paise', 'bank_name', 'account_last4', 'is_active', 'sort_order', 'created_at', 'updated_at'],
      rows: accounts,
    },
  ]
}

/* ------------------------------------------------------------------ */

/**
 * Insert first-run data if it is not already there.
 *
 * INSERT OR IGNORE, keyed on the fixed ids, so this is safe to run on every
 * launch and safe after a restore. It deliberately does NOT update existing
 * rows: once the farmer has renamed "Banana" or changed its colour, a later
 * app version must not put it back.
 */
export async function seedIfEmpty(): Promise<void> {
  const seeded = await one<{ value: string }>(
    'SELECT value FROM settings WHERE key = ?;',
    ['seeded_version'],
  )
  if (seeded?.value === '1') return

  await tx(async (run) => {
    for (const { table, columns, rows } of buildSeed()) {
      const placeholders = columns.map(() => '?').join(', ')
      const sql = `INSERT OR IGNORE INTO ${table} (${columns.join(', ')}) VALUES (${placeholders});`
      for (const row of rows) {
        await run(sql, columns.map((c) => row[c] ?? null))
      }
    }
    await run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?);', [
      'seeded_version',
      '1',
    ])
  })

  // Seeding is the one write worth flushing immediately: losing it means a
  // farmer opens a brand-new app with no crops and no cash account.
  await saveNow()
}
