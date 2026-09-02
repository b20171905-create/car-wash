// Runs locally on each branch's Windows 10 PC (one instance per PC/printer).
// The POS UI (running in the browser) sends the receipt payload here over
// localhost, and this forwards raw ESC/POS bytes to the connected thermal printer.
//
// Setup:
//   1. Install printer manufacturer's Windows driver, OR share it as a raw/generic
//      "Generic / Text Only" printer so ESC/POS bytes pass through untouched.
//   2. npm install
//   3. Set PRINTER_INTERFACE below to your printer's Windows share name,
//      e.g. "printer:POS-58" (must match the shared printer name in Windows).
//   4. npm start  (keep this running in the background, or set up as a
//      Windows service / startup task so it launches on boot)

const express = require('express');
const cors = require('cors');
const { execFile } = require('child_process');
const { printer: ThermalPrinter, types: PrinterTypes } = require('node-thermal-printer');

const PRINTER_INTERFACE = process.env.PRINTER_INTERFACE || 'printer:POS-58'; // Windows shared printer name
const AGENT_PORT = process.env.AGENT_PORT || 9100;

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

function printWindowsRaw(printerName, buffer) {
  return new Promise((resolve, reject) => {
    const script = `
      param([string]$PrinterName, [string]$Payload)
      Add-Type @'
      using System;
      using System.Runtime.InteropServices;
      public static class RawPrinter {
        [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)] public class DOCINFO { public string pDocName; public string pOutputFile; public string pDataType; }
        [DllImport("winspool.drv", EntryPoint="OpenPrinterW", SetLastError=true, CharSet=CharSet.Unicode)] public static extern bool OpenPrinter(string name, out IntPtr handle, IntPtr defaults);
        [DllImport("winspool.drv", SetLastError=true)] public static extern bool ClosePrinter(IntPtr handle);
        [DllImport("winspool.drv", CharSet=CharSet.Unicode)] public static extern int StartDocPrinter(IntPtr handle, int level, DOCINFO info);
        [DllImport("winspool.drv")] public static extern bool EndDocPrinter(IntPtr handle);
        [DllImport("winspool.drv")] public static extern bool StartPagePrinter(IntPtr handle);
        [DllImport("winspool.drv")] public static extern bool EndPagePrinter(IntPtr handle);
        [DllImport("winspool.drv", SetLastError=true)] public static extern bool WritePrinter(IntPtr handle, byte[] data, int count, out int written);
        public static void Send(string name, byte[] data) {
          IntPtr handle;
          if (!OpenPrinter(name, out handle, IntPtr.Zero)) throw new Exception("Could not open printer: " + name);
          try {
            var info = new DOCINFO { pDocName = "Tiger Car Wash Receipt", pDataType = "RAW" };
            if (StartDocPrinter(handle, 1, info) == 0) throw new Exception("Could not start print job");
            try { if (!StartPagePrinter(handle)) throw new Exception("Could not start printer page"); try { int written; if (!WritePrinter(handle, data, data.Length, out written) || written != data.Length) throw new Exception("Printer did not accept all receipt data"); } finally { EndPagePrinter(handle); } } finally { EndDocPrinter(handle); }
          } finally { ClosePrinter(handle); }
        }
      }
      [RawPrinter]::Send($PrinterName, [Convert]::FromBase64String($Payload))
    `;
    const encoded = Buffer.from(script, 'utf16le').toString('base64');
    execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', encoded, printerName, buffer.toString('base64')], (error, stdout, stderr) => {
      if (error) reject(new Error(stderr.trim() || error.message));
      else resolve();
    });
  });
}

app.post('/print', async (req, res) => {
  const { receipt_print_payload } = req.body; // base64 ESC/POS buffer from backend
  if (!receipt_print_payload) {
    return res.status(400).json({ error: 'receipt_print_payload required' });
  }

  try {
    const buffer = Buffer.from(receipt_print_payload, 'base64');
    if (PRINTER_INTERFACE.startsWith('printer:')) {
      await printWindowsRaw(PRINTER_INTERFACE.slice('printer:'.length), buffer);
    } else {
      const thermalPrinter = new ThermalPrinter({ type: PrinterTypes.EPSON, interface: PRINTER_INTERFACE });
      const isConnected = await thermalPrinter.isPrinterConnected();
      if (!isConnected) return res.status(503).json({ error: `Printer not reachable at ${PRINTER_INTERFACE}` });
      thermalPrinter.raw(buffer);
      await thermalPrinter.execute();
    }

    res.json({ printed: true });
  } catch (err) {
    console.error('[print-agent] print failed:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get('/health', (req, res) => res.json({ ok: true, printer: PRINTER_INTERFACE }));

app.listen(AGENT_PORT, () => {
  console.log(`Print agent listening on http://localhost:${AGENT_PORT}`);
  console.log(`Target printer: ${PRINTER_INTERFACE}`);
});
