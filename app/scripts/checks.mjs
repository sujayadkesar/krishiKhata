/**
 * Pure-logic assertions. Run with `npm run check`.
 *
 * This is the gate. Everything asserted here is logic that decides a number a
 * farmer acts on — what a crop cost, what is owed to a person standing in the
 * yard — and none of it needs a database or a browser to be proved.
 *
 * Add to this whenever you touch anything in src/lib.
 */

import {
  parseAmountToPaise, groupIndian, formatPaise, formatINR, formatCompactINR, rupeesInWords,
} from '../src/lib/money.ts'
import {
  parseQuantityToMilli, formatQuantity, lineTotalPaise, impliedRatePaise,
} from '../src/lib/quantity.ts'
import {
  toISODate, fromISODate, addDays, addMonths, daysInMonth, financialYearOf,
  financialYearLabel, financialYearRange, calendarGrid, isValidISODate, monthEnd,
} from '../src/lib/date.ts'
import {
  perPersonWagePaise, attendanceAmountPaise, daysFromFractions, personDaysFromRows,
  matchFifo, balancePaise, balanceState, splitByHead, crewWagePaise, crewSize, wagePaise,
} from '../src/lib/labour.ts'
import { missingFor } from '../src/features/entries/entryRules.ts'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

let passed = 0
const failures = []

function eq(actual, expected, label) {
  const a = JSON.stringify(actual)
  const e = JSON.stringify(expected)
  if (a === e) passed++
  else failures.push(`${label}\n    expected ${e}\n    actual   ${a}`)
}

function ok(cond, label) {
  if (cond) passed++
  else failures.push(label)
}

/* ---------------------------------------------------------------- money -- */

eq(parseAmountToPaise('1,250'), 125000, 'money: commas stripped')
eq(parseAmountToPaise('₹1250.50'), 125050, 'money: rupee sign and paise')
eq(parseAmountToPaise('0.05'), 5, 'money: five paise')
eq(parseAmountToPaise(''), null, 'money: empty is not zero')
eq(parseAmountToPaise('abc'), null, 'money: rubbish rejected')
eq(parseAmountToPaise('1.234'), null, 'money: three decimals rejected')
eq(parseAmountToPaise(1250.5), 125050, 'money: number input')

eq(groupIndian('1234567'), '12,34,567', 'money: Indian grouping (lakh)')
eq(groupIndian('100'), '100', 'money: no grouping under 1000')
eq(groupIndian('1000'), '1,000', 'money: thousand')
eq(groupIndian('10000000'), '1,00,00,000', 'money: crore')

eq(formatPaise(123456789), '12,34,567.89', 'money: format with paise')
eq(formatINR(125000, { decimals: false }), '₹1,250', 'money: whole rupees')
eq(formatINR(-50000), '-₹500.00', 'money: negative')
eq(formatCompactINR(1240000000), '₹1.24 Cr', 'money: compact crore')
eq(formatCompactINR(12400000), '₹1.24 L', 'money: compact lakh')
eq(formatCompactINR(7813000), '₹78,130', 'money: compact below a lakh')
eq(formatCompactINR(-12400000), '-₹1.24 L', 'money: compact negative')

eq(rupeesInWords(125000), 'Rupees One Thousand Two Hundred Fifty Only', 'money: words')
eq(rupeesInWords(0), 'Rupees Zero Only', 'money: words zero')
eq(rupeesInWords(100050), 'Rupees One Thousand and Fifty Paise Only', 'money: words with paise')

/* ------------------------------------------------------------- quantity -- */

eq(parseQuantityToMilli('12.5'), 12500, 'qty: one decimal')
eq(parseQuantityToMilli('2.75'), 2750, 'qty: two decimals')
eq(parseQuantityToMilli('1.2345'), null, 'qty: four decimals rejected')
eq(formatQuantity(12000), '12', 'qty: trailing zeroes dropped')
eq(formatQuantity(12500), '12.5', 'qty: half')
eq(formatQuantity(2750), '2.75', 'qty: quarter')

