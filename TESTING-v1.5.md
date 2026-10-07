# Testing V1.5 (final postcard design + mailing readiness)

Nothing in V1.5 mails or sends anything. About 15 minutes.

## Part A — Database (3 minutes, zero risk)

1. In Supabase → SQL Editor, run `supabase/migrations/2026-10-07_v1_5_mailing_readiness.sql`.
2. Run each test below. Every one should end with **…CHECKS PASSED (test data rolled back)**.

| Test file | Covers |
|---|---|
| `supabase/tests/v1_5_mailing_readiness_test.sql` | the 9 V1.5 checks below |
| `supabase/tests/v1_4_postcards_test.sql` | V1.4 postcard rules (updated: its test leads now include mailing addresses) |
| `supabase/tests/v1_2_property_images_test.sql` | approved-image lock, QR tracking |
| `supabase/tests/v1_1_safe_delete_test.sql` | archive / delete |

The V1.5 test checks:
1. Approved image + full mailing info = **ready**.
2. Approved image + missing mailing = **not ready**. Partial mailing (e.g. no ZIP) is also not ready, and the property address is never used as the mailing address.
3. Full mailing info + missing or unreviewed image = **not ready**.
4. A postcard can't be approved with incomplete mailing info, not even by a raw database update.
5. Changing the recipient name, street (including via CSV re-import), city, state or ZIP **cancels the approval**. Notes, outreach status, follow-up dates, scans and events do **not**.
6. Replacing the approved image cancels the approval. Re-approving the image gives *ready*, not *approved*.
7. Lead codes (and so QR codes) never change, are unique, and a scan lands on the right lead.
8. **Do not contact** leads never appear in exports or print batches. Neither do non-approved postcards.
9. Archive, restore, delete selected and delete campaign still work, and nothing outside the test campaign changes (Wave 1 fingerprint).

### What the migration does to existing data
- Each lead's existing `mailing_address` text is split into street / city / state / ZIP **only if** it clearly reads like `123 Main St, Anaheim, CA 92801` (or `…, Anaheim CA 92801`). The original text is not modified.
- Leads whose mailing text can't be split, or that have none, become **Missing mailing information**. Any approval they had is cleared, so they can't print until fixed.
- Approved postcards with complete mailing info **stay approved**.

**Check right after migrating:** open **Postcards** for Wave 1 and click the **Missing mailing info** filter. Fix those leads on their lead pages before printing.

## Part B — Click-through (10 minutes)

Note **Anaheim ADU – Wave 1**'s counts on Campaigns and Postcards first.

1. **Throwaway campaign.** Campaigns → New campaign `ZZ V1.5 TEST`, city `Anaheim`. Import this CSV:
   ```
   Owner,Mailing Address,Property Address,City,Zip,APN,Permit Number
   V15 ONE,"10 Mail Rd, Anaheim, CA 92801",1 Prop St,Anaheim,92801,V15-APN-1,V15-P-1
   V15 TWO,,2 Prop St,Anaheim,92801,V15-APN-2,V15-P-2
   V15 THREE,"30 Mail Rd, Anaheim, CA 92805",3 Prop St,Anaheim,92805,V15-APN-3,V15-P-3
   ```
2. **Images.** Property Images → this campaign:
   - V15 ONE: upload a photo → **Approve**.
   - V15 TWO: upload a photo → **Approve**.
   - V15 THREE: leave **Missing**.
3. **Postcards page.**
   - ✅ ONE: thumbnails, *Ready for review*, Approve and Download buttons.
   - ✅ TWO: thumbnails with a **Missing mailing information** badge, the back shows the orange box, no Approve and no Download.
   - ✅ THREE: “No property image yet — no postcard is generated.”
   - ✅ The **Missing mailing info** filter shows TWO.
4. **New design (preview ONE).**
   - ✅ Front: the photo fills about two-thirds of the card, with “YOUR ANAHEIM PROPERTY” at top-left and the benefit row across the photo bottom (Extra Living Space · Rental Income · Property Value). The green panel has the headline, the QR with “SCAN TO SEE WHAT'S POSSIBLE”, and Armando's details smaller below. No homeowner name on the front.
   - ✅ Back: 3 concept cards on the left, the dashed **PLACEHOLDER** disclosure box, the disclaimer, then on the right “THINKING ABOUT BUILDING AN ADU?”, the HELOC copy and pill, the QR, Armando's details and the recipient in the address area.
   - Turn on **Show print guides**: ✅ text stays inside the blue safe line, and the postage and address areas are clear.
   - ✅ Scan the on-screen QR with your phone. It opens ONE's `/adu?lead=…` link (this counts as a real scan).
5. **Approve ONE**, then change its mailing ZIP on the lead page (Postcard mailing information → Save).
   - ✅ It asks you to confirm, and afterwards the postcard is back to **Ready for review**.
   - Approve it again, then change only **Notes** or click *Called* → ✅ it stays **Approved**.
6. **Fix TWO.** On TWO's lead page fill Street / City / State / ZIP → Save.
   - ✅ The badge disappears and it becomes **Ready for review**; it can now be approved.
7. **Image replacement.** On ONE: Replace image URL (tick *Replace approved image*). ✅ The postcard goes to **Not ready**. Re-approve the image → **Ready**, not approved.
8. **Exports.** Approve ONE and TWO. Mark TWO **Do not contact**.
   - **Export manifest CSV** → ✅ only ONE, with mailing_street/city/state/zip columns.
   - **Print approved (PDF)** → ✅ only ONE, 2 pages, 9.25″ × 6.25″.
9. **QR tracking.** On ONE click *Postcard sent*, then open its tracking link in a private window → ✅ scan count +1, status *Scanned QR*, postcard still Approved.
10. **Clean up.** Campaigns → ZZ V1.5 TEST → More ▾ → Permanently delete… → `DELETE`. ✅ Wave 1 counts match your notes.

## Before a real print run
- Put the employer-approved disclosure text in `src/lib/postcards/content.ts` → `EMPLOYER_DISCLOSURE`, then redeploy. The placeholder box disappears.
- Print one physical proof and scan the QR from paper.
