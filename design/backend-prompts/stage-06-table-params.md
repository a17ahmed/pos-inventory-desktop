# Backend prompt — Stage 6: search + payment filter on the Receipts list, search on Supplies

Send everything inside the box to the backend session.

**Why:** with the new tables, Receipts and Vendors → Supplies show one page at a time (25 / 50 / 100 rows).
Their search box can only look through the page on screen, because these two list endpoints have no
`search` parameter (Customers and Expenses already have one). The desktop **already sends `search=`** to
both endpoints; today the server ignores it. Once this is in, searching finds a bill or supply on any page —
nothing to change in the desktop.

Sort is **not** needed: both lists stay newest first, which is what people want here.

```
Feature: server-side search for two paged lists. The desktop already sends the parameter.

1. GET /bill  (controllers/bill.mjs → getAllBills)
   New optional query param: search (string, trimmed, max 100 chars).
   When present, AND it with the existing filters (status, type, paymentStatus, startDate/endDate):
     - If it is a bill number — digits, optionally starting with "#" (e.g. "161", "#161") —
       match billNumber exactly (number compare).
     - Otherwise match, case-insensitive, any of: customerName, customerPhone, cashierName.
       Escape regex special characters in the user's text (no raw user regex).
   total / totalPages / hasMore in `pagination` must count the searched result, so paging works
   on the filtered list. `all=true` keeps ignoring paging as today.
   Also new optional param: paymentMethod = cash | card | online | store_credit.
     Match bills with at least one payment of that method (payments.method; a payment with
     creditFrom set counts as store_credit), or — bills with no payments array — the bill's own
     paymentMethod. AND it with everything else; counts in `pagination` follow.

2. GET /supply  (controllers/supply.mjs → getAllSupplies)
   New optional query param: search (same rules: trimmed, max 100, regex-escaped).
   AND it with vendor / paymentStatus / dates. Match, case-insensitive, any of:
     - billNumber (the vendor's bill #, a string)
     - the vendor's name: look up Vendor ids for this business whose name matches, then
       { vendor: { $in: ids } }
   total / totalPages count the searched result.

3. Validation: if there is a Joi query schema for these routes, allow `search`; otherwise just read
   it. Empty or whitespace-only search = no filter.

4. Tests (real HTTP, test DB):
   - /bill?search=161 → only bill #161; /bill?search=%23161 same;
   - /bill?search=<part of a customer name> → only that customer's bills, total = their count;
   - /bill?search=a.b(c → 200, no crash (escaped);
   - /bill?paymentMethod=online → only bills with an online payment; + startDate/endDate combine;
   - search + startDate/endDate + status=cancelled combine;
   - /supply?search=<vendor bill #> and ?search=<part of vendor name>;
   - employee with pos.view can search /bill like before (same permissions, nothing new).

Rules: don't commit, tag or push without my permission. Tell me the changed files and show the
test output.
```

## What the desktop does with it

- `src/screens/Receipts.jsx` and `src/screens/Vendors.jsx` send `search` (300 ms after typing stops);
  Receipts also sends `paymentMethod` (the "Payment" filter).
- Until the server supports it, the desktop still filters the rows on the current page, so nothing
  breaks with an older server; it just can't find rows on other pages.
- After the backend answers: test Receipts → search "161" while on page 1 of "All" → bill #161 shows
  even though it's not in the first 25; same for a vendor bill # on Supplies.
