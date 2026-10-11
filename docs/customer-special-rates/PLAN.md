# Customer Special Rates — Plan

Save a fixed per-unit price for a product on a customer's profile, and auto-apply
it in the POS whenever that customer buys that product.

Backend contract: see [BACKEND_SPEC.md](./BACKEND_SPEC.md).

---

## 1. Decisions

| # | Topic | Decision |
|---|---|---|
| 1 | Discount type | **Fixed price per unit** ("Ali's rate is Rs 90") |
| 2 | Product price changed since the rate was saved | Still apply the rate + ⚠ icon → **Keep rate / Update rate / Remove for this bill** |
| 3 | Rate beyond `maxDiscountPercent` limit or below cost | Alert → cashier picks **Sell at limit price** or **Sell at customer's rate**; red + loss amount if below cost |
| 4 | Permissions | New `pos.saveCustomerRates` and `pos.sellBeyondLimit`; admin always has both |
| 5 | Save prompt | Right after each item discount is committed (Enter / blur) |
| 6 | Management UI | Customer add/edit modal (Details \| Special Rates tabs) **and** a tab on the Customer Ledger page |
| 7 | Offline | Rates live on the customer document → cached offline automatically. Saving a rate is **online-only** |
| 8 | Receipt | Unchanged — printed as a normal item discount |

Defaults (not asked, change if needed):
- Discount given with **no customer attached** → no save prompt.
- Line already has a **manual** discount when a customer is attached → keep the manual one; rates only fill lines without a discount.
- **Bill-level discount** keeps today's rule: setting it clears all item discounts, rated ones included.

---

## 2. Split of work

| Area | Owner | Blocks |
|---|---|---|
| Customer `specialRates` field + rates endpoints | Backend | Frontend phases 2–4 |
| Bill item fields (`discountSource`, `customerRate`, `limitOverride`) | Backend | Frontend phase 3 checkout |
| New `pos` permissions | Backend | Frontend phase 5 |
| POS auto-apply, prompts, alerts | Frontend | — |
| Customers / Ledger Special Rates UI | Frontend | — |
| Employees permission checkboxes | Frontend | — |

Order: **Backend first** (whole spec) → frontend phases 1–5. Frontend phase 1 can
start in parallel since it only adds API wrappers and shared helpers.

---

## 3. Frontend plan (this repo)

### Phase 1 — API + shared helpers
- `src/services/api/customers.js`
  - `getCustomerRates(id)` → `GET /customer/:id/rates`
  - `saveCustomerRate(id, productId, { rate, note })` → `PUT /customer/:id/rates/:productId`
  - `deleteCustomerRate(id, productId)` → `DELETE /customer/:id/rates/:productId`
  - `replaceCustomerRates(id, rates)` → `PUT /customer/:id/rates`
- `src/utils/specialRates.js` (new)
  - `buildRateMap(specialRates)` → `{ [productId]: rateObj }`
  - `getRateStatus(product, rateObj)` → `{ priceChanged, belowCost, beyondLimit, limitPrice, lossPerUnit }`
    (reuses the same cap math as `getItemDiscountCap` in `Dashboard.jsx`)
  - `canSaveRates(permissions)`, `canSellBeyondLimit(permissions)` (admin = `permissions === null`)

### Phase 2 — POS: apply rates (`src/screens/Dashboard.jsx`)
- Bill state gets `customerRates` (map) — persisted with the bill via `saveBills`.
- Line items get `discountSource` (`'manual' | 'customerRate'`), `customerRate`, `limitOverride`.
- `attachCustomer` → build the map from `customer.specialRates`; apply to existing
  lines that have no discount; toast "N special rates applied for Ali".
- `detachCustomer` → clear lines with `discountSource === 'customerRate'`, clear map.
- `addProductToBill` / `updateQuantity` / `setItemQuantity` → for rated lines
  recompute `discountAmount = (price - rate) * qty`.
- Manual edit of a rated line's discount → becomes `discountSource: 'manual'`.
- Line UI: badge "🏷 Ali's rate: Rs 90".

### Phase 3 — POS: warnings & choices
- **Price changed** (`priceChanged`): ⚠ icon on the line → popover with
  *Keep rate* / *Update rate* (calls `saveCustomerRate` with the new rate, needs
  permission) / *Remove for this bill*.
