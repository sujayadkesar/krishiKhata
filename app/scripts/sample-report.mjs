import { writeFileSync } from 'node:fs'
import { comprehensiveDoc, labourStatementDoc } from '../src/features/reports/documents.ts'
import { buildPrintDocument } from '../src/lib/printDoc.ts'

/**
 * Render every report against made-up figures, for looking at.
 *
 *   npm run sample -- <output-directory>
 *
 * The documents are pure functions of their data, so the layout can be checked
 * without a phone, a database, or a season's worth of real entries. Useful
 * when changing the stylesheet: a table that overflows or a chart that
 * collapses shows up here in a second rather than after a farmer prints it.
 *
 * The Kannada font is fetched over HTTP in the app and cannot be here, so the
 * output falls back to a system face. Everything else is identical.
 */

const out = process.argv[2] ?? '.'

const name = (row) => (row ? (row.name_kn ?? row.name_en ?? '') : '')

const ctx = {
  profile: {
    farm_name: 'ಶ್ರೀ ಗಣಪತಿ ತೋಟ',
    owner_name: 'Ganapati Bhat',
    village: 'Karadolli, Yellapur',
    phone: '8762759240',
  },
  period: { from: '2026-04-01', to: '2027-03-31' },
  lang: 'both',
  name,
}

const crop = (kn, en, income, direct, labour, qty) => ({
  head_id: en,
  name_en: en,
  name_kn: kn,
  color: null,
  income_paise: income,
  quantity_milli: qty,
  unit_short_en: 'kg',
  unit_short_kn: 'ಕೆ.ಜಿ',
  direct_cost_paise: direct,
  labour_cost_paise: labour,
  total_cost_paise: direct + labour,
  profit_paise: income - direct - labour,
  cost_per_unit_paise: qty ? Math.round(((direct + labour) * 1000) / qty) : null,
  realised_rate_paise: qty ? Math.round((income * 1000) / qty) : null,
})

const crops = [
  crop('ಅಡಿಕೆ', 'Arecanut', 84_50_000, 12_40_000, 21_60_000, 1_240_000),
  crop('ಬಾಳೆಕಾಯಿ', 'Banana', 31_20_000, 6_10_000, 9_80_000, 4_800_000),
  crop('ಕಾಳುಮೆಣಸು', 'Pepper', 18_75_000, 2_30_000, 4_10_000, 310_000),
  crop('ಜೇನುತುಪ್ಪ', 'Honey', 4_60_000, 90_000, 40_000, 62_000),
]

const plots = [
  {
    plot_id: 'p1', name_en: 'Hosatota', name_kn: 'ಹೊಸತೋಟ', survey_no: '114/2',
    area_milli: 3200, area_unit: 'acre',
    income_paise: 78_00_000, direct_cost_paise: 12_00_000, labour_cost_paise: 20_00_000,
    total_cost_paise: 32_00_000, profit_paise: 46_00_000, person_days: 214.5,
  },
  {
    plot_id: 'p2', name_en: 'Halagadde', name_kn: 'ಹಳಗದ್ದೆ', survey_no: '87/1',
    area_milli: 1500, area_unit: 'acre',
    income_paise: 46_20_000, direct_cost_paise: 7_60_000, labour_cost_paise: 12_40_000,
    total_cost_paise: 20_00_000, profit_paise: 26_20_000, person_days: 138,
  },
  {
    plot_id: null, name_en: 'Not recorded', name_kn: 'ದಾಖಲಾಗಿಲ್ಲ', survey_no: null,
    area_milli: null, area_unit: null,
    income_paise: 14_85_000, direct_cost_paise: 2_10_000, labour_cost_paise: 3_10_000,
    total_cost_paise: 5_20_000, profit_paise: 9_65_000, person_days: 41,
  },
]

const income = crops.map((c) => ({
  id: c.head_id, name_en: c.name_en, name_kn: c.name_kn, total: c.income_paise,
}))

const expense = [
  ['ಕೂಲಿ', 'Labour', 35_90_000],
  ['ಗೊಬ್ಬರ', 'Fertilizer & Manure', 11_20_000],
  ['ಸಾಗಾಣಿಕೆ', 'Transport', 4_80_000],
  ['ಔಷಧಿ', 'Pesticide & Spray', 3_40_000],
  ['ಯಂತ್ರ ಮತ್ತು ಇಂಧನ', 'Machinery & Fuel', 2_60_000],
  ['ವಿದ್ಯುತ್', 'Electricity', 1_10_000],
].map(([kn, en, total], i) => ({ id: String(i), name_en: en, name_kn: kn, total }))

const detail = [
  ['ಅಡಿಕೆ', 'Arecanut', 'ಕೂಲಿ', 'Labour', 'ಕೊಯ್ಲು', 'Harvesting', 14_20_000],
  ['ಅಡಿಕೆ', 'Arecanut', 'ಗೊಬ್ಬರ', 'Fertilizer', 'ಗೊಬ್ಬರ ಹಾಕುವುದು', 'Fertilizer application', 7_40_000],
  ['ಬಾಳೆಕಾಯಿ', 'Banana', 'ಕೂಲಿ', 'Labour', 'ಕಳೆ ತೆಗೆಯುವುದು', 'Weeding', 5_90_000],
  ['ಕಾಳುಮೆಣಸು', 'Pepper', 'ಸಾಗಾಣಿಕೆ', 'Transport', 'ವಾಹನ ಬಾಡಿಗೆ', 'Vehicle hire', 2_30_000],
].map(([hk, he, sk, se, ak, ae, total]) => ({
  head_id: he, head_en: he, head_kn: hk, sub_en: se, sub_kn: sk,
  activity_en: ae, activity_kn: ak, total,
}))

