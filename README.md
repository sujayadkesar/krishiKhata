# ಕೃಷಿ ಖಾತೆ · Krishi Khata

A farm ledger for individual farmers: income, expenses, and the labour
management that dominates both.

Everything lives on the phone. No account, no server, no subscription, and it
works with the SIM out. Kannada first, English second.

---

## What it does

**Income** — sell 250 kg of banana at ₹42, or 12 bottles of honey at ₹450. Each
crop carries its own units, so honey offers bottle, kilo and litre while banana
offers kilo and bunch. Quantity times rate fills the total in, and stops the
moment you type one yourself, because the trader rounds.

**Expenses, in detail** — not "₹8,000 on banana" but *crop → kind of spend →
exactly what work*: banana, labour, harvesting. That granularity is the point;
it is what turns a year of records into an answer.

**Labour** — the hard part, and most of the app.

- A month calendar. Tap the days someone worked: once for a full day, again for
  half. Farmers do not update daily; they come back on Saturday remembering
  Monday, Wednesday and Friday, and four taps is the difference between that
  being recorded and not.
- Several people at once, when three did the same job on the same days.
- Group leads. A maistry brings a crew that is different people every time, so
  the app tracks the lead and a head-count, split by men and women because
  their day rates differ. Twelve on Monday and eight on Wednesday is normal.
- A running khata per person: days worked, wages earned, payments, balance.
- Advances. Pay before any work and it sits as an advance, then attaches itself
  to the work when it happens.

**Plots** — most farms here are two or three separate pieces of land: an
inherited one, a bought one, a leased one. Name them once and every entry and
every work day can carry one, so each plot shows its own profit. The question
that answers is whether the leased land is worth renewing, which crop alone
cannot tell you: the same banana grows on both.

**Reports** — a complete farm report, crop-wise profit, plot-wise profit,
income and expense with full spend detail, wages due, a per-worker statement,
and the day book. All on the farm's own letterhead with charts, all exported as
a real PDF with selectable text and correctly shaped Kannada.

**Backup** — a single file you can keep or send on WhatsApp, and optionally
automatic backup to your own Google Drive.

**Updates** — the app checks GitHub for a new release, shows what changed, and
downloads and installs it itself. Nothing arrives on WhatsApp, nothing is
uninstalled, and your records are untouched.

---

## The one idea worth understanding

The books are kept on a **cash basis**: a wage becomes an expense on the day it
is paid, not the day it is earned. But a farmer still needs to know what they
owe. Those two only coexist because **work and money are recorded separately**:

- **Attendance** records who worked, when, on which crop. It moves no money.
- **A payment** is when cash changes hands. That is the expense.
- **Allocations** join them, oldest work first.

Because every work day knows its crop, a ₹4,000 lump sum spanning banana and
pepper still lands on the right crops in the report. And because the expense is
dated the payment, the cash book matches the cash box.

The visible cost of cash basis is that a month where you harvest but do not pay
looks cheap. So every statement carries an **unpaid wages** line, and the
dashboard shows what you owe next to what you have spent.

An advance is not a separate concept anywhere in the code — it is a payment made
while the balance is at or below zero, and the subtraction already says so.

---

## Running it

```bash
cd app && npm install && npm run dev
```

Then <http://localhost:5173>. The web build is for development and preview; the
product is the Android app.

| Command | What it does |
|---|---|
| `npm run dev` | Vite dev server on 5173 |
| `npm run check` | **The gate.** Pure-logic assertions, including the FIFO allocation engine. |
| `npm run build` | `tsc -b && vite build` |
| `npm run sync` | Build, then copy into the Android project |
| `npm run lint` | oxlint |
| `npm run icons` | Regenerate the favicon and Android icons from `logoArt.ts` |
| `npm run sample -- <dir>` | Render every report against made-up figures, to look at |

### Releasing

The version lives in **`app/version.json`** and nowhere else — Android's build
reads `versionCode` and `versionName` from it, and the in-app updater reads
`version`. To ship:

1. Bump **both** numbers in `app/version.json`. `versionCode` must increase;
   Android refuses to install an APK over one with an equal or higher code, and
   the update will fail with nothing on screen to explain why.
2. Commit, then tag `vX.Y.Z` matching `version` and push the tag.
3. **Actions → Build APK** runs on the tag and attaches the APK to a Release.

Every phone offers it on next launch, and installs it from inside the app.

No Android SDK is needed locally — you can also run the workflow by hand from
the Actions tab. Without signing secrets it produces a debug APK that installs
fine for testing. For anything you intend to share, set
`ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` and
`ANDROID_KEY_PASSWORD` as repository secrets first: a release APK cannot be
installed over a debug-signed one, so the farmer would have to uninstall — and
uninstalling takes their records with it.

---

## What it costs

Nothing to build, nothing to run: no server, no database, no hosting. Drive
backup uses the `drive.file` scope, which Google classifies non-sensitive — no
verification review, no user cap, and access limited to files the app itself
created.

**One future cost, stated plainly.** Google's Android developer verification
began enforcement in September 2026 and expands worldwide during 2027, India
included. After that, installing an APK on a certified device requires it to be
registered to a verified developer. The free tier covers **20 devices** with no
fee and no government ID. Beyond that it is a **one-time $25** registration.
Sideloading via ADB stays open regardless.

---

## Documentation

- [`CLAUDE.md`](CLAUDE.md) — the hard rules. Read before changing anything;
  each one exists because breaking it causes a specific, expensive failure.
- [`docs/BACKUP-SETUP.md`](docs/BACKUP-SETUP.md) — the fifteen-minute Google
  Cloud setup for Drive backup, including the step everyone gets wrong.

---

## Checking it still works

`npm run check` covers the pure logic. On a phone, the list in `CLAUDE.md` is
the fastest way to confirm nothing important broke — the important ones being:

- Add six work days for one labourer: the khata shows six days and **no expense**.
- Pay a lump sum covering four: an expense appears dated the payment day, two
  days stay outstanding, and crop costs move by the right amount.
- Raise a labourer's wage: **past attendance amounts do not change.**
- Bank-to-cash transfer: expenses do not move, both balances do.
