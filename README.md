# ADU → HELOC Lead Tracker (V1)

Internal dashboard for Armando Fernandez's ADU → HELOC postcard campaign.
Import homeowner leads, give each one a unique QR code, track who scans, and manage follow-ups.

**Stack:** Next.js 15 (App Router) · TypeScript · Tailwind CSS 4 · Supabase (Postgres + Auth)

---

## What's inside

```
adu-leads/
├── supabase/
│   ├── schema.sql          ← run this first in Supabase (tables, security, functions)
│   ├── migrations/         ← run these after schema.sql, in date order (V1.1 archive/delete)
│   ├── tests/              ← throwaway self-tests (roll back, change nothing)
│   └── seed.sql            ← optional: first campaign + 8 DEMO leads to click around
├── sample-data/
│   └── anaheim-adu-leads-example.csv   ← example import file
├── src/
│   ├── middleware.ts       ← sends logged-out users to /login
│   ├── app/
│   │   ├── login/          ← sign-in page
│   │   ├── (app)/          ← everything behind login
│   │   │   ├── dashboard/  ← KPIs, recent scans, follow-ups, campaign table
│   │   │   ├── leads/      ← filterable table + [id] detail page
│   │   │   ├── follow-ups/ ← overdue / today / upcoming / pipeline buckets
│   │   │   ├── campaigns/  ← per-campaign stats + "mark all sent"
│   │   │   ├── import/     ← CSV upload → match columns → preview → import
│   │   │   └── export/     ← mail-merge CSV + ZIP of QR PNGs
│   │   ├── adu/            ← PUBLIC landing page (no homeowner data)
│   │   └── api/
│   │       ├── track/      ← PUBLIC: logs a visit/scan (server-side only)
│   │       ├── qr/[code]/  ← PUBLIC: QR PNG for a lead code
│   │       └── export/     ← logged-in: CSV and ZIP downloads
│   ├── components/         ← shared UI (badges, quick-action buttons…)
│   └── lib/                ← Supabase clients, scoring, CSV mapping, server actions
├── .env.example
└── README.md
```

---

## 1. Set up Supabase (about 10 minutes)

1. Go to **https://supabase.com** → sign in → **New project**.
   Name it `adu-leads`, pick a strong database password (save it somewhere), region **West US**. Wait ~2 minutes for it to finish.
2. In the left sidebar click **SQL Editor** → **New query**.
3. Open `supabase/schema.sql` from this folder, copy **everything**, paste it into the editor, click **Run**.
   You should see "Success. No rows returned."
   Then do the same with each file in `supabase/migrations/`, oldest first:
   `2026-10-06_v1_1_safe_delete.sql`, then `2026-10-07_v1_2_property_images.sql`.
4. (Optional but recommended) New query again → paste all of `supabase/seed.sql` → **Run**.
   This creates your real campaign **"Anaheim ADU – Wave 1"** plus 8 fake `DEMO-` leads so the dashboard isn't empty. Run it only once.
5. **Turn off public sign-ups** (important — this is an internal tool):
   **Authentication → Sign In / Providers** (may be called "Providers" or "Settings") → turn **off** "Allow new users to sign up". Leave **Email** enabled.
6. **Create your login(s):** **Authentication → Users → Add user → Create new user**.
   Enter your email and a password, and check **Auto Confirm User**. Repeat for Armando or anyone else on the team.
7. **Copy your keys:** **Project Settings (gear icon) → API** (or **API Keys**). You need three values:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon / publishable key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role / secret key** → `SUPABASE_SERVICE_ROLE_KEY` (keep this private — never paste it anywhere public)

> When you're done testing, remove demo data with:
> ```sql
> delete from public.leads where lead_code like 'DEMO-%';
> delete from public.campaigns where name = 'DEMO – sample data';
> ```

---

## 2. Run it on your computer

You need **Node.js 20 or newer**. Check by opening Terminal (Mac) or PowerShell (Windows) and typing `node -v`.
If it's missing or older, install the "LTS" version from **https://nodejs.org**.

```bash
# 1. go into the project folder (adjust the path to wherever you unzipped it)
cd ~/Downloads/adu-leads

# 2. install the libraries (one time, takes a minute)
npm install

# 3. create your settings file
cp .env.example .env.local        # Windows PowerShell: copy .env.example .env.local
```

Open `.env.local` in any text editor and paste in the three Supabase values from step 1.7.
For local testing set:

```
NEXT_PUBLIC_TRACKING_BASE_URL=http://localhost:3000/adu
```

Then start it:

```bash
npm run dev
```

Open **http://localhost:3000** → sign in with the user you created.

**Test QR tracking locally:** open `http://localhost:3000/adu?lead=DEMO-0004` in another tab, then open lead DEMO-0004 in the dashboard — the scan count goes up, a "Scanned QR code" event appears, and its status changes from *Postcard sent* to *Scanned QR*.

