# Tables

Tables are most of this app: receipts, products, inventory, customers, vendors, ledgers,
returns, expenses, the Money Book. Today there are **18 files with a hand-built `<table>`**,
each with its own header style, paging and empty text.

Reference: `reference/light/06-data-table.png`, `05-raw-table.png`, `16…20-table-*.png`,
`26-people-list-table.png`, `29-activity-log.png`, `components/table-01-block.png`, and the
same in `reference/dark/`.

## What a table looks like

- **One card** holds the toolbar, the table and the footer.
- **Toolbar** — one 36px row: search on the left → filter selects → (selection actions) → on the
  right: export, columns, density.
- **Header** — `text-th`: 10px JetBrains Mono, uppercase, muted, 36px tall, a painted line under it.
  Sort arrows and column menus appear on hover.
- **Rows** — 44px (36 compact / 56 comfortable), faint painted line between rows, inset 12px
  from the card edge. **No zebra, no vertical lines.**
- **Hover** — a 6% wash behind the row, not a colour change.
- **Selected row** — `surface-tint` fill + 3px accent bar on the left.
- **Attention row** — `warning-chip` fill + 3px warning bar (e.g. a receipt with returns, a product
  below its stock alert, a cheque past its date).
- **Cells** — text `text-body`; bill numbers, barcodes and codes in mono; money right-aligned,
  `tabular-nums`, with currency; status as `StatusChip`; missing value = muted `—`;
  long text truncates with a tooltip.
- **Row actions** — one `⋯` menu at the end (View, Print, Cancel…), with the most common action
  also available by clicking the row. Destructive items last in the menu, red.
- **Footer** — "Rows per page [25] · 1–25 of 159" on the left, first/prev/next/last 32px outline
  buttons on the right.
- **Six states from the same component:** rows · loading (skeleton rows) · empty (no data yet) ·
  no results (filters hide everything, with "Clear filters") · error (message + Retry) ·
  no permission.

## Library decision: TanStack Table, not MRT

You mentioned MRT (Material React Table). The reference app does **not** use MRT — it uses
**TanStack Table** (`@tanstack/react-table` v8) with its own Tailwind styling. Recommendation:
do the same.

| | TanStack Table (recommended) | MRT (material-react-table) |
| --- | --- | --- |
| What it is | headless logic: sorting, filtering, paging, selection, column order/visibility, pinning | a finished table built on **Material UI** |
| Look | 100% ours (the tokens above) | Material Design — would fight the new look and need heavy overrides |
| Extra packages | 1 (`@tanstack/react-table`, ~15 kB gzip) | MUI + Emotion + MUI icons + MRT (hundreds of kB) |
| Works with React 18 / Tailwind 3 | yes | yes, but brings a second styling system |
| Matches the reference | exactly | no |

Optional later: `@tanstack/react-virtual` for very long lists (Money Book "All", big product
lists) — only if a list is slow.

## Server or client paging

- Lists the backend already pages (`page`/`limit` — receipts, Money Book entries, customer
  statement, supplies) use **server mode**: the table sends page, sort and search to the API.
- Small lists (vendors, employees, accounts) use **client mode**.
- If a list we want to sort or search on the server doesn't support it yet, Stage 6 writes a
  backend prompt (`backend-prompts/stage-06-table-params.md`) listing exactly which endpoint
  needs which `sort` / `search` / `filter` parameter. No backend change is assumed up front.

## Per-user table settings (Stage 6, optional)

Column visibility, order and density are remembered per device (`localStorage`) first. If you
want them to follow the user to another computer, that needs a small backend store — decided in Stage 6.
