# Foundations — colours, type, shape, motion

Source of truth for values: `reference/DESIGN_HANDOFF.md` §C–§H and
`reference/source/tokens/` (`globals.css`, `colors.json`, `tailwind.config.js`).
Reference pictures: `reference/light/01-foundations.png`, `reference/dark/01-foundations.png`.

Our stack matches what the handoff's §J targets: Electron 28 (Chromium 120), React 18,
**Tailwind 3.4.19** (installed), `react-icons` 4.12 (`fi` set). Chromium 120 supports
`oklch()` and `color-mix()`, so the token values can be used as-is.

---

## 1. Colour tokens

Every colour is a CSS variable on `:root` (light) and `.dark` (dark). Tailwind classes point at
the variables, so switching theme or accent never touches component code.

| Token → class | Role | Light | Dark |
| --- | --- | --- | --- |
| `background` | page | `#f3f8fd` | `#111418` |
| `foreground` | main text | `#19242e` | `#e8f2fa` |
| `card` | cards, panels | `#fbfdff` | `#1b1f23` |
| `popover` | menus, dialogs, toasts | `#fcfeff` | `#23282c` |
| `muted` | header wash, disabled, neutral chip | `#e3eef7` | `#272d33` |
| `muted-foreground` | secondary text | `#5f6871` | `#8e98a1` |
| `placeholder` | input placeholder | `#7e8890` | `#6f7981` |
| `border` | **control** edges (inputs, outline buttons) | `#848d95` | `#646d75` |
| `hairline` | **card** edges (border at 50% / 70%) | `#848d9580` | `#646d75b3` |
| `input` | input border (stronger) | `#6a747e` | `#808b94` |
| `primary` / `ring` | accent: main button, links, focus | `#0f77b2` | `#4aaef1` |
| `primary-foreground` | text on primary | `#f6fbff` | `#061824` |
| `secondary` | secondary button fill | `#dae8f6` | `#2f363d` |
| `accent` / `accent-foreground` | soft accent tint (current nav row, active count) | `#d3f1ff` / `#176da1` | `#1e3546` / `#56a3db` |
| `surface-tint` | page header band, selected row | `#eaf2fa` | `#212c35` |
| `destructive` · `-chip` · `-chip-foreground` | danger solid / tint / tint text | `#b74c44` · `#ffe0d9` · `#a44b43` | `#e2867c` · `#47231f` · `#d87a70` |
| `warning` · `-chip` · `-chip-foreground` | | `#a56000` · `#ffe7c6` · `#955b01` | `#d19552` · `#41290d` · `#c78a43` |
| `success` · `-chip` · `-chip-foreground` | | `#13823d` · `#d4f8da` · `#277940` | `#6bb77c` · `#183720` · `#59a86c` |
| `info` · `-chip` · `-chip-foreground` | | `#3072c1` · `#d5efff` · `#366bad` | `#71a6ea` · `#1b304b` · `#6299de` |
| `sidebar` · `-foreground` · `-primary` · `-accent` | sidebar column | `#0b1d2f` · `#eaf1f8` · `#2886c2` · `#153349` | `#0a0f13` · `#eaf1f8` · `#4aaef1` · `#12334a` |
| `--hover-overlay` / `--press-overlay` | hover / press wash | foreground 6% / 11% | foreground 9% / 15% |
| `--overlay` | dialog scrim | `rgb(8 12 14 / 0.42)` | same |
| `chart-1 … chart-6` | chart series | blue, violet, rose, amber, green, cyan (OKLCH in handoff §C) | lighter versions |

Hex values are for reading; the CSS uses the exact OKLCH strings from
`reference/source/tokens/globals.css`.

**Usage rules:** text `foreground` on `background`/`card`; secondary text `muted-foreground`;
card edge `hairline` (never full `border`); status = chip pair (`bg-success-chip text-success-chip-foreground`);
`surface-tint` marks a band or a selected state, never an ordinary card.

## 2. Shop accent colour (our addition)

The reference has one locked blue. We let each shop pick an accent (Stage 2). Only the
**accent group** changes: `primary`, `primary-foreground`, `ring`, `accent`, `accent-foreground`,
`surface-tint`, `sidebar-primary`, `sidebar-accent`, `chart-1`. Neutrals and status colours never
change, so warnings stay amber and errors stay red whatever the shop picks.

Each preset is the reference formula with a different OKLCH hue `H`:

