# Offline Mode Architecture — POS Inventory Desktop

**Status:** Design proposal
**Author:** Architecture
**Audience:** The developer implementing this (you)
**Repos in scope:**
- Frontend / desktop: `pos-inventory-desktop` (Electron 28 + React 18 + Vite)
- Backend: `pos-inventory-backend` (Node + Express + Mongoose, Vercel serverless)

---

## 0. TL;DR — what this design decides

- **Local store:** SQLite via **`better-sqlite3`** running in the **Electron main process**, one DB file per `business` under `app.getPath('userData')`. Renderer talks to it over IPC. (Not IndexedDB/Dexie, not PouchDB — reasons in §2.)
- **Offline billing** works entirely against the local SQLite cache of products/customers, writing each finished bill into a local **`outbox`** table with a client-generated **UUID v4 `idempotencyKey`** and a client receipt number.
- **Exactly-once sync** rides on infrastructure the backend **already has**: `createBill` already accepts `idempotencyKey`, there is already a **unique partial index on `{ idempotencyKey }`**, and it already returns `409 { alreadyPaid, bill }` on a duplicate. We harden and lean on this. The client is the source of the key; the DB unique index is the enforcement point; the server always returns the canonical bill (incl. server `billNumber`) so the client can reconcile.
- **Receipt number vs billNumber:** the offline receipt prints a **client receipt number** (`OFF-<terminalId>-<seq>`). The authoritative server `billNumber` is assigned at sync time and stored back on the outbox row as `serverBillNumber`. The two are mapped 1:1 forever via the `idempotencyKey`.
- **Pull sync:** full pull on first login, then **incremental delta** by `updatedAt` cursor through **new dedicated endpoints** (`GET /sync/products?since=`, `GET /sync/customers?since=`) that page internally and are not subject to the `limit≤100` list cap.
- **Backend changes are small and backward-compatible:** 3 new sync endpoints, a few new fields on `Bill` (`clientBillId`, `source`, `clientCreatedAt`), one behavioural fix in `createBill` (return `200` with the canonical bill on idempotent replay instead of a semantics-muddying `409`), and confirmation that the `idempotencyKey` unique index is deployed. No schema migration that rewrites existing rows.

---

## 1. High-level architecture

### 1.1 Component diagram

```
┌──────────────────────────────────────────────────────────────────────────┐
│  ELECTRON DESKTOP APP (one machine = one "terminal")                       │
│                                                                            │
│  ┌────────────────────────────┐        ┌──────────────────────────────┐   │
│  │  RENDERER (React)          │  IPC    │  MAIN PROCESS (Node)         │   │
│  │                            │◄───────►│                              │   │
│  │  Sales.jsx  Customers.jsx  │         │  ┌────────────────────────┐  │   │
│  │  Inventory.jsx  ...        │         │  │ LocalDB (better-sqlite3│  │   │
│  │                            │         │  │  file per business)    │  │   │
│  │  ┌──────────────────────┐  │         │  │  products, customers,  │  │   │
│  │  │ offlineApi facade    │  │         │  │  outbox, sync_meta     │  │   │
│  │  │ (reads local,        │  │         │  └────────────────────────┘  │   │
│  │  │  queues writes)      │  │         │                              │   │
│  │  └──────────────────────┘  │         │  ┌────────────────────────┐  │   │
│  │                            │         │  │ SyncEngine             │  │   │
│  │  online/offline banner ◄───┼─────────┼──│  - pull loop (delta)   │  │   │
│  │  outbox status UI          │         │  │  - push loop (outbox)  │  │   │
│  └────────────────────────────┘         │  │  - reachability probe  │  │   │
│                                         │  └───────────┬────────────┘  │   │
│                                         └──────────────┼───────────────┘   │
└─────────────────────────────────────────────────────────┼─────────────────┘
                                                          │ plain idempotent HTTPS
                                                          │ (Bearer JWT)
                                                          ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  BACKEND (Express on Vercel serverless — stateless, cold starts, no WS)    │
│                                                                            │
│   POST /bill  (idempotencyKey dedupe via unique index) ── MongoDB          │
│   GET  /sync/products?since=  GET /sync/customers?since=  GET /sync/cursor  │
│   POST /auth/refresh  (7-day opaque refresh token, rotated)                │
│                                                                            │
│   Transaction on write: Counter(billNumber) + stock -= + customer ledger   │
│                         + cashbook runningBalance                          │
└──────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Offline → online lifecycle

```
LOGIN (online required for first login of a business/terminal)
  │
  ├─ authenticate → get access JWT + 7-day refresh token
  ├─ FULL PULL: download ALL products + ALL customers into local SQLite
  │            store per-resource cursor (max updatedAt) in sync_meta
  └─ mark terminal "ready for offline"
        │
        ▼
ONLINE STEADY STATE
  ├─ every N seconds: reachability probe → if reachable:
  │     ├─ PUSH: drain outbox (idempotent) — usually empty
  │     └─ PULL: delta since cursor → upsert products/customers
  └─ billing writes go to outbox AND are pushed near-immediately
        │
        ▼  (internet drops)
OFFLINE
  ├─ reads served from local SQLite (products, customers)
  ├─ billing fully functional:
  │     ├─ validate stock/credit against LOCAL optimistic state
  │     ├─ assign client receipt number OFF-<terminal>-<seq>
  │     ├─ generate idempotencyKey = uuidv4()
  │     ├─ write bill row to outbox (status='pending')
  │     └─ decrement local stock / bump local customer balance (optimistic)
  └─ print receipt with client receipt number
        │
        ▼  (internet returns — detected by probe)
