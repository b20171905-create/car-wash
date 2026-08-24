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
const { printer: ThermalPrinter, types: PrinterTypes } = require('node-thermal-printer');

const PRINTER_INTERFACE = process.env.PRINTER_INTERFACE || 'printer:POS-58'; // Windows shared printer name
const AGENT_PORT = process.env.AGENT_PORT || 9100;

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

app.post('/print', async (req, res) => {
  const { receipt_print_payload } = req.body; // base64 ESC/POS buffer from backend
  if (!receipt_print_payload) {
    return res.status(400).json({ error: 'receipt_print_payload required' });
  }

  try {
    const buffer = Buffer.from(receipt_print_payload, 'base64');
    const thermalPrinter = new ThermalPrinter({
      type: PrinterTypes.EPSON, // most ESC/POS printers work with EPSON profile
      interface: PRINTER_INTERFACE,
    });

    const isConnected = await thermalPrinter.isPrinterConnected();
    if (!isConnected) {
      return res.status(503).json({ error: `Printer not reachable at ${PRINTER_INTERFACE}` });
    }

    thermalPrinter.raw(buffer);
    await thermalPrinter.execute();

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
