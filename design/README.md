# Design overhaul — POS Desktop

We are moving the whole app to a new look, taken from the reference app in
`reference/` (a web app called "Pedant"). We copy its **look and design rules**, not
its screens: it is a freight app, we are a POS.

The new look in five words: **calm · dense · soft-rounded · hairline · cool-blue**
(the blue is the default; each shop can pick its own accent colour — Stage 2).

## How to read this folder

| File | What it is |
| --- | --- |
| [`ROADMAP.md`](ROADMAP.md) | **Start here.** The 10 stages, each split into small steps, with "done when" checks and which stages need the backend. |
| [`01-design-sense.md`](01-design-sense.md) | The design rules in plain words, adapted to a POS (what to do, what never to do). |
| [`02-foundations.md`](02-foundations.md) | Colours (light + dark), shop accent colours, fonts, sizes, corners, shadows, motion — and how today's classes map to the new ones. |
| [`03-components.md`](03-components.md) | The component kit we will build (`src/components/ui/`), each with its reference screenshot and the old code it replaces. |
| [`04-tables.md`](04-tables.md) | The table design and the table library decision (TanStack Table vs MRT). |
| [`05-screens.md`](05-screens.md) | Every screen in the app: size, tables, modals, which stage changes it. |
| [`06-charts.md`](06-charts.md) | How every chart looks, the charts we have today, and the **drill-down windows** that open when you click a dashboard tile (Sales, Profit, Orders, Money, Costs). |
| `backend-prompts/` | Prompts to send to the backend, one file per stage that needs one. |
| `reference/` | The reference: `light/`, `dark/`, `components/` screenshots, `DESIGN_HANDOFF.md` (full spec), `source/` (tokens + Tailwind-3 component ports), `ours/` (screens from our own platform admin that we want to copy, e.g. "Today & bills"). |
| `current/` | Screenshots of **our app today** (light + dark), the "before" picture. |
| `progress/` | (created per stage) "after" screenshots of each stage, same pages as `current/`. |

## Ground rules for every stage

1. **Small steps.** One stage at a time; each stage ends with `npm run build`, the same
   screenshot set as `current/` (light + dark), a short checklist, and your approval.
2. **Nothing changes in behaviour.** A design stage never changes what a button does,
   what is sent to the backend, or what prints on a receipt.
3. **Receipts and printed pages are not part of the redesign** (`utils/receiptTemplate.js`,
   `printReceipt.js`, thermal printing). They have their own fixed format.
4. **Light and dark are both first-class.** Every change is checked in both.
5. **Backend changes go through a prompt** in `backend-prompts/` — you send it, the
   backend replies, we test it here.
6. **No commit, tag or push without your permission** (see `CLAUDE.md`).

## Status

| Stage | Name | Backend? | Status |
| --- | --- | --- | --- |
| 1 | Foundations: tokens, fonts, legacy re-map | no | **done — waiting for your OK** (`progress/stage-01/NOTES.md`) |
| 2 | Theme engine + shop accent colour + density | **yes** | **done (backend done + tested) — waiting for your OK** (`progress/stage-02/NOTES.md`) |
| 3 | Core controls kit + Design Lab page | no | **done — waiting for your OK** (`progress/stage-03/NOTES.md`, open `/design-lab`) |
| 4 | Overlays and feedback (dialogs, drawer, menus, toasts) | no | **done — waiting for your OK** (`progress/stage-04/NOTES.md`, open `/design-lab`) |
| 5 | App shell: sidebar, top bar, page header band | no | **done — waiting for your OK** (`progress/stage-05/NOTES.md`) |
| 6 | Tables: one `DataTable` + migrate every list | optional | **done — waiting for your OK + backend prompt to send** (`progress/stage-06/NOTES.md`) |
| 7 | KPI cards, charts and drill-down windows | **yes** | **parts 1 + 2 done — awaiting your OK; insights endpoint still to test when the backend ships it** (`progress/stage-07/NOTES.md`) |
| 8 | POS checkout screen | no | done (`progress/stage-08/NOTES.md`) |
| 9 | Forms, detail and auth screens | no | done (`progress/stage-09/NOTES.md`) |
| 10 | Clean-up, guard rails, final audit | no | **done — awaiting your OK** (`progress/stage-10/NOTES.md`) |
