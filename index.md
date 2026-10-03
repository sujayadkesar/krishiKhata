---
title: A farm ledger that works with the SIM out
description: Krishi Khata is a Kannada-first farm ledger for income, expenses and daily-wage labour. Offline, no account, no server.
---

<section class="hero">
  <img class="hero-mark" src="{{ '/assets/logo.svg' | relative_url }}" alt="Krishi Khata">
  <h1>ಕೃಷಿ ಖಾತೆ</h1>
  <p class="latin">Krishi Khata · Farm Khata Book</p>
  <p class="lede">
    The paper khata, on a phone. Income, expenses and the daily-wage labour that
    dominates both — written down in Kannada, in the field, with no signal.
  </p>

  <div class="cta">
    <a class="btn btn-primary" href="https://play.google.com/store/apps/details?id=in.krishikhata.app">
      Get it on Google Play
    </a>
    <a class="btn btn-ghost" href="https://github.com/sujayadkesar/krishiKhata/releases/latest">
      Download the APK
    </a>
  </div>

  <div class="pills">
    <span class="pill on-green">No account</span>
    <span class="pill on-green">No server</span>
    <span class="pill on-teal">Works offline</span>
    <span class="pill on-earth">ಕನ್ನಡ first</span>
    <span class="pill">Free</span>
  </div>
</section>

<div class="shots">
  <figure>
    <img src="{{ '/assets/screens/home.png' | relative_url }}" alt="The home screen, showing this month's income and expenses" loading="lazy">
    <figcaption>ಮುಖಪುಟ · Home</figcaption>
  </figure>
  <figure>
    <img src="{{ '/assets/screens/team.png' | relative_url }}" alt="The workers screen, showing who is owed what" loading="lazy">
    <figcaption>ಕೆಲಸಗಾರರು · Workers</figcaption>
  </figure>
  <figure>
    <img src="{{ '/assets/screens/entry.png' | relative_url }}" alt="Recording an entry" loading="lazy">
    <figcaption>ಸೇರಿಸಿ · Record</figcaption>
  </figure>
  <figure>
    <img src="{{ '/assets/screens/reports.png' | relative_url }}" alt="The reports screen" loading="lazy">
    <figcaption>ವರದಿ · Reports</figcaption>
  </figure>
</div>

<div class="grid">
  <div class="card">
    <h3><span class="dot" style="background:var(--teal)"></span>Money in</h3>
    <p>
      250 kg of banana at ₹42, or 12 bottles of honey at ₹450. Each crop carries
      its own units and its own varieties, so the entry stays two taps long.
    </p>
  </div>
  <div class="card">
    <h3><span class="dot" style="background:#c62828"></span>Money out</h3>
    <p>
      Not "₹8,000 on banana" but crop, kind of spend, and exactly what work. The
      car and the house go in the same book, because a farmer has one wallet.
    </p>
  </div>
  <div class="card">
    <h3><span class="dot" style="background:var(--earth)"></span>Labour</h3>
    <p>
      Tap the days somebody worked on a month calendar. Day rate, by the hour,
      per litre, a lump sum, or a monthly salary — each paid the way it is
      really paid.
    </p>
  </div>
  <div class="card">
    <h3><span class="dot" style="background:var(--green)"></span>Statements</h3>
    <p>
      A worker's full record as a PDF in Kannada: the days they came, what they
      earned, what they took, what is left. Handed over, not argued over.
    </p>
  </div>
</div>

<div class="prose" markdown="1">

## Why it is built this way

**It works with the SIM out.** Everything is written to the phone first. A
farmer standing in a field with no signal records six days of work, walks back
into range, and the backup catches up on its own. Nothing ever waits on a
network.

**There is no server, and no account on anybody's system.** The ledger lives on
the phone. If you switch on Google Drive backup it goes from your phone to
*your own* Drive, in a hidden folder this app alone can reach — never through
me, and never anywhere I can read it. See the
[privacy policy]({{ '/docs/privacy' | relative_url }}).

**Kannada first, English second.** Not a translation layer bolted on
afterwards: every crop, worker and account carries both names, and the printed
statements do too, because the document gets handed to somebody who may read
the other one.

**Money is counted in paise, dates are plain local dates.** The arithmetic that
decides what a farmer owes somebody standing in front of them is held down by a
suite of assertions that must pass before any build reaches a phone.

## Work, the way it is actually paid

A day rate is only one of the ways a farm pays for work, and an app that knows
only day rates quietly records the rest wrongly.

<div class="table-wrap" markdown="1">

| How it is paid | What that looks like |
| --- | --- |
| By the day | A rate, times the days they came. Half days are one more tap. |
| By the hour | A tractor and its driver, at a rate agreed beforehand. |
| Per unit | Spraying, per litre — and the price is settled *after* the job. |
| Lump sum | Coconut plucking: one figure agreed for the whole job. |
| Monthly | A fixed worker, posted once a month. |

</div>

Work and money are kept apart on purpose. Recording a day of work does not
create an expense; paying somebody does. That is what lets the app tell you
what is still owed, which a book that only records payments never can.

## Who it is for

Small and marginal farmers in Uttara Kannada, Karnataka, growing arecanut,
banana, pepper and coconut, who hire daily-wage workers and keep their accounts
in a paper khata. One Android phone, patchy network, and no appetite for
signing up to anything.

---

Free, with no advertising, no subscription and no data collection of any kind.

</div>
