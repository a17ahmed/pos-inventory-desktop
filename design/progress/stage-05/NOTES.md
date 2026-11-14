# Stage 5 — App shell: done (waiting for your OK)

**Every screen now sits in the new shell.** Screenshots of all the main screens (light + dark, admin and cashier) are
in this folder, plus the collapsed sidebar, the account menu, the light sidebar style and a ledger page.

**Stages 1–5 together are the first release candidate** (ROADMAP D5) — nothing is released until you say so.

## What changed

### Sidebar (`src/components/shell/Sidebar.jsx`)
- Navy column (or **light** — new choice in Settings → Appearance → Sidebar, for the whole shop, admin only).
- Shop name + "Retail · POS" at the top; pages in **groups**: Sell · Stock · Money · People · Shop.
- Current page: tinted row + a thin accent bar on the left. Colours follow the shop's accent.
- **Collapses to a 64px icon rail** with the ☰-style button at the top left; hovering an icon shows its name. The choice
  is remembered on this computer. On a first run, screens narrower than 1280px start collapsed.
- Your name at the bottom opens the account menu: Profile (staff), Settings (if allowed), **Log out**.
- **Same pages for the same people as before** — the permission rules were moved as they were (`shell/nav.js`).
  The old admin sidebar opened when the mouse passed over it; now it opens and closes with the button instead.

### Top bar (`src/components/shell/TopBar.jsx`)
- Where you are: **People › Customers › Ledger** (the middle part is a link back).
- Online / Offline chip, and the Light / Dark / System switch (the old sidebar theme toggle moved here).
- It is also the window's drag strip in the desktop app; on Windows it leaves room for the window buttons and the
  title-bar colours now follow the theme and accent.

### Page header band (`PageHeader`) — every screen
One title per screen, in a tinted band with the actions on the right: Dashboard, Products, Customers, Customer ledger
(back link + "Customer ledger" + name + contact line), Receipts, Returns, Expenses, Money Book (+ old Cash Book),
Vendors (title + **tabs** Supplies · Vendors · Stats in the band), Vendor ledger, Inventory, Reports, Closing,
Closing report (back link), Employees, Employee dashboard, Profile, Settings.

- The **buttons inside** most bands are still the old ones (same click, same look as before) — they change with their
  screen in Stages 6/9. Customer ledger, Vendor ledger, Vendors and Closing report already use the new buttons.
- Admin dashboard: its own dark top strip and "LIVE" chip are gone (the top bar shows Online); the Today / Week /
  Month switch is now the standard segmented control (same values). The KPI cards and charts are Stage 7.

### Tabs (`Tabs`, underline)
Vendors (in the band), Money Book (account / Transfers / Cheques / Accounts — kept above the list it controls; the
pending-cheque number is now a small count pill), Customer ledger (Ledger · Special rates). Arrow keys move between
tabs. Settings has no tabs (it is one list) — nothing to change there.

### Cashier
Same shell, with a slightly **slimmer top bar on the checkout**; no header band on the checkout or Sales screen
(Stage 8 redoes the checkout itself).

## Not changed (on purpose)
- Login / Sign-up (Stage 9), the POS checkout's own top row (Stage 8), printed reports and statements.
- **Sidebar counts** (e.g. pending expenses) — the sidebar can show them, but nothing feeds them yet; small follow-up.
- The user pill in the reference's top bar: the account menu lives at the bottom of the sidebar instead (one place).

## Checked
- `npm run build` passes; no console errors.
- Admin and cashier: every screen in the capture set, light + dark.
- Sidebar: 240 → 64 px, the choice survives a reload, rail tooltips, account menu (Escape returns focus).
- Breadcrumb + back link on Customer ledger; "Customers" in the breadcrumb goes back.
- Settings → Sidebar: Light → saved (200), sidebar turns light everywhere; Navy → saved, accent untouched. Left on Navy.
- **Please check in the desktop app (can't be tested in a browser):** on Mac the window buttons sit above the shop
  name; on Windows the window buttons sit at the right end of the top bar, and dragging the top bar moves the window.
