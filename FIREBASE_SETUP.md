# Dashboard + bot backend setup (one-time, manual)

This repo now contains both the website (Vite/React, `src/`) and the bot's
Cloud Functions backend (`functions/`), both deploying to the same Firebase
project (`logistic-track-golf`). The original `ATSS logistic bot` folder on
this machine has been superseded by `functions/` here — once you've
confirmed everything below works, you can archive or delete that old folder.

## 1. Enable Google sign-in

[Firebase Console](https://console.firebase.google.com/project/logistic-track-golf/authentication/providers)
→ Authentication → Sign-in method → enable **Google**.

## 2. Enable Firestore and Cloud Storage

[Firestore](https://console.firebase.google.com/project/logistic-track-golf/firestore)
→ Create database (production mode). [Storage](https://console.firebase.google.com/project/logistic-track-golf/storage)
→ Get started.

## 3. Re-authenticate the Firebase CLI and set secrets

```
firebase login --reauth
```

The Cloud Functions reference `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`,
and `WHATSAPP_VERIFY_TOKEN` via `defineSecret`, which reads from Secret
Manager in production — not from the `.env` file. If they aren't set yet:

```
firebase functions:secrets:set WHATSAPP_TOKEN
firebase functions:secrets:set WHATSAPP_PHONE_NUMBER_ID
firebase functions:secrets:set WHATSAPP_VERIFY_TOKEN
```

(The old project's `.env` file was intentionally **not** copied into this
repo — copy the values from there yourself if you need them, or re-issue
them from the Meta developer console.)

## 4. Deploy rules and functions

```
cd functions && npm install && cd ..
firebase deploy --only firestore:rules,storage,functions
```

Or paste [`firestore.rules`](firestore.rules) / [`storage.rules`](storage.rules)
into the console's Rules tabs directly if you'd rather not use the CLI for
that part.

## 5. Add yourself (and anyone else) as a dashboard user

In the Firestore console, create a `users` collection. For each person who
should have dashboard access, add a document:

- **Document ID**: their Google account email, **lowercase**
- Fields:
  - `email` (string)
  - `active` (boolean) — `true` to grant access
  - `company` (string) — e.g. `atss`. **This exact string is the tenant
    boundary** — it must match the `company` value used in the Storage
    upload path and in the `workers` records below. Pick one slug per
    client company and use it everywhere.
  - `role` (string) — e.g. `manager`

## 6. Seed workers for that company

Deliveries only get created for addresses that have active workers — the
Cloud Function fans each uploaded delivery row out to every active worker
at that `address`. Upload a workers Excel (שם עובד, מספר טלפון, כתובת) to
Storage at `workers/{company}/yourfile.xlsx` (same `company` slug as
above) to seed them, or add documents to the `workers` collection by hand:
`{ company, name, phone, address, active: true }`, doc ID
`{company}_{phone}`.

If you upload deliveries before any workers exist for an address, the
function logs `Store {address}: no workers, skipping N rows` and creates
nothing for that address — check the Cloud Functions logs if the dashboard
table stays empty after an upload.

## Daily deliveries Excel format

Uploaded via the dashboard to `imports/{company}/...`. Exact column
headers (Hebrew, RTL), from
[`functions/src/config/constants.ts`](functions/src/config/constants.ts):

| שם הנהג | ID חנות | תאריך | שעת הגעה צפויה | לוחית רישוי | כמות ארגזים |
|---|---|---|---|---|---|
| driver | store ID | date | expected time | license plate | box count |

Dates/times can be real Excel date/time cells or text. Parsing happens
server-side in
[`functions/src/lib/excelParser.ts`](functions/src/lib/excelParser.ts) —
the web client only uploads the raw file.
