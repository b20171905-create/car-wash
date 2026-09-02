# Tiger Car Wash Printer Helper

This helper lets the hosted POS print directly to a BC-86AC ESC/POS receipt printer connected to this Windows computer.

## Installation

1. Install the BC-86AC Windows printer driver and connect the printer by USB.
2. Open **Settings > Bluetooth & devices > Printers & scanners** and copy the exact printer name.
3. Double-click `install-print-helper.bat`.
4. Paste the printer name when asked.
5. Allow the helper through Windows Firewall if Windows asks.
6. Leave the helper running. It starts automatically when Windows starts.

After setup, open the POS website and press **Print Receipt**. The receipt will be sent to this computer's printer. The browser will not open Save as PDF.

## Test

Open this address on the same computer:

`http://localhost:9100/health`

A working helper shows a JSON response containing `ok: true` and the configured printer name.

## Important

The helper must run on the same computer as the USB printer. It cannot be installed only on Hostinger. Do not close the helper window while printing.

If printing fails, confirm the exact Windows printer name and run `install-print-helper.bat` again.
