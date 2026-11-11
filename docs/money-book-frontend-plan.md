# Money Book — Desktop Implementation Plan (Phase 1)

> Status: **approved 2026-11-10**. Decisions: Q1 fixed in the backend (payments[] path now sets receivedBy) → POS always sends `payments[]` with `accountId` when ON. Q3 → option (b): `GET /money-book/accounts/picker` (names only) for users without `cashbook.view`; no client-side insufficient warning for them. Q2, Q4, Q5 as recommended.
> Brief: `docs/money-book-frontend.md`. Backend source of truth: `../pos-inventory-backend`
> (`controllers/moneyBook.mjs`, `routes/moneyBook.mjs`, `middleware/validationSchemas.mjs`,
> `middleware/accessControl.mjs`, `docs/money-book-plan.md` §2–§11, `test/money-book.test.mjs`).

---

## 0. Decisions I need from you (before Phase 2)

These come from reading the backend. Each one changes what I build.

| # | Finding | Options | My recommendation |
|---|---|---|---|
| **Q1** | **POS checkout can't send an account without losing "received by".** `POST /bill` accepts `accountId` only inside `payments[]` (no top-level field). The POS sends `paymentMethod` + `amountPaid` today. On that path the server fills `receivedBy` / `receivedByName` (`controllers/bill.mjs:372-380`). When `payments[]` is sent, it copies them from the request, and `billPaymentSchema` doesn't allow `receivedBy*`. So those bills would show an empty "received by" on customer statements (`customerStatement.mjs:192`, `customer.mjs:403`). | **(a)** A 2-line backend fix: in the `payments[]` branch, set `receivedBy` / `receivedByName` / `paidAt` when they're missing. **(b)** Send `payments[]` only when the cashier changes the account away from the default; otherwise keep today's fields. "Received by" is lost only on overridden bills. **(c)** No account choice at checkout; the server always uses the mapping. | **(a)**. The brief says to report API gaps rather than work around them. Until it ships I'd do **(b)**, so default checkouts are byte-identical to today. |
| **Q2** | **The POS has no split payment.** A sale has one method (cash / card / UPI / credit + "paid now" as cash). The acceptance item "split payments can use different accounts" has no UI to attach to. | Build a split-payment UI in checkout, or leave it out. | **Leave it out.** `AccountPicker` works per payment row, so split payments can use it later. Building split tender is a separate feature. |
| **Q3** | **Cashiers usually can't see accounts.** `GET /money-book/settings` and `/accounts` need `cashbook.view` (`accessControl.mjs:158`), and `accessControl` runs before the 409/200 check. A cashier without `cashbook.view` gets **403** and can't load accounts, so no picker can be shown at POS / returns / collect. | **(a)** Accept it: those users post to the mapped account (server default) with no picker and no client balance check, and server `INSUFFICIENT_BALANCE` is still handled. **(b)** Backend: let pickers read `/settings` + `/accounts` without `cashbook.view` (names + balances, or names only). | **(a)** for this release, and I'll list **(b)** as a backend gap. |
| **Q4** | **The employee access editor has no Cash Book row at all** (`Employees.jsx:45`, `ACCESS_MODULES`), so today `cashbook.view/manage` can't be granted from the UI. The brief only asks for a "Transfer between accounts" checkbox. | Add a "Cash / Money Book" row (`view`, `manage`, `transfer`) always, or only when the Money Book is ON. | **Only when ON**, labelled "Money Book", with `transfer` in it. OFF shops keep today's editor unchanged. |
| **Q5** | **The cheque method when the Money Book is OFF.** §5.5 of the brief says to hide cheque unless `chequeTracking` is on. §2 says OFF shops must behave exactly like today, and today cheque is shown (Expenses, Vendors, VendorLedger). | — | **OFF → unchanged (cheque shown). ON → cheque only when `chequeTracking`.** Same for the new **Online** expense method: shown only when ON (an old server's Joi would reject it). |

Nothing else blocks me. The rest of this plan assumes the recommendations above.

---

## 1. On/off detection (the switch)

### 1.1 States

```
mode = 'loading' | 'off' | 'on' | 'restricted'
```

| `GET /money-book/settings` | `mode` | Effect |
|---|---|---|
| 200 | `on` | New screens and pickers. New fields are sent. Accounts are loaded. |
| 409 `MONEY_BOOK_NOT_READY` | `off` | Exactly today's app. |
| 404 (old server) | `off` | Exactly today's app. |
| 403 (no `cashbook.view`) | → `GET /accounts/picker`: 200 `on` (names only, `balances=false`), 409 `off`, 403 `on` but no pickers | Money Book screens hidden for this user. With picker data: pickers show names only, no client insufficient check; server `INSUFFICIENT_BALANCE` shown. |
| network error / 5xx | `off`, retried later | Fail safe: never send new fields to a server we couldn't confirm. Retried on the next window focus or picker open. |

`restricted` behaves like `off` everywhere except two places: the sidebar label and the Money Book page. With no `cashbook.view` the route is already blocked by `PermissionRoute`, so nothing extra is needed there.

### 1.2 Gate rule used everywhere

Every call site follows the same rule. New fields are added only through helpers that return `{}` unless `mode === 'on'`:

```js
const { moneyFields } = useMoneyBook();
await paySupply(id, { amount, method, note, ...moneyFields({ accountId, chequeNumber, chequeDate }) });
```

`moneyFields(obj)` returns `{}` when not ON and drops `undefined` / empty keys when ON. A field can only reach a server that said 200, and OFF payloads stay byte-identical to today's.

### 1.3 Mid-session fallback

`handleMoneyError(err)` in the context:
- `409 MONEY_BOOK_NOT_READY` from any `/money-book/*` call → `mode = 'off'` and accounts cleared. The screen shows its normal error.
- `400` with `code` `ACCOUNT_NOT_FOUND` / `ACCOUNT_ARCHIVED` / `ACCOUNT_TYPE_MISMATCH` → reload the accounts so pickers reset to the default (brief §6).
- `400 INSUFFICIENT_BALANCE` → reload the accounts so balances are fresh. The caller shows `message` and keeps the form open.

### 1.4 When it loads

The provider loads `/settings` when `isAuthenticated` becomes true, so after login and on app start. It also reloads when the logged-in user changes, and resets to `loading` on logout. The accounts list is loaded when ON. It refreshes:
- when any `AccountPicker` mounts (it calls `refreshAccounts()`, throttled to 1 call per 10 s),
- after every money action that goes through the context (transfer, deposit, …),
- on `window` focus, throttled.

---

## 2. New files

| File | Purpose |
|---|---|
| `src/services/api/moneyBook.js` | One function per endpoint in brief §3. Plain axios wrappers like `cashbook.js`. |
| `src/context/MoneyBookContext.jsx` | Detection, settings, accounts and the gate helpers (see §3). |
| `src/utils/moneyBook.js` | Pure helpers: `ENTRY_TYPE_LABELS` + colours (old 9 + new 5), `ACCOUNT_TYPE_LABELS`, `METHOD_LABELS`, `round2`, `formatMoney(amount, currency)` (minus sign + red class helper for negatives), `apiErrorMessage(err)` (`message` → `error` → first Joi `errors[].message` → fallback), `isInsufficient(err)`. |
| `src/components/AccountPicker.jsx` | A reusable picker (see §4). |
| `src/screens/MoneyBook.jsx` | The Money Book page shell: header cards, tabs, actions, banner. |
| `src/components/moneybook/EntriesTable.jsx` | Day-grouped ledger table, filters and paging. |
| `src/components/moneybook/MoneyActionModal.jsx` | One modal for deposit / withdraw / transfer / adjustment / opening balance. |
| `src/components/moneybook/TransfersPanel.jsx` | `GET /transfers` list with reverse. |
| `src/components/moneybook/ChequesPanel.jsx` | Pending cheques: clear / cancel. |
| `src/components/moneybook/AccountSettings.jsx` | Admin: accounts CRUD, reorder, archive/restore, method → account mapping. |
| `src/components/moneybook/AccountReconciliation.jsx` | Closing: a per-account counted-vs-expected table, used by `Closing.jsx`, `ClosingDetail.jsx` and `ClosingReport.jsx`. |

The `moneybook/` subfolder keeps `MoneyBook.jsx` from becoming a 3,000-line file like `Dashboard.jsx`. No new libraries.

---

## 3. Context / state design — `MoneyBookContext`

The provider sits inside `BusinessProvider` in `main.jsx`, because it needs `useAuth()`.

```js
{
  mode,                 // 'loading' | 'off' | 'on' | 'restricted'
  isOn,                 // mode === 'on'
  settings,             // { methodAccounts, compatibility, cashDrawer, chequeTracking, enabledAt } | null
  accounts,             // active AccountRow[] sorted by sortOrder ([] unless ON)
  totals,               // { total, byType }
  accountsById,         // Map for labels (archived ones included once loaded with includeArchived)
  chequeTracking,       // bool (false unless ON)
  refreshSettings(), refreshAccounts({ force }),
  handleMoneyError(err),
  moneyFields(obj),     // {} unless ON (gate, §1.2)
  defaultAccountId(method),                 // methodAccounts[method] ?? null
  accountsForMethod(method, { anyType }),   // compatibility filter, active only
  canTransfer, canManage, canView, isAdmin, // from useAuth().permissions (admins → all true)
}
```

Why a separate context instead of `BusinessContext`: `BusinessContext` loads only from localStorage and doesn't depend on auth. The Money Book needs auth state, network calls and its own refresh cycle. Keeping it separate leaves the existing context untouched.

Screen-local state stays in the screens: the selected account per form and the form-level "insufficient" flag.

---

## 4. `AccountPicker`

```jsx
<AccountPicker
  method="card"            // payment method; 'store_credit' → renders nothing
  value={accountId}        // controlled; null → default chosen on mount / method change
  onChange={(id, account) => …}
  amount={number}          // for the balance check
  direction="in" | "out"
  anyType={false}          // walk-in refunds: every active account
  defaultId={…}            // override the default (refunds → settings.cashDrawer)
  pending={false}          // cheque with tracking ON → skip the balance check
  onInsufficientChange={(bool) => …}  // the parent blocks submit
  compact                  // inline style for the POS modal
/>
```

Behaviour:
- Renders `null` unless `isOn`, or when `method` is a non-money method (`store_credit`, `credit`, `ledger_adjust`, `vendor_credit`).
- Options: `accountsForMethod(method, { anyType })`. Default: `defaultId ?? methodAccounts[method]`. If the method is mapped to "don't record" (null) the default is null, shown as "Not recorded (mapping)", and the cashier can still pick one.
- **When there is exactly one option**, it shows as a read-only chip ("→ Cash Drawer · Rs 18,450"). Its id is still reported through `onChange`, so the payload always carries it.
- If the current value is no longer an active option (archived, or the method changed), it resets to the default and calls `onChange`.
- Each option shows its name, type and balance. Negative balances show a minus sign in red.
- For `direction="out"` with `amount > balance` and not `pending`, it shows red "Insufficient — available Rs X" and calls `onInsufficientChange(true)`.
- A plain `<select>` styled like the existing inputs, no new dependency.

---

## 5. Changes to existing files

All changes go through `isOn` / `moneyFields`, so OFF paths are unchanged.

### 5.1 Foundation
| File | Change |
|---|---|
| `src/main.jsx` | Wrap `<App/>` in `<MoneyBookProvider>`. |
| `src/App.jsx` | The `/cashbook` route renders `<CashBookRoute/>`: `isOn ? <MoneyBook/> : <CashBook/>`, with a spinner while `loading`. `CashBook.jsx` itself is **not modified**. |
| `src/components/Layout.jsx` | Both nav lists: label `isOn ? 'Money Book' : 'Cash Book'`. |
| `src/services/api/expenses.js` | `approveExpense(id, body)`. The body is sent only when given, so OFF calls stay `POST` with no body, as today. |

### 5.2 Payment flows (Phase 4)

| Screen | Today | When ON |
|---|---|---|
| `Dashboard.jsx` POS checkout (`handleCheckout` ~1338, modal ~2517) | `paymentMethod` + `amountPaid` | Picker under the method buttons for cash / card / UPI(online), and for "credit + paid now" (cash). Payload per **Q1**. No balance check, because sales are money in. |
| `Dashboard.jsx` add-to-bill (`handleAmendSave` ~1266, modal ~2412) | `payment: { amount, method }` | `payment.accountId` from the picker when the method isn't credit. `accountId` is added to the idempotency fingerprint, so a changed account gets a new key. |
| `CustomerLedger.jsx` collect / bill payment (~337) | `{ amount, method, note }` | Picker in the payment modal, `accountId` on both `collectFromCustomer` and `addBillPayment`. The confirm text names the account. |
| `Vendors.jsx` supply create (~396) | always cash, no method field; cash balance check | When ON: a method selector (`PAY_METHODS`, cheque only if tracking) shown when paid > 0, plus a picker (`out`). FormData gets `paymentMethod`, `paymentAccountId`, and the cheque fields. The check uses the selected account's balance. |
| `Vendors.jsx` supply pay modal (~473) | `{ amount, method }`, no check | Picker (`out`) + check, `accountId` and cheque fields. |
| `VendorLedger.jsx` FIFO / per-supply pay (~272) | cash-only check against `getCashBalance` | When ON: picker + check on the selected account, `accountId` and cheque fields. When OFF: unchanged. |
| `Expenses.jsx` form (~145, ~540) | cash/card/bank/cheque, cash check | When ON: add **Online**; cheque only if tracking (and then cheque no. + date inputs). Picker (`out`) + check, `accountId` sent on create/update. |
| `Expenses.jsx` approve (~185) | `approveExpense(id)`, generic error | When ON: a small approve dialog with the picker pre-set to `expense.account ?? default`, a balance check and `{ accountId }`. Show the server `message`/`error` (today it shows a generic "Failed"). |
| `Returns.jsx` linked walk-in return + full return (~448, ~544) | cash-only check | When ON and the bill has no customer: picker `anyType`, default `cashDrawer`, `refundAccountId`, check on the selected account. Customer bills (ledger_adjust) get no picker. |
| `Returns.jsx` standalone refund (~485, ~1027) | `refundMethod` cash/card/store_credit, cash check | Picker for cash/card (filtered by method), `refundAccountId`, check on the selected account. None for store credit. |

For every flow above, on `INSUFFICIENT_BALANCE` from the server: show `message` inline, or with `appAlert` where the screen already uses it, keep the modal open, and call `handleMoneyError` to refresh balances. Brief §6 says amounts are rounded with `round2` before sending; I'll apply that only where a new field is involved, so OFF payloads don't change.

### 5.3 Display (Phase 5)
| File | Change |
|---|---|
| `Receipts.jsx` (~938 payment list, ~386 cancel) | Show the account name next to the method when `p.account` is set (resolved via `accountsById`, or "account" if unknown). After cancel, when `res.data.reversed?.length`, the toast reads "Rs 600 back from Cash Drawer, Rs 400 from Bank / Online". Otherwise today's `cashReversed` text. |
| `CustomerLedger.jsx` (~821) | The account name next to the method on payment rows, when present. |
| `Dashboard.jsx` AdminDashboard (~2945, ~3210) | Keep "Cash in hand". When `data.moneyBook` is not null, add a "Total money" card with a per-account breakdown. This comes from the dashboard response itself, not the context, so it works for every viewer of the dashboard. |
| `Closing.jsx` | When `preview.accountReconciliation?.length`: render `AccountReconciliation` with a counted input per account. Send `accountCounts` (`id:amt,…` on preview, an array on save). The cash/card/online inputs stay. If the drawer is counted through `accountCounts`, the separate cash input is hidden and `countedCash` is not sent (the server fills it). Shops without the array keep today's screen. |
| `ClosingDetail.jsx`, `components/ClosingReport.jsx` | Render the per-account table + `totalMoneyExpected` when the array exists. Old closings show today's view (both are handled). |
| `Employees.jsx` | Per **Q4**: when ON, append `{ key: 'cashbook', label: 'Money Book', actions: ['view','manage','transfer'] }` and the label `transfer: 'Transfer between accounts'`. |

Nothing changes in `Settings.jsx`. Account management lives in the Money Book page (admin-only tab), so all Money Book admin is in one place. A one-line link card could go in Settings if you want one.

---

## 6. Money Book page (`/cashbook` when ON)

```
Header: "Money Book" · refresh · CSV · print
[Go-live banner: Bank / Online openingBalance === 0 → "Enter opening balance" → opening dialog]
Cards: Total money (by-type split under it) | one card per account (balance, today in/out, pending-cheque badge)
Actions: Deposit · Withdraw (cashbook.manage) · Transfer (cashbook.transfer) · Adjustment (admin)
Tabs: All | <account…> | Transfers | Cheques (if tracking or the list returns data) | Accounts (admin)
```

- **Entries tab** (`All` / per account): `GET /entries?account=<id|all>&type&direction&startDate&endDate&q&page&limit=50`.
  - Grouped by **local day of `effectiveDate`**. The day header shows `dailySummary[date].openingBalance` and the footer shows `closingBalance`. I key days with a local `YYYY-MM-DD`, not `toISOString()`: the old screen's `toISOString` slicing is wrong around midnight in PKT.
  - Columns: # · time · (account chip in All) · type label · description (+ "→ To: X" / "← From: X" from `counterAccount` on transfer legs, the reason for adjustments, a cheque badge) · In · Out · Balance.
  - The **Balance column is hidden when `balanceAfter` is null** (a filtered list). Day rows still show opening/closing, because those cover all entries.
  - A transfer row (`transfer_out` / `transfer_in` that isn't `reversalOf`) gets a "Reverse" action when `canTransfer`, with an `appConfirm` and an optional note.
  - The range summary strip comes from `rangeSummary` (+ `rangeSummary.type` when a type filter is set).
  - Search uses the server `q` (prefix match on reference / description).
- **Transfers tab**: `GET /transfers` with paging, showing from → to, amount, fee, note, by, and status ("Reversed" / "Reversal" / Reverse button).
- **Cheques tab**: shown when `chequeTracking`, or when `GET /cheques` returns 200 with rows. A 404 `CHEQUE_TRACKING_OFF` hides it. It has a status filter. Clear asks for a date (default today) and is refused with the server message if the bank is short. Cancel asks for a reason, and the confirm explains: "No money moves. The supplier / expense payment itself stays recorded."
- **Action modal** (one component, `kind` prop):
  - Deposit / Withdraw: account, amount, date (≤ today), description, note. Withdraw shows the balance and blocks when short.
  - Transfer: from / to (different accounts), amount, fee, date, note. Shows the from-balance and blocks when `amount + fee > balance`.
  - Adjustment (admin): account, in/out, amount, **reason (required)**, date, note. A hint says it may go below zero.
  - Opening balance: amount, date (optional), note. Offered from the banner and from an account card while its opening is 0.
  - `PERIOD_CLOSED` and other server messages are shown inline, and the modal stays open.
- **Accounts tab** (admin only):
  - A list with an "include archived" toggle. Add / edit: name, type, bank name, account title, **last 4 digits only** (maxLength 8, digits), wallet number, note, and an opening balance (create only).
  - ↑/↓ reorder → `PUT /accounts/reorder`.
  - Archive / restore show the server's reason text (balance ≠ 0, mapped, pending cheques, Cash Drawer).
  - The type select is disabled for system accounts. If the server refuses a type change, its message is shown.
  - **Mapping**: one row per method (cash, card, online, bank_transfer, other, + cheque if tracking). Each dropdown is filtered by `compatibility[method]`, plus "Don't record" for every method except cash. Save → `PUT /settings`, then `refreshSettings()`.
- Permissions: if an action's permission is missing, its button is hidden, not just disabled. Admin-only controls check `isAdmin` from `useAuth`.

---

## 7. Phases (after approval)

1. ~~Read & plan~~ (this file)
2. **Foundation**: `moneyBook.js` API, `MoneyBookContext` + provider wiring, `utils/moneyBook.js`, `AccountPicker`, the `/cashbook` switch, the sidebar label, `approveExpense(id, body)`.
3. **Money Book page**: entries, cards, banner, action modal, transfers, cheques, accounts + mapping.
4. **Payment flows**: every row in §5.2 + balance checks + `INSUFFICIENT_BALANCE` handling.
5. **Closing, dashboard, receipts, customer ledger display, permissions editor.**
6. `npm run build`, a self-review of every OFF path (diff check that no new key reaches a request without `isOn`), a summary of changed files. **No commit / tag / push without your say-so.**

Testing note: I can run `npm run build`. A manual run in `electron:dev` against a local backend with a switched-on shop needs your backend running with a migrated business. I'll tell you what I could and couldn't verify.

---

## 8. Backend gaps to report (not working around them)

1. **Q1**: `createBill` `payments[]` path doesn't set `receivedBy` / `receivedByName`.
2. **Q3**: pickers need `cashbook.view`, so most cashiers will never see one.
3. `addBillItems` (`POST /bill/:id/add-items`): fine as is (`payment.accountId` exists).
4. A Joi rejection comes back as `message: "Validation failed"` with details in `errors[]`. `apiErrorMessage` handles this; it's not a gap, just noted.
5. Expense handlers sometimes answer `{ error }` instead of `{ message }` (e.g. approve "already approved"). Handled client-side.

## 9. Out of scope (per brief §7 + above)
Backend changes, hold-bill money, backfill, a split-payment UI (Q2), and offline queueing: `docs/OFFLINE_MODE_ARCHITECTURE.md` is only a design proposal and there's no outbox code in `src/`. The add-to-bill idempotency key will include `accountId` so retries stay correct.
