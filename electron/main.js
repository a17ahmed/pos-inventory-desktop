const { app, BrowserWindow, ipcMain, Menu, shell, dialog } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');
const { runOfflineDbSmokeTest } = require('./offlineDbSmokeTest');

// Sentry — production builds only, initialized as early as possible to catch startup crashes.
// DSN is safe to embed in source (it's a public write-only identifier, not a secret).
if (app.isPackaged) {
    const Sentry = require('@sentry/electron/main');
    Sentry.init({
        dsn: 'https://7477330dad5d7fcfdb8da627558a463c@o4511976432992256.ingest.de.sentry.io/4511976441184336',
        release: `pos-desktop@${app.getVersion()}`,
    });
}

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
// Phase 0 offline-store probe (better-sqlite3). Guarded internally — never throws.
let offlineDbSmokeResult = null;

app.whenReady().then(() => {
    offlineDbSmokeResult = runOfflineDbSmokeTest(app);
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

// Phase 0: lets the renderer read the offline-store smoke-test outcome.
ipcMain.handle('get-offline-db-status', () => offlineDbSmokeResult);

ipcMain.handle('check-for-updates', () => {
    if (!isDev) {
        autoUpdater.checkForUpdates().catch(() => {});
    }
    return { checking: true };
});

// ──── PRINT DIAGNOSTICS ────
// Every print attempt appends a line here so a remote failure at the customer's
// shop can be diagnosed from one file (Settings → Receipt Settings → Open print log).
function getPrintLogDir() {
    const fs = require('fs');
    let dir;
    try { dir = app.getPath('logs'); }
    catch (e) { dir = path.join(app.getPath('userData'), 'logs'); }
    try { fs.mkdirSync(dir, { recursive: true }); } catch (_) { /* ignore */ }
    return dir;
}

function logPrint(...parts) {
    const fs = require('fs');
    const line = '[' + new Date().toISOString() + '] ' + parts.join(' ') + '\n';
    console.log('[PRINT]', ...parts);
    try { fs.appendFileSync(path.join(getPrintLogDir(), 'print.log'), line); } catch (_) { /* ignore */ }
}

// Open the folder that holds print.log so the shop can send it over.
ipcMain.handle('open-logs-folder', async () => {
    try {
        await shell.openPath(getPrintLogDir());
        return { success: true, path: getPrintLogDir() };
    } catch (e) {
        return { success: false, error: e.message };
    }
});

// Open the system print dialog for the current view (respects @media print CSS).
// Explicit webContents.print is reliable on Windows, where renderer
// window.print() can silently do nothing. Shows the same dialog as macOS.
ipcMain.handle('print-page', async (event) => {
    try {
        return await new Promise((resolve) => {
            event.sender.print({ silent: false, printBackground: true }, (success, failureReason) => {
                resolve({ success, failureReason: failureReason || null });
            });
        });
    } catch (e) {
        // e.g. "No valid printers available" can throw synchronously on a PC
        // with no printers — don't let it become an unhandled rejection.
        console.error('print-page error:', e);
        return { success: false, failureReason: e.message };
    }
});

// List installed printers so the user can pick their thermal printer in Settings.
ipcMain.handle('get-printers', async (event) => {
    try {
        const printers = await event.sender.getPrintersAsync();
        return printers.map((p) => ({ name: p.name, displayName: p.displayName, isDefault: p.isDefault, status: p.status }));
    } catch (e) {
        console.error('get-printers error:', e);
        return [];
    }
});

// A virtual/software printer we must never send raw ESC/POS bytes to.
function isVirtualPrinter(name) {
    return /microsoft print to pdf|xps|onenote|fax|document writer|pdf/i.test(name || '');
}

// Choose which installed printer to print to: an explicit user choice wins,
// then a name that looks like a thermal printer, then the system default,
// then any real (non-virtual) printer.
function pickPrinterName(printers, preferred) {
    const list = Array.isArray(printers) ? printers : [];
    if (preferred && list.some((p) => p.name === preferred)) return preferred;
    const thermal = list.find((p) => /(pos|thermal|receipt|speed|stm|80mm|58mm|xprinter|xp-?80|gprinter|epson tm|rongta|bixolon|zjiang|zj-)/i.test(p.name) && !isVirtualPrinter(p.name));
    if (thermal) return thermal.name;
    const def = list.find((p) => p.isDefault);
    if (def && !isVirtualPrinter(def.name)) return def.name;
    const firstReal = list.find((p) => !isVirtualPrinter(p.name));
    return firstReal ? firstReal.name : null;
}

// Send raw ESC/POS bytes to a Windows printer through the print spooler (RAW
// datatype) — the same driver path a Windows test page / PDF uses. This is the
// reliable way to reach a USB printer installed via a driver; writing straight
// to \\.\USBxxx does NOT work for driver-installed USB printers. Returns true
// on success.
function sendRawToWindowsPrinter(filePath, printerName) {
    const { execSync } = require('child_process');
    const fs = require('fs');
    const os = require('os');
    const psPath = path.join(os.tmpdir(), 'posprint_' + Date.now() + '.ps1');
    const escPs = (s) => String(s).replace(/'/g, "''"); // escape single quotes for a PS string literal
    const ps = `$ErrorActionPreference = 'Stop'
$PrinterName = '${escPs(printerName)}'
$FilePath = '${escPs(filePath)}'
$signature = @'
using System;
using System.IO;
using System.Runtime.InteropServices;
public class RawPrinterHelper {
  [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)]
  public struct DOCINFOW { [MarshalAs(UnmanagedType.LPWStr)] public string pDocName; [MarshalAs(UnmanagedType.LPWStr)] public string pOutputFile; [MarshalAs(UnmanagedType.LPWStr)] public string pDataType; }
  [DllImport("winspool.Drv", EntryPoint="OpenPrinterW", SetLastError=true, CharSet=CharSet.Unicode)] public static extern bool OpenPrinter(string src, out IntPtr hPrinter, IntPtr pd);
  [DllImport("winspool.Drv", EntryPoint="ClosePrinter", SetLastError=true)] public static extern bool ClosePrinter(IntPtr hPrinter);
  [DllImport("winspool.Drv", EntryPoint="StartDocPrinterW", SetLastError=true, CharSet=CharSet.Unicode)] public static extern bool StartDocPrinter(IntPtr hPrinter, int level, ref DOCINFOW di);
  [DllImport("winspool.Drv", EntryPoint="EndDocPrinter", SetLastError=true)] public static extern bool EndDocPrinter(IntPtr hPrinter);
  [DllImport("winspool.Drv", EntryPoint="StartPagePrinter", SetLastError=true)] public static extern bool StartPagePrinter(IntPtr hPrinter);
  [DllImport("winspool.Drv", EntryPoint="EndPagePrinter", SetLastError=true)] public static extern bool EndPagePrinter(IntPtr hPrinter);
  [DllImport("winspool.Drv", EntryPoint="WritePrinter", SetLastError=true)] public static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, int dwCount, out int dwWritten);
  public static bool SendFile(string printerName, string filePath) {
    byte[] bytes = File.ReadAllBytes(filePath);
    IntPtr hPrinter;
    DOCINFOW di = new DOCINFOW(); di.pDocName = "POS Receipt"; di.pDataType = "RAW";
    if (!OpenPrinter(printerName, out hPrinter, IntPtr.Zero)) return false;
    bool ok = false;
    if (StartDocPrinter(hPrinter, 1, ref di)) {
      if (StartPagePrinter(hPrinter)) {
        IntPtr p = Marshal.AllocCoTaskMem(bytes.Length);
        Marshal.Copy(bytes, 0, p, bytes.Length);
        int written;
        ok = WritePrinter(hPrinter, p, bytes.Length, out written);
        Marshal.FreeCoTaskMem(p);
        EndPagePrinter(hPrinter);
      }
      EndDocPrinter(hPrinter);
    }
    ClosePrinter(hPrinter);
    return ok;
  }
}
'@
Add-Type -TypeDefinition $signature -Language CSharp
if ([RawPrinterHelper]::SendFile($PrinterName, $FilePath)) { exit 0 } else { exit 3 }`;
    try {
        fs.writeFileSync(psPath, ps, 'utf8');
        const out = execSync(`powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "${psPath}"`, {
            timeout: 20000,
            windowsHide: true,
            encoding: 'utf8',
        });
        return { ok: true, detail: (out || '').trim() };
    } catch (e) {
        // Capture PowerShell's stdout/stderr so the real reason lands in print.log.
        const detail = [
            e.message,
            e.stdout && ('stdout: ' + String(e.stdout).trim()),
            e.stderr && ('stderr: ' + String(e.stderr).trim()),
        ].filter(Boolean).join(' | ');
        return { ok: false, detail };
    } finally {
        try { fs.unlinkSync(psPath); } catch (_) { /* ignore */ }
    }
}

// Characters per line, chosen per-machine in Settings. Defaults to 42 (the
// value the first deployed shop needs) when unset/invalid, so an app that
// updates before the setting is picked keeps working. 58mm = 32, 80mm = 42 or 48.
function resolvePaperWidth(paperWidth) {
    const w = parseInt(paperWidth, 10);
    return [32, 42, 48].includes(w) ? w : 42;
}

// Word-wrap text into lines no wider than `width` chars. Wraps on spaces;
// hard-splits any single word longer than the column. Used so long item names
// print in full (wrapping to extra lines) instead of being truncated.
function wrapText(text, width) {
    const words = String(text || '').trim().split(/\s+/).filter(Boolean);
    if (!words.length) return [''];
    const lines = [];
    let line = '';
    for (let word of words) {
        while (word.length > width) {
            if (line) { lines.push(line); line = ''; }
            lines.push(word.slice(0, width));
            word = word.slice(width);
        }
        if (!line) {
            line = word;
        } else if ((line + ' ' + word).length <= width) {
            line += ' ' + word;
        } else {
            lines.push(line);
            line = word;
        }
    }
    if (line) lines.push(line);
    return lines;
}

// Deliver an ESC/POS temp file to the printer (cross-platform). Throws on
// failure. Shared by the receipt print and the paper-width test.
async function deliverPrintFile(tmpFile, printerName, event, byteLen) {
    const { execSync } = require('child_process');

    if (process.platform === 'win32') {
        // Windows: print through the spooler/driver (RAW) — the same path a
        // Windows test page or PDF uses. Writing straight to \\.\USBxxx does
        // not work for driver-installed USB printers.
        let printers = [];
        try {
            printers = await event.sender.getPrintersAsync();
        } catch (e) {
            logPrint('getPrintersAsync FAILED:', e.message);
        }
        logPrint('installed printers:', JSON.stringify(printers.map((p) => ({ name: p.name, default: p.isDefault, status: p.status }))));

        const target = pickPrinterName(printers, printerName);
        logPrint('chosen target:', target || '(none)', '| ESC/POS bytes:', byteLen);

        let printed = false;
        if (target) {
            const res = sendRawToWindowsPrinter(tmpFile, target);
            logPrint('RAW spool ->', '"' + target + '":', res.ok ? 'OK' : 'FAILED', res.detail ? ('| ' + res.detail) : '');
            printed = res.ok;
        } else {
            logPrint('no target printer resolved — skipping RAW spool');
        }

        // Last-resort fallback for older setups where a printer exposes a
        // raw USB/LPT port directly.
        if (!printed) {
            const ports = ['USB001', 'USB002', 'USB003', 'LPT1'];
            for (const port of ports) {
                try {
                    execSync(`copy /b "${tmpFile}" \\\\.\\${port}`, {
                        shell: 'cmd.exe',
                        timeout: 10000,
                        windowsHide: true,
                    });
                    printed = true;
                    logPrint('fallback direct-port', port, ': OK');
                    break;
                } catch (e) {
                    logPrint('fallback direct-port', port, ': failed');
                }
            }
        }

        if (!printed) {
            const names = printers.map((p) => p.name).join(', ') || 'none detected';
            logPrint('RESULT: FAILED — no delivery method worked');
            const err = new Error(
                'Could not reach the receipt printer' + (target ? ' ("' + target + '")' : '') +
                '. Installed printers: ' + names +
                '. Open Settings → Receipt Settings and pick your thermal printer under "Receipt Printer".'
            );
            // No printer resolved at all = nothing attached → skip quietly.
            // A resolved-but-unreachable printer is a real error worth showing.
            err.noPrinter = !target;
            throw err;
        }
        logPrint('RESULT: SUCCESS via', target ? ('printer "' + target + '"') : 'fallback port');
    } else {
        // macOS / Linux: use CUPS `lp -o raw`. Try the printer the user picked,
        // then a thermal-looking CUPS printer, then the legacy default name.
        let cupsList = '';
        try {
            // `|| true` so a failed/empty lpstat never throws (was surfacing a
            // cryptic "Command failed: lpstat" error to the cashier).
            cupsList = execSync('lpstat -p 2>/dev/null || true', { timeout: 5000 }).toString();
        } catch (e) { /* no CUPS / no printers */ }

        const targets = [];
        if (printerName) targets.push(printerName);
        const posMatch = cupsList.match(/printer (\S*(?:POS|STM|Thermal|Receipt|Speed)\S*)/i);
        if (posMatch) targets.push(posMatch[1]);
        targets.push('STMicroelectronics_POS80_Printer_USB');

        let printed = false;
        for (const t of targets) {
            try {
                execSync(`lp -d "${t}" -o raw "${tmpFile}"`, { timeout: 10000, stdio: 'pipe' });
                printed = true;
                logPrint('RESULT: SUCCESS via CUPS printer', t);
                break;
            } catch (e) {
                logPrint('CUPS lp ->', t, ': failed');
            }
        }

        if (!printed) {
            logPrint('RESULT: FAILED — no CUPS printer worked');
            const err = new Error(
                'No thermal printer found on this Mac' + (printerName ? ' ("' + printerName + '")' : '') +
                '. CUPS printers: ' + (cupsList.trim() || 'none') +
                '. (This is a Mac-only path — the shop\'s Windows PC prints via the spooler and is unaffected.)'
            );
            // No CUPS printer at all = nothing attached → skip quietly.
            err.noPrinter = !cupsList.trim();
            throw err;
        }
    }
}

// Handle print request — uses node-thermal-printer for cross-platform support
ipcMain.handle('print-receipt', async (event, { receiptData, printerName, paperWidth }) => {
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

        // Chars per line for this printer (32/42/48), chosen in Settings. Column
        // widths below are computed from W so any paper size stays aligned.
        const W = resolvePaperWidth(paperWidth);

        logPrint('--- print-receipt START ---', 'platform:', process.platform, '| bill:', billNumber, '| printer:', printerName || '(auto)', '| width:', W, '| store:', storeName);
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
        // Column widths must sum to W. Numeric columns are fixed (tighter on
        // 58mm); 'name' absorbs the remaining space. 'disc' is the last column,
        // so its right edge is the paper edge — an exact sum prevents wrapping.
        const c = {
            sr: W >= 42 ? 3 : 2,
            qty: W >= 42 ? 4 : 3,
            rate: W >= 42 ? 7 : 6,
            amt: W >= 42 ? 8 : 6,
            disc: W >= 42 ? 6 : 5,
        };
        c.name = W - (c.sr + c.qty + c.rate + c.amt + c.disc);

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

            // Full item name: first chunk shares the row with the numbers; any
            // overflow wraps onto extra lines in the name column below, so long
            // names print in full while short names still take a single line.
            const nameLines = wrapText(item.name, c.name);

            printer.tableCustom([
                { text: String(i + 1), cols: c.sr },
                { text: nameLines[0], cols: c.name },
                { text: String(item.qty), cols: c.qty, align: 'RIGHT' },
                { text: num(rate), cols: c.rate, align: 'RIGHT' },
                { text: num(amount), cols: c.amt, align: 'RIGHT' },
                { text: disc > 0 ? '-' + num(disc) : '0', cols: c.disc, align: 'RIGHT' },
            ]);

            for (let k = 1; k < nameLines.length; k++) {
                printer.tableCustom([
                    { text: '', cols: c.sr },
                    { text: nameLines[k], cols: c.name },
                    { text: '', cols: c.qty },
                    { text: '', cols: c.rate },
                    { text: '', cols: c.amt },
                    { text: '', cols: c.disc },
                ]);
            }
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

        // Get the raw ESC/POS buffer and deliver it to the printer.
        const buffer = printer.getBuffer();
        fs.writeFileSync(tmpFile, buffer);
        await deliverPrintFile(tmpFile, printerName, event, buffer.length);

        return { success: true };
    } catch (error) {
        logPrint('RESULT: ERROR —', error.message);
        console.error('Print error:', error);
        // noPrinter = nothing attached → the frontend skips the popup for this.
        return { success: false, error: error.message, noPrinter: !!error.noPrinter };
    } finally {
        try { fs.unlinkSync(tmpFile); } catch (e) { /* ignore */ }
    }
});

// Print a paper-width ruler so the shop can see which width their printer fits.
// Each line is exactly N characters ending in '|'; the largest number whose
// line does NOT wrap is the printer's characters-per-line.
ipcMain.handle('print-width-test', async (event, { printerName } = {}) => {
    const fs = require('fs');
    const os = require('os');
    const ThermalPrinter = require('node-thermal-printer').printer;
    const PrinterTypes = require('node-thermal-printer').types;
    const tmpFile = path.join(os.tmpdir(), 'widthtest_' + Date.now() + '.bin');

    try {
        logPrint('--- print-width-test START --- printer:', printerName || '(auto)');
        const printer = new ThermalPrinter({
            type: PrinterTypes.EPSON,
            interface: tmpFile,
            width: 48,
            characterSet: 'PC437_USA',
        });

        printer.alignCenter();
        printer.bold(true);
        printer.println('PAPER WIDTH TEST');
        printer.bold(false);
        printer.alignLeft();
        printer.println('The largest number whose line');
        printer.println('ends with | on ONE line (does');
        printer.println('not wrap) is your paper width.');
        printer.println('-'.repeat(30));
        [32, 42, 48].forEach((w) => {
            const label = String(w);
            printer.println(label + '-'.repeat(w - label.length - 1) + '|');
        });
        printer.println('-'.repeat(30));
        printer.println('Set it in Receipt Settings ->');
        printer.println('Paper Width.');
        printer.newLine();
        printer.newLine();
        printer.partialCut();

        const buffer = printer.getBuffer();
        fs.writeFileSync(tmpFile, buffer);
        await deliverPrintFile(tmpFile, printerName, event, buffer.length);

        return { success: true };
    } catch (error) {
        logPrint('width-test ERROR —', error.message);
        console.error('Width test error:', error);
        return { success: false, error: error.message };
    } finally {
        try { fs.unlinkSync(tmpFile); } catch (e) { /* ignore */ }
    }
});
