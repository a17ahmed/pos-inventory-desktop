# Stage 2 — Theme engine + shop accent colour: done (waiting for your OK)

## What you can do now

**Settings → Appearance** (new card, replaces the old "Dark Mode" switch):
- **Theme: Light · Dark · System.** System follows the computer's own light/dark setting and
  switches live when the computer changes. Saved on this computer. Everyone can change it.
  (The sidebar's Light/Dark button still works.)
- **Accent colour:** Steel blue (default), Teal, Green, Violet, Gold, Rose. The admin picks it for
  the whole shop; cashiers see it but can't change it ("Set by the shop admin").

## Screenshots (`design/progress/stage-02/`)

- `accent-<name>-light.png` / `accent-<name>-dark.png` — the Receipts screen in each of the 6 accents.
- `light-appearance-start.png`, `light-appearance-teal.png`, `light-appearance-gold-device-only.png`,
  `dark-appearance-gold.png` — the Appearance card as admin.
- `dark-appearance-cashier.png` — the cashier's read-only view.

## How it works

| Piece | Where |
| --- | --- |
| Choices and storage keys | `src/utils/appearance.js` (new) |
| Theme engine: mode (light/dark/system, follows the OS live), accent, sidebar style, density, all set as attributes on `<html>`; the old `isDark` / `toggleTheme` still work | `src/context/ThemeContext.jsx` (rewritten) |
| Shop accent read from `business.settings.appearance` whenever the business loads | `src/context/BusinessContext.jsx` |
| Six accent colour blocks (light + dark), light sidebar variant, density row heights | `src/index.css` |
| No colour flash on start: mode + accent applied before the app loads | `index.html` |
| Appearance card | `src/components/AppearanceSettings.jsx` (new), `src/screens/Settings.jsx` |

**Contrast:** every preset was measured: button text, accent links on cards and on the page,
accent chips, all ≥ 4.5:1 in both themes. Teal and Green were darkened a little in light mode,
Violet and Rose chip text lifted a little in dark mode, to pass.

## Backend — done and tested (11 Nov 2026)

The backend change from `design/backend-prompts/stage-02-shop-appearance.md` is in. Tested here
against the local backend (test database), clicking through the app:

- Old shop: both logins return `appearance: {accent: steel, sidebar: navy}` → app shows Steel blue.
- Admin picks **Teal** in Settings → `PUT /admin/business/settings` → **200**, the card says
  "Saved for the whole shop", nothing stored on this computer only. Reload → still Teal.
- **Cashier** signs in on a fresh computer → app is Teal (`backend-cashier-gets-teal.png`).
- Saving another setting (Auto print) keeps the colour; saving only the accent keeps the sidebar.
- Reset to Steel blue afterwards.

The "this computer only" fallback stays in the app for shops whose backend is older.

## Built but not shown yet (on purpose)

- **Sidebar style** (navy / light) — the colours are ready; the choice appears in Stage 5 with the
  new sidebar (today's sidebar doesn't use these colours yet, so the option would do nothing).
- **Density** (compact / default / comfortable) — row heights are ready; the choice appears in
  Stage 6 with the new tables.

## Noticed, not changed

- Settings shows a **cashier** as "admin@example.com · Administrator" in the profile card at the top
  (existing bug, not from this stage). → fix in Stage 9.1 (Settings).
