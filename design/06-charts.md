# Charts and drill-down windows

Two things in this file:
1. **How every chart looks** (one `ChartPanel` style for the whole app).
2. **Drill-down windows:** click a tile on the dashboard (Sales, Profit, Orders, Money, Costs…) and a
   window opens with the full story for that number — the KPI strip, "by hour" chart, by cashier,
   payment methods, biggest sale, etc. Like the platform admin's "Today & bills" tab
   (`reference/ours/platform-admin-today-and-bills.png`).

Reference: `reference/light/09-charts.png`, `reference/dark/` (same), `components/charts-01` (bar with
the current bar emphasised), `charts-04` (area), `charts-09` (donut), `charts-10` (error / loading /
empty), `kpi-01…08` (KPI strips), `kpi-06` (a whole tile that is a button).

---

## 1. Charts we have today

| Screen | Chart | Library / style today | Problem |
| --- | --- | --- | --- |
| Admin dashboard — "Sales & Orders" | Area, hourly (today) or daily | recharts, gold fill, 8px DM Mono axis | tiny axis text, no money format on axis, no toggle, no tooltip detail |
| Admin dashboard — "Peak times", "Payment methods", "Employee performance" | lists / bars drawn by hand | divs | not charts, no click-through |
| Reports — P&L "Expense breakdown" | Pie with outside labels | recharts default colours | labels collide, colours not themed |
| Reports — "Sales timeline" | Line | recharts, `#94a3b8` axis | hard-coded colours, no day/week/month switch on the chart |
| Reports — By category "Revenue share", Payments "Distribution" | Pie | recharts | same as above |
| Reports — Returns "Returns by reason" | Horizontal bar | recharts | fine shape, not themed |
| Employee analytics | Area | recharts | not themed |

Before pictures: `current/light-dashboard.png`, `current/light-reports.png` (and `dark-*`).
We keep **recharts** (already installed) — only the look and the wrappers change.

## 2. How every chart looks — `ChartPanel`

One card per chart (`SectionCard`), flat when it sits inside another card.

- **Header:** title (`text-h4`), one-line description that states the period and time zone
  ("When the bills were made, Pakistan time."), and on the right a `SegmentedControl` for the
  measure (**Sales | Bills**, **Day | Week | Month**) and a ⋯ menu (Show as table · Download CSV).
