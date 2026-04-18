# TODO — POS Inventory Desktop

## Priority Fixes (Next Session)

### 1. Vendor Payment — Cash in Hand Validation
- [ ] Fetch and display **current cash in hand** in the Pay Vendor modal
- [ ] **Block payment** if amount > cash in hand (when payment method is Cash)
- [ ] **Block payment** if amount > vendor's remaining balance due
- [ ] Show cash in hand balance clearly in the modal UI

### 2. Cash Book — Opening Balance
- [ ] Opening balance should display **at the top** of each day's entries
- [ ] Opening balance is set **only once** (first time setup)
- [ ] After first time, user deposits cash (not re-setting opening balance)
- [ ] Previous day's closing balance = next day's opening balance (auto-carry)

### 3. Vendor Ledger — Entry Order Fix
- [ ] When supply is added with partial/full payment, entries should be:
  - **Debit first** (supply received → amount owed increases)
  - **Credit second** (payment made → amount owed decreases)
- [ ] Currently showing credit before debit — fix ordering

### 4. Vendor Ledger — Download PDF
- [ ] Change "Download CSV" to **"Download PDF"**
- [ ] PDF should cover the **selected time period** only
- [ ] Include: vendor info header, all ledger entries, totals row

### 5. Seed Business Types (New DB)
- [ ] Seed `businessTypes` collection with:
  - Retail Store, Restaurant, Grocery Store, Pharmacy, Electronics, Clothing, Hardware Store, General Store, Other

---

## Deployment Tasks

### Oracle Cloud VM (Backend)
- [ ] Oracle account activation (Mumbai region)
- [ ] Create VM instance
- [ ] Install Node.js, PM2, Nginx
- [ ] Deploy backend API
- [ ] Update `VITE_API_URL` to Oracle VM IP
- [ ] Socket.IO will work on Oracle (persistent server)

### Desktop Distribution
- [ ] First Mac build — DONE ✅
- [ ] Test the DMG locally
- [ ] Create GitHub Release (v1.0.0) to enable auto-updater
- [ ] Windows build (need Windows machine or CI)
- [ ] Code signing (optional, for later)

---

## Completed ✅
- [x] Git repo initialized & pushed (a17ahmed/pos-inventory-desktop)
- [x] .gitignore created
- [x] App icons generated (icon.ico, icon.icns)
- [x] Auto-updater configured in electron/main.js
- [x] Mac build successful (release/POS Desktop-1.0.0-arm64.dmg)
- [x] Backend bugs fixed (route ordering, employee soft delete, supply error logging, expense fields)
- [x] Frontend bugs fixed (stale permissions, Reports colors, Pending currency, employee reactivation UI)