const dues = [
  ['ರಮೇಶ', 'Ramesha', 62, 62, 12_40_000, 9_00_000],
  ['ಸಾವಿತ್ರಿ', 'Savitri', 48, 48, 8_64_000, 8_64_000],
  ['ಮಂಜುನಾಥ (ಗುಂಪು)', 'Manjunatha (crew)', 22, 214, 38_52_000, 32_00_000],
].map(([kn, en, days, personDays, earned, paid], i) => ({
  labourer_id: String(i), name_en: en, name_kn: kn, phone: '90000000' + i,
  days, person_days: personDays, earned_paise: earned, paid_paise: paid,
  balance_paise: earned - paid,
}))

const effort = [
  ['ಅಡಿಕೆ', 'Arecanut', 'ಕೊಯ್ಲು', 'Harvesting', 128, 21_60_000],
  ['ಬಾಳೆಕಾಯಿ', 'Banana', 'ಕಳೆ ತೆಗೆಯುವುದು', 'Weeding', 74, 9_80_000],
  ['ಕಾಳುಮೆಣಸು', 'Pepper', 'ಸಿಂಪರಣೆ', 'Spraying', 41, 4_10_000],
].map(([hk, he, ak, ae, personDays, earned]) => ({
  head_en: he, head_kn: hk, activity_en: ae, activity_kn: ak,
  person_days: personDays, earned_paise: earned,
}))

const months = ['04', '05', '06', '07', '08', '09', '10', '11', '12', '01', '02', '03']
const monthly = months.map((m, i) => ({
  month: `${i < 9 ? 2026 : 2027}-${m}`,
  income: [2, 6, 31, 12, 9, 4, 3, 18, 26, 7, 5, 11][i] * 100_000,
  expense: [4, 9, 14, 8, 11, 5, 4, 7, 12, 6, 4, 8][i] * 100_000,
}))

const comprehensive = comprehensiveDoc(ctx, {
  crops, plots, income, expense, detail, dues, effort,
  balances: [
    { name_en: 'Cash in Hand', name_kn: 'ಕೈಯಲ್ಲಿನ ನಗದು', balance_paise: 4_93_000 },
    { name_en: 'SBI-8055', name_kn: 'SBI-8055', balance_paise: 8_95_000 },
  ],
  monthly,
  outstanding: 6_52_000,
})

/* ------------------------------------------------------- one worker - */

const work = Array.from({ length: 14 }, (_, i) => ({
  id: String(i),
  date: `2026-${String(6 + (i % 4)).padStart(2, '0')}-${String(3 + i).padStart(2, '0')}`,
  day_fraction: i % 5 === 0 ? 500 : 1000,
  group_size: i % 3 === 0 ? 12 : 1,
  is_group: i % 3 === 0 ? 1 : 0,
  rate_paise: 45_000,
  amount_paise: (i % 3 === 0 ? 12 : 1) * (i % 5 === 0 ? 22_500 : 45_000),
  head_id: 'Arecanut',
  head_name_en: i % 2 ? 'Arecanut' : 'Banana',
  head_name_kn: i % 2 ? 'ಅಡಿಕೆ' : 'ಬಾಳೆಕಾಯಿ',
  activity_name_en: i % 2 ? 'Harvesting' : 'Weeding',
  activity_name_kn: i % 2 ? 'ಕೊಯ್ಲು' : 'ಕಳೆ ತೆಗೆಯುವುದು',
  paid_paise: 0,
}))

const payments = [
  { id: 'a', date: '2026-06-20', amount_paise: 5_00_000, mode: 'cash', is_advance: 1, direction: 'out', note: 'ಮುಂಗಡ', account_name_en: 'Cash in Hand', account_name_kn: 'ನಗದು', allocated_paise: 0 },
  { id: 'b', date: '2026-07-18', amount_paise: 12_00_000, mode: 'upi', is_advance: 0, direction: 'out', note: null, account_name_en: 'SBI-8055', account_name_kn: 'SBI-8055', allocated_paise: 0 },
  { id: 'c', date: '2026-08-02', amount_paise: 1_00_000, mode: 'cash', is_advance: 0, direction: 'in', note: 'ವಾಪಸ್', account_name_en: 'Cash in Hand', account_name_kn: 'ನಗದು', allocated_paise: 0 },
]

const earned = work.reduce((s, w) => s + w.amount_paise, 0)

const statement = labourStatementDoc(
  ctx,
  { name_en: 'Manjunatha', name_kn: 'ಮಂಜುನಾಥ', phone: '9008812345', code: 'W003' },
  work,
  payments,
  earned - 16_00_000,
  {
    byCrop: [
      { name_en: 'Arecanut', name_kn: 'ಅಡಿಕೆ', person_days: 128, earned_paise: 21_60_000 },
      { name_en: 'Banana', name_kn: 'ಬಾಳೆಕಾಯಿ', person_days: 74, earned_paise: 9_80_000 },
      { name_en: 'Pepper', name_kn: 'ಕಾಳುಮೆಣಸು', person_days: 41, earned_paise: 4_10_000 },
    ],
    monthly: monthly.slice(2, 8).map((m) => ({
      month: m.month,
      earned: Math.round(m.income / 3),
      paid: Math.round(m.expense / 2),
      days: 12,
    })),
  },
)

for (const [file, body, title] of [
  ['sample-comprehensive.html', comprehensive, 'Complete Farm Report'],
  ['sample-worker.html', statement, 'Work & Payment Statement'],
]) {
  const html = await buildPrintDocument(body, title)
  writeFileSync(`${out}/${file}`, html, 'utf8')
  console.log('wrote', `${out}/${file}`)
}
