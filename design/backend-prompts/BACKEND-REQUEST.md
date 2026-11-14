# Backend request — everything the desktop branch `feat/impove-ui` needs

Send everything inside the box to the backend session.

```
Context: the desktop branch feat/impove-ui (design overhaul + Money Book + till/returns fixes) is
ready on the desktop side. It needs the backend below before it can be released. Work on the
backend branch feat/impove-ui. Rules for the whole task: don't commit, tag or push without my
permission; never point at the production database; run the full test suite at the end.

════════════════════════════════════════════════════════════════════════════════════════════
PART A — Get the work that is already on this branch ready to ship (no new features)
════════════════════════════════════════════════════════════════════════════════════════════
These are already written on feat/impove-ui but are uncommitted and NOT on the live server. The
desktop needs all of them (against the live server today: Money Book switches off, the dashboard
"Overview"/"Today & bills" tabs say "needs the server update", shop colour/sidebar can't be saved,
and Receipts search / payment filter / Supplies search are silently ignored).

  1. Money Book (accounts, transfers, cheques, settings) + scripts/migrate-money-book.mjs
     (follow docs/money-book-plan.md).
  2. Stage 2 — shop appearance: business.settings.appearance { accent, sidebar } saved through
     the business settings endpoint.
  3. Stage 6 — list params: GET /bill?search=&paymentMethod=, GET /supply?search=.
  4. Stage 7 — GET /v1/dashboard/insights/sales?from=&to= (shop-scoped, ≤ 366 days).

  To do:
  - Review the diff, then run the full test suite (it was 262/262 when last checked) and fix
    anything red.
  - .playwright-mcp/page-2026-11-08T20-25-07-242Z.yml is STAGED by mistake: unstage it and add
    .playwright-mcp/ to .gitignore.
  - List the deploy steps for me in order (deploy → run the Money Book migration → smoke test),
    but don't deploy.

════════════════════════════════════════════════════════════════════════════════════════════
PART B — Safe retries (idempotency) for every action that moves money or stock
════════════════════════════════════════════════════════════════════════════════════════════
Why: on a dropped connection the server can save something while its answer never reaches the
app; the cashier then presses the button again. A real case: a cash sale was saved as Bill #173,
the answer was lost, the retry came with a new key and failed with "Insufficient stock". The
desktop now keeps ONE key per attempt (a random UUID v4, kept until a definite answer, even
across an app restart) — the server must recognise a repeat everywhere, not only for sales.

Today
  - POST /bill already does this with body.idempotencyKey (unique index on Bill.idempotencyKey):
    a repeat answers 409 { alreadyPaid: true, bill }. The desktop relies on that exact answer —
    DO NOT change POST /bill or POST /bill/:id/add-items.
  - No other endpoint accepts a key.

B1. One shared mechanism (don't copy-paste per controller)
  - New collection IdempotencyRecord:
      { business, key, route (method + route pattern, e.g. "POST /bill/:id/return"),
        requestHash (sha256 of the canonical JSON body without the key),
        state: "in_progress" | "done", statusCode, responseBody, createdAt }
    Unique index { business: 1, key: 1 }. TTL index on createdAt: 7 days.
  - The key arrives in the "Idempotency-Key" request header. Also accept body.idempotencyKey
    (header wins if both). Optional everywhere: no key → behaviour exactly as today, so older
    desktop versions keep working.
  - Keys are UUIDs from the app; accept any string of 8–100 characters.
  - index.mjs CORS: add 'Idempotency-Key' to corsOptions.allowedHeaders and 'Idempotent-Replay'
    to exposedHeaders (today only Content-Type and Authorization are allowed → the request would
    be blocked).
  - Joi: validate() uses allowUnknown: false, so add idempotencyKey: Joi.string().trim().min(8)
    .max(100).optional() to every schema in B2 (otherwise a body key fails "Validation failed").
  - A helper, e.g. withIdempotency(req, res, route, work), used by each controller in B2:
      a) No key → run the work as today.
      b) Same key, same route, state "done", same requestHash → return the STORED statusCode +
         responseBody unchanged, plus header "Idempotent-Replay: true". No work, no side effects:
         no second cash-book / money-book / stock / ledger entry.
      c) Same key but a different route or different requestHash → 422
         { message: "This request key was already used for a different action" }, nothing changed.
      d) Same key, state "in_progress" (first request still running) → 409
         { inProgress: true, message: "Still saving the first try — wait a moment and retry" }.
      e) New key → insert { state: "in_progress" } FIRST, run the work, then set state "done" with
         the response. The record must be written in the SAME Mongo transaction/session as the
         work (utils/txn.mjs), so the work and its record commit or roll back together. If the work
         fails (4xx/5xx), the record must not stay behind, so the same key can be retried after
         the problem is fixed.
  - Only successful (2xx) responses are stored and replayed.

B2. Endpoints to wrap (all of these move money, stock or a balance)
  Returns and refunds
    - POST  /bill/:id/return              (processReturn, incl. { fullReturn: true })
    - POST  /bill/returns/standalone      (createStandaloneRefund)
  Customer money
    - POST  /customer/:id/collect         (collectFromCustomer — FIFO payment)
    - POST  /bill/:id/payment             (addPayment)
  Vendors and supplies
    - POST  /vendor/:id/pay
    - POST  /supply                       (stock goes up)
    - PATCH /supply/:id/pay
    - POST  /supply/:id/return
  Expenses
    - POST  /expense
  Money Book / Cash Book
    - POST  /money-book/transfers, /money-book/deposit, /money-book/withdraw,
            /money-book/adjustments
    - POST  /cashbook/deposit, /cashbook/withdraw, /cashbook/opening-balance

B3. Actions that can only happen once — make the repeat answer friendly (no key needed)
  A second call on something already done must not fail with a scary message. Return 409 with a
  flag + the current record, like POST /bill does:
    - POST /bill/:id/cancel                        → 409 { alreadyCancelled: true, bill }
    - POST /expense/:id/approve and /reject        → 409 { alreadyDecided: true, expense }
    - POST /money-book/cheques/:id/clear and /cancel → 409 { alreadyDone: true, entry }
    - POST /money-book/transfers/:id/reverse       → 409 { alreadyReversed: true, transfer }
  Keep today's checks; only make sure the body carries the flag and the current record.

════════════════════════════════════════════════════════════════════════════════════════════
PART C — Small fix
════════════════════════════════════════════════════════════════════════════════════════════
GET /bill/returns/today-summary only counts returns made against a sale bill. Returns without a
bill (POST /bill/returns/standalone) are left out, so the Returns screen showed
"4 returns · PKR 550" after 5 returns (PKR 700). Include standalone refunds in totalReturns,
totalRefunded and totalItems — each counted once, on its own date (Pakistan time).

════════════════════════════════════════════════════════════════════════════════════════════
TESTS
════════════════════════════════════════════════════════════════════════════════════════════
For EACH endpoint in B2:
  - same key twice, same body → exactly one record / entry / ledger line / stock move; the second
    answer is the stored 2xx body + "Idempotent-Replay: true";
  - same key, different body → 422, nothing changed;
  - no key → unchanged behaviour (an existing test per endpoint still passes);
  - first request fails (e.g. 400 not enough cash / over-return) → the same key succeeds on retry
    once the problem is fixed;
  - header and body key both work; CORS preflight allows the Idempotency-Key header.
Concurrency: two parallel requests with the same key → exactly one does the work; the other gets
409 inProgress or the replay.
B3: the second call returns 409 with the flag + current record.
C: a standalone refund appears in today-summary (count, amount, items).
Regression: POST /bill and POST /bill/:id/add-items idempotency tests pass unchanged; the full
suite is green.

════════════════════════════════════════════════════════════════════════════════════════════
REPORT BACK
════════════════════════════════════════════════════════════════════════════════════════════
  - The changed files, grouped by part.
  - One replayed response (status, headers, body) for POST /bill/:id/return and for
    POST /customer/:id/collect.
  - The full test output.
  - The deploy order from Part A.
  - Don't commit, tag or push without my permission.
```

## Release order (why the backend goes first)

1. Backend: review → tests → commit (with permission) → deploy → Money Book migration → smoke test.
2. Desktop: the version that sends the keys for returns/payments/etc. is released only after that —
   today's live server rejects unknown fields and the new header, so an earlier desktop release
   would break those screens.
3. Shops that haven't updated keep working: every key is optional (tested: the released v1.4.1
   app sold normally against the new backend).