- **Series colours:** `chart-1 … chart-6` only (the first is the shop's accent). Never hard-coded hex.
- **Axes:** 11.5px muted labels; money axis in short form (`Rs 6.5K`, `Rs 1.2M`); hours as `4 PM`;
  light horizontal grid lines only, no vertical grid; axis title only when it adds something ("Hour (PKT)").
- **Bars:** rounded top 4px, fixed max width; the **current** bar (this hour, today) is solid and the
  others are a lighter tint, with the value printed at its tip (`charts-01`). A zero bar draws a 2px stub.
- **Tooltip:** popover surface; exact values with currency, the bill count, and the time range ("7–8 PM").
- **Donut, not pie:** max 6 slices + "Other", square legend underneath **with amounts and %** as a small
  table; no labels on the slices.
- **Table view:** every chart can flip to a sortable table with a totals row (`charts-02`), and export CSV.
- **States:** loading (skeleton block), empty ("No sales on this day" + "Pick another date"), error
  ("Couldn't load this chart" + Try again) — `charts-10`.
- **Dark mode:** same tokens, lighter series; nothing hard-coded, so it switches by itself.

Wrappers (Stage 7): `BarChart`, `AreaChart`, `DonutChart`, `HorizontalBarChart`, `ChartTable`,
`Sparkline` (tiny trend inside a KPI tile).

## 3. Drill-down windows ("insights")

**Pattern.** Every dashboard tile is a button (`kpi-06`: hover wash, chevron in the corner).
Clicking it opens a **large drawer from the right** (700–880px wide) — the dashboard stays behind
it, Esc closes it, and the URL gets `?insight=sales&date=2026-11-10` so the back button closes it
and the window can be reopened from a link. A "Open full report →" link at the bottom goes to the
matching Reports tab with the same dates.

**Header of every window:** title + date line ("10 Nov 2026 · Pakistan time, midnight to midnight"),
and the period control: `‹` · date picker · `›` · **Today**, plus presets **Day · Week · Month · Custom**.
A day shows charts **by hour**; a week/month/custom range shows them **by day**.

### 3.1 Sales (Revenue tile) — the one in your screenshot

1. **KPI strip** (2 rows, mono labels, big tabular numbers, small note under each):
   Bills (note: "Completed. Also 0 cancelled, 0 on hold") · Sales · Paid · On credit ("Not paid yet") ·
   Profit ("After returns", hidden for users who can't see profit) ·
   Discount given · Items sold · With a customer ("11 of 16 bills") · **Biggest bill** (amount, bill #, time —
   click opens the receipt) · **Average bill** · First bill · Last bill.
   Each figure shows a delta chip vs the previous period ("+18% vs yesterday").
2. **By hour / By day** bar chart with a **Sales | Bills** toggle; the peak bar is labelled
   ("Peak: 7 PM, Rs 25,400, 4 bills").
3. **Sales by cashier** — horizontal bars (sales, bill count), click a cashier → Employee analytics.
4. **Payment methods** — donut + table (cash / card / online / store credit, amount, count, %); when the
   Money Book is on, a second view **by account** (Cash Drawer, Bank, JazzCash…).
5. **Biggest bills** — top 5 bills of the period (bill #, time, customer, cashier, total); click → receipt drawer.
6. **Top products** for the period (top 5 by sales, with qty).

### 3.2 Profit (Net profit tile)
KPI strip: Net sales · Cost of goods · Gross profit · Margin % · Expenses · Net profit · Returns · Discounts.
Charts: profit by hour/day (bars) with margin % line; **best and worst margin products** (top 5 each);
products sold below cost (if any, attention rows).

### 3.3 Orders (Orders tile)
KPI strip: Bills · Average bill · Items per bill · With a customer · Cancelled · On hold · Returns.
Charts: bills by hour/day; **bill size spread** (how many bills under Rs 500, 500–1K, 1–5K, 5K+);
latest 10 bills table → receipt drawer.

### 3.4 Money (Cash in hand / Total money tile)
Money Book ON: balance per account (bars), money in vs out per account for the period, pending
cheques, last closing variance; link to the Money Book. Money Book OFF: cash in drawer, cash in/out
by type (sales, refunds, expenses, vendor payments). Uses existing Money Book / cash book endpoints.

### 3.5 Costs (Costs tile)
Expenses by category (donut + table), COGS vs expenses vs refunds (stacked bar by day), pending
expenses to approve. Uses existing expense + profit report endpoints.

### 3.6 Panels below the tiles
Top sellers, Best margins, Dead stock, Low stock, Employee performance and Payment methods panels also
open their window (product ranking, stock list, employee detail, payment methods) with the same header.

## 4. Where the data comes from

| Window / block | Existing endpoint | Gap |
| --- | --- | --- |
| Dashboard tiles today/week/month | `GET /v1/dashboard/summary?filter=` | only 3 presets, no chosen date or range |
| Timeline by day/week/month | `GET /bill/report/timeline` (startDate, endDate, groupBy) | no `hour` grouping |
| By cashier, payment methods, by product, discounts, returns | `GET /bill/report/*` (date range) | fine |
| Bills, sales, paid, credit, profit, discount, items, with customer, first/last bill, by hour, by cashier, by payment method for **one day** | `GET /platform/…/bills-summary` | **platform admins only** — the shop can't call it |
| Biggest bill, average bill, peak hour, cancelled/on-hold count, previous-period comparison, bill-size spread | — | **missing** |
| Money, costs | Money Book, expenses, profit report endpoints | fine |

→ Backend prompt: `backend-prompts/stage-07-sales-insights.md` — one shop endpoint that reuses the
platform bills-summary calculation (so the two can never disagree), with a date **range**, hour or day
buckets, and the missing figures.
