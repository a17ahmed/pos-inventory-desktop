# Backend prompt — Stage 7: sales insights for the dashboard drill-down windows

Send everything inside the box to the backend session when Stage 7 starts (or earlier if you want
the endpoint ready). Spec of the windows: `design/06-charts.md` §3.

```
Feature: a shop-level "sales insights" endpoint for the desktop dashboard's drill-down windows.

Background
- controllers/platform.mjs getBillsSummary already computes, for ONE day: bills, sales, paid (real
  money taken that day), paidByStoreCredit, creditGiven, profit, discount, itemsSold,
  billsWithCustomer, firstBillAt, lastBillAt, cancelled, onHold, byHour, byCashier, byPaymentMethod.
  It is only reachable by platform admins.
- The shop's GET /v1/dashboard/summary only supports filter=today|week|month.

What to build
1. Move the getBillsSummary aggregation into a shared function (e.g. computeSalesInsights in
   controllers/bill.mjs or utils/), used by BOTH the platform route and the new shop route, so they
   can never disagree. The platform response must stay exactly the same.

2. New route: GET /v1/dashboard/insights/sales?from=YYYY-MM-DD&to=YYYY-MM-DD
   - Shop-scoped (req.user.businessId), same auth/middleware as /v1/dashboard/summary.
   - from/to are local dates in the shop's time zone (Asia/Karachi), inclusive, midnight to midnight.
     Default: today. Reject to < from, bad dates, or ranges over 366 days (400 with a clear message).
   - Buckets: one day → by hour (0–23, include hours with 0 so the chart has no gaps between the first
     and last bill); more than one day → by day (every day in the range, zeros included).
     Return `bucket: "hour" | "day"` and `series: [{ key, label, bills, sales, profit }]`.
   - Everything getBillsSummary returns today, for the whole range.
   - Plus:
       averageBill (sales / bills),
       largestBill: { billId, billNumber, total, createdAt, cashierName, customerName } or null,
       topBills: the 5 largest completed bills (same fields),
       peak: { key, label, sales, bills } (the bucket with the most sales) or null,
       billSizeSpread: counts of completed bills with total < 500, 500–999, 1000–4999, ≥ 5000,
       topProducts: top 5 by sales in the range { productId, name, qty, sales },
       refunds: { count, amount } for returns processed in the range (by returnedAt),
       previous: the same headline totals (bills, sales, paid, creditGiven, profit, discount,
         itemsSold, averageBill) for the previous period of the same length
         (yesterday for a day, the 7 days before for a week, …), so the app can show "+18% vs yesterday".
   - When the Money Book is on, add byAccount: [{ accountId, name, type, amount, count }] for payments
     taken in the range (same rule as `paid`: real money, taken in the range, not store credit).
   - Profit fields (profit, previous.profit, series[].profit) follow the existing canViewProfit rule —
     redact them the same way the dashboard summary does for users who can't see profit.

3. Permission: whoever can see the admin dashboard today. Cashiers without dashboard access get 403.

4. Tests: one day with bills in several hours (hour buckets incl. zeros); a 7-day range (day buckets);
   empty day (zeros, largestBill null, peak null); cancelled and hold bills counted separately and not
   in sales; walk-in vs customer counts; a payment taken on a later day is not counted in `paid` for the
   bill's day; previous-period totals; profit redacted for a user without profit permission;
   bad range → 400; the platform bills-summary response is unchanged (snapshot test).

Rules: don't commit, tag or push without my permission. Tell me the changed files, paste one
example response for a single day and one for a 7-day range, and show the test output.
```

## What the desktop does with it

- Sales window (`06-charts.md` §3.1) reads this one endpoint; Profit and Orders windows reuse it plus
  the existing `/bill/report/*` endpoints.
- If the endpoint isn't there yet (404), the Sales window falls back to `/v1/dashboard/summary` for
  today/week/month and hides the blocks it can't fill (biggest bill, peak, previous-period deltas).
