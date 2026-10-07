# Testing V1.6 (final /adu landing page)

V1.6 has **no database migration**. QR tracking, the 30-minute scan dedupe, lead codes, postcards, campaigns, Nearmap and login are unchanged.

## 0. Setup (one time)
In `.env.local`, and in Vercel → Settings → Environment Variables:
```
NEXT_PUBLIC_HELOC_URL=        # approved HELOC page (blank → button scrolls to the HELOC section)
NEXT_PUBLIC_BOOKING_URL=      # Armando's Calendly (blank → "Book a Call" dials Armando)
NEXT_PUBLIC_APPLICATION_URL=  # NEW: loan application (blank → "Start Loan Application" is hidden)
```
Photos, the headshot, compliance text and the property-address switch are in `src/lib/landing/config.ts` (see section 3).

## 1. Database check (2 minutes, zero risk)
Supabase → SQL Editor → run `supabase/tests/v1_6_landing_tracking_test.sql`.
✅ **ALL V1.6 TRACKING CHECKS PASSED (test data rolled back)**

It confirms:
- the first visit = 1 scan, and status *Postcard sent* → *Scanned QR*;
- refreshes within 30 minutes add page visits only (dedupe);
- a visit after 30 minutes = a new scan;
- CTA clicks store the button and where on the page it was clicked;
- bad codes are ignored.

## 2. Manual tests
Use a throwaway campaign (city Anaheim) with two leads, and note their codes (e.g. ANA-0101, ANA-0102). Give lead 1 an **approved** property image, and leave lead 2 with **no approved image**. Mark lead 1 *Postcard sent*.

| # | Test | How | Expected |
|---|---|---|---|
| 1 | No lead code | open `/adu` | Generic page renders, “YOUR ANAHEIM PROPERTY”, fallback hero panel (or your `heroFallback` photo). No personal band. |
| 2 | Approved image | open `/adu?lead=<lead 1>` in a **private window** | Lead 1's property photo fills the hero. Band below the hero: “You're already exploring…”. **No owner name or address anywhere.** The `?lead=` code disappears from the address bar. |
| 3 | Valid lead, no approved image | `/adu?lead=<lead 2>` | Generic hero image plus the personal band. Lead 2's unapproved image is **not** shown. |
| 4 | Invalid code | `/adu?lead=hello`, `/adu?lead=ANA-99999`, `/adu?lead=<script>` | Generic page every time, never an error page. |
| 5 | QR tracking increments | after test 2, open lead 1 in the dashboard | QR scans +1, page visits +1, status **Scanned QR**, timeline shows “Scanned QR code” + “Visited landing page”. |
| 6 | Dedupe | open the same `/adu?lead=<lead 1>` link again (new private window) within 30 minutes | Page visits +1, **QR scans unchanged**. |
| 7 | HELOC button | click **Explore HELOC Options** (hero) | Opens your HELOC link in a new tab. Lead timeline: “Clicked a button · Button: Explore HELOC Options (hero)”. |
| 8 | Calendly button | click **Book a Call** | Opens Calendly. The URL includes `utm_source=postcard&utm_content=<lead code>` so the booking can be matched to the lead. |
| 9 | Phone on mobile | on a phone, tap **Call** (sticky bar) and **Call Armando** | Phone app opens with 714-746-1584. |
| 10 | Application button | click **Start Loan Application** (Armando section) | Opens the application link. Timeline: “Button: Start Loan Application (trust)”. |
| 11 | Desktop | open on a laptop/desktop | Large photo left (~60%), headline and buttons right, sections in two or three columns, footer placeholders visible. |
| 12 | Mobile | open on an iPhone and an Android phone | Photo on top, then the headline. **Explore HELOC Options and Book a Call are visible without scrolling.** The sticky bottom bar has Call + Explore HELOC. No sideways scrolling. |

Clean up afterwards: delete the throwaway campaign (More ▾ → Permanently delete…).