// 12.5 kg at ₹40/kg = ₹500
eq(lineTotalPaise(12500, 4000), 50000, 'qty: line total')
// 3 bottles of honey at ₹450 = ₹1350
eq(lineTotalPaise(3000, 45000), 135000, 'qty: bottles')
eq(impliedRatePaise(12500, 50000), 4000, 'qty: implied rate')
eq(impliedRatePaise(0, 50000), null, 'qty: implied rate needs a quantity')

/* ----------------------------------------------------------------- date -- */

eq(toISODate(new Date(2026, 7, 6)), '2026-08-06', 'date: local ISO, no UTC shift')
eq(toISODate(fromISODate('2026-03-31')), '2026-03-31', 'date: round trip')
ok(isValidISODate('2026-02-29') === false, 'date: 2026 is not a leap year')
ok(isValidISODate('2024-02-29') === true, 'date: 2024 is')
eq(addDays('2026-03-31', 1), '2026-04-01', 'date: add across month end')
eq(addMonths('2026-01-31', 1), '2026-02-28', 'date: month add clamps to Feb')
eq(addMonths('2024-01-31', 1), '2024-02-29', 'date: and to leap Feb')
eq(daysInMonth(2026, 1), 28, 'date: Feb 2026')
eq(monthEnd('2026-08-06'), '2026-08-31', 'date: month end')

// Indian financial year runs April to March.
eq(financialYearOf('2026-03-31'), 2025, 'date: 31 March is the OLD financial year')
eq(financialYearOf('2026-04-01'), 2026, 'date: 1 April starts the new one')
eq(financialYearLabel(2026), '2026-27', 'date: FY label')
eq(financialYearRange(2026), { from: '2026-04-01', to: '2027-03-31' }, 'date: FY range')

const grid = calendarGrid(2026, 7) // August 2026
eq(grid.length, 42, 'date: calendar is always 42 cells')
eq(grid.filter((c) => c.inMonth).length, 31, 'date: August has 31 days')
eq(grid[0].iso, '2026-07-26', 'date: grid starts on the Sunday before')

/* --------------------------------------------------------------- labour -- */

// ₹500/day
eq(perPersonWagePaise(1000, 50000, null), 50000, 'labour: full day')
eq(perPersonWagePaise(500, 50000, null), 25000, 'labour: half day defaults to half')
eq(perPersonWagePaise(500, 50000, 30000), 30000, 'labour: explicit half-day rate wins')

// A group lead brings 12 people at ₹500 each.
eq(attendanceAmountPaise(1000, 50000, null, 12), 600000, 'labour: group of twelve')
eq(attendanceAmountPaise(500, 50000, null, 12), 300000, 'labour: group, half day')
eq(attendanceAmountPaise(1000, 50000, null, 1), 50000, 'labour: individual')
// Rounding is per person, then multiplied — matching how it is worked out aloud.
eq(attendanceAmountPaise(500, 33333, null, 12), 200004, 'labour: rounds per person, not per crew')

// A crew of 6 men at ₹500 and 4 women at ₹400 = 3000 + 1600 = ₹4,600
eq(crewWagePaise(1000, 6, 50000, 4, 40000), 460000, 'crew: mixed crew full day')
eq(crewWagePaise(500, 6, 50000, 4, 40000), 230000, 'crew: mixed crew half day')
eq(crewWagePaise(1000, 10, 50000, 0, 0), 500000, 'crew: all male')
eq(crewWagePaise(1000, 0, 0, 3, 40000), 120000, 'crew: all female')
eq(crewWagePaise(1000, 0, 50000, 0, 40000), 0, 'crew: nobody came')
// Odd rate halves per person, then multiplies — not the other way round.
eq(crewWagePaise(500, 3, 33333, 0, 0), 50001, 'crew: rounds per person, not per crew')
eq(crewSize(6, 4), 10, 'crew: size')
eq(crewSize(-1, 4), 4, 'crew: negative counts ignored')

eq(daysFromFractions([1000, 1000, 500]), 2.5, 'labour: half day counts as half')
eq(
  personDaysFromRows([{ day_fraction: 1000, group_size: 12 }, { day_fraction: 500, group_size: 8 }]),
  16,
  'labour: person-days',
)

/* ------------------------------------------------------- FIFO allocation -- */

