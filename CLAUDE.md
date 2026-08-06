# Krishi Khata — standing instructions

A farm ledger for individual farmers: income, expenses, and the labour management
that dominates both. Offline-first, local SQLite, no server, no account required.
The app lives in `app/`.

Read this before changing anything. The rules below are not style preferences.

## Stack

React 19 + TypeScript + Vite 8, Tailwind v4, Capacitor 8 (Android), Recharts.
SQLite via `@capacitor-community/sqlite` on Android, `sql.js` on the web.

Android is the product. The web build is a development and preview surface only.

## Hard rules

1. **Money is an integer number of paise.** Never a float, never a formatted
   string in the database. `lib/money.ts` parses and formats.

2. **Quantities are integer milli-units** (12.5 kg → 12500). Same reasoning.
   `lib/quantity.ts`. Rate × quantity rounds once, in `lineTotalPaise`.

3. **Dates are plain `YYYY-MM-DD` business dates**, not timestamps. Never build
   one with `toISOString()` — that converts to UTC first, so every evening entry
   in India lands on the previous day. `lib/date.ts` works in local time.

4. **Attendance records work. Payments record money.** They are separate tables
   on purpose. The farmer chose cash-basis accounting, so an expense appears
   when a wage is PAID, not when it is earned — but dues, advances and worked-day
   statistics all need the work recorded independently. This is the central
   design of the app; see `lib/labour.ts`.

5. **An advance is not a separate concept.** It is a payment made while the
   balance is at or below zero. `balancePaise` already says so. Never add a
   second code path for it — two ways of moving the same money is how ledgers
   stop balancing. `is_advance` is a display flag and nothing more.

6. **`rate_paise` is snapshotted onto every attendance row.** Raising a
   labourer's rate in Settings must never rewrite what last season cost. Never
   read the rate off `labourers` when reporting on past work.

7. **A bank-to-cash withdrawal is a transfer, not an expense.** Recording it as
   an expense permanently overstates spending and breaks the cash balance.

8. **All SQL goes through `db/db.ts`.** Screens call `all` / `one` / `scalar` to
   read and `run` / `tx` to write. Writes are serialised through one chain and
   flushed by one debounced save; a write that goes round them can interleave
   with another or fail to persist. Inside `tx`, use the `run` it hands you —
   the module-level one would deadlock on the write chain.

9. **`MIGRATIONS` in `db/schema.ts` is append-only.** Never edit a statement
   that has shipped. A phone that already ran it will not run it again, and the
   two devices then disagree about what the table looks like.

10. **Seeded master data uses fixed, deterministic ids** (`lib/ids.ts`
    `seedId`). Random ids would give a restored backup a second "Banana" head
    splitting every report between them.

11. **Master data is deactivated, never deleted**, once anything references it.
    Renaming is always safe because transactions store ids, not names.

12. **Booleans are `0 | 1`.** SQLite has no boolean type.

## Deliberate divergences from `goshala-ledger`

That project is next door and shares much of this reasoning, but two of its
rules do NOT apply here and should not be reintroduced:

- **Money rows are editable.** Immutability there exists to make multi-device
  sync safe. This app has no sync and one device, so it buys nothing and costs
  a farmer the ability to fix a typo.
- **No hash-chained audit log.** That belongs to a shared book several trustees
  write to. One farmer on one phone needs `change_log`, and nothing more.

`lib/money.ts` was ported from it verbatim and is worth keeping in step.

## Bilingual

Kannada is the default, English is the fallback. Every master-data row carries
`name_en` and `name_kn`; use `nameOf` from `@/i18n`, never the column directly.
UI strings live in `i18n/strings.ts`.

Keep Kannada labels SHORT. A label that wraps pushes its tap target off a small
screen, and these screens are used one-handed, outdoors, in sunlight.

## PDFs and Kannada

Documents are **printed HTML**, paginated by the print engine, never by
JavaScript. JS PDF libraries embed the font but place glyphs left to right,
which takes Kannada apart — the browser has a real shaping engine, so use it.
If a rasteriser fallback is ever added, it must never set `letter-spacing` on
farmer-entered text: html2canvas then positions text grapheme by grapheme.

## Verifying without reading code

- Record an income, force-close the app, reopen — it is still there.
- Aeroplane mode, enter five records — everything behaves normally.
- Honey sold by bottle and by kg both compute the right total.
- Add 6 work days for one labourer — the khata shows 6 days and **no expense**.
- Pay a lump sum covering 4 of them — an expense appears dated the payment day,
  2 days stay outstanding, crop-wise costs move by the right amount.
- Pay an advance before any work, then record work — the advance allocates.
- Raise a labourer's rate — **past attendance amounts do not change**.
- Group lead with 12 on Monday and 8 on Wednesday — totals match.
- Bank-to-cash transfer — expenses do not move, both balances do.
- Crop-wise statement — Kannada renders as Kannada, text is selectable, no line
  cut through a table row.
- Back up to Drive, wipe, reinstall, restore — everything returns.

## Commands

```
npm run dev      Vite dev server on 5173
npm run check    Pure-logic assertions. THE GATE — keep it green.
npm run build    tsc -b && vite build
npm run sync     build + cap sync android
npm run lint     oxlint
```

`npm run check` covers money, quantity, date and — most importantly — the FIFO
allocation engine. Add to it whenever you touch anything in `src/lib`.

## Git

Commit after every working feature. Do not add AI attribution or
`Co-Authored-By` trailers.
