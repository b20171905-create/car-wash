const express = require('express');
const { v4: uuid } = require('uuid');
const db = require('../db');
const { requireAuth, scopeBranchId } = require('../services/auth');
const whatsapp = require('../services/whatsapp');
const printService = require('../services/print');
const emailService = require('../services/email');

const router = express.Router();
router.use(requireAuth);

function nextReceiptNumber(branchId) {
  const count = db.prepare('SELECT COUNT(*) as c FROM sales WHERE branch_id = ?').get(branchId).c;
  return `${branchId.slice(0, 4).toUpperCase()}-${String(count + 1).padStart(5, '0')}`;
}

// Create a sale (checkout)
router.post('/', (req, res) => {
  const { branch_id, customer, items, discount = 0, tax = 0, payment_method } = req.body;

  if (!branch_id || !items || !items.length || !payment_method) {
    return res.status(400).json({ error: 'branch_id, items, and payment_method are required' });
  }
  if (req.user.role !== 'owner' && req.user.branch_id !== branch_id) {
    return res.status(403).json({ error: 'Cannot create sale for another branch' });
  }

  const branch = db.prepare('SELECT * FROM branches WHERE id = ?').get(branch_id);
  if (!branch) return res.status(404).json({ error: 'Branch not found' });

  const resolvedItems = items.map((i) => {
    const svc = db.prepare('SELECT * FROM services WHERE id = ?').get(i.service_id);
    if (!svc) throw new Error(`Service ${i.service_id} not found`);
    const quantity = i.quantity || 1;
    return {
      id: uuid(),
      service_id: svc.id,
      service_name: svc.name,
      quantity,
      unit_price: svc.price,
      line_total: svc.price * quantity,
    };
  });

  const subtotal = resolvedItems.reduce((sum, i) => sum + i.line_total, 0);
  const total = Math.max(0, subtotal - discount + tax);

  let customerId = null;
  if (customer && (customer.phone || customer.name)) {
    customerId = uuid();
    db.prepare(
      'INSERT INTO customers (id, name, phone, vehicle_type, vehicle_number, vehicle_model) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(customerId, customer.name || '', customer.phone || '', customer.vehicle_type || null, customer.vehicle_number || '', customer.vehicle_model || '');
  }

  const saleId = uuid();
  const receiptNumber = nextReceiptNumber(branch_id);

  const insertSale = db.prepare(
    `INSERT INTO sales (id, branch_id, user_id, customer_id, subtotal, discount, tax, total,
     payment_method, receipt_number) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const insertItem = db.prepare(
    `INSERT INTO sale_items (id, sale_id, service_id, service_name, quantity, unit_price, line_total)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  );

  const runTxn = db.transaction(() => {
    insertSale.run(saleId, branch_id, req.user.id, customerId, subtotal, discount, tax, total, payment_method, receiptNumber);
    for (const item of resolvedItems) {
      insertItem.run(item.id, saleId, item.service_id, item.service_name, item.quantity, item.unit_price, item.line_total);
    }
  });
  runTxn();

  const sale = db.prepare('SELECT * FROM sales WHERE id = ?').get(saleId);

  res.status(201).json({
    sale,
    items: resolvedItems,
    branch,
    receipt_print_payload: printService.buildReceipt({ branch, sale, items: resolvedItems }),
  });

  sendPostSaleNotifications(sale, branch, resolvedItems, customer).catch((err) =>
    console.error('[sales] notification error:', err)
  );
});

async function sendPostSaleNotifications(sale, branch, items, customer) {
  if (customer && customer.phone) {
    const msg = whatsapp.buildCustomerReceiptMessage(sale, branch, items);
    const result = await whatsapp.sendText(customer.phone, msg);
    if (result.success) {
      db.prepare('UPDATE sales SET whatsapp_sent_customer = 1 WHERE id = ?').run(sale.id);
    }
  }
  const ownerNumber = process.env.OWNER_WHATSAPP_NUMBER;
  if (ownerNumber) {
    const msg = whatsapp.buildOwnerAlertMessage(sale, branch);
    const result = await whatsapp.sendText(ownerNumber, msg);
    if (result.success) {
      db.prepare('UPDATE sales SET whatsapp_sent_owner = 1 WHERE id = ?').run(sale.id);
    }
  }
  const ownerEmail = process.env.OWNER_EMAIL;
  if (ownerEmail) {
    const emailResult = await emailService.sendAdminSaleEmail(ownerEmail, sale, branch, items);
    if (emailResult.success) {
      db.prepare('UPDATE sales SET email_sent_owner = 1 WHERE id = ?').run(sale.id);
    }
  }
}

// List sales with optional filters
router.get('/', (req, res) => {
  const branchId = scopeBranchId(req);
  const { from, to, payment_method, receipt_number, customer_name, vehicle, vehicle_type, limit } = req.query;

  let query = `
    SELECT s.*, b.name as branch_name,
           c.name as customer_name, c.phone as customer_phone, c.vehicle_type,
           c.vehicle_number, c.vehicle_model,
           u.name as cashier_name
    FROM sales s
    JOIN branches b ON b.id = s.branch_id
    LEFT JOIN customers c ON c.id = s.customer_id
    LEFT JOIN users u ON u.id = s.user_id
    WHERE 1=1
  `;
  const params = [];

  if (branchId) { query += ' AND s.branch_id = ?'; params.push(branchId); }
  if (from) { query += ' AND s.created_at >= ?'; params.push(from); }
  if (to) { query += ' AND s.created_at <= ?'; params.push(to); }
  if (payment_method) { query += ' AND s.payment_method = ?'; params.push(payment_method); }
  if (receipt_number) { query += ' AND s.receipt_number LIKE ?'; params.push(`%${receipt_number}%`); }
  if (customer_name) { query += ' AND c.name LIKE ?'; params.push(`%${customer_name}%`); }
  if (vehicle) { query += ' AND (c.vehicle_number LIKE ? OR c.vehicle_model LIKE ?)'; params.push(`%${vehicle}%`, `%${vehicle}%`); }
  if (vehicle_type) { query += ' AND c.vehicle_type = ?'; params.push(vehicle_type); }
  query += ' ORDER BY s.created_at DESC';
  const parsedLimit = Number.parseInt(limit, 10);
  if (Number.isInteger(parsedLimit) && parsedLimit > 0) {
    query += ' LIMIT ?';
    params.push(parsedLimit);
  }

  const sales = db.prepare(query).all(...params);
  res.json(sales);
});

// GET /api/sales/summary — dashboard summary per branch
router.get('/summary', (req, res) => {
  const branchId = scopeBranchId(req);
  const today = new Date().toISOString().slice(0, 10);

  let query = `
    SELECT b.id, b.name as branch_name,
           COUNT(s.id) as sale_count,
           COALESCE(SUM(s.total), 0) as revenue,
           COALESCE(SUM(CASE WHEN date(s.created_at) = ? THEN s.total ELSE 0 END), 0) as today_revenue,
           COUNT(CASE WHEN date(s.created_at) = ? THEN 1 END) as today_count,
           COALESCE(SUM(CASE WHEN date(s.created_at) = ? AND c.vehicle_type = 'motor_bike' THEN s.total ELSE 0 END), 0) as today_bike_revenue,
           COUNT(CASE WHEN date(s.created_at) = ? AND c.vehicle_type = 'motor_bike' THEN 1 END) as today_bike_count,
           COALESCE(SUM(CASE WHEN date(s.created_at) = ? AND c.vehicle_type = 'car' THEN s.total ELSE 0 END), 0) as today_car_revenue,
           COUNT(CASE WHEN date(s.created_at) = ? AND c.vehicle_type = 'car' THEN 1 END) as today_car_count
    FROM branches b
    LEFT JOIN sales s ON s.branch_id = b.id AND s.status = 'paid'
    LEFT JOIN customers c ON c.id = s.customer_id
  `;
  const params = [today, today, today, today, today, today];

  if (branchId) { query += ' WHERE b.id = ?'; params.push(branchId); }
  query += ' GROUP BY b.id ORDER BY revenue DESC';

  const summary = db.prepare(query).all(...params);
  res.json(summary);
});

// GET /api/sales/monthly-summary — monthly revenue for the last 12 months
router.get('/monthly-summary', (req, res) => {
  const branchId = scopeBranchId(req);
  const selectedYear = req.query.year;
  if (selectedYear && !/^\d{4}$/.test(selectedYear)) {
    return res.status(400).json({ error: 'year must use YYYY format' });
  }

  let dateFilter = 'date(s.created_at) >= date(?)';
  const start = new Date();
  start.setDate(1);
  start.setMonth(start.getMonth() - 11);
  const from = selectedYear ? `${selectedYear}-01-01` : start.toISOString().slice(0, 10);
  const params = [from];
  if (selectedYear) {
    dateFilter = 'date(s.created_at) >= date(?) AND date(s.created_at) < date(?)';
    params.push(`${Number(selectedYear) + 1}-01-01`);
  }

  let query = `
    SELECT substr(s.created_at, 1, 7) as month,
           COALESCE(SUM(s.total), 0) as revenue,
           COUNT(s.id) as sale_count
    FROM sales s
    WHERE s.status = 'paid' AND ${dateFilter}
  `;
  if (branchId) { query += ' AND s.branch_id = ?'; params.push(branchId); }
  query += ' GROUP BY substr(s.created_at, 1, 7) ORDER BY month';

  res.json(db.prepare(query).all(...params));
});

// GET /api/sales/month-daily-summary?month=YYYY-MM — daily stats for one month
router.get('/month-daily-summary', (req, res) => {
  const branchId = scopeBranchId(req);
  const month = req.query.month || new Date().toISOString().slice(0, 7);
  if (!/^\d{4}-\d{2}$/.test(month)) {
    return res.status(400).json({ error: 'month must use YYYY-MM format' });
  }

  let query = `
    SELECT substr(s.created_at, 1, 10) as day,
           COALESCE(SUM(s.total), 0) as revenue,
           COUNT(s.id) as sale_count
    FROM sales s
    WHERE s.status = 'paid' AND substr(s.created_at, 1, 7) = ?
  `;
  const params = [month];
  if (branchId) { query += ' AND s.branch_id = ?'; params.push(branchId); }
  query += ' GROUP BY substr(s.created_at, 1, 10) ORDER BY day';

  res.json(db.prepare(query).all(...params));
});

// GET /api/sales/:id — single sale with items (for reprint)
router.get('/:id', (req, res) => {
  const sale = db.prepare(`
    SELECT s.*, b.name as branch_name, b.address as branch_address, b.phone as branch_phone,
           c.name as customer_name, c.phone as customer_phone,
           c.vehicle_number, c.vehicle_model
    FROM sales s
    JOIN branches b ON b.id = s.branch_id
    LEFT JOIN customers c ON c.id = s.customer_id
    WHERE s.id = ?
  `).get(req.params.id);

  if (!sale) return res.status(404).json({ error: 'Sale not found' });

  // Branch scoping for non-owners
  if (req.user.role !== 'owner' && sale.branch_id !== req.user.branch_id) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const items = db.prepare('SELECT * FROM sale_items WHERE sale_id = ?').all(req.params.id);
  res.json({ sale, items });
});

// POST /api/sales/:id/mark-printed
router.post('/:id/mark-printed', (req, res) => {
  db.prepare('UPDATE sales SET printed = 1 WHERE id = ?').run(req.params.id);
  res.json({ updated: true });
});

module.exports = router;

// POST /api/sales/:id/resend-notifications
// Admin/owner can re-send notifications for a sale in case of earlier failures.
router.post('/:id/resend-notifications', async (req, res) => {
  const saleId = req.params.id;

  const sale = db.prepare('SELECT * FROM sales WHERE id = ?').get(saleId);
  if (!sale) return res.status(404).json({ error: 'Sale not found' });

  // Branch scoping for non-owners
  if (req.user.role !== 'owner' && sale.branch_id !== req.user.branch_id) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const branch = db.prepare('SELECT * FROM branches WHERE id = ?').get(sale.branch_id);
  const items = db.prepare('SELECT * FROM sale_items WHERE sale_id = ?').all(saleId);
  const customer = sale.customer_id ? db.prepare('SELECT * FROM customers WHERE id = ?').get(sale.customer_id) : null;

  const results = { customer: null, owner_whatsapp: null, owner_email: null };

  try {
    if (customer && customer.phone) {
      const msg = whatsapp.buildCustomerReceiptMessage(sale, branch, items);
      const r = await whatsapp.sendText(customer.phone, msg);
      results.customer = r;
      if (r.success) db.prepare('UPDATE sales SET whatsapp_sent_customer = 1 WHERE id = ?').run(saleId);
    }

    const ownerNumber = process.env.OWNER_WHATSAPP_NUMBER;
    if (ownerNumber) {
      const msg = whatsapp.buildOwnerAlertMessage(sale, branch);
      const r = await whatsapp.sendText(ownerNumber, msg);
      results.owner_whatsapp = r;
      if (r.success) db.prepare('UPDATE sales SET whatsapp_sent_owner = 1 WHERE id = ?').run(saleId);
    }

    const ownerEmail = process.env.OWNER_EMAIL;
    if (ownerEmail) {
      const r = await emailService.sendAdminSaleEmail(ownerEmail, sale, branch, items);
      results.owner_email = r;
      if (r.success) db.prepare('UPDATE sales SET email_sent_owner = 1 WHERE id = ?').run(saleId);
    }

    res.json({ ok: true, results });
  } catch (err) {
    console.error('[sales] resend-notifications error:', err);
    res.status(500).json({ error: err.message || String(err) });
  }
});
