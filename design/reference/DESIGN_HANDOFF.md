# Pedant — design handoff

Everything below is taken from the code in `pedant-web/` (values quoted exactly; where something is
unclear or not in the code it says so). Source files named in backticks are relative to `pedant-web/`.

> **Read this first — three things that differ from your brief**
> 1. **Pedant is not a POS.** It is a freight-brokerage operations web app (loads, carriers, commissions,
>    settlement). The _look_ is what you are copying; none of the screens are POS screens.
> 2. **Pedant is a browser SPA, not Electron.** Source stack: React 19 · Vite 8 · **Tailwind CSS 4** · shadcn/ui
>    (Radix) · **lucide-react**. Your target is Electron 28 · React 18 · **Tailwind 3** · **react-icons (Feather)**.
>    Section J is the translation (config, CSS, class-syntax changes, icon mapping).
> 3. **Screenshots are of two kinds** (see the gallery): *component* shots are the **real** components rendered
>    from `src/` through a throw-away harness; *full-screen* shots (login, dashboard, people list, settings…) come
>    from the repo's static design record `design-reference/` because the real app needs the API, MongoDB and a
>    password I did not use. The design record is the prototype Pedant was ported from; the repo says the two are
>    "no longer compared" (`.claude/patterns/design-conformance.md` rule 64), and it differs in places
>    (e.g. its Sign-in button has a gradient that `src/` rule 38 forbids). **Where they disagree, `src/` and the
>    tokens in `tokens/` win.**

---

## A. Overview

**What it is.** "Pedant — Freight operations": loads, carriers, commissions and settlement, multi-organisation,
role-gated, English + Filipino (`index.html`).

**Design style in five words:** _calm · dense · soft-rounded · hairline · cool-blue._
Cool slate neutrals, one blue accent, 1rem-anchored radii, quiet shadows, 1px low-contrast card edges, mono uppercase
micro-labels, tabular numbers. No glass, no gradients on controls, no coloured shadows, no second accent hue
(rule 38).

**Tech stack (exact installed versions, `pedant-web/node_modules`)**

| Layer | Source app | Notes |
| --- | --- | --- |
| Framework | React 19.2.8, TypeScript 6.0.3 (strict) | |
| Router / data | TanStack Router 1.170.x, TanStack Query 5.101.x, TanStack Table 8.21.3, TanStack Virtual 3.14.9 | not design-relevant |
| Styling | **Tailwind CSS 4.3.3** via `@tailwindcss/vite` 4.3.3, CSS-first (`@theme`) | tokens in `src/styles/index.css` |
| Component kit | shadcn/ui "new-york" style on **Radix UI** primitives (`components.json`) | `baseColor: neutral`, `cssVariables: true` |
| Variants | class-variance-authority 0.7.1, clsx 2.1.1, tailwind-merge 3.6.0 | |
| Build | Vite 8.2.0, `@vitejs/plugin-react` 6.0.4 | dev port 5173 (strict) |
| Icons | lucide-react 1.28.0 | |
| Fonts | `@fontsource/inter` 5.3.0, `@fontsource/inter-tight` 5.3.0, `@fontsource/jetbrains-mono` 5.3.0 | self-hosted, no CDN |
| Themes | next-themes 0.4.6, `attribute="class"`, `defaultTheme="system"` | `.dark` on `<html>` |
| Node / pkg manager | Node `>=24.18.1 <25`, pnpm 10.32.0 | `package.json` `engines` |

**Run it locally to see the screens**

```bash
cd pedant-web
pnpm install
pnpm dev            # http://localhost:5173 (strictPort; PORT=… overrides)
```

The real app is auth-guarded and needs the API (`pedant-api/`, port 3000) plus Docker infra (Mongo replica set, Redis,
ClamAV, LocalStack — `docker compose up -d` in `pedant-api/`). Local sign-in accounts are seeded from
`BOOTSTRAP_*_PASSWORD` in `pedant-api/.env` (see `pedant-api/README.md`); I did not use them.
Two login-free ways to see the design:

```bash
node ../design-reference/serve.mjs      # http://localhost:4300 — static design record (mock data, both themes)
# Design Lab with the REAL components: route /$orgSlug/design-system, dev only (VITE_ENV=development) — needs login
```

---

## B. Packages

"Essential" = the look breaks without it (or the equivalent). "Optional" = behaviour only.

| Package | Version | Used for | Look-critical? |
| --- | --- | --- | --- |
| tailwindcss / @tailwindcss/vite | 4.3.3 | all styling; `@theme` tokens | **Essential** (port to v3, §J) |
| @fontsource/inter | 5.3.0 | body/UI face, weights 400/500/600 | **Essential** |
| @fontsource/inter-tight | 5.3.0 | headings, 400/500/600 (600 in use) | **Essential** |
| @fontsource/jetbrains-mono | 5.3.0 | codes, IDs, overlines, table headers; 400/500 | **Essential** |
| class-variance-authority | 0.7.1 | variant recipes (Button, Input, chips…) | Essential (pattern) |
| clsx / tailwind-merge | 2.1.1 / 3.6.0 | `cn()`; merge needs the type-role list (`src/lib/utils.ts`) | Essential (pattern) |
| lucide-react | 1.28.0 | every icon | **Essential** → swap to react-icons/fi |
| @radix-ui/react-dialog | 1.1.23 | Dialog, Sheet | Behaviour |
| @radix-ui/react-select | 2.3.7 | Select | Behaviour |
| @radix-ui/react-tabs | 1.1.21 | Tabs | Behaviour |
| @radix-ui/react-switch / -checkbox / -radio-group | 1.3.7 / 1.3.11 / 1.4.7 | form controls | Behaviour |
| @radix-ui/react-dropdown-menu / -context-menu / -popover / -tooltip | 2.1.24 / 2.3.7 / 1.1.23 / 1.2.16 | floating surfaces | Behaviour |
| @radix-ui/react-avatar / -label / -separator / -progress / -scroll-area / -accordion / -toggle / -slot | 1.2.6 / 2.1.15 / 1.1.15 / 1.1.16 / 1.2.18 / 1.2.20 / 1.1.18 / 1.3.3 | small primitives | Behaviour |
| sonner | 2.0.7 | toasts (restyled in `ui/sonner.tsx`) | Look + behaviour |
| vaul | 1.1.2 | Drawer (bottom/side sheet) | Behaviour |
| cmdk | 1.1.1 | command palette / autocomplete list | Optional |
| recharts | 3.10.1 | charts (wrapped in `ui/chart/*`) | Look (charts) |
| @tanstack/react-table / react-virtual | 8.21.3 / 3.14.9 | the one `DataTable` | Behaviour |
| react-day-picker | 10.0.1 | calendar (`ui/calendar.tsx`) | Optional |
| react-grid-layout | 2.3.0 | draggable dashboard grid (CSS in `index.css`) | Optional |
| react-hook-form + zod + @hookform/resolvers | 7.84.0 / 4.4.3 / 5.7.1 | forms (no visual impact) | Optional |
| next-themes | 0.4.6 | light/dark class switching | Behaviour |
| **Not installed:** `tailwindcss-animate` / `tw-animate-css` | — | The code contains `animate-in fade-in-0 zoom-in-95 …` classes, but **no plugin defines them**, so in Pedant they are inert (menus/dialogs appear without an enter animation). Don't add the plugin to "match"; see §H. | — |

Headless/UI kits **not** used: Headless UI, MUI, Ant, Mantine, framer-motion (no JS animation library at all).

---

## C. Colour system

**Palette name:** "Nordic Steel Alt" (locked). Light values live on `:root`, dark on `.dark`; both in
`src/styles/index.css`, which is the single source of truth (components never define a colour — rule 3).
Authoritative values are the OKLCH strings; the hex column is my sRGB conversion (gamut-clipped) of them and is for
reference/design tools. Full 78-token list with both themes: **`tokens/colors.json`**.

**Dark-mode switch:** `class="dark"` on `<html>` (next-themes `attribute="class"`, default `system`);
Tailwind 4: `@custom-variant dark (&:is(.dark *));`. Boot-time `<meta name="theme-color">` = `#f3f8fd` (light) /
`#111418` (dark) — equal to `--background` in each theme, which cross-checks my conversion.

**Core tokens (light | dark side by side)**

