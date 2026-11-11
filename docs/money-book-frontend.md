# Money Book — Desktop App Brief

> For the agent building the desktop side of the Money Book.
> Backend is **done and tested** (repo: `../pos-inventory-backend`, not yet committed on branch `feat/impove-ui`).
> Read this whole file before writing code.

## 0. Rules

- **Never `git commit`, `tag` or `push` without explicit permission** (see `CLAUDE.md`). A pushed tag ships an auto-update to every shop.
- **Read before deciding.** The backend is the source of truth for every request and response shape:
  - Design + decisions: `../pos-inventory-backend/docs/money-book-plan.md` (read §2, §4, §5, §7, §9, §10, §11)
  - API handlers: `../pos-inventory-backend/controllers/moneyBook.mjs`
  - Routes: `../pos-inventory-backend/routes/moneyBook.mjs`
  - Request validation (exact fields allowed): `../pos-inventory-backend/middleware/validationSchemas.mjs` (search "MONEY BOOK" and `accountId`)
  - Behaviour examples: `../pos-inventory-backend/test/money-book.test.mjs`
- **Backend Joi rejects unknown fields.** Never send `accountId` / `refundAccountId` / `chequeNumber` etc. to a server that doesn't know them — gate everything on feature detection (§2).
- Match the existing code style (React 18, Tailwind, `src/services/api/*` modules, `appAlert` / `appConfirm` from `components/AppDialog`, `formatCurrency`, existing modal patterns). Reuse what's there; don't add libraries.
- Work in phases (§9). After Phase 1, stop and show the plan; then implement; summarise changed files; ask before any commit.

## 1. What the feature is

Today the Cash Book tracks **cash only**. Card / online / bank money is recorded on bills, supplies and expenses and then "disappears".

The Money Book turns that into **several money accounts**: Cash Drawer, Bank / Online (both created automatically), plus any the shop admin adds (Meezan Bank, JazzCash, Easypaisa, Card Machine…). Account types: `cash`, `bank`, `wallet`, `card_machine`.

- Every real-money movement now lands in an account: sales, bill payments, customer collections, refunds, supplier/vendor payments, expenses.
- Each payment method maps to a default account (shop setting). The cashier can override per payment.
- Money can be **transferred** between accounts (optional fee).
- **No account may go below zero** (cash and bank alike) for normal money-out: supplier payments, withdrawals, transfers, expense approvals, refunds. Only sale cancels and admin adjustments can go negative. The server enforces this and answers `400 { code: "INSUFFICIENT_BALANCE", message, accountId, accountName, available, required }`.
- **Cheques** (pending → cleared) exist only when the platform admin turned `chequeTracking` on for that shop. Otherwise **hide the cheque method everywhere**.
- Hold bills: unchanged — nothing about holds is recorded.

## 2. Feature detection & rollout (critical)

The backend switches the Money Book on **per shop** (after a migration script runs). Old desktop builds must keep working, and this new build must keep working against shops that aren't switched on yet.

On login / app start (and cache in a context, e.g. new `MoneyBookContext` or inside `BusinessContext`):

```
GET /money-book/settings
  200 → Money Book ON. Response: { methodAccounts, compatibility, cashDrawer, chequeTracking, enabledAt }
  409 { code: "MONEY_BOOK_NOT_READY" } → OFF for this shop: behave exactly like today
  404 → old server: behave exactly like today
  403 → user lacks cashbook.view: hide the Money Book screens, then call GET /money-book/accounts/picker:
        200 → ON (use it for the pickers) · 409 → OFF · 403 → ON, but this user handles no money (no pickers)
```

Account lists for pickers:
- User **with** `cashbook.view` (and admins): `GET /money-book/accounts`, which includes balances, so the picker can show "available Rs X" and warn before money-out.
- User **without** it (most cashiers): `GET /money-book/accounts/picker`, which returns names only:
  `{ accounts: [{ _id, name, type, systemKey, methods }], methodAccounts, compatibility, chequeTracking }`.
  No balances, so the picker shows names only and skips the "insufficient" warning; the server still refuses a short money-out with `400 INSUFFICIENT_BALANCE`, so show that message.
  It is allowed for anyone with at least one of: pos.create, pendingBills.resume, returns.create/standalone, customers.edit, vendors.pay, supplies.create/recordPayment, expenses.create/approve, cashbook.view.

