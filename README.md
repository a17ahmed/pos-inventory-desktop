# POS Desktop

Desktop application for the POS system, built with Electron + React + Vite.

## Setup

1. Install dependencies:
```bash
cd desktop
npm install
```

2. Run in development mode:
```bash
npm run electron:dev
```

This will start both the Vite dev server and Electron together.

## Building for Production

### Build for current platform:
```bash
npm run electron:build
```

### Build for Windows:
```bash
npm run electron:build:win
```

### Build for macOS:
```bash
npm run electron:build:mac
```

### Build for both platforms:
```bash
npm run electron:build:all
```

Built applications will be in the `release/` folder.

## Configuration

### Server URL
The app connects to your backend server. You can configure the server URL:
1. On the login screen, click "Server Configuration"
2. Enter your backend server URL (e.g., `http://192.168.100.26:3000`)
3. Click Save

Or change it in Settings > Server after logging in.

## Features

- Dashboard with sales analytics
- New Sale (POS interface)
- Product Management
- Employee Management
- Receipt History
- Expense Tracking
- Settings & Configuration

## Project Structure

```
desktop/
├── electron/          # Electron main process files
│   ├── main.js       # Main process entry
│   └── preload.js    # Preload script
├── public/           # Static assets
├── src/
│   ├── components/   # Reusable components
│   ├── context/      # React context providers
│   ├── screens/      # App screens
│   ├── services/     # API and services
│   ├── App.jsx       # Main app component
│   ├── main.jsx      # React entry point
│   └── index.css     # Global styles
├── package.json
├── vite.config.js
└── tailwind.config.js
```

## Requirements

- Node.js 18+
- npm or yarn
- For Windows builds: Windows OS or Wine
- For macOS builds: macOS
# pos-inventory-desktop