| Token | Role | Light | Dark |
| --- | --- | --- | --- |
| `--background` | Page background | `#f3f8fd` · `oklch(0.978 0.008 245)` | `#111418` · `oklch(0.19 0.0088 245)` |
| `--foreground` | Primary text | `#19242e` · `oklch(0.255 0.024 245)` | `#e8f2fa` · `oklch(0.955 0.016 245)` |
| `--card` | Card / panel surface | `#fbfdff` · `oklch(0.994 0.004 245)` | `#1b1f23` · `oklch(0.238 0.0104 245)` |
| `--card-foreground` | Text on card | `#19242e` · `oklch(0.255 0.024 245)` | `#e8f2fa` · `oklch(0.955 0.016 245)` |
| `--popover` | Menus, dialogs, toasts | `#fcfeff` · `oklch(0.995 0.0032 245)` | `#23282c` · `oklch(0.272 0.0104 245)` |
| `--muted` | Muted fill (header wash, disabled, chips neutral) | `#e3eef7` · `oklch(0.943 0.0176 245)` | `#272d33` · `oklch(0.295 0.0128 245)` |
| `--muted-foreground` | Secondary text | `#5f6871` · `oklch(0.513 0.0176 245)` | `#8e98a1` · `oklch(0.6733 0.0176 245)` |
| `--placeholder` | Input placeholder | `#7e8890` · `oklch(0.62 0.0176 245)` | `#6f7981` · `oklch(0.57 0.0176 245)` |
| `--border` | Control border | `#848d95` · `oklch(0.6395 0.016 245)` | `#646d75` · `oklch(0.53 0.016 245)` |
| `--hairline` | Card edge | `#848d9580` · `color-mix(in oklab, var(--border) 50%, transparent)` | `#646d75b3` · `color-mix(in oklab, var(--border) 70%, transparent)` |
| `--input` | Input border | `#6a747e` · `oklch(0.5545 0.0192 245)` | `#808b94` · `oklch(0.63 0.0192 245)` |
| `--ring` | Focus outline | `#0f77b2` · `oklch(0.545 0.125 242)` | `#4aaef1` · `oklch(0.72 0.135 242)` |
| `--primary` | Accent / primary button / links | `#0f77b2` · `oklch(0.545 0.125 242)` | `#4aaef1` · `oklch(0.72 0.135 242)` |
| `--primary-foreground` | Text on primary | `#f6fbff` · `oklch(0.985 0.008 242)` | `#061824` · `oklch(0.2 0.035 242)` |
| `--secondary` | Secondary button fill | `#dae8f6` · `oklch(0.925 0.024 245)` | `#2f363d` · `oklch(0.33 0.016 245)` |
| `--accent` | Soft blue tint (current nav/tab count) | `#d3f1ff` · `oklch(0.945 0.045 242)` | `#1e3546` · `oklch(0.318 0.0425 242)` |
| `--accent-foreground` | Text on accent | `#176da1` · `oklch(0.513 0.1125 242)` | `#56a3db` · `oklch(0.6897 0.1125 242)` |
| `--destructive` | Danger solid | `#b74c44` · `oklch(0.555 0.14 27)` | `#e2867c` · `oklch(0.715 0.1148 27)` |
| `--destructive-chip` | Danger tint | `#ffe0d9` · `oklch(0.945 0.055 27)` | `#47231f` · `oklch(0.305 0.056 27)` |
| `--destructive-chip-foreground` | Danger tint text | `#a44b43` · `oklch(0.5245 0.119 27)` | `#d87a70` · `oklch(0.6815 0.119 27)` |
| `--warning` | Warning solid | `#a56000` · `oklch(0.555 0.135 68)` | `#d19552` · `oklch(0.715 0.1107 68)` |
| `--warning-chip` | Warning tint | `#ffe7c6` · `oklch(0.945 0.055 68)` | `#41290d` · `oklch(0.305 0.054 68)` |
| `--warning-chip-foreground` | Warning tint text | `#955b01` · `oklch(0.5245 0.1148 68)` | `#c78a43` · `oklch(0.6815 0.1148 68)` |
| `--success` | Success solid | `#13823d` · `oklch(0.5335 0.14 150)` | `#6bb77c` · `oklch(0.715 0.1148 150)` |
| `--success-chip` | Success tint | `#d4f8da` · `oklch(0.945 0.055 150)` | `#183720` · `oklch(0.305 0.056 150)` |
| `--success-chip-foreground` | Success tint text | `#277940` · `oklch(0.513 0.119 150)` | `#59a86c` · `oklch(0.665 0.119 150)` |
| `--info` | Info solid | `#3072c1` · `oklch(0.549 0.14 255)` | `#71a6ea` · `oklch(0.715 0.1148 255)` |
| `--info-chip` | Info tint | `#d5efff` · `oklch(0.945 0.055 255)` | `#1b304b` · `oklch(0.305 0.056 255)` |
| `--info-chip-foreground` | Info tint text | `#366bad` · `oklch(0.5245 0.119 255)` | `#6299de` · `oklch(0.6733 0.119 255)` |
| `--sidebar` | Sidebar surface | `#0b1d2f` · `oklch(0.225 0.042 250)` | `#0a0f13` · `oklch(0.165 0.012 250)` |
| `--sidebar-foreground` | Sidebar text | `#eaf1f8` · `oklch(0.955 0.012 250)` | `#eaf1f8` · `oklch(0.955 0.012 250)` |
| `--sidebar-primary` | Sidebar active bar | `#2886c2` · `oklch(0.595 0.125 242)` | `#4aaef1` · `oklch(0.72 0.135 242)` |
| `--sidebar-accent` | Sidebar active/hover fill | `#153349` · `oklch(0.31 0.0525 242)` | `#12334a` · `oklch(0.31 0.0567 242)` |
| `--surface-tint` | Page header band / selected row | `#eaf2fa` · `color-mix(in oklab, var(--primary) 8%, var(--card))` | `#212c35` · `color-mix(in oklab, var(--primary) 10%, var(--card))` |
| `--hover-overlay` | Hover wash | `#19242e0f` · `color-mix(in oklab, var(--foreground) 6%, transparent)` | `#e8f2fa17` · `color-mix(in oklab, var(--foreground) 9%, transparent)` |
| `--press-overlay` | Press wash | `#19242e1c` · `color-mix(in oklab, var(--foreground) 11%, transparent)` | `#e8f2fa26` · `color-mix(in oklab, var(--foreground) 15%, transparent)` |


**Usage rules the code states**

- Text pair: `foreground` on `background`/`card`; secondary copy `muted-foreground`; placeholder `placeholder`
  (lighter than muted so an example never reads as typed).
- **Card edge = `hairline`** (`--border` mixed 50% in light, 70% in dark). `--border` itself is for **control** edges
  (inputs, outline buttons) because controls must hold a 3:1 contrast; `--input` is the stronger input border.
- Status colours each come as a solid (`destructive`, `warning`, `success`, `info` + `*-foreground` for text on it) and a
  tinted **chip** pair (`*-chip` background + `*-chip-foreground` text) used by badges, banners and alerts.
- `accent` / `accent-foreground` = the soft blue tint used for the _current_ nav row, active tab count, avatar fallback.
- `surface-tint` = `color-mix(in oklab, primary 8% (dark 10%), card)`: the page header band's ground and the "selected row"
  fill. It marks a **state or a band**, never an ordinary card.
- Hover/press are overlays, not colour swaps: `--hover-overlay` = foreground 6% (dark 9%) over the element,
  `--press-overlay` = foreground 11% (dark 15%). Solid buttons instead `filter: brightness(1.06 | press 0.96)` (dark `1.1 | 0.94`).
- Focus ring = `--ring` = `--primary`, drawn as a 2px **outline**, offset 2px (never a box-shadow ring).
- Scrim `--overlay: rgb(8 12 14 / 0.42)` in both themes.
- Restricted (withheld) values use a hatch: `--restricted-hatch` = 135° repeating-linear-gradient, 1.5px line / 5px period, in
  `--restricted-foreground` (`oklch(0.49 0.02 265)` light, `oklch(0.755 0.018 265)` dark).

**Gradients, glass, transparency**

| Name | Value (from `index.css`) | Where |
| --- | --- | --- |
| `--hero-wash` | light `linear-gradient(180deg, surface-tint 0%, card 72%)`; dark `linear-gradient(170deg, surface-tint 0%, card 86%)` | the one leading card on a page (dashboard hero) via `HERO_WASH` |
| `--primary-gradient` | `linear-gradient(103deg, primary 0%, color-mix(in oklab, primary 76%, accent) 100%)` (dark mixes with `accent-foreground`) | token exists; rule 38 forbids gradient-filled buttons and `Button` does not use it. (Design-record login button does.) |
| `--auth-form-wash`, `--auth-hero`, `--auth-hero-dots`, `--auth-form-dots`, `--auth-rule(-soft)` | radial primary washes at 22%/15% (dark 20%/14%), 1px dot grids at 18px pitch | auth split screen and the page header band's dot texture |
| Glass / backdrop-blur | **none** — grep finds no `backdrop-*` in `src/`; rule 38 bans glassmorphism | — |
| Transparency in use | `bg-muted/40`, `bg-muted/30`, `bg-muted/50`, `border-border/60`, `bg-primary/10` (skeleton), `bg-primary/20` (progress track), `*-chip-foreground/20–25` (alert borders) | |

**Chart colours** (categorical, 6 steps; hue 242 blue, 304 violet, 10 rose, 78 amber, 150 green, 204 cyan):

| Token | Light | Dark |
| --- | --- | --- |
| `--chart-1` | `oklch(0.56 0.125 242)` | `oklch(0.68 0.125 242)` |
| `--chart-2` | `oklch(0.6585 0.125 304)` | `oklch(0.79 0.125 304)` |
| `--chart-3` | `oklch(0.47 0.125 10)` | `oklch(0.59 0.125 10)` |
| `--chart-4` | `oklch(0.64 0.125 78)` | `oklch(0.735 0.125 78)` |
| `--chart-5` | `oklch(0.41 0.125 150)` | `oklch(0.52 0.125 150)` |
| `--chart-6` | `oklch(0.6265 0.125 204)` | `oklch(0.845 0.125 204)` |

(`chart-2` lightness is pinned so it measures ≥3:1 against both `--background` and `--card`; the source comment says not to round it up.)
Series beyond six are drawn dashed, then dotted (see Charts screenshot). Colour is never the only carrier of meaning (rule 41).

**Sidebar tokens.** Light mode's sidebar is a **dark navy** column (`--sidebar` `oklch(0.225 0.042 250)` ≈ `#0b1d2f`);
dark mode's is a step _darker_ than the canvas (`oklch(0.165 0.012 250)` ≈ `#0a0f13`). The shell uses the "quiet" set
(`--sidebar-quiet*`, remapped onto `--sidebar*` inside `AppSidebar`); `tinted` and `inverted` sets also exist in the CSS but I did
not find them used by the shell — treat them as unused alternates.

---

## D. Typography

**Families** (`@theme inline` in `index.css`; loaded by `@import '@fontsource/…/<weight>.css'`):

- Sans / UI: `'Inter', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif` — weights 400, 500, 600
- Heading: `'Inter Tight', 'Inter', ui-sans-serif, system-ui, sans-serif` — weights 400, 500, 600 (headings are 600)
- Mono: `'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace` — weights 400, 500

**The type ladder** — every text style is a named _role_ (size / line-height / letter-spacing / weight in one class). Never
`text-[13px]`; Tailwind's stock `text-xs/sm/base/lg/…` are banned (rules 61–63). Heading roles must pair with `font-heading`.

