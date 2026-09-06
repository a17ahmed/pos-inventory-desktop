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
    printPage: () => ipcRenderer.invoke('print-page'),
    exportReportPdf: (data) => ipcRenderer.invoke('export-report-pdf', data),

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

    // ── Offline store (local SQLite mirror of products & customers) ──────────
    offline: {
        // writes (sync-down)
        cacheProducts: (businessId, docs) => ipcRenderer.invoke('offline:cacheProducts', { businessId, docs }),
        cacheCustomers: (businessId, docs) => ipcRenderer.invoke('offline:cacheCustomers', { businessId, docs }),
        setSyncMeta: (businessId, resource, meta) => ipcRenderer.invoke('offline:setSyncMeta', { businessId, resource, meta }),
        // reads
        getProductByBarcode: (businessId, barcode) => ipcRenderer.invoke('offline:getProductByBarcode', { businessId, barcode }),
        getProductBySku: (businessId, sku) => ipcRenderer.invoke('offline:getProductBySku', { businessId, sku }),
        searchProducts: (businessId, query, limit) => ipcRenderer.invoke('offline:searchProducts', { businessId, query, limit }),
        getAllProducts: (businessId, opts) => ipcRenderer.invoke('offline:getAllProducts', { businessId, opts }),
        searchCustomers: (businessId, query, limit) => ipcRenderer.invoke('offline:searchCustomers', { businessId, query, limit }),
        getAllCustomers: (businessId, limit) => ipcRenderer.invoke('offline:getAllCustomers', { businessId, limit }),
        getCustomerById: (businessId, id) => ipcRenderer.invoke('offline:getCustomerById', { businessId, id }),
        getCustomerSummary: (businessId) => ipcRenderer.invoke('offline:getCustomerSummary', { businessId }),
        getStatus: (businessId) => ipcRenderer.invoke('offline:getStatus', { businessId }),
        clear: (businessId) => ipcRenderer.invoke('offline:clear', { businessId }),
        // writes (outbox)
        applyBill: (businessId, args) => ipcRenderer.invoke('offline:applyBill', { businessId, args }),
        applyPayment: (businessId, args) => ipcRenderer.invoke('offline:applyPayment', { businessId, args }),
        applyCustomer: (businessId, args) => ipcRenderer.invoke('offline:applyCustomer', { businessId, args }),
        getPendingOps: (businessId) => ipcRenderer.invoke('offline:getPendingOps', { businessId }),
        markOp: (businessId, id, patch) => ipcRenderer.invoke('offline:markOp', { businessId, id, patch }),
        getOutboxStatus: (businessId) => ipcRenderer.invoke('offline:getOutboxStatus', { businessId }),
        pendingOpCount: (businessId) => ipcRenderer.invoke('offline:pendingOpCount', { businessId }),
    },
});

// Notify that preload script has run
console.log('Preload script loaded');
