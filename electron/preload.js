const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods to the renderer process
contextBridge.exposeInMainWorld('electronAPI', {
    // App info
    getAppVersion: () => ipcRenderer.invoke('get-app-version'),
    getPlatform: () => ipcRenderer.invoke('get-platform'),

    // Printing
    printReceipt: (data) => ipcRenderer.invoke('print-receipt', data),
    getPrinters: () => ipcRenderer.invoke('get-printers'),
    printWidthTest: (data) => ipcRenderer.invoke('print-width-test', data),
    openLogsFolder: () => ipcRenderer.invoke('open-logs-folder'),

    // Menu actions
    onMenuAction: (callback) => {
        ipcRenderer.on('menu-action', (event, action) => callback(action));
    },

    // Updates
    checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
    onUpdateStatus: (callback) => {
        ipcRenderer.on('update-status', (event, data) => callback(data));
    },

    // Window controls
    minimize: () => ipcRenderer.send('window-minimize'),
    maximize: () => ipcRenderer.send('window-maximize'),
    close: () => ipcRenderer.send('window-close'),

    // Windows title bar overlay color (for dark/light mode sync)
    setTitleBarColors: (bgColor, symbolColor) =>
        ipcRenderer.send('set-titlebar-colors', bgColor, symbolColor),
});

// Notify that preload script has run
console.log('Preload script loaded');