- **Beyond limit / below cost**: when a rated line is added, show `appConfirm`-style
  dialog: *Sell at Rs X (limit)* vs *Sell at Rs Y (customer's rate)*. Second option
  only if `canSellBeyondLimit`; sets `limitOverride: true`. Red styling + "You will
  lose Rs Z" when below cost. Ask once per line per bill.
- `setItemDiscount` must not re-cap a line that has `limitOverride: true`.
- Checkout: send `discountSource`, `customerRate`, `limitOverride` per item in `createBill`.

### Phase 4 — POS: save prompt
- Commit point = discount input `onBlur` / Enter (not `onChange`).
- Conditions: customer attached, discount > 0, user `canSaveRates`, online, and the
  resulting unit price differs from the saved rate.
- `appConfirm("Save Rs 90 as Ali's rate for Pepsi?")` → `saveCustomerRate`, update
  the bill's rate map and the line's `discountSource`; show backend `warnings` as a toast.
- Offline → toast "Can't save rate while offline".
- Use `appConfirm` / `appAlert` only (native dialogs freeze inputs on Windows).

### Phase 5 — Management screens
- `src/components/SpecialRatesEditor.jsx` (new, shared): product search, rate input,
  note, list with edit/delete, ⚠ badges from `getRateStatus`.
- `src/screens/Customers.jsx`: modal tabs **Details | Special Rates**. Create → send
  `specialRates` in `POST /customer`; edit → `replaceCustomerRates`. Hide/disable the
  tab without `saveCustomerRates`.
- `src/screens/CustomerLedger.jsx`: **Special Rates** tab using `getCustomerRates`
  (read-only without permission).
- `src/screens/Employees.jsx`: add `saveCustomerRates`, `sellBeyondLimit` to the
  `pos` module actions + labels.

### Phase 6 — Offline branch follow-up
- When `feat/offline-billing` merges: confirm the customer sync pull includes
  `specialRates` (it stores the raw document, so no schema change) and that the
  save prompt is blocked offline.

---

## 4. Test checklist (frontend)

- [ ] Attach Ali → rated products in cart get the discount + badge; qty change recalculates.
- [ ] Add rated product after attaching → auto-applied.
- [ ] Detach → only rated discounts removed; manual ones stay.
- [ ] Manual discount → prompt → Yes → rate saved; next bill applies it.
- [ ] Product price changed → ⚠ with Keep / Update / Remove working.
- [ ] Rate beyond limit → dialog; without `sellBeyondLimit` only the limit option shows.
- [ ] Below cost → red dialog with loss amount.
- [ ] Bill discount still clears item discounts.
- [ ] Employee without `saveCustomerRates` → no prompt, tab read-only.
- [ ] Offline → rates still apply, save prompt blocked.
- [ ] Windows: no input freeze after dialogs.
- [ ] Receipt prints as before.

---

## 5. Backend as built (differences from BACKEND_SPEC.md)

- Server discount cap now uses the frontend formula (% of profit); bill-level cap too.
- `limitOverride: true` skips the % cap and the cost floor, needs `pos.sellBeyondLimit`
  (403 otherwise, even if the line is within the limit) — only send it on lines that are
  really beyond the limit.
- New business setting `business.settings.allowSellBelowCost` (default false). Off → any
  below-cost line is rejected (400 "Cannot sell X below cost price"), even for admins.
  Saved with `PUT /admin/business/settings`, which **replaces the whole settings object**.
  Frontend: admin-only toggle in Settings → Business; POS offers "limit price" / "remove
  rate for this bill" instead of "sell at rate" when a rate is below cost and it's off.
- Products are soft-deleted: inactive products are hidden from `GET /customer/:id/rates`
  and cleaned up automatically, but may linger briefly in the raw `specialRates`.
- `POST /customer` saves `specialRates` only when the customer is new (phone not found).
- `PATCH /customer/:id` ignores `specialRates`; a PATCH with only that → 400.
- Replace-all errors include the product id: "Product not found: <id>",
  "Rate must be lower than the selling price (product <id>)".
- New errors: "Discount on X exceeds the item total", "Cannot sell X below cost price".
- `/bill/hold` stores the new fields but doesn't check the cap (desktop doesn't use it).