| Role class | Size / line-height | Tracking | Weight | Face | Used for |
| --- | --- | --- | --- | --- | --- |
| `text-micro` | 10 / 13 | – | – | Inter | tiny helper text |
| `text-caption` | 11.5 / 17 | – | – | Inter | card descriptions, chip text (sm/xs), count pills |
| `text-body-sm` | 12.5 / 18 | – | – | Inter | link buttons, dense table text, alert body |
| `text-body` | 13 / 19 | – | – | Inter | default UI text, tabs, ghost buttons, table cells (default density) |
| `text-body-lg` | 14 / 21 | – | – | Inter | **buttons, inputs, selects**, empty-state title |
| `text-lead` | 15 / 22 | – | – | Inter | lead paragraph |
| `text-label` | 11 / 16 | 1px | 600 | Inter | uppercase label (add `uppercase`) |
| `text-h5` | 15 / 20 | −0.2px | 600 | Inter Tight | card/drawer section heading (`SectionHeading sm`) |
| `text-h4` | 16 / 21 | −0.3px | 600 | Inter Tight | **card title**, page section heading (`SectionHeading md`) |
| `text-h3` | 17 / 22 | −0.3px | 600 | Inter Tight | |
| `text-h2` | 24 / 30 | −0.7px | 600 | Inter Tight | **page title** (phone: 22 / 28, −0.5px), KPI figure |
| `text-h1` | 30 / 36 | −0.8px | 600 | Inter Tight | |
| `text-display` | `clamp(26px, 2.7vw, 40px)` / 1.14 | −1.2px | 600 | Inter Tight | auth hero title |
| `text-overline` / `-md` / `-lg` / `-xl` | 9.5/14 · 10/13 · 10.5/15 · 11/16 | 1 · 1 · 1.4 · 1.2px (xl weight 500) | – | JetBrains Mono | uppercase eyebrows, KPI labels, sidebar group labels (`font-mono uppercase`) |
| `text-mono-2xs/xs/sm/mono/mono-lg` | 10.5/15 · 11/16 · 12.5/19 · 13.5/20 · 16/22 (lg −0.2px) | – | – | JetBrains Mono | record codes (`PD-40192`), IDs |
| `text-th` | 10 / 14 | 0.5px | – | JetBrains Mono | **table header** (`text-th text-muted-foreground font-mono uppercase truncate`) |

**Applied recipes**

| Element | Classes / value |
| --- | --- |
| Page title | `font-heading text-h2` (via `AppPage`; phone 22px/28px/−0.5px) |
| Section heading in a page | `SectionHeading md` → `text-h4` · in a card/drawer → `sm` → `text-h5` |
| Card title | `font-heading text-h4`; description `text-muted-foreground text-caption text-pretty` |
| Body | `text-body` (13px/19px) in `text-foreground` |
| Small / caption | `text-caption` (11.5px/17px) or `text-body-sm` (12.5px) |
| Numbers / money | `tabular-nums`, right-aligned in tables, formatted by `formatMoney` with an explicit currency; the primary currency first, the secondary muted (`ui/money.tsx`; ADR-0042) |
| KPI figure | `font-heading text-h2 break-words`; KPI label = mono overline |
| Button | `text-body-lg font-medium` (ghost: `text-body`; link: `text-body-sm`) |
| Table header | `text-th` mono uppercase muted · Table cell: `text-body-sm` compact / `text-body` default / `text-body-lg` comfortable |
| Tabs | `text-body font-medium` |
| Sidebar group label | `text-overline font-mono uppercase text-sidebar-foreground/70` |

**Special rules.** `tabular-nums` on every figure/count; machine values (ISO stamps, enums) never reach the screen (rule 77);
dates are unambiguous with a zone (`4 Mar 2026, 14:00 PHT`); table cells truncate (`block truncate`) or clamp to 2 lines
(`line-clamp-2 break-words text-pretty`); `text-pretty`/`text-balance` on paragraphs and buttons; **≤ 2 font weights in one card**
(rule 38); never centred body text. Input font size is 16px (`text-base`) below the `md` breakpoint (iOS zoom guard) and `text-body-lg` above —
irrelevant in Electron, where you can use `text-body-lg` throughout.

---

## E. Spacing, layout and shape

**Spacing.** Tailwind's 4px step. Layout primitives take a `gap` prop named by pixels — scale in `ui/elements/stack.tsx`:
`0, 2, 3, 4, 6, 7, 8, 10, 12, 14, 16, 18, 20, 24, 32` px. Card padding `p-4` (16px); `CARD_SURFACE` adds `p-5` (20px).
Page content padding (`appPage()` in `src/lib/layout.ts`): **X = 22px** (laptop), 16px when the pane is narrow, **14px** on phone;
**Y = 20px** (16px phone/narrow). Dialog padding `p-5`, gap `gap-3.5` (14px). Menu panel padding `p-1.5`.

**Radius** (anchor `--radius: 1rem`; all derived, `:root` in `index.css`):

| Token / class | px | Used on |
| --- | --- | --- |
| `rounded-2xs` | 4 | checkbox box, tag chips, control glyphs |
| `rounded-xs` | 10 | rows, small chips, icon tiles, toast icon tile |
| `rounded-sm` | 12 | **buttons, inputs, selects, tabs triggers** |
| `rounded-md` | 14 | **menus, popovers, dialogs, alerts/banners, tooltips**, badge |
| `rounded-lg` | 16 | **cards, panels, page header band, pill tab list** |
| `rounded-xl` | 20 | — |
| `rounded-full` | 999 | status pills, switches, avatars, count pills |

**Borders.** 1px everywhere. Controls: `border-input` (inputs, selects, checkbox, switch off-state) or `border-border` (outline
button, tinted input, popover). Cards: `border-hairline`. Table rules are _painted_ backgrounds, not borders: header rule uses
`--border`, body rules `color-mix(in oklab, var(--border) 55%, transparent)`, inset 12px (`TABLE_GUTTER`); no vertical rules in
the body. Dashed `border-border/60` marks a locked/withheld slot.

**Shadows / elevation** (theme-dependent; `--shadow-1` / `--shadow-2` in `index.css`)

| Token | Light | Dark | Used on |
| --- | --- | --- | --- |
| `--shadow-1` | `0 1px 2px rgb(15 23 42 / 0.06), 0 4px 12px rgb(15 23 42 / 0.06)` | `0 1px 2px rgb(0 0 0 / 0.45)` | cards (`CARD_FRAME`) |
| `--shadow-2` | `0 12px 32px rgb(15 23 42 / 0.12)` | `0 10px 30px rgb(0 0 0 / 0.55)` | everything that floats: menus, popovers, dialogs, drawers, toasts |
| `--shadow-1-flat` / `-2-flat` | `0 1px 3px rgb(16 20 24 / 0.08)` / `0 10px 24px rgb(16 20 24 / 0.12)` | same | defined ("depth disabled" level 0); I found no component using them — unverified |
| `--knob-shadow` | `0 1px 2px rgb(0 0 0 / 0.2)` | same | switch knob |
| input `filled` | `inset 0 -1px 0 var(--input)` | | bottom edge on filled fields |

No shadows on buttons; no coloured shadows (rule 6/38). In dark, separation is surface lightness + the 1px edge.

**Layout numbers**

| Thing | Value | Source |
| --- | --- | --- |
| Sidebar | **260px** expanded · **64px** icon rail · phone: hidden + `18rem` overlay drawer; width transition `200ms linear` | `ui/sidebar.tsx` |
| Top bar | **h-14 (56px)**, `bg-card border-b border-border`, `px-5` (phone `px-3.5`), `gap-4` | `AppHeader.tsx:430` |
| Page header band | tinted card: `bg-surface-tint border-hairline rounded-lg border py-4 lg:py-5`, gutter `px-3.5 sm:px-4 lg:px-[22px]`, 18px dot texture at 50% opacity + a 320px ring | `AppPage.tsx` |
| Dialog widths | `sm` 400 · `md` 480 · `lg` 640 · `xl` 880 · `full` (viewport − 4rem); max-height `100dvh − 4rem` | `ui/dialog.tsx` |
| Drawer widths | `sm` 480 · `md` 600 · `lg` 58vw clamped 700–880 (rule 72) | rule 72 |
| Record page | main column + **320px** sticky summary rail from `xl` | `DetailLayout` |
| Menu widths | `w-44` / `w-52` / `w-60` (176/208/240) | `panel-surface.ts` |
| Auth column | max 400px; control 44px (42 phone) | `layout.ts` |
| Nav rail (in-page filter list) | 208px | `NAV_RAIL_WIDTH` |
| Control heights | 36 default · 32 `xs` · 28 `2xs` · 40 `action` · **44** `sm`/`xl`/`icon` (touch floor, 42 on phone) | `button.tsx`, `input.tsx` |
| Table | row 36 / **44** / 56 and header 32 / **36** / 40 for compact / default / comfortable (`data-table/density.ts`); selected/attention rows get a 3px left edge in `primary` / `warning` | |
| Content max width | no global cap in the shell (pages fill the pane); the dev Design Lab uses `max-w-[1080px]` | |

**Responsive tiers** (`src/lib/layout.ts`): `phone < 640`, `tablet < 1024`, `laptop ≥ 1024`. The design is checked at 1440 / 1366 /
1024 / 768 / 390. Toolbar controls keep one row via measured "fit rungs"; sidebar auto-rails below 1120 in the design record.
In an Electron POS window you will mostly live in `laptop`; keep the 44px hit-area floor for touch terminals.

---

## F. Components

Source paths are in `src/components/ui/` unless noted. Copies of the sources are in `components/` (as-is) and the
Tailwind-3 ports in `components-v3/`. State classes are as written in the source (Tailwind 4 syntax — convert per §J).

### Buttons — `button.tsx`
Base: `inline-flex cursor-pointer items-center justify-center gap-2 rounded-sm text-center text-body-lg font-medium text-balance transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50 aria-busy:cursor-progress aria-busy:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0`

