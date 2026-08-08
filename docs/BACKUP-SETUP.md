# Setting up Google Drive backup

The app works completely without this. Everything is stored on the phone, and
Settings → Backup → **Save a copy** already writes a full backup file you can
keep or send on WhatsApp, with no account and no setup.

This document covers the optional extra: backing up automatically to the
farmer's own Google Drive. It costs nothing, but it needs a Google OAuth client
ID, and only you can create one because it is tied to your Google account.

**Time:** about fifteen minutes, once, ever.

---

## Why this needs no server, and no money

The scope the app asks for is `https://www.googleapis.com/auth/drive.file`.
Google classifies it **non-sensitive**, which has two consequences worth
knowing:

- **No verification review.** Sensitive and restricted scopes need Google to
  review the app. Non-sensitive ones do not.
- **No 100-user cap.** That cap applies to unverified apps requesting sensitive
  or restricted scopes. It does not apply here.

`drive.file` also grants access **only to files the app itself creates**. Krishi
Khata cannot read anything else in the farmer's Drive, and you can tell them
that honestly.

Backups land in a visible folder called **Krishi Khata Backups**, not the hidden
app-data folder, so the farmer can open Drive and see their backups exist. A
backup nobody can see is a backup nobody trusts.

---

## Steps

### 1. Create a project

<https://console.cloud.google.com> → project picker → **New project**.
Call it `Krishi Khata`.

### 2. Enable the Drive API

**APIs & Services → Library** → search "Google Drive API" → **Enable**.

### 3. Configure the consent screen

**APIs & Services → OAuth consent screen**

- User type: **External**
- App name: `Krishi Khata`, your support email, your developer email
- **Scopes → Add or remove scopes** → add
  `https://www.googleapis.com/auth/drive.file`
  It appears under *non-sensitive*. If it appears anywhere else, you have added
  the wrong scope — `drive` and `drive.readonly` are restricted and would drag
  the whole app into a review.
- **Publish app** → Production. Because the scope is non-sensitive this needs
  no review, and without it you are limited to test users.

### 4. Create the Android client

**Credentials → Create credentials → OAuth client ID → Android**

- Package name: `in.krishikhata.app`
- SHA-1: the fingerprint of the keystore the APK is signed with:

```bash
keytool -list -v -keystore your-release-key.keystore -alias your-alias
```

Use the **SHA1** line. If you build debug APKs too, add a second Android client
with the debug keystore's fingerprint — otherwise sign-in fails only in debug
and the reason is not obvious.

### 5. Create the Web client — this is the one that matters

**Credentials → Create credentials → OAuth client ID → Web application**

Name it `Krishi Khata Web`. You do not need to fill in any redirect URI for the
Android app.

**Copy the Web client ID.** Android sign-in needs the **web** client ID, not the
Android one. This is the single step almost everyone gets wrong; the Android
client must exist, but the ID you paste into the app is the web one.

### 6. Put it in the build

The client ID is read at build time from `VITE_GOOGLE_CLIENT_ID`, so nothing in
the source has to change. It is not a credential — an Android OAuth client has
no client secret, and the ID ends up readable inside the APK either way — but
keeping it out of the repository means one less thing to edit per release.

**For released APKs**, add it once as a repository secret:

GitHub → the repo → **Settings → Secrets and variables → Actions → New
repository secret**

- Name: `GOOGLE_CLIENT_ID`
- Value: the **web** client ID from step 5

Every tagged release from then on has backup enabled. Nothing else changes.

**For a local build**, put it in `app/.env.local` (git-ignored):

```
VITE_GOOGLE_CLIENT_ID=123456789-abcdefg.apps.googleusercontent.com
```

then

```bash
npm run sync
```

Settings → Backup stops saying "not set up" and shows a single **Sign in with
Google** button. Tapping it signs in, takes consent and uploads a backup in one
go, and switches automatic backup on once it has succeeded.

---

## What it does and does not do

**Does:** uploads a compressed JSON snapshot of every table to the farmer's
Drive, keeps the most recent twelve and deletes older ones, and can list and
restore any of them. A restore always saves a copy of what was there first, so
restoring the wrong file cannot lose the right one.

**Does not:** run while the app is closed. An Android OAuth client has no client
secret by design, so with no server there is no refresh token — only an access
token lasting about an hour. Backups therefore happen while the app is open,
like WhatsApp's. The app may occasionally ask the farmer to confirm with Google
again when a token has expired.

Making it truly automatic would mean running a server to hold a refresh token,
which is exactly the cost and the data-custody this app was built to avoid.

---

## If sign-in fails

| Symptom | Cause |
|---|---|
| `DEVELOPER_ERROR` / immediate dismissal | The SHA-1 does not match the keystore that signed the installed APK, or the package name is wrong. |
| Signs in, then Drive returns 403 | The `drive.file` scope is missing from the consent screen, or the Drive API is not enabled. |
| Works in debug, fails in release | Only the debug SHA-1 was registered. Add the release one. |
| "App isn't verified" warning | The consent screen is still in Testing. Publish to Production; no review is needed for this scope. |
