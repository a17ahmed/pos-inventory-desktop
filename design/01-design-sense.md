# Design sense — the rules

Taken from `reference/DESIGN_HANDOFF.md` §I and what the reference components do, then
adapted to a POS. When a screen "doesn't feel right", check it against this list.

Look at these first: `reference/light/24-app-shell-dashboard.png`,
`reference/light/26-people-list-table.png`, `reference/light/06-data-table.png`, and the
same in `reference/dark/`.

## What it feels like

- **Calm.** Cool grey-blue chrome. Colour shows up only for the one main action, a status, or
  something that needs attention. Nothing glows.
- **Dense but readable.** 13px body text, 44px table rows, tight cards. A cashier sees a lot at once.
- **Soft-rounded.** 12px on controls, 16px on cards, pills for status.
- **Hairline.** Cards have a 1px half-strength edge and a very quiet shadow — edges do the separating.
- **Structured by small mono labels.** Table headers, KPI labels, sidebar group names, eyebrows:
  tiny uppercase JetBrains Mono. The data itself stays in normal Inter.

## The 20 rules (POS version)

1. **Tokens only.** No hex colours, no `bg-slate-800`, no `text-[13px]` in new code. Every colour,
   corner and shadow comes from a named token (`bg-card`, `text-muted-foreground`, `rounded-card`…).
2. **Type is a role, not a size.** `text-body` (13px) is the default; `text-body-lg` (14px) is for
   buttons and inputs; headings are Inter Tight 600 with slight negative tracking.
3. **Mono uppercase micro-labels** for structure (table headers, KPI labels, sidebar groups).
4. **Cards:** 16px corners, 1px `hairline` edge, `shadow-1`. The full `border` colour is for controls only.
5. **One title per screen**, drawn by the tinted page header band (eyebrow → title → subtitle →
   actions → tabs). The top bar shows only where you are.
6. **Borders, not shadows. Colour for exceptions.** Only floating things (menus, dialogs, drawers,
   toasts) cast `shadow-2`.
7. **One solid primary button per view.** Secondary = outline, quiet = ghost, red only on the
   destructive action itself.
8. **Never:** gradients on buttons, glass/blur, coloured shadows, glow, a second accent colour.
   (Today's app has gold gradients and glows — they go.)
9. **Hover and press are washes**, not colour swaps: 6% / 11% foreground overlay; solid buttons
   brighten 6%; a 0.5px press shift. Same on every control.
10. **Focus = 2px outline in the accent colour, 2px offset.** Never a glow ring. Everything works
    from the keyboard (a POS lives on the keyboard and the barcode scanner).
11. **Control heights are a ladder:** 36 default · 32 small · 28 tiny · 40 action · 44 touch.
    Button, input and select in one row line up.
12. **Status = a tinted pill with a word** (and often an icon) — "Paid", "Partial", "Cancelled",
    "Has returns". Never colour alone, never a solid saturated badge.
13. **Money:** `tabular-nums`, right-aligned in tables, currency always shown (`PKR 1,250.00`), a
    missing value is a muted `—`. Negative money is red text with a minus, the same format on every screen.
14. **Tables are calm:** 44px rows, faint row lines, no zebra, no vertical lines, hover is a wash,
    selected = accent tint + 3px accent left edge, attention (e.g. a bill with returns, low stock)
    = warning tint + 3px warning edge.
15. **Every state is designed:** loading (skeleton), empty, no results, error (message + retry),
    no permission, success (toast). A list never shows fake rows.
16. **Dialogs come in sizes** 400 / 480 / 640 / 880, as tall as their content, primary button last
    on the right, first field focused. A decision about a drawer's record opens inside the drawer.
17. **Icon-only buttons always have a tooltip** and an `aria-label`. Icons sit left of the label,
    16px beside text, 14px in small controls (Feather icons, `react-icons/fi` — we already use them).
18. **Copy is short and real.** No emoji in the UI (today's POS product tiles use 📦 — replaced
    by an icon or the product initial), left-aligned text.
19. **Spacing is consistent:** page padding 22px, card padding 16–20px, gaps from one scale.
20. **Dark mode is its own palette**, not an inversion: background `#111418`, cards one step
    lighter, accent lifts to a lighter tint, the sidebar goes darker than the page.

## POS-specific additions

- **Touch floor:** anything a cashier taps during a sale (product tiles, keypad, payment methods,
  Pay button) is at least 44px; the checkout screen may use the `comfortable` density.
- **The Pay / Complete button is the one primary** on the checkout screen. Nothing else there is solid.
- **Speed beats decoration.** No enter animations on the checkout screen beyond a 120–180ms fade.
- **Money is the hero number:** totals use `font-heading` + `tabular-nums`, never a decorative
  serif (today's Playfair Display numbers go).
- **Offline-safe fonts:** fonts are bundled with the app (`@fontsource`), never loaded from Google
  — today the app falls back to system fonts when the shop's internet is down.
