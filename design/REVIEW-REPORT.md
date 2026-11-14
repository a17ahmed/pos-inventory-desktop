# Branch review — `feat/impove-ui` vs `main`

**Date:** 14 Nov 2026 · **Reviewed:** desktop branch `feat/impove-ui` (and the backend changes it needs)
**Tested on:** test database (`test` on the shared cluster) — never production.

## Verdict

| Question | Answer |
|---|---|
| Is the **desktop code** working? | **Yes.** Build passes, design check passes, every screen opens for admin and cashier with no crashes, all money flows tested give the right numbers. |
| Can it be **merged into `main`** today? | **Not yet — 4 small things first** (commit it, version number, keep third-party/licensed screenshots out of the public repo, one easy merge conflict). About 30 minutes of work. |
| Can it be **released to shops** today? | **No.** The backend it needs is **not committed or deployed**. Release order: backend first, then desktop. See "Release plan". |

---

## 1. Blockers (must fix before a release)

| # | What | Why it matters | Fix |
|---|---|---|---|
| B1 | **Backend changes are not committed.** In `pos-inventory-backend` (branch `feat/impove-ui`) the Money Book, the Stage 2 shop-appearance save, the Stage 6 list search and the Stage 7 insights endpoint are all uncommitted working-copy changes. The live server doesn't have them. | The live server runs `main`. Against it (tested): Money Book switches **off** and the old Cash Book shows; dashboard drill-downs run in **limited** mode; **Receipts search / payment filter and Supplies search are silently ignored** — searching "161" lists all 30 bills instead of 1. | Commit the backend, run its tests, deploy, run `scripts/migrate-money-book.mjs` per `docs/money-book-plan.md`, **then** release the desktop. |
| B2 | **Desktop work is not committed.** 65 files (56 changed, the rest new). The Money Book commit (`91adbc3`) has never been released. | Nothing to merge or release until it's committed. | Commit when you say so (your rule: never without explicit permission). |
| B3 | **Version number goes backwards.** `main` is at **1.4.1**; this branch says **1.4.0**. | Auto-update only installs a **higher** version — shipping 1.4.0 would never reach shops on 1.4.1. Also a merge conflict in `package.json` / `package-lock.json` (only the version line). | Set **1.5.0** at release (big visual release + Money Book). |
| B4 | **The repo is public** (GitHub answers without login) and `design/` holds 44 MB of screenshots, including **other companies' screenshots** (`design/research/`) and the **design kit's reference images** (`design/reference/`). | Publishing them may break copyright / the design kit's licence; and it bloats the repo for ever. | Commit only the `.md` docs of `design/`; add `design/**/*.png` (or `design/research/`, `design/reference/`, `design/progress/`, `design/current/`) to `.gitignore`, or keep the folder outside the repo. |

## 2. Found and fixed during this review

