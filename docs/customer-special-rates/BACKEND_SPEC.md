# Backend Spec — Customer Special Rates

> Hand-off document for the backend (Node.js / MongoDB / Express) repo.
> The desktop frontend will be built against exactly this contract. If anything
> here conflicts with how the backend is structured, keep the **request/response
> shapes and field names** identical and adapt the internals.

---

## 1. What the feature is

A business can save a **fixed per-unit price ("special rate")** for a product on a
specific customer's profile.

Example: Pepsi normally sells for Rs 100. Customer *Ali* has a special rate of
**Rs 90**. Whenever Ali is attached to a bill in the POS and Pepsi is added, the
POS automatically applies Rs 10 off per unit.

- Rates are created from the POS (after the cashier gives a discount → "Save as Ali's rate?")
  or from the Customers screen (Special Rates tab).
- The POS reads rates from the customer object it already fetches — so rates
  must be included in customer responses (this also makes them available in the
  offline SQLite cache, which stores the raw customer document).
- The backend stores the product's selling price at the moment the rate was saved
  (`priceWhenSaved`) so the POS can warn when the product price has changed since.
- A rate may be beyond the product's `maxDiscountPercent` limit or even below cost.
  Saving is allowed; the POS asks the cashier what to do at sale time. Selling
  beyond the limit requires a new permission (see §5).

---

## 2. Data model changes

### 2.1 Customer — add `specialRates`

```js
const SpecialRateSchema = new mongoose.Schema(
  {
    product:        { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    rate:           { type: Number, required: true, min: 0 },   // fixed price per unit
    priceWhenSaved: { type: Number, required: true, min: 0 },   // product.sellingPrice at save time (server-set)
    note:           { type: String, trim: true, maxlength: 200, default: '' },
    updatedBy:      { type: mongoose.Schema.Types.ObjectId, ref: 'User' },     // use whatever model holds admins/employees
    updatedByName:  { type: String, default: '' },
    updatedAt:      { type: Date, default: Date.now },
  },
  { _id: false }
);

// inside CustomerSchema
specialRates: { type: [SpecialRateSchema], default: [] },
```

Rules:
- **One rate per product per customer.** `product` is unique inside the array
  (enforce in the service layer — upsert by product id).
- No migration needed: existing customers just have `specialRates: []`
  (treat missing as empty everywhere).
- Money values: round to 2 decimals on write (`Math.round(x * 100) / 100`).

### 2.2 Bill item — add 3 fields

```js
// inside the bill item sub-schema
discountSource: { type: String, enum: ['manual', 'customerRate'], default: 'manual' },
customerRate:   { type: Number, default: null },   // the rate that was applied (per unit), for audit/reports
limitOverride:  { type: Boolean, default: false }, // true = cashier chose to sell beyond maxDiscountPercent cap
```

`discountAmount` stays exactly as it is today (**total Rs off for the whole line**,
not per unit). The frontend computes it as `(price - rate) * qty` for rated lines.

### 2.3 Employee permissions — add 2 actions to the `pos` module

Current shape (from `PUT /access/:employeeId` → `{ permissions }`):

```js
permissions.pos = { view, create, viewProfit }
```

New shape:

```js
permissions.pos = {
  view, create, viewProfit,
  saveCustomerRates, // can create/update/delete a customer's special rates
  sellBeyondLimit,   // can complete a bill where an item discount exceeds the product's maxDiscountPercent cap
}
```

- Default `false` for existing employees.
- Admins bypass all checks (same as today — `permissions` is `null` for admins).
- Make sure whatever validates/whitelists permission keys in `PUT /access/:employeeId`
  accepts the two new keys, and that the endpoint that returns the logged-in user's
  permissions (used by `AuthContext`) returns them.

---

## 3. Customer responses must include `specialRates`

Include the **lean** array (no populate) in all of these:

| Endpoint | Change |
|---|---|
| `GET /customer` (paged list) | include `specialRates` on each customer |
| `GET /customer/search?q=` | include `specialRates` (POS uses this to attach a customer) |
| `GET /customer/:id` | include `specialRates` |
| `POST /customer`, `PATCH /customer/:id` responses | include `specialRates` |
| Any endpoint the offline sync uses to pull customers | include `specialRates` |

Lean item shape in these responses:

```json
{
  "product": "66f1c0...a1",
  "rate": 90,
  "priceWhenSaved": 100,
  "note": "wholesale",
  "updatedByName": "Ahmed",
  "updatedAt": "2026-09-29T10:15:00.000Z"
}
```

