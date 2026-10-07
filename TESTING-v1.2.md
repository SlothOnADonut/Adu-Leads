# Testing V1.2 (property images) safely

About 10 minutes. Do it before reviewing real Wave 1 photos.

## Part A — Database self-test (2 minutes, zero risk)

1. Supabase → **SQL Editor → New query**.
2. Paste all of `supabase/tests/v1_2_property_images_test.sql` → **Run**.
3. Expect: **ALL V1.2 PROPERTY-IMAGE CHECKS PASSED (test data rolled back)**.

It uses 3 temporary leads and checks:
- an image URL on lead 1 → *Needs review* → *Approved* → postcard ready;
- an approved image can't be swapped without Replace (not even by a raw database update);
- lead 2 rejected, lead 3 left missing, counts 1 / 1 / 1 and 1 of 3 ready;
- re-importing the CSV doesn't touch images, notes or status;
- QR scans still count and still flip *Postcard sent* → *Scanned QR*;
- Wave 1 leads are byte-for-byte unchanged.

Everything is rolled back. Any `CHECK … FAILED` → stop and send me the message.

## Part B — Click-through (8 minutes)

Before starting, note **Anaheim ADU – Wave 1**'s lead count on the Campaigns page.

1. **Throwaway campaign + 3 leads.** Campaigns → New campaign `ZZ IMAGE TEST`, city `Testville`.
   Import this CSV into it (City `Testville`):
   ```
   Owner,Property Address,City,APN,Permit Number
   IMG ONE,1 Img St,Testville,IMG-APN-1,IMG-P-1
   IMG TWO,2 Img St,Testville,IMG-APN-2,IMG-P-2
   IMG THREE,3 Img St,Testville,IMG-APN-3,IMG-P-3
   ```
   ✅ Campaign card shows **0 approved · 0 needs review · 3 missing** and **0 / 3 ready**.
2. **Lead 1 — add and approve.** Open TES-… for *IMG ONE* → Property image → **Add image URL** → paste any public photo link
   (for a test, a photo you uploaded somewhere yourself) → Save.
   ✅ Status *Needs review*, source *Pasted URL*, postcard ready *No*.
   Click **Approve**. ✅ Status *Approved*, postcard ready *Yes*.
3. **Approval lock.** Still on lead 1 → **Replace image URL**. ✅ You must tick *Replace approved image* before it will save. Cancel by clicking the button again.
4. **Lead 2 — reject.** Add any image URL to *IMG TWO*, then **Reject**. ✅ Status *Rejected*, not ready.
5. **Lead 3** — leave it alone. ✅ Shows *No property image yet*.
6. **Counts and filters.**
   - Campaigns: ✅ **1 approved · 0 needs review · 1 missing · 1 rejected**, **1 / 3 ready**. Click "1 approved" → Leads page filtered to that campaign + Approved shows only IMG ONE.
   - Leads page → Property image filter **Missing** + campaign ZZ IMAGE TEST → only IMG THREE.
   - Property Images page → campaign ZZ IMAGE TEST → chips show the same counts; Approve / Reject / Needs review work on the cards.
   - ✅ "Fetch property images" is greyed out and says **Image provider not connected**.
7. **QR tracking still works.** On IMG ONE click *Postcard sent*, then open `/adu?lead=<its code>` in a private window.
   ✅ Scan count goes to 1, status becomes *Scanned QR*, image stays *Approved*.
8. **Clean up.** Campaigns → ZZ IMAGE TEST → More ▾ → Permanently delete… → type `DELETE`.
9. ✅ Wave 1 lead count matches what you noted, and a Wave 1 lead still shows its notes, status and scans.

Optional: try **Upload photo** on a test lead with a small JPG — it should appear and be marked *Needs review*, source *Uploaded photo*.
