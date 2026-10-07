# Testing V1.6.2 (non-enumerable public lead tokens)

Public postcard links change from `/adu?lead=ANA-0001` (guessable) to `/adu?ref=<public_token>`. The token is 16 random characters (96 bits), e.g. `gbJwnC-_rLkfqDtU`. `lead_code` is unchanged and still used everywhere inside the app.

> ⚠️ Every QR code changes. Any postcard already **approved** goes back to **Ready for review**, so re-check and re-approve before printing. Cards printed before V1.6.2 (`?lead=` links) will open the generic page and won't be tracked.

## 1. Run the migration
Supabase → SQL Editor → paste and run `supabase/migrations/2026-10-07_v1_6_2_public_tokens.sql`.
It's safe to run twice. A second run changes nothing: tokens stay the same and approvals aren't reset again.

## 2. Database self-test (2 minutes, zero risk)
Run `supabase/tests/v1_6_2_public_tokens_test.sql`.
✅ **ALL V1.6.2 PUBLIC-TOKEN CHECKS PASSED (test data rolled back)**

| Check | What it proves |
|---|---|
| 1 | Every existing lead has a token; all unique, 16 URL-safe characters, column is NOT NULL |
| 2 | A unique index exists; a token can't be changed or set to another lead's token; callers can't choose a token on insert |
| 3 | New leads (via the real CSV import path) get tokens automatically |
| 4 | 300 fresh tokens: no repeats, well spread, no sequential pattern, not derived from lead code or id |
| 5 | `?ref=` visit records against the right lead; scan +1, status → Scanned QR; refresh within 30 min = visit only; after 30 min = new scan; other leads untouched |
| 6 | CTA tracking by token stores the button and where on the page it was clicked |
| 7 | Invalid, unknown, every one-character-changed variant, and wrong-case tokens never resolve |
| 8 | The sequential lead code is rejected by the public tracking path |
| 9 | Deleting a lead retires its token; it never resolves or gets reissued |
| 10 | Anonymous visitors can't call the tracking functions or read the leads table |
| 11 | The one-time postcard-approval reset ran |

Then run the earlier tests to confirm nothing else moved:
- `v1_6_landing_tracking_test.sql`
- `v1_5_mailing_readiness_test.sql`
- `v1_4_postcards_test.sql`
- `v1_2_property_images_test.sql`
- `v1_1_safe_delete_test.sql`

## 3. Manual checks (`npm run dev`)
Use one throwaway lead with an **approved** image and one with **no approved image**. Mark the first *Postcard sent*. Copy each lead's link from its lead page (QR code section). It now ends in `?ref=…`.

| # | Test | Expected |
|---|---|---|
| 1 | Open the approved lead's `?ref=` link in a **private window** | Property photo in the hero plus the personal band. Terminal: `[adu] ref=gbJw… → ok_approved_image`. |
| 2 | **Refresh** the page | The URL still contains `?ref=…` and the page stays personalized. |
| 3 | Dashboard → that lead | QR scans **+1** (not +2: the refresh within 30 min counted only as a page visit), status **Scanned QR**. |
| 4 | Click **Explore HELOC Options** / **Book a Call** | Timeline shows “Clicked a button · Button: … (hero)”. The Calendly link ends with `utm_content=<token>`, never the lead code. |
| 5 | Open the no-image lead's `?ref=` link | Generic hero plus the personal band. Terminal: `image_not_approved`. |
| 6 | Change **one character** of the token in the address bar | Generic page, no band. Terminal: `not_found`. |
| 7 | Open `/adu?lead=ANA-0001` and `/adu?ref=ANA-0001` | Generic page both times. The lead's scan count does **not** change. |
| 8 | Open `/adu?ref=hello` and `/adu` | Generic page, never an error. |
| 9 | Right-click → **View page source** on the personalized page | Search for the owner's name, mailing street, property street, `ANA-` and the lead's id: **none** appear. |
| 10 | Open `/api/qr/ANA-0001.png` | Rejected (400). `/api/qr/<token>.png` returns the QR image. |
| 11 | **Postcards** page | Previously approved cards show **Ready for review**. Open one, scan the on-screen QR with your phone → it opens `…/adu?ref=<token>`. Re-approve. |
| 12 | **QR Export** CSV | `unique_tracking_url` and `qr_image_url` use the token. There's a new `public_token` column, and `lead_code` stays for your own reference. |
| 13 | **Leads** search | Paste a token (e.g. from a Calendly booking) into Search → that lead appears. |

If Armando's main website hosts the `/adu` page (README Option B), update its snippet to the new `ref` version in the README.

## What was checked during development
- **SQL, on PostgreSQL 16:** all the migrations, with V1.6.2 run twice.
  - Tokens didn't change on the second run, and IDs, codes, images, mailing, notes and scans were unchanged.
  - The approved ANA-0001 postcard went back to *ready*.
  - The V1.6.2 test and all earlier tests pass.
- **App (25 automated checks):**
  - **Landing page:** the right result for a valid token, a token with no approved image, and missing, invalid, unknown, lead-code, `?lead=`, lowercased and script inputs. None of the 16 one-character variants resolves.
  - **No leaks:** no owner, mailing, property, lead-code or database-id data in the page source.
  - **Lookup:** queried by `public_token` only.
  - **Tracking API:** only `ref` reaches the database (lead codes never do); tokens stay case-sensitive; CTA details are kept.
  - **QR route:** accepts tokens and rejects lead codes.
  - **No leftovers:** no QR or URL builder still uses `lead_code`, and the landing page no longer strips `?ref=`.
- **Postcards:** QR codes for 3 tokens (containing `-` and `_`, with a longer site address) rendered at 300 DPI and decoded back to their own `?ref=` link.
