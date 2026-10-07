# Testing V1.3 (Nearmap fetch) safely

Every address Nearmap finds costs **transaction credits**, so test on 1 lead, then 3, before a full campaign.

## Before you start
- V1.2 migration already run (no new SQL in V1.3).
- `NEARMAP_API_KEY` set in `.env.local` (and later in Vercel).
- `SUPABASE_SERVICE_ROLE_KEY` set (images are saved to the `property-images` bucket with it).
- Note the **Anaheim ADU – Wave 1** lead count and image counts on the Campaigns page.

## 1. Provider shows as connected
`npm run dev` → **Property Images**. ✅ The button reads **Fetch property images** with “Nearmap · N missing in this campaign”.
Without the key it is greyed out with “Image provider not connected”.

## 2. One real lead (1 transaction)
1. Campaigns → New campaign `ZZ NEARMAP TEST`, city `Anaheim`.
2. Import a 3-row CSV with **real addresses you know** (e.g. your own / office / a public building), each with a unique fake APN like `NM-TEST-1`:
   ```
   Owner,Property Address,City,Zip,APN,Permit Number
   TEST ONE,<real street 1>,Anaheim,<zip>,NM-TEST-1,NM-P-1
   TEST TWO,<real street 2>,Anaheim,<zip>,NM-TEST-2,NM-P-2
   TEST THREE,1 Nowhere Imaginary Rd,Anaheim,92801,NM-TEST-3,NM-P-3
   ```
3. Property Images → campaign ZZ NEARMAP TEST → on **TEST ONE** click **Fetch from Nearmap**.
   ✅ An aerial photo appears, status **Needs review**, source **nearmap**. The lead's image notes say the capture date, matched address and credits used.
   ✅ It is **not** approved and postcard ready is **No**.
4. Approve it. ✅ The **Fetch from Nearmap** button disappears for that lead (approved images can't be refetched).

## 3. Bulk (2 more transactions at most)
1. Click **Fetch property images** → check the dialog names **ZZ NEARMAP TEST** and **2** missing → **Start fetching**.
2. ✅ Progress panel counts up. Expect TEST TWO = **Successful**, TEST THREE = **No imagery found** (fake address).
3. ✅ TEST THREE's lead page shows an image note like “Nearmap: Nearmap couldn't find this address (GEOCODE_UNABLE_TO_DECODE)”, and its status stays **Missing**.
4. ✅ TEST ONE (approved) was not touched — same image, still Approved.
5. Run bulk again. ✅ Only TEST THREE is attempted (TEST TWO now has an image).

## 4. Nothing else changed
- ✅ Wave 1 counts on Campaigns are identical to your note.
- ✅ QR still works: on TEST ONE click *Postcard sent*, open `/adu?lead=<code>` in a private window → scan count 1, status *Scanned QR*, image still Approved.
- Clean up: Campaigns → ZZ NEARMAP TEST → More ▾ → Permanently delete… → `DELETE`.

## If something fails
- “Nearmap rejected the API key (401)” → key typo / not set on the server. Bulk runs stop immediately on this.
- “Nearmap refused access (403)” → your plan likely lacks Transactional Content or vertical imagery; ask your Nearmap rep.
- Other errors are written to that lead's image notes and shown in the run's **Details** list.
