# Screen map

Every screen and shared component, how big it is today, and which stage reworks it.
"Before" pictures are in `current/` (`light-*.png`, `dark-*.png`).

Counts: lines of code · hand-built `<table>`s · own modal overlays (`fixed inset-0`) ·
charts · hard-coded `text-[Npx]` sizes.

| File | Lines | Tables | Modals | Charts | px sizes | Main stage | Before shot |
| --- | ---: | ---: | ---: | ---: | ---: | --- | --- |
| `screens/Dashboard.jsx` — **POS checkout** (`EmployeeDashboard`, lines 79–2877) | ~2,800 | 0 | 6 | 0 | ~170 | **8** | `light-pos-checkout.png` |
| `screens/Dashboard.jsx` — admin dashboard (`AdminDashboard`, 2878–3719) | ~840 | 0 | 0 | 2 | ~8 | **7** | `light-dashboard.png` |
| `screens/Vendors.jsx` | 2,043 | 3 | 4 | 0 | 6 | 6.3 | `light-vendors.png` |
| `screens/CustomerLedger.jsx` | 1,683 | 2 | 2 | 0 | 41 | 6.4 | — |
| `screens/VendorLedger.jsx` | 1,573 | 4 | 2 | 0 | 22 | 6.4 | — |
| `screens/Returns.jsx` | 1,366 | 0 | 2 | 0 | 0 | 6.5 / 9 | — |
| `screens/Reports.jsx` | 1,324 | 1 | 1 | 6 | 0 | 7 | `light-reports.png` |
| `screens/Receipts.jsx` | 1,246 | 2 | 2 | 0 | 1 | 6.2 (pilot 2) | `light-receipts.png` |
| `screens/Inventory.jsx` | 1,150 | 6 | 2 | 0 | 2 | 6.5 | — |
| `screens/Settings.jsx` | 1,094 | 0 | 6 | 0 | 0 | 9 (+ Appearance in 2) | `light-settings.png` |
| `screens/Employees.jsx` | 860 | 0 | 2 | 0 | 0 | 6.3 / 9 | — |
| `screens/Customers.jsx` | 803 | 1 | 1 | 0 | 1 | 6.3 | `light-customers.png` |
| `screens/Expenses.jsx` | 788 | 1 | 2 | 0 | 0 | 6.3 | — |
| `screens/Closing.jsx` | 723 | 1 | 2 | 0 | 0 | 9 | `light-closing.png` |
| `screens/Sales.jsx` | 687 | 0 | 2 | 0 | 0 | 6.5 | — |
| `screens/CashBook.jsx` (old Cash Book, Money Book OFF) | 654 | 1 | 1 | 0 | 0 | 6.4 | — |
| `screens/Products.jsx` | 403 | 1 | 0 | 0 | 0 | **6.1 (pilot)** | `light-products.png` |
| `screens/Signup.jsx`, `screens/Login.jsx` | 397 · 325 | 0 | 0 | 0 | 0 | 9.4 | `light-login.png` |
| `screens/EmployeeAnalytics.jsx` | 373 | 0 | 0 | 2 | 0 | 7 | — |
| `screens/Profile.jsx` | 350 | 0 | 0 | 0 | 0 | 9 | — |
| `screens/ClosingDetail.jsx` | 306 | 4 | 0 | 0 | 0 | 9 | — |
| `screens/MoneyBook.jsx` + `components/moneybook/*` | 297 + ~1,330 | 5 | 1 | 0 | ~19 | 6.4 / 7 | `light-money-book.png` |
| `components/Layout.jsx` (sidebar) | 423 | 0 | 0 | 0 | 14 | **5** | all |
| `components/ClosingReport.jsx` | 505 | 2 | 1 | 0 | 6 | 9 | `light-closing.png` |
| `components/ProductFormModal.jsx` | 441 | 0 | 2 | 0 | 9 | 4 / 9 | — |
| `components/AppDialog.jsx` (appAlert / appConfirm) | 203 | 0 | 1 | 0 | 0 | **4** | — |
| `components/AccountStatus.jsx`, `NetworkStatus.jsx` | 224 · 71 | 0 | 2 | 0 | 0 | 4 | — |
| `components/AccountPicker.jsx`, `SpecialRatesEditor.jsx` | 141 · 189 | 0 | 0 | 0 | 5 | 3 / 9 | — |

Not redesigned (fixed print formats): `utils/receiptTemplate.js`, `utils/printReceipt.js`,
`utils/downloadReceipt.js`, the closing PDF HTML in `ClosingDetail.jsx`, `utils/customerStatement.js`.
