# Stage 4 — Overlays and feedback: done (waiting for your OK)

**Review it:** open **`/design-lab`** on the test dev server and scroll to the bottom (Dialogs, Drawer/menu/tooltip,
Toasts, Banners). Then try a few real popups: Money Book → Deposit, Products → Add Product, Receipts → 👁 →
Cancel bill, Settings → Change password. Screenshots of all of them are in this folder (light + dark).

This is the first stage you see on real screens: **every popup in the app (except the POS checkout screen) now has the
new frame**, and every `appAlert` / `appConfirm` message has the new look.

## What was built — `src/components/ui/`

| Part | What it is |
| --- | --- |
| `Dialog` | popup: sizes 400 / 480 / 640 / 880, title + description, × button, footer (plain or tinted bar) |
| `ConfirmDialog` | yes/no question with a coloured icon tile; the buttons name the action ("Cancel bill" / "Keep bill") |
| `DialogShell` | the new **outer frame only**, used by the older popups whose insides stay as they are for now |
| `Drawer` + `DrawerSection` + `DetailList` | side panel for one record (header, sections, footer bar). Not used by a screen yet — first use in Stage 6 |
| `Menu` | the "⋯" row-actions menu; keyboard ↑ ↓ Home End Enter Esc; disabled items are skipped; delete is last, in red |
| `Tooltip` | styled tooltip; every `IconButton` now shows its label as one (hover, or keyboard focus) |
| `toast()` + `<Toaster />` | one notification system for the whole app; bottom centre; success / warning / info / error / neutral |
| `Banner`, `Alert` | one-line strip with an action · title + text box |
| `overlay.js`, `floating.js` | shared helpers: which popup is on top, focus handling, placing menus/tooltips |

## Every popup now behaves the same

- **Esc closes the top popup only** (a cancel box over a bill closes first, then the bill). For the older popups Esc
  presses their own × / Cancel button, so it does exactly what that button does — and nothing while that button is
  disabled (e.g. during a save).
- **Focus starts in the first field** (never on × or Cancel), **Tab stays inside** the popup, and when it closes focus
  goes back to the button that opened it.
- A click on the dimmed page does **not** close a form (a half-filled form never vanishes by accident). The plain
  message boxes (`appAlert` / `appConfirm`) still close on an outside click, as before.
- `appAlert` / `appConfirm` / `appChoose` keep exactly the same keys as before: Enter = OK/confirm, Esc = cancel,
  `appChoose` Enter/Esc = the safe default (so a scanner's Enter can't pick a risky option).

## What moved

- **AppDialog** (`appAlert` / `appConfirm` / `appChoose`) — new look, same API, so every caller changed at once.
- **6 home-made toasts → `toast()`**: POS checkout, Receipts (bill cancelled), Vendors, Vendor ledger, Settings, and the
  "Back online" message. Same messages, same timings, still **one at a time** per screen (a new one replaces the last,
  which matters on the POS when items are scanned fast). The POS emoji markers became tones: ⚠ → warning,
  🏷 → info with a tag icon.
- **Banners:** the payment-due strip (now warning colours — it was showing in the accent colour), the Money Book
  "enter your opening balance" banner (`Alert`), and the Money Book `ErrorBox` (`Alert`, red).
- **Popups moved onto the new frame (31):** the Money Book `Modal` (Deposit / Withdraw / Transfer / Adjustment /
  Opening, Add/Edit account, Cheque cleared/cancelled, Approve expense) + 28 popups in Products (`ProductFormModal`),
  Customers, Customer ledger, Vendors (4), Vendor ledger (2), Receipts (2), Returns (2), Expenses (2), Employees (2),
  Closing (2), Closing report, Money (CashBook), Inventory (stock adjust), Settings (6).
- **Restyled in place** (special logic kept as is): the "No internet" screen and the "Account blocked" screen.

Sizes: old 384px → 400, 448 → 480, 512 → 480, 576 / 672 → 640. Checked Product form (512 → 480): fits.

## Not moved (on purpose)

- **POS checkout popups** (`Dashboard.jsx`, 6) and **Sales.jsx** (2) — Stage 8, with the POS screen.
- **Customer ledger "pending" side panel** — becomes a `Drawer` in Stage 6 with that screen.
- Inventory / Reports **print views** (full-screen pages, not popups) and the Product form's category dropdown.
- The **insides** of the older popups (their headers, inputs, buttons) still look old; each gets the new controls when
  its screen is migrated (Stages 6 and 9).

## Checked

- `npm run build` passes; no console errors on the Design Lab or the screens tried.
- Design Lab: focus in the first field, Tab stays inside, Esc closes and focus returns; `appConfirm` Esc → false,
  Enter → true; `appChoose` Esc → default; menu keys, disabled item skipped, Esc returns focus to the ⋯ button.
- Real screens (light + dark): Money Book Deposit, Add Product, Change password — open with focus in the first field,
  Esc closes. Receipts: bill details → Cancel bill stacks on top, focus in Reason, Esc closes only the top one.
- Settings Auto print: toast shows, second toggle replaces the first (Auto print left as it was: off).
- POS (cashier): "Product not found" toast shows.

## Noticed, not changed

- When a **cashier** signs in, the app asks for `/money-book/settings` and gets **403** (not allowed) — existing, from
  the Money Book loader, harmless (nothing shows). → small fix later: only ask when the user may see the Money Book.