---

## 3. How QR tracking works

```
Postcard QR  →  https://YOUR-SITE/adu?lead=ANA-0001
                    │
                    ▼
   /adu landing page (public, generic — shows NO homeowner info)
                    │  the browser quietly sends {lead: "ANA-0001"}
                    ▼
   POST /api/track  (runs on the server)
                    │  uses the secret service-role key, which never leaves the server
                    ▼
   record_lead_visit() database function
      • landing_page_visit_count + 1
      • qr_scan_count + 1 (refreshes within 30 min count as visits, not new scans)
      • first_qr_scan_at set on first visit, last_qr_scan_at updated
      • status "Postcard sent" → "Scanned QR", and follow-up set for today
      • logs qr_scan + landing_page_visit events
```

Security details:
- The landing page never reads the database and never shows names or addresses.
- `/api/track` always answers `{ok:true}` — it never reveals whether a code exists.
- Anonymous visitors have **no** table access (Row Level Security). The only way to touch lead data publicly is the two narrow database functions above, and only the server can call them.
- Link-preview bots (iMessage, Facebook, etc.) are ignored.
- After logging, the `?lead=` code is removed from the address bar, so forwarded links don't count as new scans.
- Clicks on **Check HELOC Options / Book a Call / Call Armando** are logged as `cta_click` events too.

---

## 4. Import your first 100 leads

1. Put your leads in a CSV (export from Excel/Google Sheets with **File → Download → CSV**).
   See `sample-data/anaheim-adu-leads-example.csv` for the expected columns. Every row needs an **APN** or a **Permit Number** (ideally both).