| Group token | Light | Dark |
| --- | --- | --- |
| `primary`, `ring` | `oklch(0.545 0.125 H)` | `oklch(0.72 0.135 H)` |
| `primary-foreground` | `oklch(0.985 0.008 H)` | `oklch(0.2 0.035 H)` |
| `accent` | `oklch(0.945 0.045 H)` | `oklch(0.318 0.0425 H)` |
| `accent-foreground` | `oklch(0.513 0.1125 H)` | `oklch(0.6897 0.1125 H)` |
| `sidebar-primary` | `oklch(0.595 0.125 H)` | `oklch(0.72 0.135 H)` |
| `sidebar-accent` | `oklch(0.31 0.0525 H)` | `oklch(0.31 0.0567 H)` |

| Preset | Hue `H` | Note |
| --- | --- | --- |
| **Steel blue** (default) | 242 | the reference colour |
| Teal | 195 | |
| Green | 155 | sits close to `success`; status chips still carry a word + icon |
| Violet | 295 | |
| Gold | 75 | closest to today's brand colour; contrast checked in Stage 2 (may need lower L) |
| Rose | 12 | sits close to `destructive`; same caveat as green |

Measured in Stage 2 (button text on the accent, accent links on card and page, accent chips; all
≥ 4.5:1 in both themes after these adjustments): **Teal** light `primary` L 0.515 and
`accent-foreground` L 0.49; **Green** light `primary` L 0.525 and `accent-foreground` L 0.49;
**Violet** and **Rose** dark `accent-foreground` L 0.70. The values live in `src/index.css`
(`html[data-accent=…]` blocks).

Also selectable (Stage 2): **sidebar style** `navy` (reference default) or `light`
(card-coloured sidebar), **density** `compact` / `default` / `comfortable` (table rows 36 / 44 / 56).

## 3. Typography

Fonts are **bundled** with `@fontsource` (works offline) — Inter (400/500/600),
Inter Tight (600) for headings and big numbers, JetBrains Mono (400/500) for labels and codes.

Replaces today's four web fonts: Outfit (body) → Inter · Playfair Display (`.font-display`,
prices) → Inter Tight + `tabular-nums` · Bebas Neue (dashboard titles) → Inter Tight · DM Mono → JetBrains Mono.

| Class | Size / line | Tracking · weight | Face | Use |
| --- | --- | --- | --- | --- |
| `text-micro` | 10 / 13 | | Inter | tiny helper |
| `text-caption` | 11.5 / 17 | | Inter | card descriptions, chip text, counts |
| `text-body-sm` | 12.5 / 18 | | Inter | dense table text, alert body |
| `text-body` | 13 / 19 | | Inter | **default text**, tabs, table cells |
| `text-body-lg` | 14 / 21 | | Inter | **buttons, inputs, selects** |
| `text-lead` | 15 / 22 | | Inter | lead paragraph |
| `text-label` | 11 / 16 | 1px · 600 | Inter | uppercase label |
| `text-h5` | 15 / 20 | −0.2px · 600 | Inter Tight | section heading in a card |
| `text-h4` | 16 / 21 | −0.3px · 600 | Inter Tight | **card title** |
| `text-h3` | 17 / 22 | −0.3px · 600 | Inter Tight | |
| `text-h2` | 24 / 30 | −0.7px · 600 | Inter Tight | **page title**, KPI figure |
| `text-h1` | 30 / 36 | −0.8px · 600 | Inter Tight | checkout total |
| `text-overline` (`-md/-lg/-xl`) | 9.5–11 | 1–1.4px | JetBrains Mono | eyebrows, KPI labels, sidebar groups (`uppercase`) |
| `text-th` | 10 / 14 | 0.5px | JetBrains Mono | **table header** (`uppercase text-muted-foreground`) |
| `text-mono-xs/sm/mono` | 11 · 12.5 · 13.5 | | JetBrains Mono | bill #, barcodes, SKUs |

Rules: `tabular-nums` on every number; at most 2 weights in one card; headings always with
`font-heading`. Tailwind's own `text-xs/sm/base/lg` stay available while old screens are migrated,
but new code uses the roles.

## 4. Corners, borders, shadows

We **keep Tailwind's corner names** (no clash with ~1,000 existing uses) — they already line up:

