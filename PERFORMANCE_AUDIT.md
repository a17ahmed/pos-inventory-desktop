# Performance Audit - POS Desktop

## CRITICAL Issues (Fix First)

### 1. No Lazy Route Loading — `src/App.jsx`
All 25+ screens imported synchronously at startup. Every screen loads even if user never visits it.
**Fix:** Use `React.lazy()` + `Suspense`

### 2. No API Caching — All screens
Products fetched 5+ times per session (Dashboard, Sales, Inventory, Products, Vendors). Same data re-downloaded every time.
**Fix:** Add in-memory cache or use React Query/SWR

### 3. Missing useMemo on Filtered Lists
- `src/screens/Sales.jsx` lines 111-117
- `src/screens/Products.jsx` lines 65-72
- `src/screens/Reports.jsx` — chart data transformations

Products/sales filtered on every render even if data hasn't changed.
**Fix:** Wrap in `useMemo()`

### 4. Sidebar Re-render Cascade — `src/components/Layout.jsx` lines 155-163
Mouse hover on sidebar toggles `sidebarExpanded` state → re-renders entire app including all children.
**Fix:** Memoize children, debounce hover, or use CSS-only hover

### 5. No Request Cancellation — `src/services/api.js`
No AbortController. Fast navigation fires multiple API calls, old ones still resolve and update unmounted components → memory leaks.
**Fix:** Add AbortController cleanup in useEffect

---

## HIGH Issues

### 6. Theme Toggle Forces Reflow — `src/context/ThemeContext.jsx` lines 22-26
```javascript
document.body.style.display = 'none';
document.body.offsetHeight; // forced reflow
document.body.style.display = '';
```
Causes janky flash on theme toggle. Remove this — CSS class toggle is enough.

### 7. Reports Charts All Loaded At Once — `src/screens/Reports.jsx`
Multiple recharts components (BarChart, PieChart, LineChart) rendered even for non-visible tabs. recharts bundles heavy D3 fork.
**Fix:** Lazy load chart components, only render active tab

### 8. Socket Never Disconnected — `src/services/socket.js`
`disconnectSocket()` exists but is never called anywhere. Socket persists across navigation → memory leak.
**Fix:** Call `disconnectSocket()` on logout

### 9. Layout NavItems Recalculated Every Render — `src/components/Layout.jsx` lines 72-79
`employeeNavItems` filter runs on every render.
**Fix:** Wrap in `useMemo()`

### 10. Auth Login Delay — `src/context/AuthContext.jsx` lines 55-61
```javascript
setTimeout(() => fetchPermissions(), 500);
```
Hardcoded 500ms delay after login. Should use `await` or `Promise.all()` instead.

---

## MEDIUM Issues

### 11. Unused Dependencies — `package.json`
- `escpos` and `escpos-usb` — not imported anywhere in code. Remove them.
- `html2pdf.js` — used only in VendorLedger. Should be dynamically imported.

### 12. Thermal Printer Uses Sync IO — `electron/main.js` line 435
`fs.writeFileSync()` blocks Electron main thread during print. Use `fs.promises.writeFile()`.

### 13. Auto-Updater Loaded at Startup — `electron/main.js` line 3
`electron-updater` required synchronously at app start. Could lazy-load after window ready.

### 14. localStorage Writes Not Batched — `src/screens/Dashboard.jsx` lines 311-320
Retail bills written to localStorage on every cart change. Should debounce.

### 15. Multiple localStorage Writes on Login — `src/context/AuthContext.jsx` lines 83-87
5 separate `localStorage.setItem()` calls. Could batch.

### 16. Receipts Page Duplicates State in Refs — `src/screens/Receipts.jsx` lines 143-150
`pageRef`, `loadingMoreRef`, `hasMoreRef` sync with state via useEffect. Anti-pattern.

### 17. Vite Missing Code-Splitting Config — `vite.config.mjs`
No `manualChunks` for large deps like recharts.

### 18. BusinessContext Missing try-catch on JSON.parse — `src/context/BusinessContext.jsx` lines 69-71
Corrupted localStorage crashes the app.

---

## LOW Issues

### 19. Redundant Frame Config — `electron/main.js` line 31
```javascript
frame: process.platform === 'darwin' ? true : true
```
Both branches are `true`. Simplify to `frame: true`.

### 20. isMac Computed Every Render — `src/components/Layout.jsx` line 82
Should be a constant outside the component or memoized.

### 21. Bills API String Concatenation — `src/services/api/bills.js` line 14
Use `params` object instead of manual query string building.

---

## Quick Wins (Biggest Impact, Least Effort)

| Fix | Effort | Impact |
|-----|--------|--------|
| Remove unused deps (escpos) | 5 min | Smaller bundle |
| Add useMemo to filters | 15 min | Stop thousands of re-renders |
| Remove theme reflow hack | 5 min | Smooth theme toggle |
| Lazy load routes | 30 min | Faster startup |
| Remove forced 500ms login delay | 5 min | Faster login |
| Disconnect socket on logout | 5 min | Stop memory leak |