## 3. Before going live
- **Photos:** add licensed photos to `public/landing/`, then set the paths in `src/lib/landing/config.ts` → `LANDING_IMAGES`:
  - `heroFallback` (2400×1600)
  - `garage`, `detached`, `junior` (1200×900)
  - `headshot` (800×800, Armando's final photo)

  Until then the page shows designed dark panels. The AF monogram stays in place until the headshot is set.
- **Compliance:** fill `COMPLIANCE` in `config.ts` with employer-approved text (mortgage disclosure, company NMLS, Equal Housing, privacy-policy link). Empty fields show labeled placeholders on the live page.
- **Property address:** never loaded or shown on the public page (lead codes are sequential, so it would expose the mailing list).

## Debug: verifying the hero image (development)

When you run `npm run dev`, every `/adu?lead=…` request prints **one line** in the terminal where the dev server runs. It shows only the code and the reason, never names or addresses:

```
[adu] lead=ANA-0001 → ok_approved_image
[adu] lead=ANA-0002 → image_not_approved (missing)
[adu] lead=(invalid) → invalid_code
```

The hero also carries a marker you can check in the browser: right-click the photo → **Inspect** and look for `data-hero-source` on the hero container.

| Value | Meaning |
|---|---|
| `lead-image` | the lead's approved property photo |
| `fallback-image` | your generic `heroFallback` photo |
| `fallback-panel` | the dark designed panel (no photo configured) |

**1. Approved lead image shows**
- Open `/adu?lead=<code with an approved image>` in a private window.
- ✅ Terminal: `→ ok_approved_image`.
- ✅ `data-hero-source="lead-image"`, and the photo is visible.
- In DevTools → Network the image loads from `/_next/image?url=…supabase.co/storage/v1/object/public/…` for Supabase photos, or directly from its own link for other hosts.

**2. Missing-image lead shows the fallback**
- Open a lead whose image is missing, needs review or was rejected.
- ✅ Terminal: `→ image_not_approved (missing | needs_review | rejected)`.
- ✅ `data-hero-source="fallback-panel"` (or `fallback-image`).
- ✅ The “You're already exploring…” band still appears.

**3. Invalid lead shows the fallback**
- Open `/adu?lead=hello` or `/adu?lead=ANA-99999`.
- ✅ Terminal: `→ invalid_code` or `→ not_found`.
- ✅ Fallback hero, no personal band, no error page.

**If an approved lead still shows the fallback, the terminal reason tells you why:**

| Reason | Fix |
|---|---|
| `client_unavailable (Missing … SUPABASE_SERVICE_ROLE_KEY)` | Add `SUPABASE_SERVICE_ROLE_KEY` (and `NEXT_PUBLIC_SUPABASE_URL`) to `.env.local`, then restart `npm run dev`. The public page reads leads with the server-only key. |
| `timeout` | Supabase didn't answer within 8 s (twice). Check your connection or project status, then reload. |
| `query_error (…)` | The message says what Supabase rejected (e.g. wrong key). |
| `not_found` | That code doesn't exist in this Supabase project. Check you're pointing at the right project. |
| `do_not_contact` | The lead is marked Do not contact, so the page is deliberately generic. |
| `image_url_invalid` | The stored image link doesn't start with http(s). Replace it on the lead page. |

If the photo is a Supabase link and the browser shows an error about an unconfigured host, restart `npm run dev` after setting `NEXT_PUBLIC_SUPABASE_URL`. `next.config.ts` reads it at startup to allow that host. If an optimized image ever fails, the page retries the original link automatically.

## What was checked during development
- **Hero-image fix (24 automated checks):**
  - an approved image shows even when the database takes 3 s to answer (the old 2.5 s limit dropped it);
  - an approved image shows even when the lead's mailing info is incomplete;
  - missing, needs-review, unknown and invalid codes fall back;
  - a missing key, query errors and timeouts report a reason instead of failing silently;
  - Supabase photos go through `next/image`, other hosts through a plain `<img>`;
  - no owner name or address in the page.
- The page component was rendered for 8 cases (no code, approved image, no approved image, invalid, unknown, Do not contact, duplicate `?lead=`, lowercase code) plus a database outage. Results:
  - the right hero every time;
  - the owner name never appears;
  - the address stays hidden;
  - the Calendly link carries the lead code;
  - script-like input is never injected;
  - the page renders even when the database client fails.
- Screenshots were taken at 390 px (phone), 820 px (tablet) and 1440 px (desktop) with the real Tailwind styles:
  - no horizontal overflow;
  - every tap target is at least 44 px;
  - on a 390×844 phone, the hero HELOC button ends at 584 px, above the fold.
