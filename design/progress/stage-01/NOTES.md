# Stage 1 — Foundations: done (waiting for your OK)

Compare `design/current/<name>.png` (before) with `design/progress/stage-01/<name>.png` (after):
21 screens each — login, dashboard, products, customers, receipts, money book, vendors, closing,
reports, settings (light + dark) and the cashier checkout (light + dark).

## What changed

| Step | Change | Files |
| --- | --- | --- |
| 1.1 | Design tokens (light + dark, OKLCH verbatim from the handoff), motion keyframes, reduced-motion rule | `src/index.css` |
| 1.2 | Semantic Tailwind colours (`bg-card`, `text-muted-foreground`, `bg-primary`, `*-chip`…), type roles (`text-body`, `text-h4`, `text-th`…), `font-heading`, `rounded-row` / `rounded-pop`, `shadow-1/2/knob`, `animate-ds-*` | `tailwind.config.mjs` |
| 1.3 | Fonts bundled: Inter, Inter Tight, JetBrains Mono (Latin only, ~0.4 MB). Google Fonts removed (Outfit, Playfair Display, Bebas Neue, DM Mono). `.font-display`, `.font-bebas`, `.font-mono-dm` mapped to the new faces | `package.json`, `src/main.jsx`, `src/index.css` |
| 1.4 | Old dark variables (`--d-bg`, `--d-card`, `--d-accent`…) point at the new dark tokens | `src/index.css` |
| 1.5 | `slate` / `gray` → cool neutral ramp; `amber` / `indigo` / `primary` → accent ramp from `--primary` (follows the shop accent in Stage 2); bare `border` → hairline | `tailwind.config.mjs` |
| 1.6 | No more glow: ambient gradient, grain overlay, glass blur removed; `shadow-lg/xl/2xl` → `shadow-2`, `shadow-sm/md` → `shadow-1`; coloured glow shadows lose their colour; focus = 2px accent outline on keyboard focus | `src/index.css`, `tailwind.config.mjs` |
| 1.6b | 112 hard-coded gold tints `rgba(255,210,100,…)` (and two near-golds) replaced by the accent token — **colour literals only, nothing else in those files changed** | 20 screen/component files |
| 1.7 | Screenshot routine `design/tools/capture-screens.js`, run through the Playwright tool (no new npm package) | `design/tools/` |

Build: `npm run build` passes. No console errors on any of the 21 screens. No behaviour or
API changes; receipts / printing untouched.

## Known leftovers (fixed in later stages, by design)

- **Amber warnings now show in the accent colour.** About 40 places used amber for a warning
  (e.g. the "has returns" receipt row, some pending states). They become proper warning chips /
  attention rows when those components land (Stages 3, 4, 6).
- **Hard-coded hex colours in screens** (~300): chart colours (`#ffd264` sales line, pie colours),
  dashboard tooltip backgrounds, payment-method colours, the low-stock `#f59e0b`. → Stages 6–8.
- **Login / Signup background** is an inline indigo→purple gradient. → Stage 9.4.
- **Several solid coloured buttons on one screen** (Money Book: green Deposit, orange Withdraw,
  accent Transfer, grey Adjustment). → `Button` in Stage 3, applied per screen.
- **📦 emoji product tiles**, old title styles (`DASHBOARD` in caps), icon-only sidebar. → Stages 5 and 8.
- **`text-[Npx]` sizes** (304) still in place. → replaced per screen; Stage 10 removes the rest.
- Accent-coloured glows that used to be gold glows (`shadow-[…color-mix(var(--primary)…)]`) are
  now very faint accent shadows. → removed with the components that own them.

## Next

Stage 2 — theme engine (light / dark / system), shop accent colour, density, Settings → Appearance.
Send `design/backend-prompts/stage-02-shop-appearance.md` to the backend when we start it.
