# Backend prompt — safe retries for every action that moves money or stock

**Why:** on a slow or dropped connection the server can save something while its answer never
reaches the app. The app then shows "no answer" and the cashier presses the button again. Sales
(`POST /bill`) and "add to bill" are already safe (idempotency key). Everything below is not: a
retry can refund twice, record a payment twice, pay a vendor twice, or fail with a confusing error.

Send everything inside the box to the backend session.

```
Feature: idempotency for every endpoint that moves money or stock, so a retried request after a
lost answer never does the work twice and returns the original result instead.

Today
- POST /bill already does this with body.idempotencyKey (unique index on Bill.idempotencyKey):
  a repeat answers 409 { alreadyPaid: true, bill }. The desktop relies on that exact answer —
  DO NOT change POST /bill or POST /bill/:id/add-items.
- No other endpoint accepts a key.

1. One shared mechanism (don't copy-paste per controller)
   - New collection IdempotencyRecord:
       { business, key, route (method + route pattern, e.g. "POST /bill/:id/return"),
         requestHash (sha256 of the canonical JSON body without the key),
         state: "in_progress" | "done", statusCode, responseBody, createdAt }
     Unique index { business: 1, key: 1 }. TTL index on createdAt: 7 days.
   - The client sends the key in the "Idempotency-Key" request header (the usual standard).
     Also accept body.idempotencyKey for consistency with POST /bill (header wins if both).
     Optional everywhere: no key → behaviour exactly as today (older desktop versions keep working).
   - index.mjs CORS: add 'Idempotency-Key' to corsOptions.allowedHeaders, and 'Idempotent-Replay'
     to exposedHeaders, or the browser/Electron blocks the request.
   - Joi (validate() uses allowUnknown: false): add idempotencyKey: string, trim, 8–100 chars,
     optional to every schema in section 2, so a body key is not rejected as "Validation failed".
   - A helper, e.g. withIdempotency(req, res, route, work), used by each controller:
       a) No key → run work as today.
       b) Key seen before, same route, state "done", same requestHash → return the STORED
          statusCode + responseBody unchanged, plus header "Idempotent-Replay: true".
          No work, no side effects, no second cash-book / money-book / stock / ledger entry.
       c) Key seen before but different route or different requestHash → 422
          { message: "This request key was already used for a different action" }.
       d) Key seen before, state "in_progress" (first request still running) → 409
          { inProgress: true, message: "Still saving the first try — wait a moment and retry" }.
       e) New key → insert { state: "in_progress" } FIRST, run the work, then set state "done"
          with the response. The record write MUST be in the same Mongo transaction/session as
          the work (utils/txn.mjs) so the work and its record commit or roll back together.
          If the work fails with a 4xx/5xx, delete the record (or roll it back with the
          transaction) so the client can try again with the same key after fixing the problem.
   - Only successful (2xx) responses are stored and replayed.

2. Endpoints to wrap (all of these move money, stock or a balance)
   Returns and refunds
     - POST /bill/:id/return               (processReturn, incl. { fullReturn: true })
     - POST /bill/returns/standalone       (createStandaloneRefund)
   Customer money
     - POST /customer/:id/collect          (collectFromCustomer — FIFO payment)
     - POST /bill/:id/payment              (addPayment)
   Vendors and supplies
     - POST /vendor/:id/pay
     - POST /supply                        (stock goes up)
     - POST /supply/:id/pay  (if it exists) and POST /supply/:id/return
   Expenses
     - POST /expense
   Money Book / Cash Book
     - POST /money-book/transfers, /deposit, /withdraw, /adjustments
     - POST /cashbook/deposit, /cashbook/withdraw (and /opening-balance)

3. Endpoints that are safe by state — make the repeat answer friendly, no key needed
   A second call on something already done must not error with a scary message. Return 409 with
   the current record and a flag, like POST /bill does:
     - POST /bill/:id/cancel                  → 409 { alreadyCancelled: true, bill }
     - POST /expense/:id/approve | /reject    → 409 { alreadyDecided: true, expense }
     - POST /money-book/cheques/:id/clear | /cancel → 409 { alreadyDone: true, entry }
     - POST /money-book/transfers/:id/reverse → 409 { alreadyReversed: true, transfer }
   (Keep today's checks; only make sure the body carries the flag + current record.)

4. Small fix while there: GET /bill/returns/today-summary only counts returns made against a
   sale bill; returns without a bill (POST /bill/returns/standalone) are left out, so the Returns
   screen showed "4 returns · PKR 550" after 5 returns (PKR 700). Include standalone refunds in
   totalReturns, totalRefunded and totalItems (counted once each, by their own date).

5. Tests
   For EACH endpoint in section 2:
     - same key twice, same body → one record/entry/ledger line/stock move; second answer is the
       stored 2xx body + Idempotent-Replay header;
     - same key, different body → 422, nothing changed;
     - no key → unchanged behaviour (one existing test per endpoint still passes);
     - first request fails (e.g. 400 not enough cash / over-return) → the same key works on retry
       once the problem is fixed.
   Concurrency: two parallel requests with the same key → exactly one does the work, the other
   gets 409 inProgress or the replay. Section 3: second call returns the flag + record.
   Section 4: a standalone refund appears in today-summary.
   POST /bill and POST /bill/:id/add-items: existing idempotency tests still pass unchanged.

Rules: don't commit, tag or push without my permission. Tell me the changed files, show one
replayed response (headers + body) for POST /bill/:id/return and POST /customer/:id/collect,
and paste the test output.
```

## What the desktop will do once this ships

- Each of these screens creates one key per attempt and keeps it until a definite answer (same
  pattern as the till now: kept on "no answer", dropped on a definite "no", replay = success).
- Screens: Returns (bill + no-bill), customer payment, bill "Record payment", vendor pay, supply
  create/pay/return, expense create, Money Book actions, Cash Book deposit/withdraw.
- **Release order matters.** Today's server rejects unknown body fields (`allowUnknown: false`
  in `middleware/validate.mjs`) and its CORS only allows the `Content-Type` and `Authorization`
  headers. So a desktop that sends the key to the *current* live server would get "Validation
  failed" or a CORS block on every return and payment. **Deploy this backend first, then release the
  desktop that sends the keys** (same order as the rest of this branch).