| Reference | px | Our class | Used on |
| --- | --- | --- | --- |
| `rounded-2xs` | 4 | `rounded` | checkbox, tag chips |
| `rounded-xs` | 10 | `rounded-[10px]` → token `rounded-row` (new) | rows, small chips, icon tiles |
| `rounded-sm` | 12 | `rounded-xl` | **buttons, inputs, selects** |
| `rounded-md` | 14 | `rounded-pop` (new, 14px) | **menus, dialogs, alerts, tooltips** |
| `rounded-lg` | 16 | `rounded-2xl` | **cards, panels, page band** |
| `rounded-full` | 999 | `rounded-full` | pills, switches, avatars |

Borders are 1px. Controls `border-input`/`border-border`; cards `border-hairline`.
Table lines are painted, not borders (see `04-tables.md`).

| Shadow | Light | Dark | Use |
| --- | --- | --- | --- |
| `shadow-1` | `0 1px 2px rgb(15 23 42/.06), 0 4px 12px rgb(15 23 42/.06)` | `0 1px 2px rgb(0 0 0/.45)` | cards |
| `shadow-2` | `0 12px 32px rgb(15 23 42/.12)` | `0 10px 30px rgb(0 0 0/.55)` | floating: menus, dialogs, drawers, toasts |
| `shadow-knob` | `0 1px 2px rgb(0 0 0/.2)` | same | switch knob |

No shadows on buttons. Today's `shadow-lg/xl/2xl` and gold glows go.

## 5. Spacing and layout numbers

| Thing | Value |
| --- | --- |
| Page padding | 22px sides, 20px top/bottom (16px on narrow windows) |
| Card padding | 16px (`p-4`), section cards 20px (`p-5`) |
| Sidebar | 260px expanded · 64px icon rail |
| Top bar | 56px, `bg-card border-b` |
| Dialog widths | 400 / 480 / 640 / 880 |
| Drawer widths | 480 / 600 / 700–880 |
| Control heights | 36 · 32 · 28 · 40 · 44 |
| Table rows / header | 36/32 · **44/36** · 56/40 (compact · default · comfortable) |

## 6. Motion

Quiet: colour and elevation only. Interactive elements transition background/colour/border/
filter at `.15s ease`, press `transform .12s`. Spinner `.7s linear`, skeleton pulse `1.1s`,
toast in `.18s`, page enter `.26s` (opacity + 6px rise). `prefers-reduced-motion` turns it all off.
Keyframes verbatim: `reference/source/tokens/globals.css`.

---

## 7. How today's classes map to the new look (Stage 1 "re-map")

The app has **4,319 colour classes, 3,588 `dark:*-d-*` classes and 304 `text-[Npx]` sizes** across
~45 files. Rewriting them all at once would be risky, so Stage 1 **re-points the old names** at the
new tokens. Most of the app changes colour on day one without touching screen code; later
stages then replace old classes with the new components screen by screen.

| Today (count) | Where it comes from | Stage 1 re-map |
| --- | --- | --- |
| `slate-*` (3,032) | Tailwind default greys, light theme | re-defined as a cool neutral ramp on the new tokens (50 ≈ `background`, 100 ≈ `muted`, 400 ≈ `border`, 500 ≈ `muted-foreground`, 900 ≈ `foreground`) |
| `dark:*-d-*` (3,588) | CSS variables `--d-bg`, `--d-card`, `--d-accent` … in `index.css` | the variables are re-pointed: `--d-bg`→`background`, `--d-card`→`card`, `--d-elevated`→`popover`, `--d-border`→`hairline`, `--d-accent`→`primary`, `--d-text/heading`→`foreground`, `--d-muted`→`muted-foreground`, `--d-faint`→`placeholder`, `--d-green/blue/red`→`success/info/destructive` |
| `primary-*` (229) | custom indigo scale in `tailwind.config.mjs` | re-defined as an accent ramp built with `color-mix()` from `--primary`, so it follows the shop's accent |
| `amber-*` (318) | today's **brand** gold, but also used for some warnings | audited in Stage 1: brand uses → accent; warning uses → `warning` tokens |
| `emerald/green/red/blue` (~590) | status colours | left as-is in Stage 1; replaced by chip tokens when each screen is migrated |
| `font-display` (40), Outfit body | fonts | `.font-display` → Inter Tight + `tabular-nums`; body → Inter |
| `text-[Npx]` (304) | ad-hoc sizes | left as-is; replaced by roles per screen |
| `rounded-*`, `shadow-*` | Tailwind defaults | corners already match; `shadow-lg/xl/2xl` re-defined to `shadow-2`; glows removed |