| Variant | Classes (main) | Hover / active |
| --- | --- | --- |
| `default` (primary) | `bg-primary text-primary-foreground` | `filter: brightness(1.06)` / press `0.96` + `translateY(0.5px)` |
| `destructive` | `bg-destructive text-destructive-foreground` | same as primary |
| `warning` | `bg-warning text-warning-foreground` | same |
| `outline` | `border border-border bg-card` | `bg-(--hover-overlay)` / `bg-(--press-overlay)` + 0.5px shift |
| `secondary` | `bg-secondary text-secondary-foreground` | overlays |
| `ghost` | `text-muted-foreground text-body` | overlays |
| `link` | `h-auto p-0 text-body-sm text-primary underline-offset-4 hover:underline` | underline |

Sizes: `default` h-9 px-4 · `xs` h-8 px-2.5 (icon 14px) · `2xs` size-7 (icon 14px) · `action` min-h-10 · `sm` min-h-11 px-3 text-body ·
`lg` h-10 px-8 · `xl` min-h-11 px-4 · `icon` size-11. Disabled/busy: 50% opacity, hover/press suppressed. Focus: 2px outline `--ring`, offset 2.
**One primary per view** is the observed pattern. Screenshot: `components/controls-01-button.png`.

### Inputs — `input.tsx`, `select.tsx`, `textarea.tsx`, `checkbox.tsx`, `switch.tsx`, `radio-group.tsx`
- **Input** base: `flex w-full rounded-sm border px-3 py-1 text-base md:text-body-lg placeholder:text-placeholder placeholder:text-body focus-visible:outline-2 …ring` ; disabled: `bg-muted text-muted-foreground placeholder:text-transparent`; invalid: `aria-invalid:border-destructive`; warned: `data-warned:border-warning`.
  Variants: `outline` (`border-input bg-transparent`, default) · `tinted` (`border-border bg-card`, 13px type) · `filled` (`bg-muted border-transparent` + bottom 1px inset `--input`) · `filled-edged` · `underline`. Heights: 36 / `xs` 32 / `action` 40 / `xl` 44.
- **Select trigger**: same box as the input (`rounded-sm border px-3 py-2`), chevron-down at 50% opacity (16px; 14px at `xs`); menu = floating surface below.
- **Checkbox**: `h-4 w-4 rounded-2xs border border-input bg-card`; checked `bg-primary border-primary text-primary-foreground`; indeterminate = primary border + inset primary ring + minus glyph; hover `border-primary` + overlay. Wrapped to a 44px hit area by its label row.
- **Switch**: track 46×28 (`xs` 36×20), 3px inner padding, **checked `bg-primary`**, unchecked `bg-secondary` with a 1px `--input` border; knob 20px (`xs` 14px) `--knob` white with `--knob-shadow`, slides 18px (xs 14px) in 120ms; hit area min 44×44; "mixed" parks the knob halfway.
- **Radio / date picker / search**: radio (`radio-group.tsx`) uses the same 1px `--input` edge + primary dot; date picker = `calendar.tsx` (react-day-picker) inside a popover; search = `Input` with a leading Search icon (see data-table toolbar, `components/controls-…` and `06-data-table`).
- Screenshots: `components/controls-10-segmented-control-switch-checkbox.png`, `components/controls-02-the-44px-row.png`, `components/form-01-block.png`, `light/15-select-open.png`.

### Cards and KPI — `card.tsx`, `card-surface.ts`, `kpi-card.tsx`, `chrome/section-card.tsx`
- `CARD_FRAME = 'bg-card border-hairline rounded-lg border shadow-(--shadow-1)'`; `Card` adds `text-card-foreground flex flex-col gap-3 p-4`. Title `font-heading text-h4`; description `text-muted-foreground text-caption text-pretty`.
- `INSET_FRAME = 'bg-muted/40 border-hairline rounded-lg border'` (card inside a card); `FOOTER_GROUND = 'bg-muted/40 border-hairline border-t'`; `HERO_WASH = 'bg-card bg-(image:--hero-wash)'`; `LOCKED_SLOT = 'border-dashed border-border/60 bg-muted/30 shadow-none'`.
- **KPI**: variants `strip` (cells divided by hairlines inside one card; `px-4 py-2`, 5-row subgrid), `hero`, `bare`, plain tile (`CARD_FRAME min-w-0 p-3 sm:px-4 sm:py-3.5`) and a dashboard tile (`bg-surface-tint rounded-sm px-4 py-3.5`). Figure = `font-heading text-h2`; label = mono overline; delta tone classes `text-success-chip-foreground | text-warning-chip-foreground | text-destructive | text-muted-foreground`. A drill-down KPI is a whole-card button (`hover:bg-accent`). A row of figures is one strip with its period stated, never several bordered tiles of dashes.
- Screenshots: `components/kpi-01…09`, `components/layout-07-sectioncard.png`.

### Tables — `table.tsx`, `table-surface.ts`, `data-table/*`
- All lists use the one `DataTable`. Toolbar is one 36px row (search → filters → selection → right cluster); header cells `text-th` mono uppercase muted with drag grip / sort / menu that float in on hover; rows 44px (default), hover = `--hover-overlay` painted behind the row (not a colour swap); **selected** row = `--surface-tint` fill + 3px `primary` left edge; **attention** row = `--warning-chip` fill + 3px `warning` edge; no zebra, no vertical rules; pagination footer "Rows per page [10] · 1 to 10 of 42" + first/prev/next/last 32px outline buttons.
- States drawn by the same component: default, loading (skeleton rows), empty, no-results, error (retry), permission-denied — screenshots `light/16-table-loading.png`, `17-table-empty.png`, `18-table-error.png`, `19-table-denied.png`, hover `20-table-row-hover.png`. Raw `ui/table` states: `light/05-raw-table.png`.
- Money columns right-aligned `tabular-nums`; code columns mono; status columns `StatusBadge`.

### Modals, drawers, menus, popovers, tooltips
- **Dialog** (`dialog.tsx`): `bg-popover text-popover-foreground rounded-md p-5 gap-3.5 shadow-(--shadow-2)`, centred, scrim `bg-(--overlay)` (`DialogOverlay`; in the harness screenshot the confirm dialog showed no dimming, so it may be non-modal there — unverified); sizes 400/480/640/880/full; footer actions right-aligned, primary last; × button in the corner; first field gets focus on open (never ×/Cancel); a "bar" footer is `bg-muted/40 border-t` bleeding to the edges. Screenshots `light/11-modal-destructive-dialog.png`, `components/overlays-01…03`.
- **Drawer** (`drawer.tsx`, vaul; `sheet.tsx` for side sheets with 300ms close / 500ms open): header (eyebrow code, `h4` title, chips, actions, close) → body of sections separated by 1px rules → sticky footer (primary right, destructive at the start). Decisions about the drawer's record open _inside_ the footer, never a dialog over a drawer. `light/12-drawer-open.png` (in the harness at 1440 vaul rendered it as a bottom sheet; the real app docks it — layout of the dock not captured).
- **Menu surface** (`dropdown-menu.tsx`): `bg-popover text-popover-foreground border border-border rounded-md p-1.5 shadow-(--shadow-2)`; rows `min-h-8` (32px) `text-body` `ps-2.5 pe-2.5 gap-2`, row radius `calc(var(--radius-md) - 7px)` (7px), focus = hover-overlay; section labels `text-body-sm text-muted-foreground h-8`; destructive item last after a separator. `light/13-dropdown-menu-open.png`.
- **Tooltip** (`tooltip.tsx`): `bg-primary text-primary-foreground text-body-sm rounded-md px-3 py-1.5` (a filled **primary** tooltip). Every icon-only button needs one (rule 38).
- **Popover**: `bg-popover text-popover-foreground border-border`, same `--shadow-2`.

### Toasts, banners, alerts — `sonner.tsx`, `alert.tsx`
- **Toast** (sonner): `flex w-full items-center gap-3 rounded-md border border-border bg-popover px-4 py-3.5 text-foreground shadow-(--shadow-2) animate-toast-in`; 26px icon tile `rounded-xs` (`bg-info-chip` for running, `bg-muted` for glyph); docked top-centre or beside right panels. `light/14-toast-success.png`.
- **Banner** (one line + action): `text-body min-h-9 gap-x-2 rounded-md border px-3 py-1.5`; tones neutral `bg-muted/50 border-border`, info/success/warning `bg-<tone>-chip border-<tone>-chip-foreground/20–25 text-<tone>-chip-foreground`, destructive `bg-destructive-chip border-destructive/30`. **Alert** (title + body): `rounded-md border px-3 py-2 text-body`, title `text-body font-semibold`, body `text-body-sm`. Screens: `components/feedback-02-banner.png`, `feedback-04-alerts.png`.

### Badges, chips, tags, avatars — `chips/status-chip.tsx`, `badge.tsx`, `avatar.tsx`
- **StatusBadge / StatusChip** (the one status pattern): tinted **pill** `rounded-full`, `px-2.5 py-0.5 text-body-sm font-medium`, 12px icon, tone → `bg-<tone>-chip text-<tone>-chip-foreground` (neutral = `bg-muted text-muted-foreground`, accent = `bg-accent text-accent-foreground`). Sizes md/sm/xs. `tag` shape = `rounded-2xs h-5 px-1.5 text-caption`; `dot` appearance = coloured 6px dot + normal text. Every chip has an icon or text — never colour alone.
- `Badge` (`badge.tsx`): `rounded-md border px-2.5 py-0.5 text-body-sm font-semibold`; default/secondary/destructive/outline. Rule 73 says status uses `StatusBadge`, not `Badge`.
- **Avatar**: `h-10 w-10 rounded-full`; fallback `bg-muted` (header uses `bg-accent text-accent-foreground text-caption font-semibold`, 26px/36px in the user menu); initials, no photos by default.
- Screens: `components/controls-04-status-chips-and-badges.png`.

