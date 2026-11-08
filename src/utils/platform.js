// True inside the Electron desktop app (preload exposes window.electronAPI),
// false when the same build runs as a web app in a normal browser.
// Desktop-only features (direct ESC/POS printing, printer picker, auto-update,
// window chrome) check this and fall back or hide themselves on the web.
export const isDesktopApp = typeof window !== 'undefined' && !!window.electronAPI;
export const isWebApp = !isDesktopApp;
