# Stage 7 — KPI cards, charts and drill-down windows: part 1 done

**Part 1 (this turn):** 7.1 tiles · 7.2 charts · 7.3 the window · 7.4 the new dashboard · 7.6 Profit / Orders /
Money / Costs windows · 7.7 panel windows · 7.5 Sales window (built; full version waits for the backend).
**Part 2 (next):** test the Sales window on the new endpoint (7.0 / 7.5), 7.8 Reports and Employee analytics charts,
7.9 tiles on Receipts / Money Book / Customers.

## 7.0 — backend: please send `design/backend-prompts/stage-07-sales-insights.md`
Checked today: the endpoint `GET /v1/dashboard/insights/sales` is not there yet (404). The app already calls it and
**falls back** when it's missing (see 7.5).

## What you'll see on the Dashboard
- **Five tiles:** Revenue (with the change vs the previous period), Net profit (margin), Orders (average bill),
  Money (Money Book total, or cash in hand), Costs (goods + returns + expenses). **Every tile is a button** — it
  opens its window.
- **Sales chart** by hour (today) or by day (week / month) with a **Sales | Bills** switch; the current hour (or the
  peak) is the solid bar, its value printed on top; the peak is written above the chart; ⋯ → Show as table /
  Download CSV.
- **Needs attention:** low stock, dead stock (with value), expenses waiting approval, cheques not cleared (Money
  Book), owed to vendors — each line opens the window or the screen.
- **Panels:** Top sellers, Best margins, Payment methods (donut + table with amounts and %), Employee performance,
  Inventory, Supplies — each with **Details** → its window. Shortcut buttons at the bottom (same as before).
- The old "how it's calculated" popups are now inside the Profit window ("How net profit is worked out").
- Same numbers as before: the dashboard still reads the same `/v1/dashboard/summary`, worked out the same way.

## The windows (wide panel on the right)
- Header: title, the dates ("Sun 1 Nov – Thu 12 Nov · Pakistan time"), and the period control.
- The address bar holds the window (`?insight=sales&from=…&to=…`), so **Back closes it** and a window can be linked.
  Esc closes it too. "Open full report →" at the bottom.
- **Sales:** sales, bills, average bill, items, discount, refunds, chart by hour / day, sales by cashier, payment
  methods, top products. With the new endpoint it adds: paid / on credit, profit, with a customer, **biggest bill**,
  first / last bill, cancelled / on hold, changes vs previous period, **biggest bills** table, payments **by account**,
  and **any date or range** (‹ date › · Today · Day / Week / Month / Custom).
- **Profit:** net sales, cost of goods, gross and net profit with margins, the step-by-step working, products sold
  below cost (warning), best and lowest margins.
- **Orders:** bills, average bill, items per bill, returns, chart, **latest 10 bills** of the period.
- **Money:** cash in hand, total money, cash in / out today, balance per account (click → Money Book).
- **Costs:** goods, returns, expenses, expenses waiting approval, **expenses by category** (donut).
- **Top sellers, Margins, Dead stock, Low stock, Employee performance, Payment methods:** full sortable lists.
- Until the backend is updated, windows offer **Today / Last 7 days / This month** (what the current server can
  answer) and say so.

## New parts (`src/components/ui/`)
`Kpi.jsx` (KpiCard, KpiStrip, Stat, DeltaChip) · `Charts.jsx` (ChartPanel with table view + CSV + loading / empty /
error, BarChart, AreaChart, DonutChart, HorizontalBarChart, Sparkline, ChartTable) · `InsightDrawer.jsx` (window +
period control). Charts use recharts (already installed) with the theme's chart colours only — they follow the
accent and dark mode. Design Lab → "KPI tiles and charts" shows all of them with a state switch.
The dashboard moved to `src/screens/dashboard/` (page, windows, data helpers).

## Checked
Build passes. Dashboard Today / Week / Month, light + dark; every tile opens its window; all 11 windows open by URL
without errors; Esc and Back close them; chart table view; the 404 from the missing endpoint is handled (the only
console errors). Today (12 Nov) shows the empty states — the test shop has no sales today.

## Part 2 (2026-11-12)

- **Reports:** pies → donut + legend table (Expenses, Revenue share, Payment methods). Line chart →
  "Sales over time" panel: Revenue | Profit | Bills and Day | Week | Month (server `groupBy`), empty
  days filled with zeros, bars up to 60 points then area. Returns by reason → horizontal bars.
  Tabs / period / buttons from the design system; all colours are theme tokens.
- **Employee analytics:** KPI strip + Sales bar chart (current hour/day highlighted) + Top sellers.
  Fixed: month chart (now one bar per day), "0 sold" (server field is `totalQtySold`), cashier id
  match (`id` vs `_id`). Cashiers get 403 on the by-cashier report, so "My sales" is hidden for them.
- **KPI strips:** Receipts (5 tiles; Sales / Collected / Cash open dashboard windows for admins),
  Customers (owed tiles switch the list to "With dues"), Money Book (account tiles select the account).
  `KpiCard size="sm|lg"` keeps a row the same size.
- Also: Filter button on Expenses / Supplies / Money Book entries; customer ledger summary with
  bought-vs-paid and top products (client-side, last 6 months).
- Still open: test `GET /v1/dashboard/insights/sales` when the backend ships it (route not there yet).

## Backend tested (2026-11-12)

- Stage 6 (`search` + `paymentMethod` on GET /bill, `search` on GET /supply): all checks pass via API
  and in the app (Bills search box + Payment filter, Supplies search). Bad paymentMethod → 400.
- Stage 7 (`GET /v1/dashboard/insights/sales`): day → 24 hour buckets, range → day buckets with zeros,
  previous period, peak, biggest/top bills, bill sizes, top products, refunds, byAccount (from Money
  Book start), bad ranges → 400, cashier → 403. Backend tests: 31/31 pass (incl. profit redaction).
  Sales window now runs in full mode (no "limited" fallback). Added the "Bill sizes" block.