### Tabs, segmented controls, breadcrumb, navigation — `tabs.tsx`, `inputs/segmented-control.tsx`, `rail/nav-rail.tsx`, `features/shell/components/*`
- **Underline tabs** (page strip): list `border-border flex gap-[18px] overflow-x-auto border-b px-1`; trigger `min-h-11 px-0.5 text-body font-medium`, inactive `text-muted-foreground`, active `text-foreground` + 2px `bg-primary` bar on the bottom edge; optional count pill (`text-caption rounded-full px-1.5 py-0.5 font-semibold tabular-nums`, active `bg-accent text-accent-foreground`). One tab level per page, inside the header band.
- **Pill tabs**: list `bg-muted rounded-lg p-1 h-9`, active trigger `bg-background text-foreground rounded-sm`.
- **Segmented control**: `appearance="buttons"` for a choice row, `"pills"` for a narrowing row (44px on coarse pointers).
- **Sidebar**: 260px, navy `--sidebar`; header with logo; group labels mono overline; nav rows use the primitive's menu button; **active item** = `--sidebar-accent` fill + a 2px `--sidebar-primary` bar on the left edge (`before:inset-y-1.5 before:left-0 before:w-0.5 before:rounded-full`), no glow/shadow (`--nav-active-shadow: none`); collapsed rail 64px shows glyphs only with tooltips; footer has a top `border-sidebar-border` with the user menu.
- **In-page NavRail** (`rail/nav-rail.tsx`, 208px): rows `h-9`, icon 16px, trailing tabular count, current row `bg-accent` + the nav-row current style (`aria-[current]:bg-accent aria-[current]:text-foreground`). `components/layout-08-navrail.png`.
- **Top bar**: breadcrumb trail (group / page) left, avatar-pill user menu right (`bg-muted rounded-full py-1 pr-2.5 pl-1`); the **page H1 is drawn by the page band, not the top bar** (rule 76).
- **Page header (`AppPage`)**: back link (`text-body-sm text-muted-foreground`, 14px arrow), eyebrow (mono overline) or record code + status chip, H1, muted subtitle (`max-w-[78ch]`), actions right, tabs on the band's bottom edge. `components/layout-01-apppage.png`.

### Empty, loading, error states — `empty-state.tsx`, `skeleton.tsx`, `spinner.tsx`, `chrome/state-card.tsx`
- **EmptyState** `md`: centred glyph (20px) + `text-body-lg font-semibold` title + `text-body text-muted-foreground max-w-[48ch]` body + optional actions; `sm`: one inline line (16px glyph, no tile) for inside cards/tables.
- **Skeleton**: `bg-primary/10 animate-pulse rounded-md` (pulse 1.1s, opacity 1 → 0.45). **Spinner**: `border-2 border-primary/30 border-t-primary size-4 rounded-full`, 0.7s linear. **Indeterminate bar**: `bg-primary/20 h-[3px] rounded-full` track with a 42%-wide `bg-primary` runner (1.15s). **Circular progress** for "x of y" counts.
- **StateCard**: a bordered row that replaces a screen's content (loading / error with request id + "Try again" / forbidden). Screens: `light/08-feedback.png`, `components/feedback-03…07`.

### Charts — `chart/*` (recharts)
Bar, grouped, stacked, horizontal bar, line, area, donut, sparkline, heat grid, rank ladder, each inside a `ChartPanel` (its own card on a page, flat inside one) with legend, tooltip, a table view toggle and export. Series use `--chart-1…6`; 7+ series go dashed then dotted. `light/09-charts.png`, `components/charts-01…14`.

---

## G. Icons and imagery

- Library: **lucide-react 1.28.0** (outline, `strokeWidth` default 2; a few status marks use `strokeWidth={2.5}` at `size-3`). Components set icon size through their container: `[&_svg]:size-4` in buttons (14px at `xs`/`2xs`), `size-3` in chips, `size-3.5` for chevrons/inline, `size-5` for empty-state glyphs, `size-[18px]`/`size-5` for the menu toggle. Icons are always `aria-hidden` and sit left of the label with `gap-2` (8px); icon-only buttons get a tooltip + `aria-label`.
- Most-used icons (import counts in `src/`): TriangleAlert 67, Check 47, Lock 34, Info 34, Trash2 29, Plus 27, X 24, Loader2 24 (spinner glyph), ShieldAlert 23, Ban 23, Clock 19, PenLine 18, ChevronRight 18, ChevronDown 17, RotateCcw 14, Users 13, Download 13, Search 12, Copy 12, CircleCheck 12, Truck 9, Inbox 9, Eye/EyeOff 9/8, Upload 6, Minus 6.
- **Logo:** `ui/pedant-logo.tsx` (a rounded-square blue "P" mark + "Pedant." wordmark with a primary-coloured full stop; the mark is rendered 30px in the auth band). Not copied; brand-specific.
- **No illustrations, no stock imagery, no emoji** (rule 38). Empty states are a line glyph + text. Auth hero uses a code-drawn glimpse of the UI (dot grid + ring outlines), not an image.
- Favicon: `public/favicon.svg`.

**lucide → react-icons/fi (Feather) map** — see §J for the table.

---

## H. Motion

All values from `index.css` / components. Motion is quiet: colour and elevation only; layout properties never transition globally.

| What | Value |
| --- | --- |
| Interactive transition (`button, a, [role=checkbox|tab|row|option]`) | `background-color .15s ease, color .15s ease, border-color .15s ease, box-shadow .15s ease, filter .15s ease, transform .12s ease, opacity .15s ease` |
| Inputs / textarea / select | `background-color, color, border-color, box-shadow` all `.15s ease` |
| Press | `transform: translateY(0.5px)` (`--press-shift`) |
| Hover brighten | `brightness(1.06)` light / `1.1` dark; press `0.96` / `0.94` |
| Switch knob | `transform 120ms ease` |
| Spinner | `pedant-spin .7s linear infinite` |
| Skeleton / pulse | `pedant-pulse 1.1s ease-in-out infinite` (opacity 1 → .45 → 1) |
| Indeterminate bar | `pedant-bar 1.15s ease-in-out infinite` (translateX −110% → 260%) |
| Toast enter | `pedant-toast-in .18s ease-out` (opacity 0 + `translateY(8px)` → none) |
| Fade | `pedant-fade .12s ease-out` |
| Screen / page enter | `pedant-screen-in .26s ease-out` (opacity 0 + `translateY(6px)` → none) |
| Dashboard card rise | `.dashboard-rise`: `pedant-screen-in .32s ease-out backwards`, delay `min(index, 8) × 40ms`, only under `prefers-reduced-motion: no-preference` |
| Phone nav drawer | `pedant-drawer-in .26s ease-out` (opacity + `translateX(24px)` → none; used with `animate-[pedant-drawer-in_0.26s_ease-out]`) |
| Accordion | `accordion-down/up .2s ease-out` (height ↔ `--radix-accordion-content-height`) |
| Sidebar width | `transition-[width] duration-200 ease-linear` |
| Sheet | `duration-300` closing, `duration-500` opening, `ease-in-out` |
| Dialog panel | `duration-200` (but the `animate-in`/`zoom-in-95` enter classes are inert without a plugin — dialogs effectively fade only via the overlay if at all; unverified visually) |
| Reduced motion | `*{animation-duration:.01ms!important; animation-iteration-count:1!important; transition-duration:.01ms!important}` |
| `pedant-menu-in` keyframe (`opacity 0, translateY(-4px) scale(.99)` → none) | defined but I found no usage |

Keyframes verbatim are in `tokens/globals.css`.

---

## I. Design rules ("design sense")

Distilled from `.claude/patterns/design-conformance.md` and what the components do.

1. **Tokens only.** No hex, no raw palette class (`bg-slate-800`), no `text-[13px]`. Every colour/radius/shadow is a named token; a component never defines one.
2. **Type is a role, not a measurement.** 13px body is the default; 14px is reserved for controls; headings are Inter Tight 600 with negative tracking; codes and labels are JetBrains Mono.
3. **Mono uppercase micro-labels everywhere structure needs naming** — table headers (10px/+0.5px), KPI labels, sidebar groups, eyebrows — while data stays in sentence-case Inter.
4. **Cards are soft: 16px radius, 1px _half-strength_ hairline, quiet shadow.** The full `--border` is for controls; never put the full border on a card. In dark, the edge (70% hairline) does the separating.
5. **One title per screen, drawn by a tinted page band** (`surface-tint`, dot texture, ring) with eyebrow → H1 → subtitle → actions → tab strip. The top bar only shows the trail.
6. **Borders not shadows, colour for exceptions.** Chrome is neutral grey-blue; saturated colour appears only for the primary action, status, and attention.
7. **One primary (solid blue) button per view**; secondary actions are `outline`; the quiet option is `ghost`; destructive/warning only where the action is.
8. **No shadows on buttons, no gradients on controls, no glass, no coloured shadows, no second accent hue.** Floating layers (and only those) cast `--shadow-2`.
9. **Hover/press are overlays, not recolours** (6% / 11% foreground wash; solid buttons brighten 6%) and a 0.5px press shift — identical behaviour on every control.
10. **Focus is a 2px outline offset 2px in the primary colour**, never a glow. Everything interactive is keyboard-operable; hit areas are ≥ 44px (controls 36px stay visually small but gain an invisible 44px target on coarse pointers).
11. **Control heights are variants** (36 / 32 / 28 / 40 / 44) — never `h-11` on a control. Same ladder for Button, Input, Select so a row lines up.
12. **Status = tinted pill with a word and (often) an icon** on the tone's chip tint; never colour alone, never a saturated filled badge.
13. **Money and numbers:** decimal strings, explicit currency, `tabular-nums`, right-aligned in tables, primary currency first with the secondary muted; dates always with a zone and an unambiguous month name; a missing value is a muted em dash.
14. **Tables are calm:** 44px rows, painted hairline rules inset 12px, no vertical rules, no zebra, hover is a wash, selection is a tint + 3px primary edge, attention is a warning tint + 3px edge. Every list has all six states (default, loading, empty, no-results, error, denied).
15. **Every state is designed:** empty (`EmptyState`), loading (skeleton / spinner), error (message + retry + request id), permission-denied, success (toast). A screen with no data shows its empty state, never fake rows.
16. **Dialogs by ladder** (400/480/640/880), as tall as their content; primary action last on the right; first field focused. A decision about a drawer's record opens inside the drawer.
17. **Icon-only buttons always have a tooltip + `aria-label`;** icons are 16px beside text, 14px in dense controls, always paired on the left of the label.
18. **Copy is real and short** (no lorem, no emoji), survives +35% expansion (no fixed-width buttons), left-aligned, `text-pretty`.
19. **Layout is spacing-by-prop:** `Stack/Inline/Grid` with a `gap` named in px; page padding 22/16/14 by tier.
20. **Dark mode is a first-class palette, not an inversion:** background `#111418`, cards a step lighter, primary lifts to `#4aaef1` with a dark ink, sidebar goes _darker_ than the canvas, shadows get heavier (0.45–0.55 black) while borders get stronger.