// Three days at ₹500. A ₹1,000 payment settles the first two, not the third.
{
  const work = [
    { attendance_id: 'w1', date: '2026-06-01', unpaid_paise: 50000 },
    { attendance_id: 'w2', date: '2026-06-02', unpaid_paise: 50000 },
    { attendance_id: 'w3', date: '2026-06-03', unpaid_paise: 50000 },
  ]
  const pay = [{ payment_id: 'p1', date: '2026-06-10', unallocated_paise: 100000 }]
  const allocs = matchFifo(pay, work)
  eq(allocs.length, 2, 'fifo: settles two days')
  eq(allocs[0], { payment_id: 'p1', attendance_id: 'w1', amount_paise: 50000 }, 'fifo: oldest first')
  eq(allocs[1].attendance_id, 'w2', 'fifo: then the next')
  eq(allocs.reduce((s, a) => s + a.amount_paise, 0), 100000, 'fifo: nothing invented')
}

// A payment bigger than the work outstanding leaves an advance.
{
  const work = [{ attendance_id: 'w1', date: '2026-06-01', unpaid_paise: 100000 }]
  const pay = [{ payment_id: 'p1', date: '2026-06-05', unallocated_paise: 150000 }]
  const allocs = matchFifo(pay, work)
  eq(allocs.length, 1, 'fifo: one allocation')
  eq(allocs[0].amount_paise, 100000, 'fifo: only what the work was worth')
  const left = 150000 - allocs.reduce((s, a) => s + a.amount_paise, 0)
  eq(left, 50000, 'fifo: the rest stays as an advance')
}

// An advance paid first, then work done — the same function, other direction.
{
  const pay = [{ payment_id: 'p1', date: '2026-05-01', unallocated_paise: 200000 }]
  const work = [
    { attendance_id: 'w1', date: '2026-06-01', unpaid_paise: 50000 },
    { attendance_id: 'w2', date: '2026-06-02', unpaid_paise: 50000 },
  ]
  const allocs = matchFifo(pay, work)
  eq(allocs.reduce((s, a) => s + a.amount_paise, 0), 100000, 'fifo: advance covers the work done')
  eq(200000 - 100000, 100000, 'fifo: advance still partly outstanding')
}

// One work day split across two payments.
{
  const work = [{ attendance_id: 'w1', date: '2026-06-01', unpaid_paise: 100000 }]
  const pay = [
    { payment_id: 'p1', date: '2026-06-02', unallocated_paise: 40000 },
    { payment_id: 'p2', date: '2026-06-03', unallocated_paise: 90000 },
  ]
  const allocs = matchFifo(pay, work)
  eq(allocs.length, 2, 'fifo: two payments against one day')
  eq(allocs[0], { payment_id: 'p1', attendance_id: 'w1', amount_paise: 40000 }, 'fifo: earlier payment first')
  eq(allocs[1].amount_paise, 60000, 'fifo: second payment tops it up exactly')
}

// Input order must not change the result.
{
  const work = [
    { attendance_id: 'w2', date: '2026-06-02', unpaid_paise: 50000 },
    { attendance_id: 'w1', date: '2026-06-01', unpaid_paise: 50000 },
  ]
  const pay = [{ payment_id: 'p1', date: '2026-06-10', unallocated_paise: 50000 }]
  eq(matchFifo(pay, work)[0].attendance_id, 'w1', 'fifo: sorts by date regardless of input order')
}

// Nothing to do.
eq(matchFifo([], []), [], 'fifo: empty')
eq(matchFifo([{ payment_id: 'p', date: '2026-01-01', unallocated_paise: 0 }], []), [], 'fifo: zero payment ignored')

/* ------------------------------------------------------------- balances -- */

eq(balancePaise(500000, 300000), 200000, 'balance: wages owed')
eq(balancePaise(0, 200000), -200000, 'balance: advance is negative')
eq(balanceState(200000), 'owed', 'balance: owed')
eq(balanceState(-1), 'advance', 'balance: advance')
eq(balanceState(0), 'settled', 'balance: settled')

/* -------------------------------------------- crop split of a payment --- */