The POS already has the full product list in memory, so it does not need product
details populated here.

---

## 4. New endpoints

All routes are scoped to the logged-in user's business (same auth middleware as
the other `/customer` routes). A customer/product from another business → `404`.

### 4.1 `GET /customer/:id/rates` — list with product details (management screens)

Response `200`:

```json
{
  "rates": [
    {
      "product": {
        "_id": "66f1c0...a1",
        "name": "Pepsi 500ml",
        "barcode": "8961234567",
        "sellingPrice": 120,
        "costPrice": 80,
        "maxDiscountPercent": 50
      },
      "rate": 90,
      "priceWhenSaved": 100,
      "note": "wholesale",
      "updatedByName": "Ahmed",
      "updatedAt": "2026-09-29T10:15:00.000Z",
      "priceChanged": true,
      "belowCost": false,
      "beyondLimit": true
    }
  ]
}
```

Computed flags (server-side, using the product's **current** values):
- `priceChanged` = `product.sellingPrice !== priceWhenSaved`
- `belowCost`    = `rate < product.costPrice`
- `beyondLimit`  = `(product.sellingPrice - rate) > maxAllowedDiscountPerUnit` where
  `maxAllowedDiscountPerUnit = max(0, sellingPrice - costPrice) * (maxDiscountPercent / 100)`;
  if `maxDiscountPercent` is `null/undefined`, the cap is the full profit
  (`sellingPrice - costPrice`). This mirrors `getItemDiscountCap` in the frontend.

Rates whose product was **deleted** must be removed from the response (and
ideally pruned from the document — see §6).

Permission: anyone who can view customers.

### 4.2 `PUT /customer/:id/rates/:productId` — create or update ONE rate (POS prompt)

Request:

```json
{ "rate": 90, "note": "wholesale" }
```

Server logic:
1. Permission: admin, or `permissions.pos.saveCustomerRates === true` → else `403`.
2. Load customer + product (same business) → else `404`.
3. Validate: `rate` is a number, `rate >= 0`, and `rate < product.sellingPrice`
   → else `400` (`"Rate must be lower than the selling price"`).
4. Upsert into `specialRates` by `product`:
   `rate`, `note`, `priceWhenSaved = product.sellingPrice` (server-set, never from client),
   `updatedBy`, `updatedByName`, `updatedAt = now`.
5. Save atomically (`findOneAndUpdate` with `arrayFilters` / or pull+push inside
   one update — avoid read-modify-write races).

Response `200`:

```json
{
  "rate": { "product": "66f1...", "rate": 90, "priceWhenSaved": 100, "note": "wholesale", "updatedByName": "Ahmed", "updatedAt": "..." },
  "warnings": ["BEYOND_LIMIT"],
  "specialRates": [ /* full lean array after the change */ ]
}
```

`warnings` may contain `"BELOW_COST"` and/or `"BEYOND_LIMIT"` (computed like §4.1).
They are informational — the save still succeeds.

### 4.3 `DELETE /customer/:id/rates/:productId` — remove one rate

- Permission: same as 4.2.
- Removing a rate that doesn't exist → still `200` (idempotent).

Response `200`: `{ "specialRates": [ /* array after removal */ ] }`

### 4.4 `PUT /customer/:id/rates` — replace the whole list (Customers screen "Save")

Request:

```json
{
  "rates": [
    { "product": "66f1...a1", "rate": 90, "note": "wholesale" },
    { "product": "66f1...b2", "rate": 45, "note": "" }
  ]
}
```

Server logic:
- Permission: same as 4.2.
- Reject duplicate product ids in the payload → `400`.
- Validate every product belongs to the business and every rate as in 4.2 → `400`
  with the offending product id in the message.
- For each entry: if the product already had a rate **with the same `rate` value**,
  keep its existing `priceWhenSaved`/`updatedAt`/`updatedBy`; otherwise set
  `priceWhenSaved = product.sellingPrice` and stamp `updatedBy`/`updatedAt = now`.
  (So opening the modal and saving without changes does not silently clear the
  "price changed" warning.)
- Products not in the payload are removed.

Response `200`: `{ "specialRates": [...], "warnings": [{ "product": "...", "codes": ["BELOW_COST"] }] }`

### 4.5 `POST /customer` — accept rates on create (optional field)

`POST /customer` accepts an optional `specialRates: [{ product, rate, note }]`
with the same validation and permission rule as 4.4 (if the user lacks
`saveCustomerRates`, ignore the field or return `403` — prefer `403` so the UI
can tell the user). `priceWhenSaved` is server-set.

`PATCH /customer/:id` must **not** touch `specialRates` (strip it if sent) —
edits go through the `/rates` endpoints only.

---

## 5. Bill creation changes (`POST /bill`)

The frontend will send, per item:

```json
{
  "product": "66f1...a1",
  "name": "Pepsi 500ml",
  "qty": 2,
  "price": 100,
  "costPrice": 80,
  "gst": 0,
  "discountAmount": 20,
  "discountSource": "customerRate",
  "customerRate": 90,
  "limitOverride": false
}
```

Server rules:
1. Persist `discountSource`, `customerRate`, `limitOverride` on the bill item
   (defaults: `'manual'`, `null`, `false` when absent — old clients keep working).
2. `discountSource: 'customerRate'` is only valid when the bill has a `customer`
   → otherwise treat it as `'manual'`.
3. **Discount cap:** if the backend currently validates/caps
   `discountAmount` against `maxDiscountPercent`:
   - keep that behaviour for normal lines;
   - if `limitOverride === true` **and** the user is admin or has
     `permissions.pos.sellBeyondLimit`, skip the cap for that line;
   - if `limitOverride === true` but the user lacks the permission → `403`
     (`"You are not allowed to sell beyond the discount limit"`).
   If the backend does **not** validate the cap today, just store the flag.
4. Always enforce: `0 <= discountAmount <= price * qty` (a line can never go negative).
5. Do **not** re-derive the discount from the customer's saved rate on the
   server — the bill stores what the cashier actually charged (the cashier may have
   chosen "sell at limit price" or "remove for this bill").
6. Offline bills arrive later via the outbox and are authenticated with the
   cashier's token → same rules apply.

Nothing changes in the receipt/print payload — special-rate lines are printed as
normal item discounts.

---

## 6. Housekeeping

- **Product deleted:** remove it from every customer's `specialRates`
  (`Customer.updateMany({ business }, { $pull: { specialRates: { product: id } } })`)
  in the product delete handler. Also filter out unknown products in §4.1.
- **Customer deleted:** nothing extra (rates live on the document).
- **Index (optional):** `{ business: 1, 'specialRates.product': 1 }` on Customer if
  you add the product-delete cleanup or a "which customers have a rate for this
  product" report later.

---

## 7. Reports (optional, nice-to-have)

`GET /bill/report/discounts` — add a breakdown by `discountSource`
(`manual` vs `customerRate`) and a count/amount of lines with `limitOverride: true`.
Not required for the first release; the frontend won't depend on it.

---

## 8. Error format

Use the existing error shape (`{ message }`) — the frontend shows
`err.response.data.message`.

| Case | Status | message |
|---|---|---|
| no permission to save rates | 403 | `You are not allowed to save customer rates` |
| no permission to sell beyond limit | 403 | `You are not allowed to sell beyond the discount limit` |
| customer/product not found or other business | 404 | `Customer not found` / `Product not found` |
| rate >= selling price, negative, NaN | 400 | `Rate must be lower than the selling price` |
| duplicate product in bulk payload | 400 | `Duplicate product in rates` |

---

## 9. Acceptance checklist

- [ ] `specialRates` appears in `GET /customer`, `/customer/search`, `/customer/:id`, create/patch responses, and the offline sync pull.
- [ ] `PUT /customer/:id/rates/:productId` upserts (second call with same product updates, doesn't duplicate) and sets `priceWhenSaved` from the product.
- [ ] Client-sent `priceWhenSaved` is ignored.
- [ ] `warnings` returns `BELOW_COST` / `BEYOND_LIMIT` correctly; save still succeeds.
- [ ] Rate >= selling price → 400.
- [ ] Employee without `pos.saveCustomerRates` → 403 on all write endpoints; admin always allowed.
- [ ] `PUT /customer/:id/rates` keeps `priceWhenSaved` for unchanged rates, replaces the list, rejects duplicates.
- [ ] `PATCH /customer/:id` ignores `specialRates`.
- [ ] `GET /customer/:id/rates` populates product and computes `priceChanged` / `belowCost` / `beyondLimit`.
- [ ] Deleting a product removes it from customers' `specialRates`.
- [ ] `POST /bill` stores `discountSource`, `customerRate`, `limitOverride`; old clients (no fields) still work.
- [ ] `limitOverride: true` without `pos.sellBeyondLimit` → 403 (only if cap is enforced server-side).
- [ ] `PUT /access/:employeeId` accepts and persists `pos.saveCustomerRates` and `pos.sellBeyondLimit`; the current-user permissions endpoint returns them.
