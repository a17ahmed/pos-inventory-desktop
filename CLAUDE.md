# POS Inventory Desktop

## Project Overview
Electron + React (Vite) desktop POS application. Frontend connects to Node.js backend deployed on Vercel.

## Tech Stack
- **Frontend:** React 18, Vite, Tailwind CSS
- **Desktop:** Electron 28, electron-builder
- **Backend:** Node.js (separate repo), MongoDB, deployed on Vercel
- **Auto-updater:** electron-updater via GitHub Releases

## Key Paths
- `electron/` — Electron main process (main.js, preload.js)
- `src/screens/` — All app screens (Sales, Inventory, Vendors, etc.)
- `src/services/api/` — API service modules per resource
- `src/context/` — Auth, Business, Theme contexts
- `public/` — Icons (svg, ico, icns)

## Commands
- `npm run electron:dev` — Dev mode (Vite + Electron)
- `npm run electron:build:mac` — Build Mac DMG
- `npm run electron:build:win` — Build Windows installer

## GitHub
- Desktop repo: a17ahmed/pos-inventory-desktop
- Auto-update publishes via GitHub Releases

## Notes
- `.env` uses `VITE_API_URL` for backend URL (baked into build by Vite)
- Socket.IO won't work on Vercel (serverless) — needs persistent server (Oracle Cloud planned)
- App is unsigned — users must right-click → Open on Mac, "Run anyway" on Windows
