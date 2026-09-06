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
const AMOUNT_COLUMNS = 12;
const DEFAULT_LAYOUT = { paper_columns: 42, left_padding: 0, right_padding: 0, top_feed: 0, bottom_feed: 3, header_alignment: 'center' };

const commands = {
  init: ESC + '@',
  boldOn: ESC + 'E' + '\x01',
  boldOff: ESC + 'E' + '\x00',
  center: ESC + 'a' + '\x01',
  left: ESC + 'a' + '\x00',
  right: ESC + 'a' + '\x02',
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

function buildReceipt({ branch, sale, items, settings = {} }) {
  const layout = { ...DEFAULT_LAYOUT, ...settings };
  const leftPadding = ' '.repeat(Number(layout.left_padding));
  const rightPadding = ' '.repeat(Number(layout.right_padding));
  const receiptColumns = Math.max(32, Math.min(48, Number(layout.paper_columns)));
  const contentColumns = receiptColumns - Number(layout.left_padding) - Number(layout.right_padding);
  const labelColumns = contentColumns - AMOUNT_COLUMNS;
  const line = (text) => `${leftPadding}${String(text).slice(0, contentColumns)}${rightPadding}\n`;
  const divider = () => line('-'.repeat(contentColumns));
  const headerCommand = commands[layout.header_alignment] || commands.center;
  let r = '';
  r += commands.init;
  r += commands.feed(Number(layout.top_feed));
  r += headerCommand;
  r += commands.doubleHeightOn + commands.boldOn;
  r += line(branch.name);
  r += commands.doubleHeightOff + commands.boldOff;
  if (branch.address) r += line(branch.address);
  if (branch.phone) r += line(branch.phone);
  r += commands.feed(1);
  if (sale.customer_name) r += line(`Customer: ${sale.customer_name}`);
  if (sale.vehicle_number) r += line(`Vehicle: ${sale.vehicle_number}`);
  r += line(`Receipt #${sale.receipt_number}`);
  r += line(parseTimestamp(sale.created_at).toLocaleString('en-PK', { timeZone: PK_TIMEZONE }));
  const staffName = sale.cashier_name || sale.user_name || sale.created_by_name || 'Staff';
  if (staffName) r += line(`Served By: ${staffName}`);
  r += divider();
  r += commands.left;

  for (const item of items) {
    const name = String(item.service_name || 'Service').padEnd(labelColumns - 4).slice(0, labelColumns - 4);
    const qty = `x${Number(item.quantity || 0)}`.padEnd(4);
    const amt = `Rs. ${Number(item.line_total || 0).toFixed(2)}`.padStart(AMOUNT_COLUMNS);
    r += line(`${name}${qty}${amt}`);
  }

  r += divider();
  if (Number(sale.discount || 0) > 0) r += line('Discount:'.padEnd(labelColumns) + `-Rs. ${Number(sale.discount).toFixed(2)}`.padStart(AMOUNT_COLUMNS));
  if (Number(sale.tax || 0) > 0) r += line('Tax:'.padEnd(labelColumns) + `Rs. ${Number(sale.tax).toFixed(2)}`.padStart(AMOUNT_COLUMNS));
  r += commands.boldOn;
  r += line('TOTAL:'.padEnd(labelColumns) + `Rs. ${Number(sale.total || 0).toFixed(2)}`.padStart(AMOUNT_COLUMNS));
  r += commands.boldOff;
  r += line(`Paid via: ${sale.payment_method === 'upi' ? 'BANK TRANSFER' : sale.payment_method.toUpperCase()}`);
  r += commands.feed(1);
  r += commands.center;
  r += line('Thank you for choosing');
  r += line(branch.name);
  r += line('Come back again');
  r += commands.feed(Number(layout.bottom_feed));
  r += commands.cut;

  return Buffer.from(r, 'binary').toString('base64');
}

module.exports = { buildReceipt };