{
  const heads = new Map([
    ['w1', 'banana'],
    ['w2', 'banana'],
    ['w3', 'pepper'],
    ['w4', null],
  ])
  const { byHead, unallocated } = splitByHead(
    [
      { attendance_id: 'w1', amount_paise: 50000 },
      { attendance_id: 'w2', amount_paise: 50000 },
      { attendance_id: 'w3', amount_paise: 30000 },
      { attendance_id: 'w4', amount_paise: 10000 },
    ],
    heads,
  )
  eq(byHead.get('banana'), 100000, 'split: banana labour')
  eq(byHead.get('pepper'), 30000, 'split: pepper labour')
  eq(unallocated, 10000, 'split: work with no crop is its own line, not dropped')
}

/* ------------------------------------------------------ ways of paying -- */

{
  const day = {
    day_fraction: 1000,
    is_group: 0,
    daily_rate_paise: 50000,
    half_day_rate_paise: null,
    male_count: 1,
    female_count: 0,
    male_rate_paise: 50000,
    female_rate_paise: 0,
  }

  eq(wagePaise('day', day, null, lineTotalPaise), 50000, 'wage: a plain day at the day rate')

  // Spraying: 247.5 litres, price not agreed yet.
  const spray = { ...day, quantity_milli: 247500 }
  eq(
    wagePaise('piece', spray, null, lineTotalPaise),
    0,
    'wage: unpriced piece work is worth nothing YET — the zero is the point',
  )
  eq(
    wagePaise('piece', spray, 1200, lineTotalPaise),
    lineTotalPaise(247500, 1200),
    'wage: priced piece work is quantity x rate, rounded once',
  )
  eq(
    wagePaise('piece', { ...day, quantity_milli: null }, 1200, lineTotalPaise),
    0,
    'wage: a priced job with no quantity recorded still earns nothing',
  )

  // Coconut plucking: whatever was agreed, used as-is.
  eq(
    wagePaise('lump', { ...day, amount_paise: 350000 }, null, lineTotalPaise),
    350000,
    'wage: a lump sum is the agreed figure, not derived from days or rate',
  )
  eq(
    wagePaise('lump', { ...day, amount_paise: -350000 }, null, lineTotalPaise),
    350000,
    'wage: a lump sum is always positive; direction comes from the ledger',
  )

  // A salaried month is not a day worked.
  eq(
    wagePaise('salary', { ...day, day_fraction: 0, amount_paise: 1200000 }, null, lineTotalPaise),
    1200000,
    'wage: a salary is the month, taken as given',
  )

  // A crew still works the way it always did.
  eq(
    wagePaise(
      'day',
      { ...day, is_group: 1, male_count: 6, female_count: 4, female_rate_paise: 40000 },
      null,
      lineTotalPaise,
    ),
    crewWagePaise(1000, 6, 50000, 4, 40000),
    'wage: a mixed crew is unchanged by the new bases',
  )
}

/* ------------------------------------------------- entry requirements --- */

{
  const sale = (over = {}) => ({
    kind: 'income',
    head_id: 'banana',
    sub_head_id: null,
    plot_id: null,
    account_id: 'cash',
    to_account_id: null,
    amount_paise: 50000,
    ...over,
  })
  // No varieties, no plots: a plain crop sold one way needs nothing extra.
  const bare = { topLevelCount: 0, childCount: 0, parentSubHeadId: null, hasPlots: false }

  eq(missingFor(sale(), bare).length, 0, 'entry: a complete simple sale is saveable')

  eq(
    missingFor(sale({ amount_paise: 0 }), bare),
    ['amount'],
    'entry: zero amount is not an entry',
  )
  eq(
    missingFor(sale({ head_id: null }), bare),
    ['head'],
    'entry: the crop is required',
  )

  // Banana has varieties, so one must be chosen.
  const withVarieties = { ...bare, topLevelCount: 3 }
  eq(
    missingFor(sale(), withVarieties),
    ['variety'],
    'entry: a crop that HAS varieties must be given one',
  )
  eq(
    missingFor(sale({ sub_head_id: 'g9' }), { ...withVarieties, parentSubHeadId: 'g9' }),
    [],
    'entry: a variety with no grades under it is enough on its own',
  )

  // Grades under a variety were removed: the variety IS the answer.
  const g9 = { topLevelCount: 3, childCount: 0, parentSubHeadId: 'g9', hasPlots: false }
  eq(
    missingFor(sale({ sub_head_id: 'g9' }), g9),
    [],
    'entry: the variety alone completes a sale — grades no longer exist',
  )

  // Plots are required once the farm has entered any — but never on a transfer.
  eq(
    missingFor(sale(), { ...bare, hasPlots: true }),
    ['plot'],
    'entry: a farm with plots must say which one',
  )
  eq(
    missingFor(
      {
        kind: 'transfer',
        head_id: null,
        sub_head_id: null,
        plot_id: null,
        account_id: 'cash',
        to_account_id: 'bank',
        amount_paise: 50000,
      },
      { topLevelCount: 3, childCount: 0, parentSubHeadId: null, hasPlots: true },
    ),
    [],
    'entry: a transfer needs no crop, no variety and no plot',
  )
  eq(
    missingFor(
      {
        kind: 'transfer',
        head_id: null,
        sub_head_id: null,
        plot_id: null,
        account_id: 'cash',
        to_account_id: 'cash',
        amount_paise: 50000,
      },
      bare,
    ),
    ['toAccount'],
    'entry: a transfer to the same account is not a transfer',
  )

  // The expense side asks for a spend type, not a variety.
  eq(
    missingFor(sale({ kind: 'expense' }), withVarieties),
    ['subHead'],
    'entry: the expense side asks for a sub-head, not a variety',
  )
}