2. In the dashboard click **Import** → drop the file in.
3. Choose the campaign (**Anaheim ADU – Wave 1**), keep City = **Anaheim** (that's what makes codes `ANA-0001`, `ANA-0002`…).
4. Check the column matches (most are guessed automatically) and the **Owner name format** — public records are usually `LAST FIRST`. Glance at the preview.
5. Click **Import**. You'll see how many were new, updated, or skipped.

**Re-importing is safe.** If APN + permit number already exist, only permit/enrichment fields (owner name, addresses, sale data, scores) are refreshed, and blank cells never erase existing data. Notes, statuses, follow-up dates, postcard dates and scan history are never touched.

**Scores:** if your CSV has `Permit Score` / `Priority`, those are used. Otherwise they're calculated: permit score from permit recency + job value + status; equity score from years since last sale; priority = 60% permit + 40% equity. Tweak in `src/lib/scoring.ts`.

### Then mail them
1. **QR Export** → pick the campaign → **Download CSV** (for Canva Bulk Create / Lob / print shop) and/or **Download QR images (ZIP)** (`ANA-0001.png` etc.). Do this from the deployed site so image links work for the printer.
2. Optionally click **Mark these as Postcard queued**.
3. When postcards actually go out: **Campaigns → Mark all sent** (pick the date). This sets every lead to *Postcard sent*, so scans flip them to *Scanned QR*.

---

## 5. Deploy to Vercel

1. Put the project on GitHub: create a new **private** repo at https://github.com/new, then in the project folder:
   ```bash
   git init
   git add .
   git commit -m "ADU lead tracker v1"
   git branch -M main
   git remote add origin https://github.com/YOUR-USERNAME/adu-leads.git
   git push -u origin main
   ```
   (`.env.local` is ignored automatically, so your keys are not uploaded.)
2. Go to **https://vercel.com** → **Add New → Project** → import the repo. Framework is detected as Next.js.
3. Before clicking Deploy, open **Environment Variables** and add every key from `.env.example`:
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
   `NEXT_PUBLIC_TRACKING_BASE_URL`, `NEXT_PUBLIC_HELOC_URL`, `NEXT_PUBLIC_BOOKING_URL`, `TRACKING_ALLOWED_ORIGINS`.
4. Click **Deploy**. You get a URL like `adu-leads.vercel.app`.
5. **Add a domain** (Vercel → Project → Settings → Domains). Recommended: `leads.armandofundsloans.com`. Vercel shows the DNS record to add at your domain registrar.
6. Set `NEXT_PUBLIC_TRACKING_BASE_URL` to the final address (see below) and **redeploy** (Deployments → ⋯ → Redeploy). Changing it changes every QR code, so lock it in **before** printing.

### Which URL goes in the QR code?

**Option A — simplest (recommended for this week):** use this app's own landing page.
`NEXT_PUBLIC_TRACKING_BASE_URL=https://leads.armandofundsloans.com/adu`
Works immediately with nothing else to connect.

**Option B — Armando's main website:** keep `https://armandofundsloans.com/adu?lead=…` on the main site and have that page report the visit to this app. Add this to the main site's `/adu` page (and set `TRACKING_ALLOWED_ORIGINS` to the main site's address):

```html
<script>
  (function () {
    var p = new URLSearchParams(location.search), lead = p.get("lead");
    if (!lead) return;
    fetch("https://leads.armandofundsloans.com/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      keepalive: true,
      body: JSON.stringify({ lead: lead, referrer: document.referrer, page: location.pathname })
    });
    p.delete("lead");
    history.replaceState(null, "", location.pathname + (p.toString() ? "?" + p : ""));
  })();
</script>
```

---

## 6. Things you need to connect manually

| Item | Where |
|---|---|
| Supabase project, run `schema.sql`, create users, disable sign-ups | Supabase dashboard (section 1) |
| Environment variables | `.env.local` locally, Vercel settings in production |
| Final QR destination (Option A or B) — **decide before printing** | `NEXT_PUBLIC_TRACKING_BASE_URL` |
| Booking link (Calendly etc.) for "Book a Call" | `NEXT_PUBLIC_BOOKING_URL` (falls back to calling Armando) |
| HELOC application/pre-qual link for "Check HELOC Options" | `NEXT_PUBLIC_HELOC_URL` (falls back to the "How it works" section) |
| Domain / DNS for `leads.armandofundsloans.com` | Vercel + your domain registrar |
| Compliance review of landing page copy (company NMLS #, licensing states, Equal Housing logo/wording) | `src/app/adu/page.tsx` |
| Real homeowner data / enrichment in your CSV | Your data source |
| Postcard design + printing / mail-merge service | Canva, Lob, print shop, etc. |
| Automatic property photos (licensed imagery provider) — not connected in V1.2 | `src/lib/property-images/provider.ts` |

---

## Archive & delete (V1.1)

- **Archive a campaign** (Campaigns → *More ▾* → Archive): hides it from the dashboard, follow-ups, QR export
  and all campaign dropdowns. **Nothing is deleted.** See it under the **Archived** tab and **Restore** any time.
  To look at archived leads: Leads → tick *Include archived campaigns*, or pick the campaign from the filter.
- **Permanently delete a campaign** (*More ▾* → Permanently delete…): deletes the campaign, every lead in it, and
  their scans, events and notes. Shows counts first and requires typing `DELETE`. If postcards were already mailed,
  the dialog recommends **Archive instead**.
- **Delete leads**: tick rows on the Leads page (or the header box to tick all visible) → *Delete selected…*.
- **Delete all filtered leads**: apply at least one filter, then use the small *Delete all N filtered leads…* link.
  The dialog lists the filters and the exact count; if the count changes before you confirm, nothing is deleted.

Before using these on real data, run through **TESTING-v1.1.md**.

## Property images (V1.2)

Every lead has a property photo slot with a status: **Missing → Needs review → Approved** (or **Rejected**).
**Postcard image ready** is automatically *Yes* only when the photo is **Approved**.

- **Lead page → Property image**: add/replace an image link, upload a photo (JPG/PNG/WebP, max 4 MB), Approve / Reject / Needs review, and image notes.
- **Property Images page**: pick a campaign and review every photo as a grid of cards. The status chips at the top show counts.
- **Leads page**: compact *Image* column and a *Property image* filter.
- **Campaigns page**: counts per status (click to filter) and **Postcard image readiness: X / Y ready**.
- **Approved photos are locked.** Imports, scripts and future automatic fetches can't change them. To change one, use
  *Replace* and tick “Replace approved image”, which puts the lead back to *Needs review*.
- **No image provider is connected yet.** The “Fetch property images” button stays disabled. The plug-in point is
  `src/lib/property-images/provider.ts`.
- Uploaded photos go to a Supabase Storage bucket called `property-images`. Anyone with a photo's exact random link
  can open it (printers need that), but nobody can list the bucket.

Test it first with **TESTING-v1.2.md**.

## Everyday use

- **Dashboard** — the numbers, the newest scans, and who needs a call.
- **Follow-ups** — work top to bottom: *Scanned but not contacted* first. Buttons log the action and move the status forward automatically (statuses never move backward on their own, and *Do not contact* is never changed automatically).
- **Lead page** — full details, QR code, timeline, notes (dated automatically), status panel.
- **Rates** on the dashboard and campaigns page are all *÷ postcards sent*.

## Troubleshooting

- **"Invalid API key" / can't log in** → check the three Supabase values in `.env.local` (no quotes, no spaces), then stop (`Ctrl+C`) and rerun `npm run dev`.
- **Scans not counting** → `SUPABASE_SERVICE_ROLE_KEY` missing or wrong; or the lead code doesn't exist. Check Vercel → Logs for "tracking failed".
- **Import error about a date or number** → the error names the row; fix that cell in the CSV and re-import (rows before it were already saved; re-importing them is safe).
- **QR images broken in a print tool** → export from the deployed site, not `localhost`.
