// Builds an ESC/POS command buffer for a thermal receipt printer.
//
// IMPORTANT: A browser cannot talk to a USB/Serial thermal printer directly.
// The recommended setup (see print-agent/README.md) is:
//   1. This function runs on the backend and returns raw ESC/POS bytes (base64).
//   2. A tiny local "print agent" (Node script, see /print-agent folder)
//      runs on each branch's Windows 10 PC, polls or receives this buffer,
//      and writes it directly to the printer via USB (node-thermal-printer
//      or raw `copy /b` to the printer's Windows share).
//
// Most branded thermal printers (Epson TM-T20, XPrinter, etc.) accept raw
// ESC/POS over a shared Windows printer port, which is what this targets.

const ESC = '\x1b';
const GS = '\x1d';
const RECEIPT_COLUMNS = 32;
const AMOUNT_COLUMNS = 11;
const LABEL_COLUMNS = RECEIPT_COLUMNS - AMOUNT_COLUMNS;

const commands = {
  init: ESC + '@',
  boldOn: ESC + 'E' + '\x01',
  boldOff: ESC + 'E' + '\x00',
  center: ESC + 'a' + '\x01',
  left: ESC + 'a' + '\x00',
  doubleHeightOn: GS + '!' + '\x11',
  doubleHeightOff: GS + '!' + '\x00',
  cut: GS + 'V' + '\x00',
  feed: (n = 1) => '\n'.repeat(n),
};

const PK_TIMEZONE = 'Asia/Karachi';
function parseTimestamp(value) {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(value)) {
    return new Date(`${value.replace(' ', 'T')}Z`);
  }
  return new Date(value);
}

function buildReceipt({ branch, sale, items }) {
  let r = '';
  r += commands.init;
  r += commands.center;
  r += commands.doubleHeightOn + commands.boldOn;
  r += branch.name + '\n';
  r += commands.doubleHeightOff + commands.boldOff;
  if (branch.address) r += branch.address + '\n';
  if (branch.phone) r += branch.phone + '\n';
  const customerVehicle = [
    sale.customer_name && `C: ${sale.customer_name}`,
    sale.vehicle_number && `V: ${sale.vehicle_number}`,
  ].filter(Boolean).join(' ');
  if (customerVehicle) r += `${customerVehicle}\n`;
  const receiptDate = parseTimestamp(sale.created_at);
  const dateText = receiptDate.toLocaleDateString('en-GB', { timeZone: PK_TIMEZONE, day: '2-digit', month: '2-digit', year: '2-digit' });
  const timeText = receiptDate.toLocaleTimeString('en-US', { timeZone: PK_TIMEZONE, hour: '2-digit', minute: '2-digit' });
  r += `Receipt #${sale.receipt_number} ${dateText} ${timeText}\n`;
  const staffName = sale.cashier_name || sale.user_name || sale.created_by_name || 'Staff';
  if (staffName) r += `Served By: ${staffName}\n`;
  r += commands.left;

  for (const item of items) {
    const name = String(item.service_name || 'Service').padEnd(17).slice(0, 17);
    const qty = `x${Number(item.quantity || 0)}`.padEnd(4);
    const amt = `Rs. ${Number(item.line_total || 0).toFixed(2)}`.padStart(AMOUNT_COLUMNS);
    r += `${name}${qty}${amt}\n`;
  }

  r += '-'.repeat(RECEIPT_COLUMNS) + '\n';
  if (Number(sale.discount || 0) > 0) r += 'Discount:'.padEnd(LABEL_COLUMNS) + `-Rs. ${Number(sale.discount).toFixed(2)}`.padStart(AMOUNT_COLUMNS) + '\n';
  if (Number(sale.tax || 0) > 0) r += 'Tax:'.padEnd(LABEL_COLUMNS) + `Rs. ${Number(sale.tax).toFixed(2)}`.padStart(AMOUNT_COLUMNS) + '\n';
  r += commands.boldOn;
  r += 'TOTAL:'.padEnd(LABEL_COLUMNS) + `Rs. ${Number(sale.total || 0).toFixed(2)}`.padStart(AMOUNT_COLUMNS) + '\n';
  r += commands.boldOff;
  r += `Paid via: ${sale.payment_method === 'upi' ? 'BANK TRANSFER' : sale.payment_method.toUpperCase()}\n`;
  r += commands.feed(1);
  r += commands.center;
  r += 'Thank you for choosing\n';
  r += `${branch.name}\n`;
  r += 'Come back again\n';
  r += commands.feed(1);
  r += commands.cut;

  return Buffer.from(r, 'binary').toString('base64');
}

module.exports = { buildReceipt };
