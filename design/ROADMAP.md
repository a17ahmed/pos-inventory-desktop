# Roadmap — 10 stages, small steps

Each stage is split into steps (1.1, 1.2 …). A step is small enough to build, look at and undo
on its own. **After every stage:** `npm run build`, the screenshot set from `current/` retaken into
`progress/stage-NN/` (light + dark), a quick click-through of a sale on the test database, and
your OK before the next stage. No commit, tag or push without your permission.

Legend: 🖥 frontend only · 🔌 needs a backend prompt (in `backend-prompts/`) · 📦 adds a package (your OK first)

---

## Decisions to confirm before Stage 1

| # | Question | Recommendation |
| --- | --- | --- |
| D1 | Packages. The redesign needs a few. | Yes to: `@fontsource/inter`, `@fontsource/inter-tight`, `@fontsource/jetbrains-mono` (Stage 1, fonts offline), `@tanstack/react-table` (Stage 6). Maybe later: `clsx` + `tailwind-merge@2`, `@tanstack/react-virtual`. **No** Radix / MUI / MRT / sonner — we build dialogs, menus, toasts ourselves on the existing code. |
| D2 | Table library | TanStack Table, not MRT (see `04-tables.md`). |
| D3 | Who picks the accent colour | The shop admin picks it in Settings → Appearance (saved on the backend for the whole shop). Light/dark/system and density are per device. |
| D4 | Default accent | Steel blue (the reference). Gold is offered as a preset for shops that like today's look. |
| D5 | Release | The redesign ships only when Stages 1–5 are done together (the app should never look half old, half new to a shop). Stages 6–10 can ship one by one after that. |

---

## Stage 1 — Foundations: tokens, fonts, legacy re-map 🖥 📦

Goal: the whole app picks up the new colours, fonts and dark palette **without changing any screen file**.

- **1.1 Tokens.** Add the light and dark token blocks (from `reference/source/tokens/globals.css`)
  to `src/index.css`, plus the motion keyframes and reduced-motion rule.
- **1.2 Tailwind config.** Add the semantic colours (`background`, `card`, `muted-foreground`,
  `primary`, `*-chip` …), `shadow-1/2/knob`, the type roles (`text-body`, `text-h4`, `text-th` …),
  `font-heading`/`font-mono`, `rounded-row` (10px) and `rounded-pop` (14px). Keep everything that exists.
- **1.3 Fonts.** Install the three `@fontsource` packages, import them, set Inter as the body font;
  remove the Google Fonts `@import`s. Map `.font-display` → Inter Tight + `tabular-nums`.
- **1.4 Dark re-map.** Point the existing `--d-*` variables at the new dark tokens (table in
  `02-foundations.md` §7). Every `dark:bg-d-card` etc. turns into the new dark palette.
- **1.5 Light re-map.** Redefine `slate-*` as the new neutral ramp and `primary-*` as an accent
  ramp from `--primary`. Audit `amber-*`: list brand uses vs warning uses; re-map only brand uses.
- **1.6 Kill the glow.** Neutralise the gold gradients, glows and heavy shadows in `index.css`
  (`--d-accent-glow`, `shadow-xl/2xl` re-mapped to `shadow-2`).
- **1.7 Screenshot routine.** `design/tools/capture-screens.js`, run through the Playwright tool
  (local backend only, no new npm package), retakes the `current/` set into `progress/stage-NN/`.

Done when: every screen opens in both themes with no unreadable text; the build passes; the
before/after screenshots show the new palette; no screen file was edited.

## Stage 2 — Theme engine, shop accent colour, density 🖥 🔌

Goal: light / dark / system mode, an accent colour per shop, sidebar style, table density.

- **2.1 Theme engine.** Rewrite `ThemeContext` to support `light | dark | system` (follows the OS),
  without the current body-hide reflow trick; store per device.
- **2.2 Accent presets.** `data-accent="steel|teal|green|violet|gold|rose"` on `<html>` swaps the
  accent group (formula in `02-foundations.md` §2). Measure contrast of each preset in both themes; tune lightness.
