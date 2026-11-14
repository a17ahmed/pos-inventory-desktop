# Component kit — `src/components/ui/`

One folder of small, plain React + Tailwind components. Screens use these instead of writing
long class strings by hand. Exact source classes: `reference/DESIGN_HANDOFF.md` §F,
`reference/source/components-v3/` (Tailwind-3 ports of Button, Input, Card, StatusChip, Alert,
Switch, Tabs — written in TypeScript; we port them to `.jsx`).

Every component is shown on a **Design Lab** page (`/design-lab`, dev builds only, Stage 3) in
light and dark, so it can be checked before any screen uses it.

| Component | Stage | Reference screenshot | Replaces today |
| --- | --- | --- | --- |
| `Button` — variants `primary · outline · secondary · ghost · destructive · warning · link`; sizes `default 36 · xs 32 · 2xs 28 · action 40 · touch 44 · icon` | 3 | `components/controls-01-button.png` | hand-written `bg-amber-500 … rounded-xl` buttons, gold gradient buttons |
| `Input`, `Textarea`, `Select` (native `<select>` styled), `SearchInput` (leading icon) | 3 | `components/controls-02-the-44px-row.png`, `light/15-select-open.png`, `components/form-01-block.png` | per-screen `inputClass` strings (e.g. `moneybook/ui.jsx`) |
| `Field` (label + control + help + error) | 3 | `components/form-01-block.png` | `moneybook/ui.jsx` `Field`, ad-hoc labels |
| `Checkbox`, `Switch`, `SegmentedControl` (Today/Week/Month, payment method choice) | 3 | `components/controls-10-segmented-control-switch-checkbox.png`, `controls-08-choice-buttons.png` | custom toggles in Settings, period pickers on Dashboard/Receipts |
| `StatusChip` — tones `neutral · accent · info · success · warning · destructive`; shapes `pill · tag · dot` | 3 | `components/controls-04-status-chips-and-badges.png`, `layout-03-statusbadge.png` | "Sale", "Cancelled", "HAS RETURNS", "Paid/Partial/Unpaid", entry-type colours in `utils/moneyBook.js` |
| `Card`, `SectionCard` (title + description + actions + body), `InsetCard` | 3 | `components/layout-07-sectioncard.png` | `bg-white dark:bg-d-card border … rounded-2xl` repeated everywhere |
| `Spinner`, `Skeleton`, `IndeterminateBar` | 3 | `components/feedback-07-loading-and-denied.png` | "Loading…" text, custom spinners |
| `EmptyState` (`md` / `sm`), `StateCard` (error + retry, no permission) | 3 | `components/feedback-03-emptystate-sizes.png`, `feedback-06-state-card.png` | ad-hoc "No data" text |
| `Money` (formats `PKR 1,250.00`, negative in red with minus, `tabular-nums`) | 3 | handoff §D | `formatCurrency` + `formatMoney` used in different ways (closing shows `PKR -50.00`, Money Book `-PKR 50`) |
| `Dialog` (sizes 400/480/640/880, header, body, footer bar) + `ConfirmDialog` | 4 | `light/11-modal-destructive-dialog.png`, `components/overlays-01…03` | 21 files with their own `fixed inset-0` modal; `AppDialog.jsx` (appAlert/appConfirm) is restyled, its API kept |
| `Drawer` (side panel: header, sections, sticky footer) | 4 | `components/overlays-04-drawer-anatomy.png`, `light/12-drawer-open.png` | receipt detail / ledger detail modals that would read better as a side panel |
| `Menu` (row actions "⋯"), `Tooltip` | 4 | `light/13-dropdown-menu-open.png`, `components/overlays-06-menu-and-tooltip.png` | rows of 3–4 icon buttons per table row; `title=""` tooltips |
| `Toast` (+ `useToast`) | 4 | `light/14-toast-success.png`, `components/feedback-01-toasts.png` | 4 separate home-made toasts (Dashboard, etc.) |
| `Banner`, `Alert` | 4 | `components/feedback-02-banner.png`, `feedback-04-alerts.png` | `PaymentDueBanner`, Money Book go-live banner, `ErrorBox` |
| `Tabs` (underline) and `PillTabs` | 5 | `components/controls-06-underline-tabs.png` | Money Book tabs, Vendors tabs, Customer ledger tabs |
| `AppShell`: `Sidebar` (navy, groups, rail), `TopBar` (breadcrumb, theme switch, user pill) | 5 | `light/23-app-shell-home.png`, `light/24-app-shell-dashboard.png` | `Layout.jsx` icon-only sidebar |
| `PageHeader` (tinted band: eyebrow, title, subtitle, actions, tabs) | 5 | `components/layout-01-apppage.png` | every screen's own `<h1>` block |
| `NavRail` (in-page filter list with counts) | 5 | `components/layout-08-navrail.png` | Money Book account list (optional) |
| `DataTable` (+ toolbar, pagination, density, 6 states) | 6 | see `04-tables.md` | 18 files with hand-built `<table>` |
| `KpiCard`, `KpiStrip` | 7 | `components/kpi-01…08`, `light/10-kpi.png` | Dashboard / Receipts / Money Book stat tiles |
| `ChartPanel` + chart wrappers (bar, area, donut, horizontal bar, chart table) on `chart-1…6` | 7 | `light/09-charts.png`, `components/charts-01/04/09/10` | recharts used directly in Dashboard, Reports, EmployeeAnalytics |
| `InsightDrawer` (drill-down window: date header, KPI strip, chart panels) | 7 | `reference/ours/platform-admin-today-and-bills.png`, `components/kpi-06…`, `overlays-04-drawer-anatomy.png` | nothing — new (see `06-charts.md` §3) |
| `DescriptionList` (label/value pairs) | 9 | `components/layout-05-descriptionlist-recordlink.png` | receipt / closing / customer detail blocks |

## Helpers

- `cn(...)` — joins class names (start with a tiny local function; add `clsx` +
  `tailwind-merge@2` only if overriding classes becomes painful — library decision in `ROADMAP.md`).
- Icons stay `react-icons/fi` (Feather). The lucide → Feather map is in `reference/DESIGN_HANDOFF.md` §J5.

## Rules for every component

- Colours only from tokens; no `dark:` classes inside components (tokens switch by themselves).
- Keyboard: focus outline visible, Esc closes overlays, Enter submits dialogs.
- Same heights ladder for Button / Input / Select.
- Each component has: default, hover, focus, disabled, loading (where it applies) shown in the Design Lab.