---

## J. How to move it to a Tailwind 3 app (Electron 28 · React 18 · react-icons)

Files: `tokens/tailwind.config.js` (ready to use), `tokens/globals.css` (Tailwind-3 version of `index.css`), `components-v3/*` (ports).
**I did not run the v3 config in a v3 project** — it is a direct translation; test it (`npx tailwindcss -i … --content …`) before relying on it.

### J1. Install

```bash
npm i react-icons@5 clsx class-variance-authority tailwind-merge@2 \
      @fontsource/inter @fontsource/inter-tight @fontsource/jetbrains-mono \
      @radix-ui/react-dialog @radix-ui/react-select @radix-ui/react-tabs @radix-ui/react-switch \
      @radix-ui/react-checkbox @radix-ui/react-dropdown-menu @radix-ui/react-popover \
      @radix-ui/react-tooltip @radix-ui/react-slot @radix-ui/react-label sonner@2 next-themes
npm i -D tailwindcss@3.4 postcss autoprefixer @tailwindcss/container-queries tailwindcss-animate
# (react 18 is compatible with every package above; Radix versions listed in §B work with React 18.)
```
`tailwind-merge` 3.x targets Tailwind 4 — use 2.x with Tailwind 3. `tailwindcss-animate` is **optional**: Pedant does not have it (see §B), so add it only if you want the enter/exit animations the `animate-in` classes imply.

### J2. `tailwind.config.js` — paste-ready `theme.extend`
The whole file is `tokens/tailwind.config.js`; the part to paste into an existing config:

```js
const c = (name) => `color-mix(in oklab, var(--${name}) calc(<alpha-value> * 100%), transparent)`;
// theme.extend:
colors: { background: c('background'), foreground: c('foreground'), card: c('card'), 'card-foreground': c('card-foreground'),
  popover: c('popover'), 'popover-foreground': c('popover-foreground'), muted: c('muted'), 'muted-foreground': c('muted-foreground'),
  placeholder: c('placeholder'), border: c('border'), hairline: c('hairline'), input: c('input'), ring: c('ring'),
  primary: c('primary'), 'primary-foreground': c('primary-foreground'), secondary: c('secondary'), 'secondary-foreground': c('secondary-foreground'),
  accent: c('accent'), 'accent-foreground': c('accent-foreground'),
  destructive: c('destructive'), 'destructive-foreground': c('destructive-foreground'), 'destructive-chip': c('destructive-chip'), 'destructive-chip-foreground': c('destructive-chip-foreground'),
  warning: c('warning'), 'warning-foreground': c('warning-foreground'), 'warning-chip': c('warning-chip'), 'warning-chip-foreground': c('warning-chip-foreground'),
  success: c('success'), 'success-foreground': c('success-foreground'), 'success-chip': c('success-chip'), 'success-chip-foreground': c('success-chip-foreground'),
  info: c('info'), 'info-foreground': c('info-foreground'), 'info-chip': c('info-chip'), 'info-chip-foreground': c('info-chip-foreground'),
  sidebar: c('sidebar'), 'sidebar-foreground': c('sidebar-foreground'), 'sidebar-primary': c('sidebar-primary'), 'sidebar-accent': c('sidebar-accent'),
  'sidebar-accent-foreground': c('sidebar-accent-foreground'), 'sidebar-border': c('sidebar-border'),
  'surface-tint': c('surface-tint'), 'chart-1': c('chart-1') /* … chart-2 … chart-6 */ },
borderRadius: { '2xs': 'calc(var(--radius) - 12px)', xs: 'calc(var(--radius) - 6px)', sm: 'calc(var(--radius) - 4px)',
  md: 'calc(var(--radius) - 2px)', lg: 'var(--radius)', xl: 'calc(var(--radius) + 4px)' },
boxShadow: { 1: 'var(--shadow-1)', 2: 'var(--shadow-2)', knob: 'var(--knob-shadow)' },
fontFamily: { sans: ["'Inter'", 'ui-sans-serif', 'system-ui', 'sans-serif'], heading: ["'Inter Tight'", "'Inter'", 'sans-serif'], mono: ["'JetBrains Mono'", 'ui-monospace', 'monospace'] },
fontSize: { /* the 23 roles in §D — see tokens/tailwind.config.js */ },
spacing: { 1.25: '0.3125rem', 6.5: '1.625rem', 10.5: '2.625rem', 15: '3.75rem' },
animation: { spin: 'pedant-spin .7s linear infinite', pulse: 'pedant-pulse 1.1s ease-in-out infinite', 'toast-in': 'pedant-toast-in .18s ease-out',
  fade: 'pedant-fade .12s ease-out', 'screen-in': 'pedant-screen-in .26s ease-out', bar: 'pedant-bar 1.15s ease-in-out infinite' },
```
Set `darkMode: 'class'` and toggle `document.documentElement.classList.toggle('dark')` (or next-themes `attribute="class"`).
**Why `color-mix` in the colour helper:** it keeps `bg-primary/10`-style opacity modifiers working while the variable stays a full `oklch()`; Chromium 120 (Electron 28) supports `color-mix()` and `oklch()`. Shadows are used as `shadow-1` / `shadow-2`.

### J3. `index.css`
Use `tokens/globals.css`: three `@tailwind` directives, the font imports, then the unchanged `:root` / `.dark` token blocks, keyframes, the interactive transition block, the reduced-motion rule and a plain-CSS base layer (`* { border-color: var(--border) }`, body background/colour/font, pointer cursor on enabled buttons).

### J4. Tailwind 4 → 3 class translation (what to change when copying class strings)

| In the source (v4) | In your app (v3) |
| --- | --- |
| `bg-(--hover-overlay)`, `shadow-(--shadow-2)`, `w-(--sidebar-width)` | `bg-[var(--hover-overlay)]`, `shadow-2`, `w-[var(--sidebar-width)]` |
| `bg-(image:--hero-wash)` | `bg-[image:var(--hero-wash)]` |
| `outline-solid` (+ `outline-2 outline-offset-2 outline-ring`) | `outline outline-2 outline-offset-2 outline-ring` |
| `not-disabled:` / `not-aria-busy:` | added by the plugin in the config (`&:not(:disabled)`, `&:not([aria-busy="true"])`) |
| `pointer-coarse:` | added by the plugin (`@media (pointer: coarse)`) |
| `@4xl:` / `@max-4xl:` container variants (KpiStrip) | `@tailwindcss/container-queries` (names differ: `@4xl` exists, `@max-4xl` as `@max-4xl`) |
| `size-4`, `min-h-10.5`, `ps-6.5`, `pe-1.25`, `right-15` | `size-4` exists in 3.4; `10.5 / 6.5 / 1.25 / 15` added in config `spacing` |
| `text-body`, `text-h4`… (registered via `@theme`) | `fontSize` entries in config (done) |
| `animate-in fade-in-0 zoom-in-95 …` | inert in Pedant; omit, or install `tailwindcss-animate` |
| `data-[state=open]:` / `aria-[current]:` / `group-data-[…]` | unchanged (v3.2+) |

### J5. Component map — where Pedant uses a kit and you don't

| Pedant (shadcn/Radix + lucide) | In your app |
| --- | --- |
| `Button`, `Input`, `Card`, `StatusChip`, `Banner`, `Switch`, `UnderlineTabs` | `components-v3/*.tsx` — plain React + Tailwind 3 + `react-icons/fi` |
| `Dialog` / `Sheet` / `Select` / `DropdownMenu` / `Popover` / `Tooltip` | keep Radix (works on React 18) and reuse the surface classes in §F; or any headless dialog |
| `Toaster` (sonner) | `sonner` with the `toastOptions.classNames` from `ui/sonner.tsx` (surface classes in §F) |
| `DataTable` (TanStack) | `@tanstack/react-table` 8 + the row/header classes in §F; density 36/44/56 |
| `Drawer` (vaul) | `vaul` 1.x, or a fixed side panel with the same surface/spacing |
| `Calendar` | `react-day-picker` (v8 on React 18 if v10 complains — unverified) |
| `ChartPanel` etc. | `recharts` 2.x/3.x with `--chart-1…6` |
| `Spinner` | `<FiLoader className="animate-spin" />` or the bordered-ring spinner (§F) |

