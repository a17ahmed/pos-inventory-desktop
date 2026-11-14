# Stage 9 — Forms, detail and auth screens

Look only, except the three small bugs listed under "Fixed". No saving, sign-in or closing logic changed.

## 9.1 Settings and Profile
- **Settings** rebuilt as cards: *You* (initials, role chip, Change password / Edit), *Shop* (details at a glance + Edit),
  *Receipts and printing*, *Selling rules* (admin), *Appearance*, *App* (updates, About), Sign out.
  Switches are the kit `Switch`; every dialog is the kit `Dialog` with `Field`s. "Coming soon" rows removed.
- Receipt dialog: printer + paper width (desktop only), thank-you message and note with a character count,
  phone / address switches, Preview (sample receipt, unsaved changes shown).
- **Profile** (staff): header with Sign out, KPI strip (shop sales today / month), My details, Change password card.

## 9.2 Closing
- **Closing**: tabs in the header; one Period card (last closing + Change period); KPI strip (net sales, net profit,
  credit given, *Money check · n of 3 match*); Money accounts table; three tender tiles (expected, difference,
  counted box); Sales and profit / How it was paid cards; Bills table (rows open with Enter/Space too); Finish card
  (note, "Finalize anyway" check, Finalize) → `ConfirmDialog` "Lock this closing?".
- **Closing detail**: "Closing #N" title, period + closed by under it, note as an alert, same report. PDF unchanged.

## 9.3 Forms
- **Product form**: kit Dialog, prices on one row, profit preview card, category as a select with "+ New category…",
  SKU / barcode with Generate (locked when editing).
- **Money Book forms**: the shared helpers (`moneybook/ui.jsx`) now give kit inputs and buttons, so every Money Book
  dialog and Expenses changed at once. Action buttons: Deposit primary, the rest outline (were 4 colours).
- Special rates editor was already on the kit.

## 9.4 Sign in / sign up
- Split screen (`components/shell/AuthLayout.jsx`): brand panel with what the app does, card with accent edge.
  Owner / Staff switch instead of two gradient pages. Password show/hide button. Signup: 3 steps with a bar.

## 9.5 States
- A page the staff member can't open now says so ("You can't open Reports" + Go to the home screen) — it used to jump
  to the home screen silently.
- Load errors now show "Couldn't load … · Try again" on Reports, Inventory, Staff, Closing history, Profile and the
  staff dashboard (they showed zeros / empty lists before). Offline gives "You seem to be offline."

## Fixed
- Settings showed a cashier as "admin@example.com · Administrator" → shows their name, "Staff" and sign-in ID;
  admin-only Edit / Change password replaced by "My profile & password" for staff.
- Staff page title ignored the shop's staff label → uses it ("Counter Users").
- Low stock rule: one rule everywhere (`utils/stock.js`): *track stock off* = "Not tracked" (no warning),
  0 = out of stock, ≤ the product's alert level = low. Products header now "3 out of stock · 1 low" and agrees with
  the Status column and Inventory's Low stock tab (4).

## Checked (test DB, port 3001)
- Settings: cashier + admin views; shop details saved (city set, then cleared again); auto-print switch on → off.
- Profile: password mismatch message. Closing: drawer + card counts update the differences live, lock dialog opened
  and cancelled (no closing finalized); closing #1 detail. Product form add (Generate SKU) / edit; Money Book
  Transfer and Adjustment dialogs, Accounts tab. Login: wrong password message, staff sign-in, admin sign-in; Signup
  step 1 in dark. No-access page as cashier on /reports. Error cards with the server calls blocked in the browser.
- Light + dark screenshots in this folder. Build passes.

## Not changed / noticed
- Anyone with the Settings permission can edit shop details (the server allows it; the old screen did too).
- Closing #1 shows "PKR 10,000 off" on the sales maths check — existing data, not from this stage.
- QA Mayo on the test DB has cost 300 > price 150 (test data), so its bills show a loss.
