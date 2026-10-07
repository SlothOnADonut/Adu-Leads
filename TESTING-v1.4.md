# Testing V1.4 (postcards) safely

Nothing in V1.4 mails or sends anything. About 10 minutes.

## Part A — Database self-test (2 minutes, zero risk)
1. Run the migration `supabase/migrations/2026-10-07_v1_4_postcards.sql` (SQL Editor → Run).
2. Run `supabase/tests/v1_4_postcards_test.sql`.
   ✅ **ALL V1.4 POSTCARD CHECKS PASSED (test data rolled back)**

It uses 3 temporary leads and checks:
- only the approved-image lead becomes postcard-ready;
- missing and rejected leads can't be approved;
- nobody can approve via a raw update or with a stale preview;
- notes, outreach status and QR scans don't disturb an approval;
- **replacing the image cancels the approval**, as does changing the address;
- Wave 1 is unchanged.

## Part B — Click-through (8 minutes)
Note **Anaheim ADU – Wave 1**'s counts on Campaigns first.

1. **3 throwaway leads.** Campaigns → New campaign `ZZ POSTCARD TEST`, city `Anaheim`. Import:
   ```
   Owner,Mailing Address,Property Address,City,Zip,APN,Permit Number
   PC ONE,"1 Test Mail Rd, Anaheim, CA 92801",1 Card St,Anaheim,92801,PC-APN-1,PC-P-1
   PC TWO,"2 Test Mail Rd, Anaheim, CA 92801",2 Card St,Anaheim,92801,PC-APN-2,PC-P-2
   PC THREE,"3 Test Mail Rd, Anaheim, CA 92801",3 Card St,Anaheim,92801,PC-APN-3,PC-P-3
   ```
2. **Images.** Property Images → this campaign:
   - PC ONE: upload any house photo (or paste a link) → **Approve**.
   - PC TWO: leave **Missing**.
   - PC THREE: add any image → **Reject**.
3. **Postcards page** → campaign ZZ POSTCARD TEST.
   ✅ Total 3 · Image ready 1 · Missing images 1 · Postcards ready 1 · “1 / 3 image ready”, “0 / 3 postcard approved”.
   ✅ Only PC ONE shows front/back thumbnails. PC TWO and PC THREE say *No property image yet* / *Property image was rejected — no postcard is generated*.
4. **Preview PC ONE.**
   - ✅ Front shows **PC ONE's photo**, “YOUR ANAHEIM PROPERTY”, the headline, the QR code, the benefits and Armando's details.
   - ✅ Back shows the standard 3-option layout, the funding section, the QR code, the disclaimer and the recipient address.
   - ✅ The “Ref ANA-…” code on both sides matches the lead code.
   - ✅ **Scan the QR on screen with your phone.** It opens `…/adu?lead=<PC ONE's code>`. This counts as a real scan: the lead's QR count goes up and its status flips if it was *Postcard sent*.
   - Toggle **Show print guides** to see the trim line, safe area, postage and address areas.
5. **Download front / back.** ✅ PNG files of 2775 × 1875 px. Scan the QR in the downloaded image too.
6. **Mark postcard approved.** ✅ Badge shows **Postcard approved**, and the Postcards page reads **1 / 3 postcard approved**.
7. **Replacing the image cancels the approval.** On PC ONE's lead page → Replace image URL (tick *Replace approved image*) → save.
   ✅ The postcard status goes to **Not ready**. Re-approve the image → it becomes **Ready**, *not* approved, until you approve the postcard again.
8. **Exports.** Approve PC ONE's postcard again, then:
   - **Export manifest CSV** → ✅ only PC ONE, with its asset routes, tracking URL and status `approved`.
   - **Print approved (PDF)** → ✅ 2 pages (front + back). In the print dialog: Save as PDF, margins None, Background graphics on.
9. **QR tracking unchanged.** On PC ONE click *Postcard sent*, then open its tracking URL in a private window → ✅ scan count +1, status *Scanned QR*.
10. **Clean up.** Campaigns → ZZ POSTCARD TEST → More ▾ → Permanently delete… → `DELETE`.
    ✅ Wave 1 counts match your note.
