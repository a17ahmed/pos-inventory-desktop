const { app, BrowserWindow, ipcMain, Menu, shell, dialog } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');

// Overlay scrollbars on Windows (matches macOS behaviour — scrollbars float over content)
if (process.platform === 'win32') {
    app.commandLine.appendSwitch('enable-features', 'OverlayScrollbar');
    app.commandLine.appendSwitch('overlay-scrollbars');
}

// Handle creating/removing shortcuts on Windows when installing/uninstalling
try {
    if (require('electron-squirrel-startup')) {
        app.quit();
    }
} catch (e) {
    // electron-squirrel-startup not available in dev
}

let mainWindow;

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

function createWindow() {
    // Create the browser window
    const isWin = process.platform === 'win32';
    const isMac = process.platform === 'darwin';

    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 1024,
        minHeight: 700,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js'),
        },
        // Mac: inset traffic lights overlaid on content
        // Windows: hidden title bar with native overlay controls (min/max/close in top-right)
        titleBarStyle: isMac ? 'hiddenInset' : 'hidden',
        ...(isWin && {
            titleBarOverlay: {
                color: '#ffffff',
                symbolColor: '#334155',
                height: 40,
            },
        }),
        backgroundColor: '#f8fafc',
        show: false,
    });

    // Load the app
    if (isDev) {
        mainWindow.loadURL('http://localhost:5177');
        // Open DevTools in development
        mainWindow.webContents.openDevTools();
    } else {
        mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    }

    // Show window when ready
    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
    });

    // Handle external links
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        shell.openExternal(url);
        return { action: 'deny' };
    });

    // Handle window closed
    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

// Create application menu
function createMenu() {
    const template = [
        {
            label: 'File',
            submenu: [
                {
                    label: 'New Sale',
                    accelerator: 'CmdOrCtrl+N',
                    click: () => {
                        mainWindow?.webContents.send('menu-action', 'new-sale');
                    }
                },
                { type: 'separator' },
                {
                    label: 'Print Receipt',
                    accelerator: 'CmdOrCtrl+P',
                    click: () => {
                        mainWindow?.webContents.send('menu-action', 'print');
                    }
                },
                { type: 'separator' },
                { role: 'quit' }
            ]
        },
        {
            label: 'Edit',
            submenu: [
                { role: 'undo' },
                { role: 'redo' },
                { type: 'separator' },
                { role: 'cut' },
                { role: 'copy' },
                { role: 'paste' },
                { role: 'selectAll' }
            ]
        },
        {
            label: 'View',
            submenu: [
                { role: 'reload' },
                { role: 'forceReload' },
                { type: 'separator' },
                { role: 'resetZoom' },
                { role: 'zoomIn' },
                { role: 'zoomOut' },
                { type: 'separator' },
                { role: 'togglefullscreen' },
                ...(isDev ? [{ type: 'separator' }, { role: 'toggleDevTools' }] : [])
            ]
        },
        {
            label: 'Window',
            submenu: [
                { role: 'minimize' },
                { role: 'zoom' },
                { type: 'separator' },
                { role: 'close' }
            ]
        },
        {
            label: 'Help',
            submenu: [
                {
                    label: 'About POS Desktop',
                    click: () => {
                        mainWindow?.webContents.send('menu-action', 'about');
                    }
                }
            ]
        }
    ];

    // Add Mac-specific menu items
    if (process.platform === 'darwin') {
        template.unshift({
            label: app.getName(),
            submenu: [
                { role: 'about' },
                { type: 'separator' },
                { role: 'services' },
                { type: 'separator' },
                { role: 'hide' },
                { role: 'hideOthers' },
                { role: 'unhide' },
                { type: 'separator' },
                { role: 'quit' }
            ]
        });
    }

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
}