RECONNECT & SYNC-UP
  ├─ refresh access token if expired (using surviving refresh token)
  ├─ PUSH outbox in creation order, one bill at a time:
  │     ├─ POST /bill { idempotencyKey, clientBillId, clientCreatedAt, source:'offline', ... }
  │     ├─ 200/201 → store serverBillNumber + serverBillId, mark row 'synced'
  │     ├─ 200 idempotent-replay → same handling (already existed)
  │     └─ 4xx business rejection (out of stock / credit) → mark 'rejected', surface to cashier
  ├─ PULL delta (server truth now includes our just-synced bills' side effects)
  └─ RECONCILE: replace optimistic local stock/balance with server truth
```

The critical invariant: **the server is the single source of truth for money and stock.** The local optimistic state exists only so the cashier can keep selling; at every reconnect it is overwritten by the server's authoritative values.

---

## 2. Local storage choice

### 2.1 Options evaluated

| Option | Where it runs | Durability on crash | Transactions | Query power | Verdict |
|---|---|---|---|---|---|
| **better-sqlite3** | Main process (native) | Excellent (WAL, fsync, real ACID file) | Real, synchronous, nested | Full SQL, indexes, `LIKE`/FTS for barcode+name | **RECOMMENDED** |
| IndexedDB / Dexie | Renderer | Good, but tied to Chromium profile; opaque, harder to back up/inspect | Object-store txns only | Key-range + manual indexes; no SQL joins | Rejected |
| PouchDB | Renderer or main | Good | Doc-level | Map/reduce views; heavier | Rejected |

### 2.2 Why better-sqlite3

1. **Money-grade durability.** The outbox holds real, unsynced revenue. `better-sqlite3` in WAL mode gives real ACID commits to a file we control. If the app is killed mid-write, the outbox row is either fully written or not at all — no half-bill.
2. **Synchronous, real transactions.** Writing a bill = insert outbox row + decrement N product rows + bump a customer row. That must be one atomic local transaction. `better-sqlite3` transactions are synchronous and trivially correct (`db.transaction(fn)()`); no async interleaving bugs.
3. **Query needs fit SQL perfectly.** POS lookups are: barcode exact match, SKU exact match, name prefix/substring search, category filter. All are one indexed SQL query. Barcode scan latency must be sub-10ms; an indexed SQLite lookup is microseconds.
4. **Lives in the main process, off the renderer.** The renderer is where auth tokens and PII already live in `localStorage`; keeping the durable store in main means a renderer crash/reload doesn't touch it, and we get a clean IPC boundary to expose typed operations.
5. **Inspectable & backup-able.** A single `.sqlite` file per business can be copied for support/debugging. IndexedDB inside a Chromium profile cannot.
6. **Encryptable at rest** (see §8) via `better-sqlite3-multiple-ciphers` (SQLCipher) — same API, one swap.

**Cost:** `better-sqlite3` is a native module → it must be rebuilt for Electron's ABI (`electron-rebuild`) and listed in electron-builder's `asarUnpack`. This is a one-time build-config task, called out in Phase 0.

### 2.3 Where the file lives

```
app.getPath('userData')/
  offline/
    <businessId>/
      pos.sqlite          ← the store (WAL files alongside)
```

- **Namespaced per `businessId`** (multi-tenant isolation — §4 of the constraints). A different business logging in on the same machine gets a different file.
- On **logout**, the active business's file is closed and (optionally, per policy) deleted — see §8.3. Default: keep the file but wipe on a *different* business login or on explicit "clear offline data".

### 2.4 Schema (local SQLite)

```sql
-- ── Cached reference data (pulled from server) ───────────────────────
CREATE TABLE products (
  server_id        TEXT PRIMARY KEY,     -- Mongo _id
  name             TEXT NOT NULL,
  barcode          TEXT,
  sku              TEXT,
  category         TEXT,
  selling_price    REAL NOT NULL,
  cost_price       REAL DEFAULT 0,
  gst              REAL DEFAULT 0,
  max_discount_pct REAL,                 -- nullable
  track_stock      INTEGER DEFAULT 1,
  stock_quantity   REAL DEFAULT 0,       -- server truth (last pulled)
  local_stock_delta REAL DEFAULT 0,      -- optimistic offline adjustment (see §3.6)
  is_active        INTEGER DEFAULT 1,
  updated_at       TEXT NOT NULL,        -- server updatedAt ISO string (cursor source)
  deleted          INTEGER DEFAULT 0     -- soft-delete tombstone from delta sync
);
CREATE INDEX idx_products_barcode  ON products(barcode);
CREATE INDEX idx_products_sku      ON products(sku);
CREATE INDEX idx_products_name     ON products(name);
CREATE INDEX idx_products_category ON products(category);

CREATE TABLE customers (
  server_id        TEXT PRIMARY KEY,     -- Mongo _id
  name             TEXT NOT NULL,
  phone            TEXT,
  address          TEXT,
  credit_limit     REAL DEFAULT 0,
  balance          REAL DEFAULT 0,       -- server truth (last pulled)
  local_balance_delta REAL DEFAULT 0,    -- optimistic offline credit added
  is_active        INTEGER DEFAULT 1,
  updated_at       TEXT NOT NULL,
  deleted          INTEGER DEFAULT 0
);
CREATE INDEX idx_customers_phone ON customers(phone);
CREATE INDEX idx_customers_name  ON customers(name);

-- ── Outbox: pending offline writes (the money) ───────────────────────
CREATE TABLE outbox (
  client_bill_id   TEXT PRIMARY KEY,     -- uuidv4, also the app-level id
  idempotency_key  TEXT NOT NULL UNIQUE, -- uuidv4 sent to server for dedupe
  client_receipt_no TEXT NOT NULL,       -- OFF-<terminal>-<seq>, printed offline
  terminal_id      TEXT NOT NULL,
  local_seq        INTEGER NOT NULL,     -- per-terminal monotonic ordering
  payload_json     TEXT NOT NULL,        -- full createBill request body
  client_created_at TEXT NOT NULL,       -- ISO, when cashier finalized it
  status           TEXT NOT NULL DEFAULT 'pending',
                   -- pending | inflight | synced | rejected | conflict
  attempts         INTEGER DEFAULT 0,
  last_error       TEXT,
  next_attempt_at  TEXT,                 -- for backoff scheduling
  server_bill_id   TEXT,                 -- filled on success
  server_bill_no   INTEGER,              -- authoritative billNumber, filled on success
  synced_at        TEXT
);
CREATE INDEX idx_outbox_status ON outbox(status, local_seq);

-- ── Sync metadata / cursors ──────────────────────────────────────────
CREATE TABLE sync_meta (
  key   TEXT PRIMARY KEY,   -- e.g. 'cursor.products', 'cursor.customers', 'terminal_id', 'last_pull_at'
  value TEXT
);
```

Notes:
- `local_seq` is a per-terminal counter kept in `sync_meta` (`key='local_seq'`) and incremented inside the same transaction that inserts the outbox row → strictly monotonic, gap-free per terminal. This is the offline ordering key (§3.7).
- `terminal_id` is a UUID generated once per install, stored in `sync_meta`. It disambiguates multi-terminal receipt numbers and idempotency provenance.

---

## 3. Idempotency design (the core requirement)

### 3.1 What already exists in the backend (verified)

`controllers/bill.mjs → createBill` already:
- reads `idempotencyKey` from the body,
- does a pre-check `Bill.findOne({ idempotencyKey, business })` and returns `409 { alreadyPaid:true, bill }` if found,
- on the write, if a concurrent insert races and Mongo throws duplicate-key `11000` on `idempotencyKey`, it catches it, re-fetches, and returns the same `409 { alreadyPaid, bill }`.

`models/bill.mjs` already declares:
```js
billSchema.index(
  { idempotencyKey: 1 },
  { unique: true, partialFilterExpression: { idempotencyKey: { $type: "string" } } }
);
```

So **the exactly-once enforcement primitive is already present**: a unique index plus a check-or-catch. We build on it, with two corrections (§6).

> ⚠️ **One real gap to note:** the unique index is on `{ idempotencyKey }` **only**, not `{ business, idempotencyKey }`. Because keys are UUID v4 (globally unique) this is fine and actually *stronger* (no cross-tenant key reuse possible). Keep it global. Do **not** switch it to a compound `{business, idempotencyKey}` unless you also stop trusting UUID uniqueness — the current global-unique index is the correct choice.

### 3.2 The stable key

- Generated **once**, at the moment the cashier finalizes the bill, as `uuidv4()`.
- Written into the outbox row **in the same local transaction** as the bill payload. It is never regenerated. Every retry — including retries after an app restart — sends the identical key. This is what makes retries safe.

### 3.3 The exactly-once protocol (happy path)

```
CLIENT                                        SERVER (Mongo)
──────                                        ──────────────
1. build payload, key=uuid, seq=n
2. INSERT outbox(status='pending')  ──local txn, durable──
3. print receipt (client no.)
   ... later, online ...
4. mark row 'inflight'
5. POST /bill { idempotencyKey, ... } ─────►  6. begin txn
                                              7. Counter.getNextSequence(billNumber)
                                              8. insert Bill (unique idx on key)
                                              9. stock -=, customer ledger, cashbook
                                             10. commit
                                    ◄──201──  11. return canonical bill {_id, billNumber, ...}
12. UPDATE outbox
      status='synced',
      server_bill_id, server_bill_no
13. reconcile local stock/balance
```

### 3.4 Crash / network-drop recovery — every step

The only thing that makes exactly-once hard is the **unknown-response** case: the client sent the request but never learned the outcome. The design turns *every* failure into that one case and resolves it by **replay with the same key**.

| Failure point | What the server did | Client state after crash | Recovery |
|---|---|---|---|
| Crash **before** step 2 (outbox insert) | nothing | no outbox row | Bill never existed; cashier re-rings if needed. No double anything. |
| Crash **after** step 2, before send | nothing | row `pending` | On next boot the sync loop finds `pending` and sends. First-ever send. |
| Drop **during** step 5 (request in flight), server never received | nothing | row `inflight` | Timeout → back to `pending` → resend same key. Server sees it first time now. |
| Drop **after** server committed (step 10) but response lost | **bill created** | row `inflight` | Resend same key → server hits unique index / pre-check → returns the **already-created** canonical bill → client marks `synced`. **No second bill.** |
| Server crash mid-transaction (step 6–10) | Mongo txn **aborts**, nothing persisted | row `inflight` | Resend → clean first-time insert. Atomicity of the Mongo transaction guarantees no partial side effects (partial stock decrement without a bill is impossible). |
| Client crash after 201 received, before step 12 | bill created | row still `inflight` | Resend same key → server returns existing bill → client finally records `server_bill_no` and marks `synced`. Idempotent. |

The universal rule: **`inflight` is treated exactly like `pending` on recovery** — resend the same key. The server's job is to make a resend of an already-applied key a **no-op that returns the original result**. That is precisely what the unique index + return-canonical-bill behaviour provides.

### 3.5 Making the server insert atomic under Mongo

The bill write already runs inside a `mongoose` transaction that consumes the counter, decrements stock, updates the ledger, and writes the cashbook entry. Two layers guarantee exactly-once against that:

1. **Unique index = the hard guarantee.** Even if two requests with the same key arrive concurrently (double-click, overlapping retries, two racing sync loops), at most one `insert` of the `Bill` with that `idempotencyKey` can commit. The loser gets `E11000`, which `createBill` already catches and converts into "return the existing bill." The whole transaction (counter, stock, ledger, cashbook) commits or aborts as a unit, so a losing racer produces **zero** side effects.
2. **Pre-check = the fast path.** The `findOne({ idempotencyKey })` short-circuits the common replay case without touching the counter, so replays don't burn `billNumber` sequence values.

This is the recommended shape and it is already implemented. **No idempotency-record collection is needed** — the `Bill` row itself, keyed by its unique `idempotencyKey`, *is* the idempotency record. Adding a separate collection would introduce a second thing to keep consistent and is strictly worse here.

> Ordering caveat on the pre-check: the pre-check is best-effort (a racing pair can both pass it); the unique index is the real guard. Keep both — never rely on the pre-check alone.

### 3.6 Retry / backoff strategy

- **Per-bill exponential backoff with jitter**, stored in `outbox.next_attempt_at`: `delay = min(cap, base * 2^attempts) ± jitter`, e.g. base 2s, cap 5min.
- The push loop only picks rows where `next_attempt_at <= now`.
- **Distinguish error classes:**
  - *Network/5xx/timeout* → transient → bump `attempts`, schedule retry, keep `pending`.
  - *4xx business rejection* (out of stock, credit exceeded, validation) → **terminal** → mark `rejected`, stop retrying, raise to cashier (§4.4).
  - *200/201 or idempotent replay* → `synced`.
- **Cap attempts** (e.g. 12) before flipping to a `needs_attention` state that pings the UI, so a permanently-poisoned row can't spin forever.

### 3.7 Ordering guarantees — and whether bills must apply in order

**Short answer: push offline bills in `local_seq` order, one at a time, per terminal. Do not parallelize the push.**

Why it matters — the **cashbook running balance**. `recordCashEntry` reads the latest `runningBalance` and writes `prev ± amount`. If offline bills are applied out of order, each individual entry is still internally consistent (it always reads *whatever* the current latest balance is), so the **final** balance is correct regardless of order — addition is commutative. **However**, the *per-entry* `runningBalance` values and their timestamps form the audited cash ledger the owner reads line by line. Applying B3 before B1 makes the ledger's intermediate running balances not match the real chronological cash drawer sequence, which looks wrong in the CashBook screen even though the total is right.

Therefore:
- **Within one terminal:** apply strictly in `local_seq` order (chronological). One in-flight bill at a time; only advance to `seq n+1` once `seq n` is `synced` (or explicitly `rejected` and acknowledged). This keeps the cash ledger's running balance in true chronological order.
- **Across terminals (multi-terminal business):** you cannot globally order two terminals that were both offline. Accept it. The running balance will interleave by *arrival* time at the server, and `clientCreatedAt` (§9) preserves the true event time for reporting. Document to the owner that multi-terminal offline periods reconcile by arrival order; the daily total is still exact. (Single-terminal — the common case — has no such issue.)
- Customer ledger and stock are `$inc`-based and **order-independent** for correctness; only the cashbook's human-readable sequence benefits from ordering.

---

## 4. Sync engine

### 4.1 Where it runs

In the **Electron main process**, as a long-lived singleton started after login and owning the SQLite handle. Two loops:
- **Push loop** — drains the outbox (§3).
- **Pull loop** — delta-syncs products/customers (§5).

The renderer never sees raw HTTP for sync; it calls IPC methods (`offline:createBill`, `offline:getProducts`, `sync:status`) and subscribes to status events.

### 4.2 Online/offline detection — do NOT trust `navigator.onLine`

`navigator.onLine` only reflects whether the OS has *a* network interface up; it is `true` on a captive-portal wifi with no real internet, and it can't tell you the Vercel backend is reachable. Use a **real reachability probe**:

- Add a trivial backend endpoint `GET /health` (returns `200 {ok:true}`, no auth, cache-busting) — or reuse an existing cheap authenticated GET.
- The main process pings it every **15–30s** with a short timeout (3–5s). Two consecutive successes → `online`; two consecutive failures → `offline` (hysteresis avoids flapping).
- Also probe **immediately** on OS network-up events and just before draining the outbox.
- Treat any real sync request's network error as an `offline` signal too (fail fast, don't wait for the next probe).

### 4.3 Batching & partial failure

- **Push:** sequential per §3.7 (correctness > throughput; offline bill volume during an outage is small — tens, not thousands). If you must batch for latency, batch the *transport* but still commit server-side one bill per request so each has its own idempotent boundary. Recommendation: **one bill per request.** Simpler, and every bill is independently exactly-once.
- **Pull:** paged (§5). A partial pull failure just means the cursor isn't advanced past the failed page; next run resumes from the last committed cursor. Pull is idempotent (upsert by `server_id`).

### 4.4 Drift discovered at sync time (conflict / rejection policy)

Offline optimistic state can diverge from server truth. The server is authoritative and will **reject** on the write. Policy:

| Server rejection at sync | Meaning | Policy | Cashier UX |
|---|---|---|---|
| `400 Insufficient stock` | Item sold out server-side (another terminal) while we were offline | Mark outbox row `rejected`. The offline sale physically happened (goods left the store). | Surface a **"Sync exception"** list: "Bill OFF-…-12 sold 3× Widget but only 1 was available online. Reconcile: adjust stock / accept oversell." Owner decides. Do **not** silently drop the bill. |
| `400 Credit limit exceeded` | Customer went over limit combining offline + other bills | Mark `rejected`, surface. Credit was extended in the real world already. | Same exception list; owner can accept the overage or collect. |
| `404 Customer not found` | Customer deleted server-side while offline | Mark `conflict`; offer to re-post as walk-in or recreate customer. | Prompt. |
| `409 idempotent replay` | Already synced | Mark `synced`, no-op. | Silent. |

Key stance: **an offline bill represents a real-world transaction that already happened** (cash taken, goods handed over, receipt printed). We never discard it. If the server rejects, we do not fabricate side effects — we quarantine the row and force a human reconciliation decision, because it's real money. To make rejections rare, consider adding a server flag `allowOversell:true` on offline-sourced bills so completed offline sales are accepted and instead **flagged** rather than blocked (recommended for Phase 2+; see §6.4).

---

## 5. Initial + incremental data pull

### 5.1 The problem with the existing list endpoints

- `GET /product` returns a **bare array capped at 5000**, no `since` filter, no `updatedAt` cursor. Fine for a one-shot full pull of small catalogs, bad for deltas and for 5000+ catalogs.
- `GET /customer` is **paginated and capped at `limit≤100`** with `{customers,total,page,totalPages}` and no `since` filter. You'd have to walk every page every login to detect changes — wasteful.

So we add **dedicated sync endpoints** that (a) filter by `updatedAt > since`, (b) page internally with a cursor, (c) are exempt from the 100-item UI cap, (d) include soft-delete tombstones.

### 5.2 New endpoints (see §6 for exact code shape)

```
GET /sync/products?since=<ISO>&limit=500&after=<lastId>
GET /sync/customers?since=<ISO>&limit=500&after=<lastId>
GET /sync/cursor        → { serverTime, products:{count}, customers:{count} }  (optional, for progress UI)
```

Response shape (per resource page):
```json
{
  "items": [ { "_id":"...", "name":"...", "updatedAt":"2026-08-31T10:22:00.000Z", ... } ],
  "nextAfter": "665f...c1",      // pass back as ?after= for next page, null when done
  "serverTime": "2026-08-31T10:30:00.000Z"  // use as the new cursor once fully drained
}
```

- **Pagination is keyset (cursor), not skip/limit.** Sort by `{ updatedAt:1, _id:1 }`, page with `updatedAt > since OR (updatedAt == boundary AND _id > after)`. Keyset paging is stable under concurrent writes (no skip drift) and index-friendly.
- **Cursor commit rule:** advance `sync_meta.cursor.products` to the page's `serverTime` **only after the entire delta is drained and upserted**. If pull dies mid-way, you re-fetch from the old cursor — idempotent upserts make repeats harmless.
- **Tombstones:** to sync deletions, the delta must include soft-deleted rows. Products/customers currently hard-delete. Options: (a) switch to soft-delete (`isDeleted:true`, keep `updatedAt` bumped) — **recommended**, cleanest for sync; or (b) a lightweight `deletions` collection the sync endpoint reads. Until soft-delete lands, a full re-pull on login covers deletions; deltas cover only upserts. Call this out as a Phase 2.5 item.

### 5.3 Full pull on first login

- First login for a business+terminal: drain `GET /sync/products?since=1970-01-01` and `GET /sync/customers?since=1970-01-01` fully, upserting into SQLite in transactions of ~500 rows.
- Show a progress bar (`/sync/cursor` gives totals). For 5000 products this is ~10 pages of 500 — a few seconds.
- Store the returned `serverTime` as the cursor. Subsequent logins do delta only.

### 5.4 Delta on subsequent syncs

- `since = sync_meta.cursor.products`; upsert each item by `server_id`; apply tombstones (`deleted=1`).
- Runs on the pull-loop interval while online, and once at login.
- **Reconciliation of optimistic deltas:** when a product/customer arrives from the server, its `stock_quantity`/`balance` is server truth. Reset `local_*_delta` to 0 for any row whose contributing offline bills are now all `synced` (i.e., the server's number already includes our offline effect). Track this by: after a bill row flips to `synced`, subtract its contribution from the affected products'/customer's `local_delta`. Once delta hits 0 and a fresh server value arrives, the two agree.

---

## 6. Backend changes required (precise, minimal, backward-compatible)

### 6.1 Confirm the idempotency index is deployed

`models/bill.mjs` declares the unique partial index on `idempotencyKey`. **Verify it actually exists in the production DB** (`db.bills.getIndexes()`), because a declared index isn't built until Mongoose syncs it and on an existing large collection it may need a manual `createIndex`. This is the single most important backend prerequisite — without the unique index, exactly-once degrades to "usually once."

### 6.2 `createBill` — return canonical bill on idempotent replay (behavioural fix)

Today a replay returns **`409 { alreadyPaid, bill }`**. For online double-submits that's a fine "already paid" UX. But for the **offline sync client**, a replay is a *success*, not an error, and `409` forces the client to special-case it. Recommended change: keep `409` for the interactive path but make the sync-aware path idempotent-friendly.

Minimal, backward-compatible change: **when the request is offline-sourced, treat an existing-key match as `200` success returning the canonical bill.**

```js
// inside createBill, replacing the two places that currently 409:
const respondExisting = (existing) => {
  if (req.body.source === 'offline') {
    // idempotent replay from the sync engine → success, return canonical bill
    return res.status(200).json(existing);
  }
  // interactive double-submit → keep existing behaviour
  return res.status(409).json({
    alreadyPaid: true, bill: existing,
    message: `Bill #${existing.billNumber} has already been paid`,
  });
};

// pre-check:
if (idempotencyKey) {
  const existing = await Bill.findOne({ idempotencyKey, business: req.user.businessId });
  if (existing) return respondExisting(existing);
}
// ... and in the catch for error.code === 11000:
const existing = await Bill.findOne({ idempotencyKey: req.body.idempotencyKey, business: req.user.businessId });
return respondExisting(existing);
```

The sync client then treats **200 and 201 identically** (both carry the canonical bill with `billNumber`), and never has to parse a 409 as success.

### 6.3 New fields on `Bill` (additive, all optional/defaulted)

```js
// models/bill.mjs additions:
clientBillId:    { type: String },   // uuidv4 from the terminal (audit / dedupe backup)
source:          { type: String, enum: ['online','offline'], default: 'online' },
clientCreatedAt: { type: Date },     // when the cashier finalized it offline
terminalId:      { type: String },   // which terminal produced it
// (idempotencyKey already exists)
```

- All optional → **zero migration** for existing rows; existing online flow keeps working unchanged (`source` defaults to `'online'`).
- Optionally add a non-unique index `{ business:1, source:1, createdAt:-1 }` for reporting on offline bills.
- **Cashbook / reporting timestamp:** `createBill` should, when `source==='offline'` and `clientCreatedAt` is present, use `clientCreatedAt` for the human-facing `date`/`time` fields (so the receipt/report shows when the sale actually happened), while Mongo's `createdAt` naturally records server-insert time. Decide and document which one reports use (recommend `clientCreatedAt` for sales-by-day, server `createdAt` for the cash-arrival ledger). See §9 clock-skew.

### 6.4 (Recommended, Phase 2) accept completed offline sales even on stock drift

Add optional `allowOversell` handling: when `source==='offline'` and `status==='completed'`, if stock is insufficient, **still create the bill** but attach a `syncFlags: ['oversold']` marker and let stock go to/through zero, rather than rejecting. Rationale: the sale already happened physically; blocking it loses a real bill. Surface `syncFlags` back to the client for the exception UI. Make this a config/flag so owners who prefer hard-blocking can opt out.

### 6.5 New sync endpoints (new file `controllers/sync.mjs`, `routes/sync.mjs`)

```js
// GET /sync/products?since=&after=&limit=
export const syncProducts = async (req, res) => {
  const since = req.query.since ? new Date(req.query.since) : new Date(0);
  const limit = Math.min(parseInt(req.query.limit) || 500, 1000);
  const after = req.query.after; // last _id of previous page (keyset)

  const q = { business: req.user.businessId, updatedAt: { $gte: since } };
  if (after) {
    // keyset continuation on {updatedAt,_id}
    const boundary = await Product.findById(after).select('updatedAt').lean();
    if (boundary) {
      q.$or = [
        { updatedAt: { $gt: boundary.updatedAt } },
        { updatedAt: boundary.updatedAt, _id: { $gt: new mongoose.Types.ObjectId(after) } },
      ];
      delete q.updatedAt;
      q.updatedAt = { $gte: since };
    }
  }

  const items = await Product.find(q)
    .sort({ updatedAt: 1, _id: 1 })
    .limit(limit + 1)
    .lean();

  const hasMore = items.length > limit;
  const page = hasMore ? items.slice(0, limit) : items;
  res.json({
    items: page,
    nextAfter: hasMore ? String(page[page.length - 1]._id) : null,
    serverTime: new Date().toISOString(),
  });
};
```

(Analogous `syncCustomers`.) These are **read-only, additive, and don't touch existing endpoints.** Require the same auth middleware. Because they page internally they are exempt from the `limit≤100` UI cap by design.

> Simpler alternative if you want the smallest diff: skip keyset and use `updatedAt`-window paging (`since` + `limit`, client advances `since` to the max `updatedAt` seen). Slight risk of missing rows that share the exact same `updatedAt` millisecond at a page boundary; keyset avoids it. For catalogs where many rows can share a bulk-import timestamp, **use keyset**.

### 6.6 `GET /health`

Trivial unauthenticated `200 {ok:true, serverTime}` for the reachability probe (§4.2).

### 6.7 Summary of backend changes

| Change | File | Risk | Migration |
|---|---|---|---|
| Verify unique index on `idempotencyKey` exists in prod | ops | none | build index if missing |
| Idempotent replay → 200 for `source:'offline'` | `controllers/bill.mjs` | low | none |
| Add `clientBillId, source, clientCreatedAt, terminalId` | `models/bill.mjs` | low | none (additive) |
| Use `clientCreatedAt` for offline `date/time` | `controllers/bill.mjs` | low | none |
| (opt) oversell acceptance for offline completed sales | `controllers/bill.mjs` | med | none |
| `GET /sync/products`, `/sync/customers` | new `sync.mjs` + route | low | none |
| `GET /health` | route | none | none |
| (opt) soft-delete for products/customers (tombstones) | models/controllers | med | backfill `isDeleted:false` |

---

## 7. Data integrity & money-flow correctness

- **No double-charge:** guaranteed by the client-stable `idempotencyKey` + server unique index (§3). A bill with a given key can be inserted at most once, ever, across any number of retries, restarts, or racing sync loops.
- **No lost bills:** every finalized bill is durably in the SQLite `outbox` (WAL, ACID) *before* the receipt prints. It survives app kill, OS crash, power loss. It is only removed/flagged after the server confirms `synced`. A bill can be `pending` for days across an outage and still sync.
- **Cashbook running-balance consistency:** offline bills apply in `local_seq` order per terminal (§3.7) so the single-terminal cash ledger's intermediate running balances stay chronological. Final balance is order-independent (commutative `$inc`). Multi-terminal offline periods reconcile by server-arrival order; the daily total remains exact and `clientCreatedAt` preserves true event time for reports.
- **Customer ledger for offline credit sales:** the bill's `customerBalanceBefore` is snapshotted **server-side at sync time** (inside the transaction, as it is today) — *not* offline — so the frozen "balance before" reflects the true server state when the bill actually lands, and the `post('save')` aggregation recomputes the customer's balance from all their bills. This means offline credit sales are correct even if multiple offline bills for the same customer land in a burst: each save re-aggregates. The optimistic `local_balance_delta` is only for showing the cashier a plausible running balance offline; it's discarded/reset on reconcile (§5.4).
- **Reprints of an offline-not-yet-synced bill:** reprint from the local outbox row using the **client receipt number**. Do not show a server `billNumber` until `server_bill_no` is populated. After sync, reprints can show both ("Receipt OFF-T1-12 / Bill #4021").
- **Returns of an offline-not-yet-synced bill:** **block returns until the original bill is `synced`.** A return needs the server bill `_id` and its authoritative line items/`returnedQty` (the return flow is server-transactional and looks up by `billNumber`/`_id`). Returning against an un-synced bill would create a return with no server anchor. UX: "This bill hasn't synced yet — connect to the internet to process the return." This is a Phase 3 concern (offline returns are explicitly out of the initial scope).

---

## 8. Security

### 8.1 Offline JWT expiry — authenticating queued writes on reconnect

- The **access JWT (RS256) will expire during a long offline period.** That's fine: you can't call the server while offline anyway.
- The **7-day opaque refresh token** (`refreshToken` model, `verifyAndRotate`) is the key. On reconnect, before draining the outbox, the sync engine calls `POST /auth/refresh` to mint a fresh access token, then authenticates the queued `POST /bill` calls with it.
- **Important:** the refresh token itself expires after 7 days and rotates on every use (old one is deleted on refresh). Implications:
  - An outage **longer than 7 days** means the refresh token has expired → the terminal must re-login (online) before it can sync. The outbox is preserved; syncing resumes after re-auth. Warn the owner if a terminal has been offline > ~5 days.
  - Because refresh **rotates** (single-use), the sync engine must persist the newly-issued refresh token immediately and use it for the next refresh. Guard against a refresh request whose response is lost (you'd lose the new token and be locked out): store the *in-flight* refresh attempt and, on ambiguous failure, fall back to requiring interactive login. Keep refreshes rare (only when the access token is actually expired), not per-request.
- The `cashier`/`performedBy` on an offline bill is derived server-side from the authenticated token at sync time (as today), so offline bills are correctly attributed to whoever's session synced them. If a different user logs in before sync, decide policy: recommend syncing under the **original cashier's** identity by including `cashierId` in the offline payload and honoring it server-side for `source:'offline'` (small controller tweak), so attribution reflects who actually made the sale.

### 8.2 Encryption at rest

The local SQLite holds customer PII (name, phone, address), prices, cost prices, and unsynced revenue. Encrypt it:
- Use **`better-sqlite3-multiple-ciphers`** (SQLCipher, drop-in API) with a key derived per-install.
- **Key storage:** use the OS keychain via **`keytar`** / Electron `safeStorage` (`safeStorage.encryptString`) — do **not** hardcode a key or store it plaintext next to the DB. `safeStorage` is backed by the OS credential store (Keychain on macOS, DPAPI on Windows) and is the right primitive here.
- This protects a stolen/copied laptop or a backed-up disk image from leaking PII and cost prices.

### 8.3 Clearing local data on logout

- On **logout:** close the DB handle, clear tokens from `localStorage` (already done by the api interceptor), and **wipe the outbox only if it's empty**. If the outbox has `pending` rows, **warn and block a destructive wipe** ("You have N unsynced bills — sync before logging out or you'll lose them"). Never silently delete unsynced revenue.
- On **different-business login** on the same machine: switch to that business's namespaced file; the previous business's file stays encrypted at rest (or is deleted per policy).
- Provide an explicit **"Clear offline data"** admin action (with the same unsynced-bill guard) for support scenarios.

---

## 9. Edge cases

- **App killed mid-bill:** the bill is only durable once the outbox insert commits (before printing). If killed *before* that commit, the bill never existed — cashier re-rings. If killed *after*, it's `pending` and syncs later. No half-states, because the local insert is a single SQLite transaction.
- **Clock skew (client vs server):** the terminal's clock may be wrong. Consequences: `clientCreatedAt` could be off. Mitigations: (1) store both `clientCreatedAt` and rely on server `createdAt` for the authoritative cash-arrival ledger; (2) on each successful probe/refresh, capture `serverTime` from `/health` and compute a **clock-offset** the client can apply to display/report times; (3) never use client time for anything money-authoritative — only for display and sales-by-day reporting, with a documented caveat. For a POS, a bill dated to the wrong *day* skews daily reports — so if offset is large (> a few minutes), warn the cashier to fix the system clock.
- **Multiple terminals for one business, all offline:** each has its own `terminalId` and its own `OFF-<terminal>-<seq>` receipt space, so **no client receipt-number collisions**. Idempotency keys are UUIDs → no key collisions. Server `billNumber` is assigned at sync time by the atomic counter → all terminals interleave into one correct, gapless server sequence by arrival order. Cash ledger interleaves by arrival (documented). This is the one place single-terminal simplicity breaks; everything still stays *correct*, only the intermediate cash running-balance order is arrival-based.
- **Very large catalogs (5000+):** initial pull is keyset-paged at 500/page (~10 requests), upserted in SQLite transactions; a few seconds. Barcode/name lookups are indexed SQLite queries → instant regardless of catalog size. Memory is bounded (we page, we don't hold the whole catalog in JS).
- **Partial catalog updates:** delta sync by `updatedAt` cursor pulls only changed rows; a price change to 3 products syncs 3 rows, not 5000. Tombstones handle deletions (once soft-delete lands; until then, deletions reconcile on next full re-pull/login).
- **Two sync loops racing (e.g., a bug spawns two engines):** harmless — the unique index makes concurrent same-key inserts collapse to one bill; the outbox row's `UNIQUE(idempotency_key)` and status transitions prevent local double-processing. Still, enforce a single SyncEngine singleton in main.

---

## 10. Phased rollout plan

### Phase 0 — Foundations (no user-visible change)
- Add `better-sqlite3` (+ `-multiple-ciphers` for encryption), wire `electron-rebuild`, `asarUnpack`, native-module build in CI (the existing GitHub Actions release workflow must rebuild the native module for both Win and Mac).
- Create the SQLite schema (§2.4), the main-process `LocalDB` module, and the IPC surface in `preload.js`.
- Generate & persist `terminalId`.
- Backend: ship `GET /health`; **verify the `idempotencyKey` unique index exists in prod.**
- **De-risk:** native-module packaging is the #1 risk — prove a signed Win + Mac build boots with `better-sqlite3` before building anything on top.

### Phase 1 — Read-only offline cache (safe, high value, no money risk)
- Add `GET /sync/products` + `/sync/customers` (§6.5).
- Full pull on login → SQLite; delta on interval.
- Route `Sales.jsx` product/customer **reads** through the local cache via the `offlineApi` facade (fall back to network on cache miss while online).
- Barcode scan + product search served locally.
- Online/offline banner in the UI driven by the reachability probe.
- **Ships:** app keeps *displaying* products/customers and scanning barcodes when offline; billing still requires online (writes go straight to server). Zero risk to money because no offline writes yet.

### Phase 2 — Offline billing + outbox + idempotent sync (the core)
- Backend: add `Bill` fields (`clientBillId, source, clientCreatedAt, terminalId`), idempotent-replay-→200 for offline, optional oversell acceptance (§6.4).
- Client: finalize bill → generate `idempotencyKey` + client receipt no. → outbox insert (txn) → optimistic local stock/balance → print.
- Push loop with backoff, in-order per terminal, exactly-once (§3).
- Reconcile optimistic deltas on pull.
- Sync-status UI + exception list for `rejected`/`conflict` rows (§4.4).
- **Ships:** full offline billing with exactly-once sync. Roll out behind a feature flag / to pilot terminals first.
- **De-risk:** ship to 1–2 friendly stores; watch the exception list and Sentry; compare server bill counts vs terminal receipt counts daily.

### Phase 2.5 — Deletion sync
- Soft-delete for products/customers + tombstones in the delta (§5.2). Until then, deletions reconcile on full re-pull at login.

### Phase 3 — Offline returns & other writes
- Offline returns (only against already-synced bills; queue return operations with their own idempotency keys), offline customer create, offline payments. Each follows the same outbox + idempotency pattern. Higher complexity (returns mutate an existing server doc), hence last.

### Testing strategy
- **Simulate offline:** a dev toggle that forces the reachability probe to report offline (don't rely on pulling the ethernet cable in CI). Also test *captive-portal* mode (network up, backend unreachable) to prove `navigator.onLine` isn't trusted.
- **Duplicate-delivery test:** fire the same `idempotencyKey` N times concurrently at `/bill`; assert exactly one `Bill` exists, all responses carry the same `billNumber`, stock decremented once, one cashbook entry.
- **Crash injection:** kill the app (`process.exit`) between (a) outbox insert and print, (b) send and response-store, (c) 201-received and outbox-update; on restart assert exactly-once and correct outbox status each time.
- **Network-drop mid-write:** proxy that drops the response after the server commits; assert client resends and server returns the existing bill (no second bill).
- **Ordering:** queue 5 offline bills, sync, assert cashbook running balances are chronological (single terminal).
- **Reconcile:** offline-sell an item, sync, assert local `stock_quantity` matches server and `local_stock_delta` resets to 0.
- **Long-outage auth:** expire the access token, keep refresh valid → assert auto-refresh then sync; expire refresh (>7d) → assert graceful "re-login required," outbox preserved.
- **Multi-terminal:** two terminals offline sell overlapping stock; sync; assert both bills exist with distinct `billNumber`s and the oversell exception surfaces.

### Observability
- **Sync-status UI:** online/offline indicator, count of `pending`/`inflight`/`rejected` outbox rows, last successful pull time, last successful push time.
- **Failed-outbox visibility:** a dedicated screen listing `rejected`/`conflict` bills with the server reason and a reconcile action — this is the money-safety net; make it prominent.
- **Metrics/telemetry (Sentry is already wired):** report on sync failures, oversell events, outbox depth over time, refresh-token failures, and any idempotent-replay-on-201 (indicates a lost-response retry — expected but worth counting). Alert if any terminal's outbox depth stays > 0 for > X hours (a stuck terminal = unrecorded revenue).

---

## Appendix A — Client bill submit payload (offline)

```json
POST /bill
{
  "idempotencyKey": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "clientBillId":   "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "source":         "offline",
  "terminalId":     "T-9d2a...",
  "clientCreatedAt":"2026-08-31T14:03:21.114Z",
  "cashierId":      "665f...e1",
  "items": [
    { "product":"665f...aa", "name":"Widget", "qty":2, "price":150, "barcode":"890..." }
  ],
  "payments": [ { "amount":300, "method":"cash" } ],
  "customer": null,
  "billDiscountAmount": 0
}
```

Server responds (200 on idempotent replay, 201 on first insert) with the **canonical bill** including the authoritative `billNumber` and `_id`. Client writes those back to the outbox row and marks it `synced`.

## Appendix B — Why not just call the existing `/bill` online-only?

The existing `createBill` already supports `idempotencyKey`. The *only* things missing for true offline are: (1) a durable local outbox so bills survive an outage and app restarts, (2) a local cache so the cashier can look up products/customers offline, (3) delta pull endpoints so re-syncing the catalog is cheap, and (4) a small idempotent-replay response tweak so the sync client treats replays as success. That's the whole delta — the backend's money-transaction core is reused untouched, which is exactly what you want for correctness.