- **2.3 Density.** `data-density="compact|default|comfortable"` drives row and control heights.
- **2.4 Backend.** Send `backend-prompts/stage-02-shop-appearance.md`. Shop-wide accent + sidebar style.
- **2.5 Settings → Appearance.** A card with mode switch and accent swatches (live preview).
  Admin saves the accent for the shop; mode saved on the device. The sidebar-style and density
  choices are added in Stages 5 and 6, when there is something for them to change.
- **2.6 Boot without flash.** Apply mode + accent before React renders (read the cached values in
  `index.html`), so the app never flashes the wrong colour on start.

Done when: switching any option recolours the app instantly; a second device of the same shop gets
the same accent after login; shops whose backend doesn't have the field yet fall back to steel blue.

## Stage 3 — Core controls kit + Design Lab 🖥

Goal: the building blocks exist and can be reviewed, before any screen uses them.

- **3.1** `cn()` helper, `src/components/ui/` folder, `/design-lab` route (dev builds only).
- **3.2** `Button` (all variants and sizes), `IconButton`.
- **3.3** `Input`, `Textarea`, `Select`, `SearchInput`, `Field`.
- **3.4** `Checkbox`, `Switch`, `SegmentedControl`.
- **3.5** `StatusChip` + one mapping file for every status in the app (bill status, payment status,
  return status, expense status, cheque status, Money Book entry types).
- **3.6** `Card`, `SectionCard`, `InsetCard`, `Money`, `Spinner`, `Skeleton`, `EmptyState`, `StateCard`.
- **3.7** Design Lab shows every component, every state, light + dark; screenshot it into `progress/stage-03/`.

Done when: you have reviewed the Design Lab and said OK. No screen changed yet.

## Stage 4 — Overlays and feedback 🖥

- **4.1** `Dialog` (sizes, header, body, footer bar, Esc, focus first field, scrim) and `ConfirmDialog`.
- **4.2** Restyle `AppDialog.jsx` on `Dialog` — `appAlert` / `appConfirm` keep their API, so every
  caller changes look at once.
- **4.3** `Toast` + `useToast`; replace the 4 home-made toasts.
- **4.4** `Banner` / `Alert`; move `PaymentDueBanner`, the Money Book go-live banner, `ErrorBox`.
- **4.5** `Menu` (row "⋯" actions) and `Tooltip`.
- **4.6** `Drawer` (side panel). Not used by screens yet — first use in Stage 6.
- **4.7** Move the 21 home-made modals' **outer shell** onto `Dialog`, one file per step, contents
  unchanged (Money Book modals and `ProductFormModal` first, POS modals last in Stage 8).

## Stage 5 — App shell: sidebar, top bar, page header 🖥

- **5.1** `Sidebar`: navy column, logo + shop name, groups with mono labels (Sell · Stock · Money ·
  People · Reports · Admin), active row = accent fill + 2px bar, counts (e.g. pending expenses),
  collapse to a 64px icon rail with tooltips, user menu at the bottom. Same permission rules as `Layout.jsx` today.
- **5.2** `TopBar`: breadcrumb (group / page), live/offline status, theme switch, user pill.
- **5.3** `PageHeader` band (eyebrow, title, subtitle, actions, tabs) — add to every screen, replacing
  each screen's own title block. One step per group of screens.
- **5.4** `Tabs` (underline) for Money Book, Vendors, Customer ledger, Settings.
- **5.5** Cashier (employee) shell: the checkout keeps a slim header, no big band.

Done when: every screen sits in the new shell, has one title, and the sidebar works collapsed and expanded.
**Stages 1–5 together = first release candidate (D5).**

## Stage 6 — Tables 🖥 📦 (🔌 only if a list needs new sort/filter params)

- **6.0** 📦 add `@tanstack/react-table`; build `DataTable` (toolbar, header, rows, footer,
  selected/attention rows, density, six states, server + client mode). Show it in the Design Lab.
- **6.1 Pilot:** Products. Review together before going on.
- **6.2** Receipts (server paging, attention row for "has returns", ⋯ menu: view / print / cancel; detail in a `Drawer`).
- **6.3** Customers, Vendors (supplies + vendors tabs), Employees, Expenses.
- **6.4** Ledgers: Customer ledger, Vendor ledger, Money Book entries (day groups kept), old Cash Book.
- **6.5** Inventory (6 tables), Returns, Sales.
- **6.6** If a list needs server-side sort/search the API doesn't have, write
  `backend-prompts/stage-06-table-params.md` with the exact endpoints and params.

