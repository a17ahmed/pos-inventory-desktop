# Stage 8 — POS checkout (2026-11-12)

Look only — the sale logic (totals, discounts, rates, stock, credit, add-to-bill) is unchanged.

## What changed
- **8.1 Header:** "Today PKR … · N sales", customer button ("Walk-in · add customer" / name + phone + ×),
  bill tabs (real tabs, keyboard Enter/Space, item count badge, × to close), New bill, Returns.
  The fake "Live" badge is gone (the app header already shows Online/Offline).
- **8.2 Search + products:** 48px scan box with ⌘/Ctrl K hint; suggestions show category + stock;
  product tiles are real buttons with the product's **initials** on a category colour (shops can't set
  emojis, so every product used to be 📦); **out-of-stock tiles are marked** (they were refused only on tap).
- **8.3 Cart + totals:** 40px initials, qty stepper (− / input / +), click-to-edit line price,
  trash icon, expanded details with theme colours; totals in tabular figures; **Pay is the one
  primary button** (full width, ⌘/Ctrl 0 hint).
- **8.4 Payment:** app dialog surface; method tiles (Cash / Card / Online / Credit — credit disabled
  without a customer, with the reason); "Exact / 300 / 500 / 1,000" quick cash; "Short by …";
  big "Change to give"; credit summary (paid now / added to balance / total owed).
- **8.5 Add-to-bill, walk-in, success:** same dialog look; success has "New sale (Esc)" + "Print receipt".
  Start-up spinner → till-shaped skeleton.
- **8.6 Keyboard + scanner:** tapping a tile, chip, +/−, remove, New bill or a bill tab no longer
  takes focus from the scan box (a scanner's Enter would have pressed that button again); after a
  sale the cursor goes back to the scan box. ⌘/Ctrl K, ⌘/Ctrl 0, Esc, ↑/↓/Enter in suggestions all work.
- Toasts move to the top (click-through) while the till is open, so they never cover Pay; the
  "… added" toast clears when the payment window opens.
- Money shows in the shop currency with ≤ 2 decimals (was "Rs." + up to 3 decimals).

## Test sales (test DB, cashier ali)
| # | Kind | Result |
|---|---|---|
| 163 | Cash, walk-in, 500 given | PKR 200, change 300 ✓ |
| 164 | Card, customer QA 01 | PKR 209.99 ✓ |
| 165 | Credit, QA 02, 50 paid now | 150 added to balance (5,950 → 6,100) ✓ |
| 165 | Add-to-bill (offered automatically), +Juice, 250 cash | 200 → 300, due 0 ✓ |
| 166 | Cash exact, two bills open | PKR 200 ✓ |

## Known, not from this stage
- Cashier gets 403 on `/money-book/settings` on every screen (permission) — harmless, pre-existing.

## Scanner guard (added after review)
When the cursor is not in a text box (e.g. someone pressed Tab onto a button):
- No window open → the first typed character moves the cursor to the scan box, so the scan and its Enter land there. On "Sale complete" the screen closes and the scan goes into the next sale.
- A window is open (payment, add-to-bill, walk-in, customer picker) → a fast burst (≥3 keys under 50 ms apart) ending in Enter is swallowed, so it can't press a button.
- Space, Tab, arrows, Esc and normal-speed Enter are untouched.

Tested (cashier ali, test DB): scan with focus on New bill → no new bill, item added · human Enter on New bill → opens bill · scan with focus on a product tile → tile not pressed · scan with focus on "Complete payment" → no sale · human Enter on it → walk-in check → sale · scan on "Sale complete" → screen closes, item added to the open bill.