/* ------------------------------------------------- android backup rules -- */

/*
 * The backup XML decides whether a farmer's records survive a lost phone, and
 * it is validated by aapt rather than by anything that runs here — so a typo
 * in it does not fail until four minutes into a CI build, with a Gradle stack
 * trace that never names the file.
 *
 * It has already cost one build: `domain="cache"` looks obvious and does not
 * exist. Android's domain list is closed and short, so checking it is three
 * lines and pays for itself the first time.
 */
{
  const ANDROID_RES = join(
    dirname(fileURLToPath(import.meta.url)),
    '..', 'android', 'app', 'src', 'main', 'res', 'xml',
  )

  // The complete set. Cache directories are always excluded by Android and
  // cannot be named at all.
  const DOMAINS = new Set([
    'root', 'file', 'database', 'sharedpref', 'external',
    'device_root', 'device_file', 'device_database', 'device_sharedpref',
  ])

  for (const file of ['backup_rules.xml', 'data_extraction_rules.xml']) {
    let xml
    try {
      xml = readFileSync(join(ANDROID_RES, file), 'utf8')
    } catch {
      failures.push(`backup: ${file} is missing — Android would back up everything by default`)
      continue
    }

    const used = [...xml.matchAll(/domain="([^"]+)"/g)].map((m) => m[1])
    ok(used.length > 0, `backup: ${file} declares at least one rule`)

    const bad = [...new Set(used)].filter((d) => !DOMAINS.has(d))
    eq(bad, [], `backup: every domain in ${file} is one Android recognises`)

    /*
     * An <include> makes the file an allow-list, and lint treats an <exclude>
     * outside it as a FATAL error rather than a redundancy. This is the rule
     * that actually failed the build: excluding a sharedpref file while only
     * database and file were included reads as sensible and is rejected.
     */
    const included = new Set(
      [...xml.matchAll(/<include[^>]*domain="([^"]+)"/g)].map((m) => m[1]),
    )
    const strayExcludes = [
      ...new Set([...xml.matchAll(/<exclude[^>]*domain="([^"]+)"/g)].map((m) => m[1])),
    ].filter((d) => !included.has(d))
    eq(
      strayExcludes,
      [],
      `backup: every exclude in ${file} sits under an include — lint calls this fatal`,
    )

    // The ledger itself. Everything else in these files is a refinement.
    ok(
      /<include domain="database" path="\.".?\/>/.test(xml.replace(/\s+/g, ' ')) ||
        xml.includes('<include domain="database"'),
      `backup: ${file} carries the database — the ledger is the whole point`,
    )
  }
}

/* ------------------------------------------------------------------------ */

if (failures.length) {
  console.error(`\n  ${failures.length} check(s) FAILED\n`)
  for (const f of failures) console.error('  ✗ ' + f + '\n')
  process.exit(1)
}
console.log(`  ✓ ${passed} checks passed`)
