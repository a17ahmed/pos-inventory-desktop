# Stage 3 — Core controls kit + Design Lab: done (waiting for your OK)

**Review it:** run the test dev server and open **`/design-lab`** (it is only in development
builds — never in the app shops install). Or look at `light-design-lab.png` / `dark-design-lab.png`
here. The theme switch and accent dots at the top let you check every block in both themes and all
six accents; the accent dots only preview, they save nothing.

No screen uses the kit yet — that starts in Stage 4 (dialogs) and grows screen by screen.

## What was built — `src/components/ui/` (import from `components/ui`)

| Component | What it is |
| --- | --- |
| `Button` | primary · outline · secondary · ghost · destructive · warning · link; sizes xs 32 · default 36 · action 40 · touch 44; `loading` shows a spinner and blocks clicks |
| `IconButton` | square icon-only button; `label` required (screen readers + hover title) |
| `Input`, `Textarea`, `Select`, `SearchInput` | same heights as buttons; outline / tinted / filled; error border; disabled and read-only looks; search with a clear (×) |
| `Field` | label + control + hint or error, ids and `aria-*` wired automatically; required * / (optional) |
| `Checkbox`, `Switch`, `SegmentedControl` | 44px click areas; indeterminate checkbox; segmented as pills (periods, theme) or buttons (payment methods) |
| `StatusChip`, `StatusBadge` | tinted pill / tag / dot; `StatusBadge kind value` reads the shared map |
| `Card`, `CardTitle`, `CardDescription`, `InsetCard`, `SectionCard` | the card look; `SectionCard` = title, description, actions, body, footer bar |
| `Money` | shop currency, even-width digits, negative in red with a real minus, missing = — |
| `Spinner`, `Skeleton`, `IndeterminateBar` | loading |
| `EmptyState`, `NoResults`, `StateCard` | empty, no results (clear filters), error (Try again + request id), no access, loading |

Shared helpers:
- `src/utils/statusTones.js` — **every status in the app in one place**: bill, payment, return,
  expense, cheque, stock, active, and all 14 Money Book entry types (word + tone + icon).
- `src/utils/money.js` — one money format: `formatAmount` (PKR 1,250 · PKR 1,250.50 · −PKR 50),
  `formatCompact` (Rs 6.5K, for chart axes). Same rule as the printed receipt. Replaces the
  separate `formatCurrency` written in ~10 screens as those screens are migrated.
- `src/components/ui/cn.js` — joins class names.
- `src/screens/DesignLab.jsx` + a dev-only lazy route in `src/App.jsx`.

**No new packages** (the reference uses `class-variance-authority` and `tailwind-merge`; plain
variant maps do the same job here).

## Checked

- Build passes; the production bundle contains no Design Lab code.
- Toolbar row: search, select, input and buttons all exactly 36px tall.
- Keyboard focus: 2px accent outline, 2px offset.
- No console errors on the page, light and dark.
- Fixed during the check: an input given a width (e.g. `w-40`) was still stretching full width.

## Rules for using the kit (also in the files' comments)

- Pass **layout** classes (margin, width, flex) through `className`; use the **props** for the look
  (variant, size, tone). Class overrides of colour/size are not reliable without tailwind-merge.
- One `primary` button per view.
- Status always through `StatusBadge` / the map, so the same word looks the same everywhere.