| # | What | Fix |
|---|---|---|
| F1 | The new till kept its product list in memory **across logins** — after a logout, another shop signing in on the same computer could briefly see the previous shop's products and today's total (until the refresh, ~1 s). | Cache is now keyed by shop + signed-in person. |
| F2 | Returns → By Bill showed **"Walk-in • PKR 0"** for every bill (it read a field that doesn't exist). **Already wrong on `main`.** | Now shows the bill total. |

## 3. Things to know (not blockers)

| # | What | Note |
|---|---|---|
| N1 | Cashier gets a **403** on `/money-book/settings` (every page) and `/cashbook/balance` (Returns), and on the "my sales" report. | Expected — the app handles each (falls back to a cashier-safe list / hides the tile). Only noise in the console. |
| N2 | The test database is **on the same cluster as production**; the backend `.env` has the production URI on line 2, commented out. | One wrong uncomment points every test at real shop data. Consider a separate cluster or a clearly named test DB. |
| N3 | Login is limited to **10 tries per 15 minutes** per server. | Working as intended (it blocked this review once). |
| N4 | One 2.6 MB JavaScript file (single bundle); compressed code +40 KB vs `main`, CSS −26 %. | Fine for a desktop app; splitting per screen would speed the first start. |
| N5 | React Router "future flag" warnings in the console. | Harmless; were there before. |
| N6 | Older screens (Returns, Vendors, Inventory overview, Expenses stat cards) use the new colours but keep their old layout. | Cosmetic; candidate for a follow-up. |
| N7 | New design check runs before **every** build, including the release workflow. | A future change with off-design classes will **stop the release build** — intended. |
| N8 | Till decisions A–D (quick-add grid, "Usually buys", over-limit warning, daily target) are still open. | See `design/research/pos-checkout/README.md`. |

---

## 4. What was tested

### Automatic checks
| Check | Result |
|---|---|
| `npm run build` (design check + Vite production build) | ✅ passes |
| Design check (raw colours, old classes, pixel fonts, gradients, hex) | ✅ 0 problems; self-test with a bad file caught all 5 rules |
| Backend test suite (`npm test`, backend branch) | ✅ **262 / 262** pass |
| Electron packaging (`electron-builder --mac --dir`, local only, nothing published) | ✅ app built (Electron 28.3.3, native modules rebuilt) |

### Every screen, both roles, both servers
19 pages × admin and cashier, against the **new** backend (port 3001) and against the **live server's code** (`main`, port 3002):

| | New backend | Live server code |
|---|---|---|
| Admin — page crashes / blank pages | **0 / 0** | **0 / 0** |
| Cashier — page crashes / blank pages | **0 / 0** | **0 / 0** |
| Failed calls | only the expected cashier 403s (N1) | + 404 on Money Book (→ falls back to Cash Book, as designed) |
| Pages a cashier can't open (Reports, Customers, Staff, Customer ledger) | "You can't open …" page | same |

### Money flows (real records on the test database)
| Flow | Server | Result |
|---|---|---|
| Cash sale, walk-in | live code | ✅ bill #169, PKR 150 |
| Credit sale, QA 03 | live code | ✅ bill #170, balance 4,000 → **4,150**, bill due 150 |
| Full return of bill #169, cash refund | new | ✅ Cash Drawer **−150**, "Today's returns 1 (PKR 150)" |
| Record payment PKR 150 from QA 03 (FIFO, cash) | new | ✅ balance 4,150 → **4,000**, Cash Drawer **+150**, confirm step shown |
| Money Book transfer 100 Cash → Bank | new | ✅ Cash **−100**, Bank **+100** |
| **Released v1.4.1 app** cash sale against the **new** backend | new | ✅ bill #171 — shops that haven't updated keep working after the backend deploy |
| Earlier in the project (stage notes): cash / card / credit / add-to-bill sales (#163–#167), scanner guard, closing preview, product form, settings save | new | ✅ (see `design/progress/stage-08`…`stage-10`) |

### Endpoint comparison (new backend vs live code, admin)
| Endpoint | New | Live | Impact if desktop ships first |
|---|---|---|---|
| `/bill?search=161` | 1 bill | **30** (ignored) | Receipts search shows wrong list |
| `/bill?paymentMethod=online` | 4 | **30** (ignored) | Payment filter does nothing |
| `/supply?search=QA` | 7 | **11** (ignored) | Supplies search shows wrong list |
| `/money-book/*` | 200 | 404 | Money Book off → old Cash Book (safe) |
| `/v1/dashboard/insights/sales` | 200 | 404 | Limited drill-down (safe) |
| `/bill/report/timeline?groupBy=week|month` | 200 | 200 | ✅ same |
| closing, statements, ledgers, stats, reports | 200 | 200 | ✅ same |

### Code review (risky parts read line by line)
- **API client** (`services/api.js`): loading bar counts each request once (retries after token refresh not double-counted); identical in-flight GETs share one request, cancellable ones are never shared. ✅
- **Till** (`screens/Dashboard.jsx`): the sale itself (`createBill` payload, totals, discounts, special rates, stock checks, add-to-bill) unchanged apart from the Money Book account fields from commit `91adbc3`. New: scanner guard, instant loading, held scan, customer card (local only, never sent to the server). Cache issue F1 fixed. ✅
- **App shell / menu**: same permission rules as `main`; title-bar colours, logout, account-status dialogs kept. ✅
- **Contexts**: theme/appearance with fallback for older servers; Money Book switches off on 404/409. ✅
- **Stage 10 colour swap**: no "same colour text on same colour background" combinations found. ✅
- **Electron main process**: not changed by this branch.

### Not covered
- Windows build / install (only the Mac app folder was packaged here) and real thermal printing.
- Auto-update from 1.4.1 → new version (needs a real release).
- Very large shops (thousands of products) — the till loads the full product list, as before.

---

## 5. Release plan (in this order)

1. **Backend:** review + commit the backend branch (leave out the stray `.playwright-mcp/*.yml` that is staged there), run `npm test`, deploy, run the Money Book migration, smoke-test the live server.
2. **Desktop:** decide what of `design/` goes into the repo (B4), commit, bump version to **1.5.0** (B3), merge `main` into the branch (only the version conflict), build.
3. Fill in the version in `design/RELEASE-NOTES.md`.
4. Install the built app on one shop computer (Windows) and sell / print / close a day.
5. Tag and release — **only when you say so** (the tag publishes to every shop).
