# ============================================================================
#  POS Raw-Print Test  (Windows only)
#
#  Proves whether the app's Windows printing method (RAW ESC/POS sent through
#  the Windows spooler by printer name) actually reaches YOUR thermal printer.
#  This uses the IDENTICAL Win32 winspool path the app uses in production.
#
#  HOW TO RUN:
#    1. Copy this file to the Windows machine that has the printer.
#    2. Right-click it -> "Run with PowerShell"
#         OR open PowerShell and run:
#         powershell -ExecutionPolicy Bypass -File .\test-print-windows.ps1
#    3. It lists your printers, then asks which one to test.
#
#  RESULT:
#    - A short receipt prints + paper cuts  => the app WILL print your bills.
#    - Nothing prints / error shown         => copy the message back to Ahmed.
# ============================================================================

param([string]$PrinterName)

$ErrorActionPreference = 'Stop'

Write-Host ""
Write-Host "=== POS Raw-Print Test ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Installed printers on this PC:" -ForegroundColor Yellow
try {
    Get-Printer | Select-Object Name, DriverName, PortName | Format-Table -AutoSize
} catch {
    # Fallback for very old systems without the Get-Printer cmdlet
    Get-WmiObject Win32_Printer | Select-Object Name, PortName | Format-Table -AutoSize
}

if (-not $PrinterName) {
    $PrinterName = Read-Host "Type the EXACT printer Name from the list above"
}
if (-not $PrinterName) { Write-Host "No printer name given. Exiting." -ForegroundColor Red; exit 1 }

Write-Host ""
Write-Host "Testing printer: '$PrinterName'" -ForegroundColor Green
Write-Host ""

# ---- Same Win32 RAW-spooler helper the app uses (electron/main.js) ----------
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
  public static bool SendBytes(string printerName, byte[] bytes) {
    IntPtr hPrinter;
    DOCINFOW di = new DOCINFOW(); di.pDocName = "POS Test"; di.pDataType = "RAW";
    if (!OpenPrinter(printerName, out hPrinter, IntPtr.Zero)) {
      throw new Exception("OpenPrinter failed (Win32 error " + Marshal.GetLastWin32Error() + "). Check the printer name is exactly right.");
    }
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

# ---- Build a small ESC/POS test receipt ------------------------------------
$data = New-Object System.IO.MemoryStream
function Add-B([byte[]]$b) { $data.Write($b, 0, $b.Length) }
function Add-T([string]$s) { $b = [System.Text.Encoding]::ASCII.GetBytes($s); $data.Write($b, 0, $b.Length) }

Add-B @(0x1B,0x40)              # ESC @  -> initialize
Add-B @(0x1B,0x61,0x01)        # ESC a 1 -> center
Add-B @(0x1D,0x21,0x11)        # GS ! 0x11 -> double width + height
Add-T  "TEST OK`n"
Add-B @(0x1D,0x21,0x00)        # GS ! 0 -> normal size
Add-T  "Raw ESC/POS printing works.`n"
Add-T  "Your POS bills will print.`n"
Add-B @(0x1B,0x61,0x00)        # ESC a 0 -> left
Add-T  ("-" * 32 + "`n")
Add-T  ("Printer: " + $PrinterName + "`n")
Add-T  ("Time:    " + (Get-Date).ToString() + "`n")
Add-B @(0x0A,0x0A,0x0A,0x0A)   # feed
Add-B @(0x1D,0x56,0x42,0x03)   # GS V 66 3 -> feed & partial cut

$bytes = $data.ToArray()

# ---- Send it ---------------------------------------------------------------
try {
    $ok = [RawPrinterHelper]::SendBytes($PrinterName, $bytes)
    if ($ok) {
        Write-Host "SUCCESS: bytes were accepted by the spooler." -ForegroundColor Green
        Write-Host "Look at the printer - a short receipt should have printed and cut." -ForegroundColor Green
        Write-Host ""
        Write-Host "If paper came out => the app's method works on this printer. You're good to ship." -ForegroundColor Cyan
    } else {
        Write-Host "FAILED: the spooler rejected the data (WritePrinter returned false)." -ForegroundColor Red
    }
} catch {
    Write-Host ("ERROR: " + $_.Exception.Message) -ForegroundColor Red
}

Write-Host ""
Read-Host "Press Enter to close"