**Icon map lucide-react → react-icons/fi (Feather)** — Feather is outline, 24px viewBox, stroke 2: the same visual family.
Exact matches: Check→`FiCheck`, X→`FiX`, Plus→`FiPlus`, Minus→`FiMinus`, Trash2→`FiTrash2`, Search→`FiSearch`, Clock→`FiClock`, Copy→`FiCopy`, Download→`FiDownload`, Upload→`FiUpload`, Eye→`FiEye`, EyeOff→`FiEyeOff`, Lock→`FiLock`, Mail→`FiMail`, Users→`FiUsers`, Truck→`FiTruck`, Inbox→`FiInbox`, Layers→`FiLayers`, Info→`FiInfo`, Ban→`FiSlash`, RefreshCw→`FiRefreshCw`, RotateCcw→`FiRotateCcw`, ChevronRight/Down/Left→`FiChevronRight/Down/Left`, ArrowRight→`FiArrowRight`, ArrowUpRight→`FiArrowUpRight`, ArrowLeftRight→`FiRepeat`, Loader2→`FiLoader`, Pencil/PenLine→`FiEdit2`/`FiEdit3`, TriangleAlert/AlertTriangle→`FiAlertTriangle`, CircleAlert→`FiAlertCircle`, CircleCheck→`FiCheckCircle`, Shield/ShieldAlert→`FiShield`, UserRound→`FiUser`, Building2→`FiHome`, FileUp→`FiFilePlus`, Hourglass→`FiClock`, History→`FiClock`, Undo2→`FiCornerUpLeft`, SearchX→`FiSearch`, MoreHorizontal→`FiMoreHorizontal`, Menu→`FiMenu`, ArrowLeft→`FiArrowLeft`. (Fi names verified from memory of the react-icons Feather set, not by importing them — check each exists in your installed `react-icons/fi`.)
Use the same sizing: `<FiPlus className="size-4" />` in buttons (the `[&_svg]:size-4` rule does it), `size-3` in chips, 14px (`size-3.5`) in `xs` controls; Feather's default stroke width is 2 (matches lucide).

---

## Screenshot gallery

All at a 1440 px wide viewport. **R** = real components rendered from `src/` (Design Lab sections in a temporary harness, since deleted; tokens/themes exactly as shipped);
**D** = design record prototype (mock data; see the note at the top). Placeholder/fake data only — names such as Northwind Logistics are the repo's demo content.


### Light mode

![Foundations: palette, radius and elevation reference](screenshots/light/01-foundations.png)  
_01-foundations [R] — Foundations: palette, radius and elevation reference_

![Layout primitives: AppPage band, DetailLayout, SectionCard, NavRail](screenshots/light/02-layout.png)  
_02-layout [R] — Layout primitives: AppPage band, DetailLayout, SectionCard, NavRail_

![Controls: buttons, inputs, chips, tabs, switch, checkbox, code input](screenshots/light/03-controls.png)  
_03-controls [R] — Controls: buttons, inputs, chips, tabs, switch, checkbox, code input_

![Form block](screenshots/light/04-form.png)  
_04-form [R] — Form block_

![Raw table states](screenshots/light/05-raw-table.png)  
_05-raw-table [R] — Raw table states_

![DataTable with toolbar, selection, attention rows, pagination, infinite list](screenshots/light/06-data-table.png)  
_06-data-table [R] — DataTable with toolbar, selection, attention rows, pagination, infinite list_

![Overlays: dialogs, drawers, menu, tooltip](screenshots/light/07-overlays.png)  
_07-overlays [R] — Overlays: dialogs, drawers, menu, tooltip_

![Feedback: toasts, banners, alerts, empty/state cards, loading](screenshots/light/08-feedback.png)  
_08-feedback [R] — Feedback: toasts, banners, alerts, empty/state cards, loading_

![Charts](screenshots/light/09-charts.png)  
_09-charts [R] — Charts_

![KPI cards and strip](screenshots/light/10-kpi.png)  
_10-kpi [R] — KPI cards and strip_

![Open destructive dialog](screenshots/light/11-modal-destructive-dialog.png)  
_11-modal-destructive-dialog [R] — Open destructive dialog_

![Open drawer (harness shows it as a bottom sheet)](screenshots/light/12-drawer-open.png)  
_12-drawer-open [R] — Open drawer (harness shows it as a bottom sheet)_

![Open dropdown menu](screenshots/light/13-dropdown-menu-open.png)  
_13-dropdown-menu-open [R] — Open dropdown menu_

![Success toast](screenshots/light/14-toast-success.png)  
_14-toast-success [R] — Success toast_

![Open select dropdown](screenshots/light/15-select-open.png)  
_15-select-open [R] — Open select dropdown_

![Table loading state](screenshots/light/16-table-loading.png)  
_16-table-loading [R] — Table loading state_

![Table empty state](screenshots/light/17-table-empty.png)  
_17-table-empty [R] — Table empty state_

![Table error state](screenshots/light/18-table-error.png)  
_18-table-error [R] — Table error state_

![Table permission-denied state](screenshots/light/19-table-denied.png)  
_19-table-denied [R] — Table permission-denied state_

![Table row hover](screenshots/light/20-table-row-hover.png)  
_20-table-row-hover [R] — Table row hover_

![Two-step sign-in (code entry)](screenshots/light/21-mfa-challenge.png)  
_21-mfa-challenge [D] — Two-step sign-in (code entry)_

![Organisation picker](screenshots/light/22-organisation-picker.png)  
_22-organisation-picker [D] — Organisation picker_

![App shell: sidebar, top bar, tab strip, loading skeleton, toasts](screenshots/light/23-app-shell-home.png)  
_23-app-shell-home [D] — App shell: sidebar, top bar, tab strip, loading skeleton, toasts_

![Dashboard: hero KPI card, chart, work queue](screenshots/light/24-app-shell-dashboard.png)  
_24-app-shell-dashboard [D] — Dashboard: hero KPI card, chart, work queue_

![People list: page band, tabs, filter toolbar, table](screenshots/light/26-people-list-table.png)  
_26-people-list-table [D] — People list: page band, tabs, filter toolbar, table_

![Settings: profile form cards](screenshots/light/27-settings-profile.png)  
_27-settings-profile [D] — Settings: profile form cards_

![Rules catalogue](screenshots/light/28-rules-catalogue.png)  
_28-rules-catalogue [D] — Rules catalogue_

![Activity log table](screenshots/light/29-activity-log.png)  
_29-activity-log [D] — Activity log table_

![CSV import wizard](screenshots/light/30-import-wizard.png)  
_30-import-wizard [D] — CSV import wizard_

![404 / system page](screenshots/light/31-system-404.png)  
_31-system-404 [D] — 404 / system page_

![Onboarding invite](screenshots/light/32-onboarding-invite.png)  
_32-onboarding-invite [D] — Onboarding invite_

![Auth sign-in](screenshots/light/33-auth-sign-in.png)  
_33-auth-sign-in [D] — Auth sign-in_


### Dark mode

_Dark captures exist only where the prototype's theme switch worked (shell, dashboard, people list, activity log) plus all real-component shots; the other design-record screens are light only._

![Foundations: palette, radius and elevation reference](screenshots/dark/01-foundations.png)  
_01-foundations [R] — Foundations: palette, radius and elevation reference_

![Layout primitives: AppPage band, DetailLayout, SectionCard, NavRail](screenshots/dark/02-layout.png)  
_02-layout [R] — Layout primitives: AppPage band, DetailLayout, SectionCard, NavRail_

![Controls: buttons, inputs, chips, tabs, switch, checkbox, code input](screenshots/dark/03-controls.png)  
_03-controls [R] — Controls: buttons, inputs, chips, tabs, switch, checkbox, code input_

![Form block](screenshots/dark/04-form.png)  
_04-form [R] — Form block_

![Raw table states](screenshots/dark/05-raw-table.png)  
_05-raw-table [R] — Raw table states_

![DataTable with toolbar, selection, attention rows, pagination, infinite list](screenshots/dark/06-data-table.png)  
_06-data-table [R] — DataTable with toolbar, selection, attention rows, pagination, infinite list_

![Overlays: dialogs, drawers, menu, tooltip](screenshots/dark/07-overlays.png)  
_07-overlays [R] — Overlays: dialogs, drawers, menu, tooltip_

![Feedback: toasts, banners, alerts, empty/state cards, loading](screenshots/dark/08-feedback.png)  
_08-feedback [R] — Feedback: toasts, banners, alerts, empty/state cards, loading_

![Charts](screenshots/dark/09-charts.png)  
_09-charts [R] — Charts_

![KPI cards and strip](screenshots/dark/10-kpi.png)  
_10-kpi [R] — KPI cards and strip_

![Open destructive dialog](screenshots/dark/11-modal-destructive-dialog.png)  
_11-modal-destructive-dialog [R] — Open destructive dialog_

![Open drawer (harness shows it as a bottom sheet)](screenshots/dark/12-drawer-open.png)  
_12-drawer-open [R] — Open drawer (harness shows it as a bottom sheet)_

![Open dropdown menu](screenshots/dark/13-dropdown-menu-open.png)  
_13-dropdown-menu-open [R] — Open dropdown menu_

![Success toast](screenshots/dark/14-toast-success.png)  
_14-toast-success [R] — Success toast_

![Open select dropdown](screenshots/dark/15-select-open.png)  
_15-select-open [R] — Open select dropdown_

![Table loading state](screenshots/dark/16-table-loading.png)  
_16-table-loading [R] — Table loading state_

![Table empty state](screenshots/dark/17-table-empty.png)  
_17-table-empty [R] — Table empty state_

![Table error state](screenshots/dark/18-table-error.png)  
_18-table-error [R] — Table error state_

![Table permission-denied state](screenshots/dark/19-table-denied.png)  
_19-table-denied [R] — Table permission-denied state_

![Table row hover](screenshots/dark/20-table-row-hover.png)  
_20-table-row-hover [R] — Table row hover_

![App shell: sidebar, top bar, tab strip, loading skeleton, toasts](screenshots/dark/23-app-shell-home.png)  
_23-app-shell-home [D] — App shell: sidebar, top bar, tab strip, loading skeleton, toasts_

![Dashboard: hero KPI card, chart, work queue](screenshots/dark/24-app-shell-dashboard.png)  
_24-app-shell-dashboard [D] — Dashboard: hero KPI card, chart, work queue_

![People list: page band, tabs, filter toolbar, table](screenshots/dark/26-people-list-table.png)  
_26-people-list-table [D] — People list: page band, tabs, filter toolbar, table_

