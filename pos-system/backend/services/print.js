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

function buildReceipt({ branch, sale, items }) {
  let r = '';
  r += commands.init;
  r += commands.center;
  r += commands.doubleHeightOn + commands.boldOn;
  r += branch.name + '\n';
  r += commands.doubleHeightOff + commands.boldOff;
  if (branch.address) r += branch.address + '\n';
  if (branch.phone) r += branch.phone + '\n';
  r += commands.feed(1);
  r += `Receipt #${sale.receipt_number}\n`;
  r += `${new Date(sale.created_at).toLocaleString()}\n`;
  const staffName = sale.cashier_name || sale.user_name || sale.created_by_name || 'Staff';
  if (staffName) r += `Served By: ${staffName}\n`;
  r += '--------------------------------\n';
  r += commands.left;

  for (const item of items) {
    const name = String(item.service_name || 'Service').padEnd(20).slice(0, 20);
    const qty = `x${Number(item.quantity || 0)}`.padEnd(4);
    const amt = `Rs. ${Number(item.line_total || 0).toFixed(2)}`.padStart(10);
    r += `${name}${qty}${amt}\n`;
  }

  r += '--------------------------------\n';
  if (Number(sale.discount || 0) > 0) r += 'Discount:'.padEnd(24) + `-Rs. ${Number(sale.discount).toFixed(2)}\n`;
  if (Number(sale.tax || 0) > 0) r += 'Tax:'.padEnd(24) + `Rs. ${Number(sale.tax).toFixed(2)}\n`;
  r += commands.boldOn;
  r += 'TOTAL:'.padEnd(24) + `Rs. ${Number(sale.total || 0).toFixed(2)}\n`;
  r += commands.boldOff;
  r += `Paid via: ${sale.payment_method === 'upi' ? 'BANK TRANSFER' : sale.payment_method.toUpperCase()}\n`;
  r += commands.feed(1);
  r += commands.center;
  r += 'Thank you for your visit!\n';
  r += commands.feed(3);
  r += commands.cut;

  return Buffer.from(r, 'binary').toString('base64');
}

module.exports = { buildReceipt };
