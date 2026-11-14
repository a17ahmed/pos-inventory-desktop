# Stage 10 — Clean-up and guard rails

## 10.1 Old colour names removed
- About 1,900 old colour classes (plus their dark-only twins) in 19 files were swapped automatically for the design tokens they already
  pointed at (one-off script; it changed class lists only). Old dark-only classes (`dark:bg-d-card` …) were
  dropped — the token classes switch with the theme by themselves. Gradients became flat colours
  (Returns, Expenses, Staff, ledgers); glow shadows removed.
- Page wrappers no longer paint their own grey (the app shell does).
- Inventory's per-category colours now use the chart colours.
- Removed: the `slate` / `gray` / `amber` / `indigo` / `primary-50…950` re-maps and the `d-*` colours from
  `tailwind.config.mjs`, and the `--d-*` / `--ink` … variable block from `index.css`.
- Unused shop-type colours removed from `BusinessContext`.

## 10.2 Font sizes
- Every `text-[Npx]` (71) replaced with a type role (`text-caption`, `text-body`, `text-lead` …). None left.

## 10.3 Design check (`scripts/check-design.mjs`)
Runs before every build (`npm run build`, `build:web`, all `electron:build*`, so also the release workflow) and
on its own with `npm run check:design`. Fails the build on: raw palette colours, the removed Stage-1 classes,
`text-[Npx]`, `bg-gradient-*`, and hex colours in screen code. Escapes: `design-ok` on the line, or a
`design-check: print-start/end` region (PDF / print HTML — used in ClosingDetail and VendorLedger), and the
receipt / statement templates. Tested with a throwaway file: all 5 rules caught, bill numbers like "#1042" ignored.

## 10.4 Audit
- Light + dark screenshots of every changed screen in this folder (1366×768), plus 1024×768 for the till,
  Dashboard, Products, Closing, Vendors, Reports — nothing runs off the side; the sidebar folds to icons.
- No page errors on any screen.
- Contrast (measured in the browser): all text colours ≥ 4.5 : 1 on their backgrounds in both themes
  (lowest: chips 4.5–4.7). Placeholder grey is 3.5–3.7 : 1 — used only for hint text in empty boxes and
  decorative icons / dashes.
- Keyboard: tabbing through the sidebar, top bar and page buttons — every stop shows the focus ring.

## 10.5 Performance (production build, compared with the last commit before the redesign)
| | before | now |
|---|---|---|
| CSS | 107.9 kB (17.2 kB gzip) | 79.4 kB (13.8 kB gzip) — **−26 %** |
| JS | 2,680.7 kB (712.7 kB gzip) | 2,668.6 kB (752.8 kB gzip) — +40 kB gzip (table library + new components) |
| whole `dist` | 3.1 MB | 3.6 MB — the fonts now ship with the app (work offline) |
- Till: a scan shows in the cart ~4–6 ms after the last digit (5 tries, dev build). After a full reload the till
  is ready in ~1 s, mostly the product list coming from the server.
- Not done (bigger change, not asked): splitting the single 2.6 MB JS file into per-screen chunks.

## 10.6 Release notes
`design/RELEASE-NOTES.md` — plain-language notes for shops (where the theme / accent colour settings are,
what changed on the till, lists, closing, settings). Version number left blank for you to fill in.

## Not changed
- Tailwind's own size classes (`text-sm`, `text-xs` …) are still used in older screens; the check doesn't block
  them (the roadmap only asked for `text-[Npx]`).
- Older screens (Returns, Vendors, Inventory overview, Expenses stat cards) keep their layout — only their
  colours moved to tokens; they weren't in any stage's restyle list.