![Activity log table](screenshots/dark/29-activity-log.png)  
_29-activity-log [D] — Activity log table_


### Component close-ups (light, real components)

![charts-01-barchart-emphasisindex-tooltip-lines-tab](screenshots/components/charts-01-barchart-emphasisindex-tooltip-lines-tab.png)  
_charts-01-barchart-emphasisindex-tooltip-lines-tab_

![charts-02-charttable-sortable-columns-totals-row-c](screenshots/components/charts-02-charttable-sortable-columns-totals-row-c.png)  
_charts-02-charttable-sortable-columns-totals-row-c_

![charts-03-linechart-outlined-series-dashed-caption](screenshots/components/charts-03-linechart-outlined-series-dashed-caption.png)  
_charts-03-linechart-outlined-series-dashed-caption_

![charts-04-areachart-soft-fill-two-series](screenshots/components/charts-04-areachart-soft-fill-two-series.png)  
_charts-04-areachart-soft-fill-two-series_

![charts-05-stackedbarchart-stacked-values](screenshots/components/charts-05-stackedbarchart-stacked-values.png)  
_charts-05-stackedbarchart-stacked-values_

![charts-06-stackedbarchart-normalise-100](screenshots/components/charts-06-stackedbarchart-normalise-100.png)  
_charts-06-stackedbarchart-normalise-100_

![charts-07-groupedbarchart-side-by-side-bars](screenshots/components/charts-07-groupedbarchart-side-by-side-bars.png)  
_charts-07-groupedbarchart-side-by-side-bars_

![charts-08-horizontalbarchart-ranking](screenshots/components/charts-08-horizontalbarchart-ranking.png)  
_charts-08-horizontalbarchart-ranking_

![charts-09-donutchart-square-legend-one-outlined-sl](screenshots/components/charts-09-donutchart-square-legend-one-outlined-sl.png)  
_charts-09-donutchart-square-legend-one-outlined-sl_

![charts-10-chartpanel-error-loading-empty](screenshots/components/charts-10-chartpanel-error-loading-empty.png)  
_charts-10-chartpanel-error-loading-empty_

![charts-11-chartpanel-charttypeswitch-type-persiste](screenshots/components/charts-11-chartpanel-charttypeswitch-type-persiste.png)  
_charts-11-chartpanel-charttypeswitch-type-persiste_

![charts-12-past-six-series-dashed-then-dotted-drawn](screenshots/components/charts-12-past-six-series-dashed-then-dotted-drawn.png)  
_charts-12-past-six-series-dashed-then-dotted-drawn_

![charts-13-heatgrid-reason-by-age-five-wash-steps-v](screenshots/components/charts-13-heatgrid-reason-by-age-five-wash-steps-v.png)  
_charts-13-heatgrid-reason-by-age-five-wash-steps-v_

![charts-14-rankladder-the-rung-above-you-the-gap-ba](screenshots/components/charts-14-rankladder-the-rung-above-you-the-gap-ba.png)  
_charts-14-rankladder-the-rung-above-you-the-gap-ba_

![controls-01-button](screenshots/components/controls-01-button.png)  
_controls-01-button_

![controls-02-the-44px-row](screenshots/components/controls-02-the-44px-row.png)  
_controls-02-the-44px-row_

![controls-03-the-44px-in-shell-row](screenshots/components/controls-03-the-44px-in-shell-row.png)  
_controls-03-the-44px-in-shell-row_

![controls-04-status-chips-and-badges](screenshots/components/controls-04-status-chips-and-badges.png)  
_controls-04-status-chips-and-badges_

![controls-05-icon-chips](screenshots/components/controls-05-icon-chips.png)  
_controls-05-icon-chips_

![controls-06-underline-tabs](screenshots/components/controls-06-underline-tabs.png)  
_controls-06-underline-tabs_

![controls-07-file-drop-zone](screenshots/components/controls-07-file-drop-zone.png)  
_controls-07-file-drop-zone_

![controls-08-choice-buttons](screenshots/components/controls-08-choice-buttons.png)  
_controls-08-choice-buttons_

![controls-09-inline-option-list](screenshots/components/controls-09-inline-option-list.png)  
_controls-09-inline-option-list_

![controls-10-segmented-control-switch-checkbox](screenshots/components/controls-10-segmented-control-switch-checkbox.png)  
_controls-10-segmented-control-switch-checkbox_

![controls-11-one-time-code-input](screenshots/components/controls-11-one-time-code-input.png)  
_controls-11-one-time-code-input_

![feedback-01-toasts](screenshots/components/feedback-01-toasts.png)  
_feedback-01-toasts_

![feedback-02-banner](screenshots/components/feedback-02-banner.png)  
_feedback-02-banner_

![feedback-03-emptystate-sizes](screenshots/components/feedback-03-emptystate-sizes.png)  
_feedback-03-emptystate-sizes_

![feedback-04-alerts](screenshots/components/feedback-04-alerts.png)  
_feedback-04-alerts_

![feedback-05-tinted-note](screenshots/components/feedback-05-tinted-note.png)  
_feedback-05-tinted-note_

![feedback-06-state-card](screenshots/components/feedback-06-state-card.png)  
_feedback-06-state-card_

![feedback-07-loading-and-denied](screenshots/components/feedback-07-loading-and-denied.png)  
_feedback-07-loading-and-denied_

![form-01-block](screenshots/components/form-01-block.png)  
_form-01-block_

![kpi-01-kpicard-variant-hero-kpistrip-surface-ba](screenshots/components/kpi-01-kpicard-variant-hero-kpistrip-surface-ba.png)  
_kpi-01-kpicard-variant-hero-kpistrip-surface-ba_

![kpi-02-kpicard-dashboard-figure-and-note](screenshots/components/kpi-02-kpicard-dashboard-figure-and-note.png)  
_kpi-02-kpicard-dashboard-figure-and-note_

![kpi-03-kpicard-severity-accent-colour-never-alo](screenshots/components/kpi-03-kpicard-severity-accent-colour-never-alo.png)  
_kpi-03-kpicard-severity-accent-colour-never-alo_

![kpi-04-kpicard-one-line-per-currency](screenshots/components/kpi-04-kpicard-one-line-per-currency.png)  
_kpi-04-kpicard-one-line-per-currency_

![kpi-05-kpicard-delta-up-down-flat-and-a-rise-th](screenshots/components/kpi-05-kpicard-delta-up-down-flat-and-a-rise-th.png)  
_kpi-05-kpicard-delta-up-down-flat-and-a-rise-th_

![kpi-06-kpicard-drill-the-whole-card-is-a-button](screenshots/components/kpi-06-kpicard-drill-the-whole-card-is-a-button.png)  
_kpi-06-kpicard-drill-the-whole-card-is-a-button_

![kpi-07-kpicard-loading-error-dimmed](screenshots/components/kpi-07-kpicard-loading-error-dimmed.png)  
_kpi-07-kpicard-loading-error-dimmed_

![kpi-08-kpistrip-kpicard-variant-strip-one-56px-](screenshots/components/kpi-08-kpistrip-kpicard-variant-strip-one-56px-.png)  
_kpi-08-kpistrip-kpicard-variant-strip-one-56px-_

![kpi-09-kpicard-glimpse-and-weekly-variants](screenshots/components/kpi-09-kpicard-glimpse-and-weekly-variants.png)  
_kpi-09-kpicard-glimpse-and-weekly-variants_

![layout-01-apppage](screenshots/components/layout-01-apppage.png)  
_layout-01-apppage_

![layout-02-detaillayout](screenshots/components/layout-02-detaillayout.png)  
_layout-02-detaillayout_

![layout-03-statusbadge](screenshots/components/layout-03-statusbadge.png)  
_layout-03-statusbadge_

![layout-04-sectionheading](screenshots/components/layout-04-sectionheading.png)  
_layout-04-sectionheading_

![layout-05-descriptionlist-recordlink](screenshots/components/layout-05-descriptionlist-recordlink.png)  
_layout-05-descriptionlist-recordlink_

![layout-06-externallink](screenshots/components/layout-06-externallink.png)  
_layout-06-externallink_

![layout-07-sectioncard](screenshots/components/layout-07-sectioncard.png)  
_layout-07-sectioncard_

![layout-08-navrail](screenshots/components/layout-08-navrail.png)  
_layout-08-navrail_

![overlays-01-confirm-dialog](screenshots/components/overlays-01-confirm-dialog.png)  
_overlays-01-confirm-dialog_

![overlays-02-dialog-ladder](screenshots/components/overlays-02-dialog-ladder.png)  
_overlays-02-dialog-ladder_

![overlays-03-dialogs](screenshots/components/overlays-03-dialogs.png)  
_overlays-03-dialogs_

![overlays-04-drawer-anatomy](screenshots/components/overlays-04-drawer-anatomy.png)  
_overlays-04-drawer-anatomy_

![overlays-05-drawer](screenshots/components/overlays-05-drawer.png)  
_overlays-05-drawer_

![overlays-06-menu-and-tooltip](screenshots/components/overlays-06-menu-and-tooltip.png)  
_overlays-06-menu-and-tooltip_

![table-01-block](screenshots/components/table-01-block.png)  
_table-01-block_



---

## What is in this folder

```
design-handoff/
├── DESIGN_HANDOFF.md        ← this file
├── tokens/
│   ├── colors.json          ← 78 colour/composite tokens, light + dark (OKLCH authoritative, hex computed)
│   ├── tailwind.config.js   ← Tailwind 3.4 theme (translated; untested in a v3 project)
│   ├── globals.css          ← Tailwind 3 CSS: variables, base, keyframes (token blocks verbatim)
│   ├── globals.v4.source.css, tailwind.config.v4.source.ts   ← the originals, for diffing
├── components/              ← copied-as-is sources (Tailwind 4 / Radix / lucide) — read for exact classes
├── components-v3/           ← Tailwind 3 + react-icons ports of the key components
└── screenshots/{light,dark,components}/
```