Refresh the list after any money action (sale, payment, transfer…) or at least when a picker opens.

**When OFF:** old Cash Book screen, old cash-only balance checks, never send any new field.
**When ON:** new screens + pickers, and only then send the new fields.

## 3. API reference (all under `/money-book`, auth like other shop calls)

Permissions: GETs need `cashbook.view` (except `/accounts/picker`, see §2); deposit/withdraw/opening/cheques need `cashbook.manage`; transfers need the new **`cashbook.transfer`**; accounts CRUD, mapping (`PUT /settings`) and adjustments are **admin only** (403 otherwise).

| Method | Path | Body / query | Notes |
|---|---|---|---|
| GET | `/accounts` | `?includeArchived=true` | `{ accounts: [AccountRow], totals: { total, byType } }` |
| GET | `/accounts/picker` | | active accounts, names only, for cashiers (§2): `{ accounts: [{ _id, name, type, systemKey, methods }], methodAccounts, compatibility, chequeTracking }` |
| POST | `/accounts` | `{ name, type, details?, openingBalance?, sortOrder?, date? }` | admin; 201 `{ account, entry }` |
| PATCH | `/accounts/:id` | `{ name?, type?, details?, sortOrder? }` | admin |
| POST | `/accounts/:id/archive` | — | admin; 400 if balance ≠ 0, Cash Drawer, mapped, or pending cheques |
| POST | `/accounts/:id/restore` | — | admin |
| PUT | `/accounts/reorder` | `{ order: [id,…] }` | admin |
| POST | `/accounts/:id/opening-balance` | `{ amount, date?, note? }` | once per account |
| GET / PUT | `/settings` | PUT `{ methodAccounts: { card: id\|null, … } }` | PUT admin; `cash` can't be null |
| GET | `/entries` | `account=<id\|all>, type, direction, startDate, endDate, referenceType, referenceId, q, page, limit≤100` | `{ entries, dailySummary, rangeSummary, pagination }` |
| GET | `/summary` | `account, startDate, endDate` | same shape as `/cashbook/summary` + `byAccount` when `all` |
| GET | `/balances` | `asOf?` | balances at a moment |
| GET | `/transfers` | `page, limit, startDate, endDate` | `{ transfers: [{ transferId, date, from, to, amount, fee, note, isReversal, reversedBy }] }` |
| POST | `/transfers` | `{ fromAccountId, toAccountId, amount, fee?, date?, note? }` | `cashbook.transfer` |
| POST | `/transfers/:transferId/reverse` | `{ note? }` | 400 if already reversed or "to" account short |
| POST | `/deposit`, `/withdraw` | `{ accountId, amount, description?, note?, date? }` | withdraw refused if short |
| POST | `/adjustments` | `{ accountId, direction: in\|out, amount, reason, date?, note? }` | admin; may go negative |
| GET | `/cheques` | `status=pending\|cleared\|cancelled, account, page, limit` | 404 `CHEQUE_TRACKING_OFF` if never on |
| POST | `/cheques/:entryId/clear` | `{ date? }` | money leaves bank now; refused if short |
| POST | `/cheques/:entryId/cancel` | `{ reason }` | no money moves; does NOT undo the supplier/expense payment |

`AccountRow`:
```json
{ "_id": "…", "name": "Cash Drawer", "type": "cash", "systemKey": "cash_drawer",
  "details": { "bankName": "", "accountTitle": "", "accountTail": "", "walletNumber": "", "note": "" },
  "balance": 18450, "openingBalance": 0, "pendingCheques": { "count": 0, "amount": 0 },
  "isActive": true, "sortOrder": 0, "today": { "totalIn": 6200, "totalOut": 1500, "entries": 14 },
  "lastEntryAt": "…", "methods": ["cash"], "archivedAt": null }
```
`systemKey`: `cash_drawer` (never archivable), `bank_online`, or `null`.