// ──── Auto Updater ────
function setupAutoUpdater() {
    if (isDev) return; // Skip in development

    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;

    autoUpdater.on('update-available', (info) => {
        console.log('Update available:', info.version);
        mainWindow?.webContents.send('update-status', {
            status: 'available',
            version: info.version,
        });
    });

    autoUpdater.on('update-not-available', (info) => {
        console.log('Up to date:', info.version);
        mainWindow?.webContents.send('update-status', {
            status: 'up-to-date',
            version: info.version,
        });
    });

    autoUpdater.on('download-progress', (progress) => {
        mainWindow?.webContents.send('update-status', {
            status: 'downloading',
            percent: Math.round(progress.percent),
        });
    });

    autoUpdater.on('update-downloaded', (info) => {
        console.log('Update downloaded:', info.version);
        mainWindow?.webContents.send('update-status', {
            status: 'ready',
            version: info.version,
        });

        dialog.showMessageBox(mainWindow, {
            type: 'info',
            title: 'Update Ready',
            message: `Version ${info.version} has been downloaded.`,
            detail: 'Restart now to apply the update?',
            buttons: ['Restart Now', 'Later'],
            defaultId: 0,
        }).then((result) => {
            if (result.response === 0) {
                autoUpdater.quitAndInstall(false, true);
            }
        });
    });

    autoUpdater.on('error', (err) => {
        console.error('Auto-update error:', err);
    });

    // Check for updates every 4 hours
    autoUpdater.checkForUpdates().catch(() => {});
    setInterval(() => {
        autoUpdater.checkForUpdates().catch(() => {});
    }, 4 * 60 * 60 * 1000);
}