## Stage 7 — KPI cards, charts and drill-down windows 🖥 🔌

Full spec: `06-charts.md`. Backend: `backend-prompts/stage-07-sales-insights.md` (send at 7.0 so it
is ready by 7.5).

- **7.0** 🔌 Send the sales-insights prompt; test the new endpoint here when it comes back.
- **7.1** `KpiCard` / `KpiStrip` (mono label, big tabular figure, note, delta chip, optional sparkline);
  a tile can be a button (hover wash + chevron).
- **7.2** `ChartPanel` (title, period line, measure toggle, ⋯ Show as table / Download CSV, loading /
  empty / error) + `BarChart`, `AreaChart`, `DonutChart`, `HorizontalBarChart`, `ChartTable` on `chart-1…6`.
  Shown in the Design Lab.
- **7.3** `InsightDrawer`: the 700–880px right-hand window with the date header
  (‹ date › Today · Day / Week / Month / Custom), `?insight=` in the URL, Esc / back to close.
- **7.4** Admin dashboard re-laid out: tile strip (Revenue, Net profit, Orders, Money, Costs), Sales chart
  panel with Sales | Bills toggle, "Needs attention" list (low stock, unpaid bills, pending expenses,
  pending cheques). Every tile and panel is clickable.
- **7.5 Sales window** (your screenshot): KPI strip incl. biggest bill / average bill / first-last bill,
  by hour (day) or by day (range), by cashier, payment methods (and by account with the Money Book),
  biggest bills, top products.
- **7.6** Profit, Orders, Money and Costs windows.
- **7.7** Windows for the panels: Top sellers, Best margins, Dead stock, Low stock, Employee performance.
- **7.8** Reports screen: pies → donut + legend table, timeline → bar/area panel with Day | Week | Month,
  all themed; Employee analytics the same.
- **7.9** Stat tiles on Receipts, Money Book, Customers → `KpiStrip` (clickable where a window exists).

## Stage 8 — POS checkout screen 🖥

The most used and most risky screen (~2,800 lines). Look only — the sale logic is not touched.
Each step ends with a real test sale (cash, card, credit, add-to-bill) on the test database.

- **8.1** Header strip: live status, today's total, customer picker, bill tabs, returns.
- **8.2** Product search + product grid (44px+ tiles, initial/icon instead of 📦, price in tabular figures).
- **8.3** Cart lines (qty stepper, price, discount, remove) and the totals panel; Pay = the one primary button.
- **8.4** Payment modal (method segmented control, account picker, cash keypad, change due).
- **8.5** Add-to-bill, walk-in confirm, held bills, success / receipt screen, toasts.
- **8.6** Keyboard and scanner pass: every shortcut still works, focus is visible, nothing steals focus from the scanner.

## Stage 9 — Forms, detail and auth screens 🖥

- **9.1** Settings (cards per section, `Field`s, switches) and Profile. Fix: the profile card shows a
  cashier as "admin@example.com · Administrator".
- **9.2** Closing + Closing detail + `ClosingReport` (account table, tender tiles → `KpiStrip`, finalize footer).
- **9.3** `ProductFormModal`, `SpecialRatesEditor`, Money Book forms and account settings.
- **9.4** Login and Signup (split screen like `reference/light/33-auth-sign-in.png`, no gradient button).
- **9.5** Empty / error / offline / no-permission states on every screen.

## Stage 10 — Clean-up and guard rails 🖥

- **10.1** Remove the Stage 1 re-maps (`slate`, `primary-*` ramp, `--d-*`) once no file uses them.
- **10.2** Replace the remaining `text-[Npx]` with type roles.
- **10.3** Add `scripts/check-design.mjs` (run in `npm run build`): fails on new raw palette classes,
  hex colours in JSX, `text-[Npx]`, gradients on buttons.
- **10.4** Final light/dark audit of every screen, contrast check, keyboard pass, 1366×768 and 1024×768 window sizes.
- **10.5** Performance check (bundle size before/after, checkout screen render time).
- **10.6** Release notes for shops (what changed, where the accent colour setting is).
