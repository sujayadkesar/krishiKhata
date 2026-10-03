---
title: Privacy Policy — Krishi Khata
---

# Privacy Policy

**Krishi Khata** (`in.krishikhata.app`)

Last updated: 3 October 2026

---

## The short version

Krishi Khata keeps your farm records in a file on your own phone. There is no
server and no company receiving your data. We cannot see your figures, because
they never reach us.

You may optionally sign in with Google so the app can keep a backup copy in
**your own** Google Drive. That copy goes from your phone to your Drive
directly. It does not pass through us, and we cannot read it.

---

## What the app stores

Everything you enter — income, expenses, transfers, crops, plots, workers,
attendance and payments — is written to a SQLite database in the app's private
storage on your device. No other app on the phone can read it.

We do not collect, transmit, sell or share any of it.

## What the app does not do

- It has **no server**. There is no backend to send anything to, and no
  account on any system of ours.
- It contains **no analytics, tracking or advertising** libraries.
- It does **not** collect your location or device identifiers.
- It does **not** share your data with any third party, and we never see it.

The names, phone numbers and villages of workers you record are information
*you* type in about people you employ. It is stored on your phone in the same
way as everything else, and is never transmitted anywhere.

## Permissions the app requests

Every one of these is optional except the first two, and each is asked for at
the moment you use the feature that needs it — never on first launch.

| Permission | Why | What happens if you refuse |
| --- | --- | --- |
| `INTERNET` | Uploading your backup to your own Google Drive, if you turn that on. There is no other network use and no server of ours to call. | — |
| `ACCESS_NETWORK_STATE` | So the app knows when the phone is back in range and can finish a backup that was waiting. | — |
| `READ_CONTACTS` | Searching your phone book inside the app to add workers quickly. Nothing is read until you tap that button, nothing is written, and nothing leaves the phone. | You can still add a worker from the system contact picker, which needs no permission, or type the name yourself. |
| `CAMERA` | Photographing a bill against an entry. | You can choose an existing photo from the gallery instead, which needs no permission. |

It does **not** request location, microphone, phone state, access to your wider
files, or the ability to install other apps. It never writes to your contacts.

## Signing in with Google

If you turn on Google Drive backup, the app asks for one narrow permission:
`drive.appdata`. This reaches a **hidden folder that belongs to this app alone**
inside your Drive. It cannot see your documents, your photos, or any other file
in your Drive, and it cannot create files anywhere you would find them.

- The backup goes **from your phone straight to your Drive**. It does not pass
  through any server of ours, because there isn't one.
- We never receive your Google account name, your email, or a token for it.
  The sign-in happens between you, your phone and Google.
- You can revoke it at any time from
  [your Google account permissions](https://myaccount.google.com/permissions),
  or turn it off in **Settings → Backup**, or simply delete the file from your
  Drive. The app will carry on working with everything stored on the phone.

## Photographs of bills

A photo you attach to an entry is shrunk and stored inside the app's own
database on your phone, alongside the entry. It is not placed in your gallery
and is not sent anywhere. If you have Drive backup switched on it is included
in that backup, in your own Drive, like the rest of your records.

## Backup

There are two ways your records are protected, and neither sends anything to
us.

**Android's automatic backup.** Android backs up app data to your own Google
account, roughly once a day while the phone is idle, charging and connected to
wi-fi, and restores it when you set up a new phone or reinstall the app. This
is a feature of Android itself, controlled by you in
**Settings → Google → Backup**. Krishi Khata simply allows it, as most apps do.
The backup goes to your Google account, governed by
[Google's Privacy Policy](https://policies.google.com/privacy). We have no
access to it.

**A file you save yourself.** In **Settings → Backup** you can save a copy of
your records as a file and put it wherever you choose — Google Drive, WhatsApp,
a memory card. You control that copy entirely. The app hands it to Android's
share sheet and takes no further part.

**Google Drive, if you switch it on.** Described above. Off until you turn it
on, and removable at any time.

## Children

Krishi Khata is a bookkeeping tool intended for adults running a farm or
household. It is not directed at children and collects nothing from anyone.

## Changes to this policy

If this policy changes, the updated version will be published at this address
and the date at the top will change.

## Contact

Questions about this policy, or about the app:

**Sujay Adkesar**
<sujayadkesar.iet@srinivasuniversity.edu.in>

Source code: [github.com/sujayadkesar/krishiKhata](https://github.com/sujayadkesar/krishiKhata)
