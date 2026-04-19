# TODO — POS Inventory Desktop

---

## Pending — Future

### Admin — Invoice Editing (Frontend + Backend)
- [ ] Backend: API endpoint to edit an existing invoice (admin only)
- [ ] Backend: Save full edit history (who edited, when, what changed)
- [ ] Backend: API endpoint to fetch edit history for an invoice
- [ ] Frontend: Add edit button on invoice/receipt detail (admin only)
- [ ] Frontend: Editable fields: items, quantities, prices, discounts, customer info
- [ ] Frontend: Show edit history log on invoice detail view (audit trail)

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
- [x] First Mac build (release/POS Desktop-1.0.0-arm64.dmg)
- [ ] Test the DMG locally
- [ ] Create GitHub Release (v1.0.0) to enable auto-updater
- [ ] Windows build (need Windows machine or CI)
- [ ] Code signing (optional, for later)

---

## Completed ✅

### Infrastructure
- [x] Git repo initialized & pushed (a17ahmed/pos-inventory-desktop)
- [x] .gitignore created
- [x] App icons generated (icon.ico, icon.icns)
- [x] Auto-updater configured in electron/main.js
- [x] Mac build successful

### Backend Fixes
- [x] Route ordering, employee soft delete, supply error logging, expense fields
- [x] Vendor Payment — Cash in Hand validation API
- [x] Cash Book — Opening Balance with dailySummary (auto-carry)
- [x] Vendor Ledger — Entry order fix (debit before credit)
- [x] Vendor Ledger — Unit Price in supply detail API
- [x] Seed Business Types

### Frontend Fixes
- [x] Stale permissions, Reports colors, Pending currency, employee reactivation UI
- [x] Vendor Payment — Cash in Hand validation UI (modal with balance display)
- [x] Cash Book — Opening Balance UI (uses dailySummary from backend)
- [x] Cash Book — Inline error handling (replaced alerts)
- [x] Vendor Ledger — Download PDF (replaced CSV)
- [x] Vendor Ledger — Unit Price fallback fix
- [x] Customer Ledger — Download PDF (replaced CSV)
- [x] Receipts — Print & Download unified (shared receiptTemplate.js)
- [x] Receipts — Credit bill detection fix (uses paymentStatus)
- [x] Receipts — Customer account balance fix (fetches from API)
- [x] Receipts — Thermal printer ESC/POS text mode reset fix
