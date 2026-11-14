# Stage 6 — Tables: done (waiting for your OK)

> 6.0 + 6.1 (the table + the Products pilot) are described first; 6.2–6.6 (every other list) follow
> under **"6.2 – 6.6"** below.

The roadmap says: build the one table, move **Products** onto it, look at it together, then do the rest.
This is that checkpoint.

**Review it:** open **Products** (and the bottom of `/design-lab` → "Table", where the switch shows all six states).
Screenshots here: `light-products-table.png`, `dark-products-table.png`, `light-products-row-menu.png`,
`light-products-compact.png`, `light-products-no-results.png`, `light-products-error.png`,
`light-products-cashier.png`, `light-products-cards.png`, `light-lab-table-*.png`.

## 6.0 — `DataTable` (`src/components/ui/DataTable.jsx`)

Package added (approved): **`@tanstack/react-table` 8.21.3** — the same library and version the reference uses.
It only does the logic (sorting, paging, hiding columns); every pixel is our design.

- **One card:** toolbar (search · filters · actions · columns · row height) → table → paging footer.
- **Header:** small mono capitals, muted; click to sort (arrow shows the direction; numbers sort biggest first).
- **Rows:** 44px, a faint line between rows, hover wash, no zebra stripes, no vertical lines. Money right-aligned
  with even-width digits; codes in mono; missing value = `—`.
- **Selected row:** tint + accent bar on the left. **Attention row:** warning tint + warning bar.
- **Row actions:** one `⋯` menu at the end (delete last, in red). The most common action is also a click on the row
  (and Enter on a focused row).
- **Footer:** Rows per page (10 / 25 / 50 / 100) · "1–25 of 159" · first / previous / next / last.
- **Six states** from the same table: rows · loading (grey placeholder rows) · empty · no results ("Clear filters") ·
  error (message + Try again) · no access.
- **Remembered on this computer:** page size and hidden columns per table; **row height** (Compact 36 / Default 44 /
  Comfortable 56) for all tables — this is the "density" setting prepared in Stage 2.
- Works with lists the server pages (`server={{ page, pageSize, total, onPageChange }}`) — used from Receipts on.

## 6.1 — Products (pilot)

- **The table is now the default view**; the card grid is one click away (Table | Cards, remembered on this computer).
- Columns: Product (name + barcode), Category, Price, Cost (admin only), Stock, Status (In stock / Low / Out of stock),
  ⋯ (admin only: Edit, Delete).
- Admin: **click a row to edit** it. Cashier: no Cost column, no actions, no row click, no Add button — same as before.
- Search box is in the table toolbar (same search as before: name, barcode or category); the category filter is the
  pill row above (same filter as before).
- **Low-stock rows are tinted.** Out-of-stock rows are not tinted (in the test shop that would be 11 of 12 rows, which
  makes the colour meaningless) — they have the red "Out of stock" chip instead. Tell me if you'd like both tinted.
- **New:** if the products can't be loaded, the table says so with "Try again" (before, it looked like an empty shop).
- Header buttons are now the new ones (Refresh, Add Product).

## Checked
- Build passes. Sorting, search, no results → Clear filters, ⋯ menu, row click → Edit dialog, hide a column (stays
  hidden after reload), row height 44 → 36, 10 per page → page 2, light + dark, cashier view, Cards view, error → Try again.

## Noticed, not changed
- The header says "**4 low stock**" but the Status column shows 11 out of stock + 1 low. They use different rules
  (header: only products with "track stock" on and ≤ 10; column: any product ≤ 10, like the old cards). Say which rule
  is right and I'll make both use it.

## 6.2 – 6.6 — every other list

Pilot approved ("next stage"); your three questions kept their defaults: only low-stock rows tinted, the
"low stock" count rule left as it is until you choose.

| Screen | What changed |
| --- | --- |
| **Receipts** | Real **pages** (25 / 50 / 100) instead of the endless scroll; period + "Cancelled" filters in the toolbar; Type column with chips (Sale / Refund / Cancelled + **Has returns**); bills with returns tinted; cancelled bills faded; **⋯** View details · Print · Download · Cancel bill (only when allowed, as before). **Click a bill → its details open in a side panel** (same contents as the old popup). |
| **Customers** | Table with server paging + server search (already supported); All / With dues; ⋯ View ledger · Edit · Delete; click → ledger. |
| **Expenses** | Same; status filter as pills; **pending expenses tinted**; ⋯ Approve · Reject · Edit · Delete; click → edit. The full-page loading/error screens are gone (the table shows them). |
| **Vendors → Supplies** | Server paging; status pills; "Clear vendor filter"; ⋯ Record payment · Return items · Edit · Delete (same conditions as before); click → edit. |
| **Vendors → Vendors** | Table; ⋯ View ledger · Edit · Delete; click → ledger (as before). |
| **Employees** | **Cards → table** (like the reference "People" list): name + ID, role, status, email, phone, salary, hours (+ commission for service shops); ⋯ Edit · Access control · Deactivate (or Reactivate). |
| **Money Book** | Entries keep their **day groups with opening / closing lines**, now in the table look with entry-type chips; toolbar with the kit's inputs; shared paging footer. Transfers, Cheques (pending cheque past its date tinted), Accounts and the closing "Money accounts" table restyled the same way. |
| **Customer / Vendor ledger** | Same structure (expandable rows), new header and row look. |
| **Old Cash Book** | (shown when Money Book is off) same as Money Book entries. |
| **Inventory** | Underline tabs (Low Stock count as a pill); **Movements**, **Low stock**, **Dead stock** on the table; Overview and Stock sheet tables in the table look, adjust button with tooltip. |
| **Closing** | History on the table (closings with a tender variance tinted); closing report tables and Reports table in the table look. |

**Returns and Sales** have no list — they are step-by-step working screens (find bill → pick items → refund)
and are redone with the checkout in **Stage 8**.

New shared pieces: `tableSurface.jsx` (the table look as classes + `TablePager` + `TableToolbar`, for lists
with their own row structure such as day groups) and `DrawerShell` (side-panel frame for the receipt details).
`DataTable` now uses the shared `TablePager`.

### Backend prompt (6.6) — send `design/backend-prompts/stage-06-table-params.md`
Receipts and Supplies can only search the page on screen (their list endpoints have no `search`). The app
already sends the search text; after this backend change it finds bills / supplies on any page with no app change.

### Fixed along the way
- **Inventory → Dead stock list was always empty** (the server sends `deadStock`, the screen read `products`), and
  "Retail value" always showed PKR 0. Both fixed in the app (the retail total is added up on screen).
- Products, Receipts: a failed load now says so with Try again (before: looked empty).
- Receipts: when filters change quickly, an older answer can no longer replace a newer one.

### Checked
Every screen above in the browser (admin), light + dark capture set, and every page the cashier can open (no
crashes). Paging, filters, search, ⋯ menus, row clicks, side panel, Esc. Old Cash Book checked by making the
browser believe Money Book is off (no setting was changed).

### Noticed, not changed
- Employees: the sidebar says "Counter Users" (shop's staff label) but the page title says "Employees" — the
  title has always ignored the label. Small fix in Stage 9.