// App ready
app.whenReady().then(() => {
    createWindow();
    createMenu();
    setupAutoUpdater();

    // macOS: re-create window when clicking dock icon
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

// Quit when all windows are closed (except on macOS)
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// IPC Handlers
ipcMain.handle('get-app-version', () => {
    return app.getVersion();
});

// Sync Windows title bar overlay colors with the app's dark/light theme
ipcMain.on('set-titlebar-colors', (event, bgColor, symbolColor) => {
    if (process.platform === 'win32' && mainWindow) {
        mainWindow.setTitleBarOverlay({ color: bgColor, symbolColor, height: 40 });
    }
});

ipcMain.handle('get-platform', () => {
    return process.platform;
});

ipcMain.handle('check-for-updates', () => {
    if (!isDev) {
        autoUpdater.checkForUpdates().catch(() => {});
    }
    return { checking: true };
});

// Handle print request — uses node-thermal-printer for cross-platform support
ipcMain.handle('print-receipt', async (event, { receiptData }) => {
    const { execSync } = require('child_process');
    const fs = require('fs');
    const os = require('os');
    const ThermalPrinter = require('node-thermal-printer').printer;
    const PrinterTypes = require('node-thermal-printer').types;

    // Find the temp file path for the printer output
    const tmpFile = path.join(os.tmpdir(), 'receipt_' + Date.now() + '.bin');

    try {
        const {
            storeName, storeAddress, storePhone, cashierName,
            billNumber, date, customerName, customerBalanceBefore,
            customerPhone, customerAddress, showCustomerPhone, showCustomerAddress,
            items, subtotal, tax, itemDiscounts, billDiscount, total,
            paymentMethod, amountPaid, cashGiven, change, currency,
            receiptFooter, receiptNote
        } = receiptData;

        console.log('[PRINT DEBUG] storeName:', storeName, '| storePhone:', storePhone, '| receiptData keys:', Object.keys(receiptData));

        const W = 48;
        const money = (amt) => currency + ' ' + Number(amt).toLocaleString();
        const num = (n) => Number(n).toLocaleString();

        // Create printer instance — writes to temp file
        const printer = new ThermalPrinter({
            type: PrinterTypes.EPSON,
            interface: tmpFile,
            width: W,
            characterSet: 'PC437_USA',
            removeSpecialCharacters: false,
            lineCharacter: '-',
        });

        // ──── STORE HEADER ────
        printer.drawLine();
        printer.alignCenter();
        printer.setTextDoubleHeight();
        printer.bold(true);
        printer.println((storeName || 'STORE').toUpperCase());
        printer.setTextNormal();
        printer.bold(false);
        if (storeAddress) printer.println(storeAddress);
        if (storePhone) printer.println('Tel: ' + storePhone);
        printer.newLine();
        printer.bold(true);
        printer.println('SALE INVOICE');
        printer.bold(false);
        printer.alignLeft();
        printer.drawLine();

        // ──── BILL INFO ────
        printer.leftRight('Inv No: ' + billNumber, date);
        if (cashierName) printer.leftRight('Cashier: ' + cashierName, '');
        if (customerName && customerName !== 'Walk-in') {
            printer.leftRight('Customer: ' + customerName, '');
        }
        if (showCustomerPhone && customerPhone) {
            printer.leftRight('Phone: ' + customerPhone, '');
        }
        if (showCustomerAddress && customerAddress) {
            printer.leftRight('Address: ' + customerAddress, '');
        }
        printer.drawLine();

        // ──── ITEMS TABLE ────
        const c = { sr: 3, name: 16, qty: 5, rate: 7, amt: 9, disc: 8 };

        printer.tableCustom([
            { text: '#', cols: c.sr, bold: true },
            { text: 'Item', cols: c.name, bold: true },
            { text: 'Qty', cols: c.qty, align: 'RIGHT', bold: true },
            { text: 'Rate', cols: c.rate, align: 'RIGHT', bold: true },
            { text: 'Amt', cols: c.amt, align: 'RIGHT', bold: true },
            { text: 'Disc', cols: c.disc, align: 'RIGHT', bold: true },
        ]);
        printer.drawLine();

        let totalQty = 0;
        let totalAmt = 0;
        let totalDisc = 0;

        items.forEach((item, i) => {
            const rate = item.rate || item.price || 0;
            const amount = item.amount || (rate * item.qty);
            const disc = Number(item.discountAmount) || 0;
            totalQty += item.qty;
            totalAmt += amount;
            totalDisc += disc;

            let name = item.name;
            if (name.length > c.name - 1) name = name.substring(0, c.name - 2) + '.';

            printer.tableCustom([
                { text: String(i + 1), cols: c.sr },
                { text: name, cols: c.name },
                { text: String(item.qty), cols: c.qty, align: 'RIGHT' },
                { text: num(rate), cols: c.rate, align: 'RIGHT' },
                { text: num(amount), cols: c.amt, align: 'RIGHT' },
                { text: disc > 0 ? '-' + num(disc) : '0', cols: c.disc, align: 'RIGHT' },
            ]);
        });

        printer.drawLine();

        // Total row
        printer.bold(true);
        printer.tableCustom([
            { text: 'Total', cols: c.sr + c.name },
            { text: String(totalQty), cols: c.qty, align: 'RIGHT' },
            { text: '', cols: c.rate },
            { text: num(totalAmt), cols: c.amt, align: 'RIGHT' },
            { text: totalDisc > 0 ? '-' + num(totalDisc) : '0', cols: c.disc, align: 'RIGHT' },
        ]);
        printer.bold(false);
        printer.drawLine();

        // ──── TOTALS ────
        printer.leftRight('Sub Total:', money(subtotal));
        if (itemDiscounts > 0) printer.leftRight('Item Discount:', '-' + money(itemDiscounts));
        if (billDiscount > 0) printer.leftRight('Bill Discount:', '-' + money(billDiscount));
        if (tax > 0) printer.leftRight('Tax:', money(tax));
        printer.drawLine('=');

        // ──── GRAND TOTAL ────
        printer.bold(true);
        printer.setTextDoubleHeight();
        printer.leftRight('Total:', money(total));
        printer.setTextNormal();
        printer.bold(false);
        printer.drawLine('=');

        // ──── PAYMENT ────
        // Derived from amounts, not the payment-method string — a partial
        // credit sale may still be tendered/stored as 'cash'.
        const paidOnBill = amountPaid ?? 0;
        const billDue = Math.max(0, total - paidOnBill);
        const isPartial = billDue > 0 && paidOnBill > 0;
        const paymentLabel = isPartial ? `PARTIAL (${(paymentMethod || 'cash').toUpperCase()})` : (paymentMethod || 'cash').toUpperCase();

        printer.setTextNormal();
        printer.bold(false);
        printer.leftRight('Payment:', paymentLabel);
        if (paymentMethod === 'cash' && !isPartial && cashGiven > 0) {
            printer.leftRight('Tendered:', money(cashGiven));
            printer.leftRight('Change:', money(change));
        }
        if (isPartial) {
            printer.leftRight('Paid Now:', money(paidOnBill));
            printer.leftRight('Credited:', money(billDue));
        }

        // ──── PENDING BALANCE ────
        if (customerName && customerName !== 'Walk-in' && (billDue > 0 || customerBalanceBefore > 0)) {
            const previousBalance = customerBalanceBefore || 0;
            printer.leftRight('Balance:', money(previousBalance));
            printer.leftRight('Bill Balance:', money(billDue));
            printer.bold(true);
            printer.leftRight('Net Balance:', money(previousBalance + billDue));
            printer.bold(false);
        }

        printer.drawLine();

        // ──── FOOTER ────
        if (receiptNote) {
            printer.alignCenter();
            receiptNote.split('\n').forEach(line => printer.println(line));
            printer.drawLine();
        }
        printer.alignCenter();
        printer.bold(true);
        printer.println(receiptFooter || 'THANK YOU!');
        printer.bold(false);
        printer.alignLeft();
        printer.drawLine();
        printer.alignCenter();
        printer.println('Software by Ahmed');
        printer.println('0307-0019031');
        printer.alignLeft();
        printer.newLine();
        printer.newLine();
        printer.newLine();

        // Cut paper
        printer.partialCut();

        // Get the raw ESC/POS buffer
        const buffer = printer.getBuffer();

        // Write buffer to temp file
        fs.writeFileSync(tmpFile, buffer);

        // ──── SEND TO PRINTER (cross-platform) ────
        const platform = process.platform;

        if (platform === 'win32') {
            // Windows: try direct USB port, then shared printer
            let printed = false;
            const ports = ['USB001', 'USB002', 'USB003'];
            for (const port of ports) {
                try {
                    execSync(`copy /b "${tmpFile}" \\\\.\\${port}`, {
                        shell: 'cmd.exe',
                        timeout: 10000,
                        windowsHide: true,
                    });
                    printed = true;
                    break;
                } catch (e) { /* try next port */ }
            }

            if (!printed) {
                // Try finding printer via wmic
                try {
                    const wmicOut = execSync('wmic printer get name,portname /format:csv 2>nul', {
                        encoding: 'utf8',
                        shell: 'cmd.exe',
                        timeout: 5000,
                        windowsHide: true,
                    });
                    const match = wmicOut.match(/,(.*(?:POS|Thermal|Receipt|Speed|STM)[^,]*),/i);
                    if (match) {
                        execSync(`copy /b "${tmpFile}" "\\\\%COMPUTERNAME%\\${match[1].trim()}"`, {
                            shell: 'cmd.exe',
                            timeout: 10000,
                            windowsHide: true,
                        });
                        printed = true;
                    }
                } catch (e) { /* wmic failed */ }
            }

            if (!printed) {
                throw new Error('No thermal printer found on Windows. Make sure the printer is connected and drivers are installed.');
            }
        } else {
            // macOS / Linux: use CUPS lp command
            try {
                execSync(`lp -d STMicroelectronics_POS80_Printer_USB -o raw "${tmpFile}" 2>&1`, { timeout: 10000 });
            } catch (lpError) {
                const printers = execSync('lpstat -p 2>/dev/null', { timeout: 5000 }).toString();
                const posMatch = printers.match(/printer (\S*(?:POS|STM|Thermal|Receipt|Speed)\S*)/i);
                if (posMatch) {
                    execSync(`lp -d "${posMatch[1]}" -o raw "${tmpFile}" 2>&1`, { timeout: 10000 });
                } else {
                    throw new Error('No thermal printer found. Printers: ' + printers);
                }
            }
        }

        return { success: true };
    } catch (error) {
        console.error('Print error:', error);
        return { success: false, error: error.message };
    } finally {
        try { fs.unlinkSync(tmpFile); } catch (e) { /* ignore */ }
    }
});
