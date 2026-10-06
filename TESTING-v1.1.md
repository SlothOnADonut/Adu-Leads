# Testing V1.1 (archive / delete) safely

Do these in order **before** using delete on real data. Total time: ~10 minutes.

## Part A — Database self-test (2 minutes, zero risk)

1. Supabase → **SQL Editor → New query**.
2. Paste all of `supabase/tests/v1_1_safe_delete_test.sql` → **Run**.
3. You should see: **ALL V1.1 SAFE-DELETE CHECKS PASSED (test data rolled back)**.

This creates a temporary campaign with 3 leads, deletes one lead, archives, restores,
permanently deletes the campaign, and checks that every other campaign — including
**Anaheim ADU – Wave 1** — has exactly the same number of leads and events as before.
Everything is rolled back at the end, so nothing stays in your data.

If you see an error starting with `CHECK … FAILED`, stop and send it to me.

## Part B — Click-through test in the app (8 minutes)

Write down first: the **Leads** count of **Anaheim ADU – Wave 1** (Campaigns page) and the total on the Leads page.

1. **Make a throwaway campaign.** Campaigns → New campaign → name it `ZZ TEST – delete me`, city `Testville`.
2. **Import 3 test leads into it.** Save this as `test-leads.csv`:
   ```
   Owner,Property Address,City,APN,Permit Number
   TEST ONE,1 Test St,Testville,TEST-APN-1,TEST-P-1
   TEST TWO,2 Test St,Testville,TEST-APN-2,TEST-P-2
   TEST THREE,3 Test St,Testville,TEST-APN-3,TEST-P-3
   ```
   Import → choose campaign **ZZ TEST – delete me** → City `Testville` → Import. They get codes `TES-0001…0003`.
3. **Give one some history.** Open `/adu?lead=TES-0002` in a new tab (counts as a scan). Add a note on TES-0002.
4. **Delete one selected lead.** Leads → Campaign filter = **ZZ TEST – delete me** → Apply → tick **TES-0001** only →
   *Delete selected…* → check the dialog says **1** → type `DELETE` → confirm.
   ✅ Only TES-0001 disappears; TES-0002 and TES-0003 remain.
5. **Archive.** Campaigns → ZZ TEST → **More ▾ → Archive campaign**.
   ✅ It vanishes from Active and from the campaign dropdowns on Leads / Import / QR Export, and its leads no longer show on Dashboard or Follow-ups.
   ✅ **Archived (1)** tab shows it with 2 leads; TES-0002 still has its scan and note.
6. **Restore.** Archived tab → **Restore**. ✅ It's back under Active with the same numbers.
7. **Permanently delete.** **More ▾ → Permanently delete…**
   ✅ The dialog shows the name, **2 leads**, the scan count and event count, and the button stays grey until you type `DELETE`.
   Type `DELETE` → confirm.
8. **Verify it's gone.** ✅ Not in Active or Archived. Leads search for `TES-` finds nothing. `/leads?archived=1` also finds nothing.
9. **Verify Wave 1 is untouched.** ✅ Anaheim ADU – Wave 1 lead count and the Leads total match what you wrote down.

Optional: test **Delete all filtered leads** the same way — import the 3 test leads again into a test campaign,
filter Leads by that campaign, click *Delete all 3 filtered leads…*, and check the dialog lists the campaign filter and the number 3.

## How the safety works

- Every delete needs the word `DELETE` typed exactly — checked in the browser, in the server, **and** inside the database function.
- Deletes run inside single database functions, so they either fully finish or fully roll back.
- "Delete selected" sends the exact lead IDs you ticked — nothing else.
- "Delete all filtered" only appears when at least one filter is active, re-runs the **same** filter on the server,
  and refuses if the number of matches isn't exactly the number you confirmed.
- Campaign delete removes only leads whose campaign is that campaign. Old events from leads that now belong to another campaign are kept.
- Nothing ever touches login users, settings, or other tables.
- Deleting a campaign row directly in Supabase's table editor does **not** wipe its leads (they become "No campaign").
- Lead codes are never reused. If you delete ANA-0007, the next new lead is still the next number, so an old postcard can't point at a different person.