Entry rows: like the old cash book entries plus `account: {_id,name,type}`, `counterAccount`, `method`, `effectiveDate` (the day the money moved — group and show by this, not `createdAt`), `balanceAfter` (**null when the list is filtered** — then hide the balance column), `transferId`, `reversalOf`, `reason`, `chequeStatus`.

New entry types to label (old app showed raw strings): `transfer_out` "Transfer out", `transfer_in` "Transfer in", `transfer_fee` "Transfer fee", `adjustment` "Adjustment", `refund_reversal` "Refund reversed". Existing: `opening_balance, manual_deposit, manual_withdrawal, sale_collection, vendor_payment, customer_refund, expense, sale_cancel, expense_reversal`.

`date` (back-dating) for transfers / deposit / withdraw / adjustment / opening: `YYYY-MM-DD` or ISO; must be after the last store closing (`PERIOD_CLOSED` 400) and not in the future.

Method → allowed account types (`compatibility` from `GET /settings`, don't hard-code):
`cash: [cash]`, `card: [card_machine, bank]`, `online: [wallet, bank]`, `bank_transfer: [bank]`, `cheque: [bank]`, `other: any`. `store_credit` / `ledger_adjust` / `vendor_credit` never get an account.

Other error codes: `ACCOUNT_TYPE_MISMATCH`, `ACCOUNT_NOT_FOUND`, `ACCOUNT_ARCHIVED`, `MONEY_BOOK_NOT_READY`, `CHEQUE_TRACKING_OFF`. Show `message` from the server.

## 4. New fields on existing endpoints (send only when ON)

| Screen / API fn | Endpoint | Add |
|---|---|---|
| POS checkout `createBill` (`Dashboard.jsx` ~1387) | `POST /bill` | `payments[].accountId` |
| POS add-to-bill `addBillItems` (`Dashboard.jsx` ~1299) | `POST /bill/:id/add-items` | `payment.accountId` |
| `addBillPayment` | `POST /bill/:id/payment` | `accountId` |
| Customer collect (`CustomerLedger.jsx`, `collectFromCustomer`) | `POST /customer/:id/collect` | `accountId` |
| Supply create (`Vendors.jsx`, `createSupply`, multipart) | `POST /supply` | `paymentAccountId`, `chequeNumber?`, `chequeDate?` |
| Supply pay (`paySupply`) | `PATCH /supply/:id/pay` | `accountId`, `chequeNumber?`, `chequeDate?` |
| Vendor FIFO pay (`VendorLedger.jsx`, `payVendor`) | `POST /vendor/:id/pay` | `accountId`, `chequeNumber?`, `chequeDate?` |
| Expense create/update (`Expenses.jsx`) | `POST/PATCH /expense` | `accountId`, `chequeNumber?`, `chequeDate?`; method `online` now allowed |
| Expense approve (`approveExpense`) | `POST /expense/:id/approve` | optional body `{ accountId }` (change `approveExpense(id)` to accept a body) |
| Walk-in return (`Returns.jsx`, `processReturn`) | `POST /bill/:id/return` | `refundAccountId` (walk-in only; default Cash Drawer) |
| Standalone refund (`createStandaloneRefund`) | `POST /bill/returns/standalone` | `refundAccountId` |
| Closing preview (`Closing.jsx`) | `GET /closing/preview` | `accountCounts=<id>:<amount>,<id>:<amount>` |
| Closing save | `POST /closing` | `accountCounts: [{ accountId, counted }]` |

New outputs: `bill.payments[].account`, `returns[].refundAccount`, return response `refundAccount`, cancel-return response `refundReversed[]`, cancel-sale response `reversed: [{accountId,name,amount}]` (keeps `cashReversed`), dashboard summary `moneyBook: { total, byType, accounts }` (null when OFF; keeps `cashBalance`), closing `accountReconciliation[]` + `totalMoneyExpected`.

Sending `accountId` is optional: if omitted the server uses the method's mapped account. Send it whenever the picker is shown (simplest), `null`/omit for `store_credit`.

## 5. Screens to build / change

### 5.1 Money Book page (replace Cash Book when ON)
Route `/cashbook` stays (sidebar `Layout.jsx` lines ~51/69 → label "Money Book" when ON). When OFF render the existing `CashBook.jsx` unchanged — put the new page in a new file (e.g. `screens/MoneyBook.jsx`) and switch on the flag.
- **Header cards:** total money, split by type, one card per account (balance, today in/out, pending cheques badge). From `GET /accounts`.
- **Tabs:** "All" + one per active account (sortOrder).
- **Table:** `GET /entries?account=…` with date range, type and direction filters, paging. Group rows by local day of `effectiveDate` using `dailySummary` for opening/closing per day; show `balanceAfter` (hide column when filtered). In "All", show an account chip per row. Transfer rows show "→ To: X" / "← From: X" (`counterAccount`).
- **Range summary** strip from `rangeSummary`.
- **Actions:** Deposit, Withdraw (`cashbook.manage`), Transfer (`cashbook.transfer`; from/to dropdowns, amount, fee, date, note; show from-balance and block client-side if amount+fee > balance), Adjustment (admin only; reason required), "Reverse" on a transfer row (confirm dialog).
- **Transfers list** (tab or drawer) from `GET /transfers`, showing reversed state.
- **Pending cheques** panel, only when `chequeTracking` or the list returns data: clear (date picker) / cancel (reason). Explain on cancel that the supplier/expense payment itself stays recorded.
- **Go-live banner:** if the Bank / Online account (`systemKey: bank_online`) has `openingBalance === 0` → banner "Enter your bank / online opening balance from today's statement" with a button opening the opening-balance dialog (`POST /accounts/:id/opening-balance`). Hide once set.

### 5.2 Account settings (admin) — in `Settings.jsx` (new section) or inside the Money Book page
- List accounts (incl. archived toggle), add (name, type, bank name / account title / last 4 digits / wallet number / note, opening balance), edit, archive/restore (show server error text), drag or arrow reorder (`PUT /accounts/reorder`).
- **Payment method → account mapping**: one row per method (cash, card, online, bank_transfer, other, and cheque only if `chequeTracking`), dropdown filtered by `compatibility[method]`, plus "Don't record" for non-cash. `PUT /settings`.
- Never ask for or show full account numbers; only last digits.

### 5.3 Reusable `AccountPicker` component
`<AccountPicker method value onChange amount direction="in|out" anyType? />`
- Options = active accounts whose type is in `compatibility[method]` (or all active when `anyType`, used for walk-in refunds).
- Default = `methodAccounts[method]` (for refunds: `cashDrawer`).
- Shows each account's balance **when it has them** (from `/accounts`; not from `/accounts/picker`); for `direction="out"` show red "Insufficient — available Rs X" and let the parent block submit when `amount > balance` (pending cheques skip this check).
- Hidden when only one option exists? Still send its id. Hidden for `store_credit`.
- Use it in: POS checkout (each payment row, incl. split payments), POS add-items payment, bill add-payment, customer collect, supply create + pay, vendor pay, expense form + approve dialog, returns refund (walk-in), standalone refund.

### 5.4 Replace cash-only balance checks (when ON)
These read `getCashBalance()` and block only cash today; switch them to the **selected account's** balance for every method:
- `Expenses.jsx` (~145–160, ~561), `Returns.jsx` (~93, ~466, ~548, ~1027), `Vendors.jsx` (~314), `VendorLedger.jsx` (~264). When OFF keep current behaviour.
- Expense **approve** must also check (server blocks approval when short).
- Always handle the server's `INSUFFICIENT_BALANCE` gracefully (another cashier may have spent it): show `message`, keep the form open.

### 5.5 Methods
- Expenses: add **Online** method.
- `cheque` option (expense, supply, vendor): show only when `chequeTracking` is true; then show cheque number + cheque date fields. When OFF hide it.

### 5.6 Dashboard
Keep "Cash in hand" (`data.cashBalance.balance`, ~2945). When `data.moneyBook` is not null add a "Total money" card with per-account breakdown.

### 5.7 Store Closing (`Closing.jsx`, `ClosingDetail.jsx`, `ClosingReport.jsx`)
When `accountReconciliation` is present: table per account — opening, in, out, expected, **counted / statement** input, variance, reconciled ✓/✗. Send `accountCounts` on preview and save. Keep existing cash/card/online tender inputs working (old closings lack the array — `ClosingDetail` must handle both). If the drawer is counted via `accountCounts` you don't need to also send `countedCash`.

### 5.8 Bills / receipts / returns display
Where payments are listed (receipt detail, customer ledger), show the account name next to the method when `payments[].account` is set (map ids via the accounts list). After cancelling a sale, show `reversed[]` ("Rs 600 back from Cash Drawer, Rs 400 from Bank / Online").

### 5.9 Permissions UI
Employee access editor (`Employees.jsx` / access screen): add **"Transfer between accounts"** checkbox → `permissions.cashbook.transfer`. Hide transfer buttons without it; hide account/mapping/adjustment controls for non-admins.

## 6. Edge cases to handle
- Server says 409 `MONEY_BOOK_NOT_READY` mid-session (shouldn't happen, but) → fall back to OFF mode.
- Archived account still selected in a draft → reload accounts, reset to default.
- Negative balances can exist (after a sale cancel / adjustment) — display with minus sign in red.
- Amounts: round to 2 decimals; server validates `precision(2)`.
- Offline / sync code (`docs/OFFLINE_MODE_ARCHITECTURE.md`): if bills are queued offline, the stored `accountId` must still be valid when synced; if the server rejects with `ACCOUNT_*`, retry without `accountId` (server falls back to the mapped account) and surface a warning. Read that doc before touching checkout.
- Old servers: never send new fields unless §2 detection said ON.

## 7. Out of scope
- Backend changes (report any API gap instead of working around it).
- Hold-bill money (intentionally not recorded).
- Backfilling old card/online payments (not done by design).

## 8. Acceptance checklist
- [ ] OFF shop / old server: app behaves byte-for-byte like today (no new fields sent, old Cash Book).
- [ ] ON: Money Book page with All + per-account tabs, day groups, balances, filters, paging.
- [ ] Transfer with fee, reverse, deposit, withdraw, adjustment (admin), opening balance + go-live banner.
- [ ] Account CRUD, reorder, archive rules surfaced, method mapping with compatibility filtering.
- [ ] AccountPicker in every payment flow in §5.3; split payments can use different accounts.
- [ ] Balance checks use the selected account; `INSUFFICIENT_BALANCE` handled everywhere.
- [ ] Online expense method; cheque UI only with `chequeTracking`; pending cheques clear/cancel.
- [ ] Closing per-account reconciliation (new + old closings render).
- [ ] Dashboard total money; receipts show account; cancel shows `reversed[]`.
- [ ] `cashbook.transfer` permission in the access editor.
- [ ] `npm run build` passes; tested in `npm run electron:dev` against a local backend with a switched-on shop.

## 9. Phases
1. **Read & plan** — read this file, the backend plan doc, and the screens listed. Write `docs/money-book-frontend-plan.md` (components, files touched, state/context design, how ON/OFF is gated). **Stop for approval.**
2. **Foundation** — `services/api/moneyBook.js`, context + detection, `AccountPicker`, entry-type labels.
3. **Money Book page + account settings + mapping.**
4. **Payment flows** (POS, collect, supplier/vendor, expenses, returns, refunds) + balance checks.
5. **Closing, dashboard, receipts, permissions.**
6. Build, manual test, summary of changed files. **Ask before any commit.**
