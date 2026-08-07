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
  matchFifo, balancePaise, balanceState, splitByHead, crewWagePaise, crewSize,
} from '../src/lib/labour.ts'
import { isNewer } from '../src/lib/updates.ts'

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

/* --------------------------------------------------------- updates ------ */

ok(isNewer('1.0.1', '1.0.0'), 'update: patch bump')
ok(isNewer('v1.1.0', '1.0.9'), 'update: leading v tolerated')
ok(isNewer('1.2.10', '1.2.9'), 'update: compared numerically, not as strings')
ok(!isNewer('1.0.0', '1.0.0'), 'update: same version is not newer')
ok(!isNewer('0.9.9', '1.0.0'), 'update: older is not newer')
ok(isNewer('1.0', '0.9.9'), 'update: short version still compares')

/* ------------------------------------------------------------------------ */

if (failures.length) {
  console.error(`\n  ${failures.length} check(s) FAILED\n`)
  for (const f of failures) console.error('  ✗ ' + f + '\n')
  process.exit(1)
}
console.log(`  ✓ ${passed} checks passed`)
