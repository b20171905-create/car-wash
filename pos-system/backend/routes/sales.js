const express = require('express');
const { v4: uuid } = require('uuid');
const db = require('../db');
const {
  requireAuth,
  requireBranchManager,
  requireCashierOrAbove,
  requireOwner,
  scopeBranchId,
} = require('../services/auth');
const whatsapp = require('../services/whatsapp');
const printService = require('../services/print');
const emailService = require('../services/email');

const router = express.Router();
// All /api/sales routes require a valid JWT
router.use(requireAuth);

async function nextReceiptNumber() {
  const dbType = (process.env.DB_CLIENT || '').toLowerCase();
  const isMysql = dbType === 'mysql' || (process.env.DATABASE_URL || '').startsWith('mysql');

  if (isMysql) {
    const result = await db.query("SELECT LPAD(COALESCE(MAX(CAST(receipt_number AS UNSIGNED)), 0) + 1, 3, '0') AS receipt_number FROM sales");
    if (!result.rows || !result.rows[0]) {
      throw new Error('Failed to generate receipt number');
    }
    return result.rows[0].receipt_number;
  }

  const result = await db.query("SELECT LPAD(nextval('receipt_number_seq')::text, 3, '0') AS receipt_number");
  if (!result.rows || !result.rows[0]) {
    throw new Error('Failed to generate receipt number');
  }
  return result.rows[0].receipt_number;
}

// Create a sale (checkout) — open to cashier and above
router.post('/', requireCashierOrAbove, async (req, res, next) => {
  try {
  const { branch_id, customer, items, discount = 0, tax = 0, payment_method } = req.body;

  if (!branch_id || !items || !items.length || !payment_method) {
    return res.status(400).json({ error: 'branch_id, items, and payment_method are required' });
  }
  if (!customer || !customer.name?.trim() || !customer.phone?.trim() || !customer.vehicle_number?.trim() || !customer.vehicle_type) {
    return res.status(400).json({ error: 'Customer name, contact number, vehicle number, and vehicle type are required' });
  }
  if (!/^[A-Za-z ]+$/.test(customer.name.trim())) {
    return res.status(400).json({ error: 'Customer name must contain letters and spaces only' });
  }
  if (!/^\+92\d{11}$/.test(customer.phone.trim())) {
    return res.status(400).json({ error: 'Contact number must be +92 followed by exactly 11 digits' });
  }
  if (!/^[A-Za-z]{1,3}[- ]\d{1,4}$/.test(customer.vehicle_number.trim())) {
    return res.status(400).json({ error: 'Vehicle number must be like ABC-1234 or ABC 1234' });
  }
  if (!['bike', 'car', 'rikshaw', 'suv', 'coaster', 'truck'].includes(customer.vehicle_type)) {
    return res.status(400).json({ error: 'A valid vehicle type is required' });
  }
  if (!['cash', 'card', 'upi', 'wallet', 'other'].includes(payment_method)) {
    return res.status(400).json({ error: 'A valid payment method is required' });
  }
  const numericDiscount = Number(discount);
  const numericTax = Number(tax);
  if (!Number.isFinite(numericDiscount) || numericDiscount < 0 || !Number.isFinite(numericTax) || numericTax < 0) {
    return res.status(400).json({ error: 'Discount and tax must be non-negative numbers' });
  }
  if (items.length > 100) {
    return res.status(400).json({ error: 'A sale cannot contain more than 100 items' });
  }
  // Cashiers and branch_managers may only create sales for their own branch
  if (req.user.role !== 'owner' && req.user.branch_id !== branch_id) {
    return res.status(403).json({ error: 'Cannot create sale for another branch' });
  }

  const branch = await db.prepare('SELECT * FROM branches WHERE id = ? AND active = TRUE').get(branch_id);
  if (!branch) return res.status(404).json({ error: 'Branch not found' });

  const resolvedItems = await Promise.all(items.map(async (i) => {
    const svc = await db.prepare('SELECT * FROM services WHERE id = ? AND active = TRUE').get(i.service_id);
    if (!svc) throw new Error(`Active service ${i.service_id} not found`);
    const quantity = Number(i.quantity);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100) {
      throw new Error('Each item quantity must be a whole number from 1 to 100');
    }
    return {
      id: uuid(),
      service_id: svc.id,
      service_name: svc.name,
      quantity,
      unit_price: svc.price,
      line_total: svc.price * quantity,
    };
  }));

  const subtotal = resolvedItems.reduce((sum, i) => sum + i.line_total, 0);
  if (numericDiscount > subtotal) {
    return res.status(400).json({ error: 'Discount cannot exceed the subtotal' });
  }
  const total = Math.max(0, subtotal - numericDiscount + numericTax);

  let customerId = null;
  if (customer) {
    customerId = uuid();
  }

  const saleId = uuid();
  const receiptNumber = await nextReceiptNumber();

  const runTxn = db.transaction(async (transactionDb) => {
    if (customerId) {
      await transactionDb.prepare(
        'INSERT INTO customers (id, name, phone, vehicle_type, vehicle_number, vehicle_model) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(customerId, customer.name.trim(), customer.phone.trim(), customer.vehicle_type, customer.vehicle_number.trim(), '');
    }
    await transactionDb.prepare(
      `INSERT INTO sales (id, branch_id, user_id, customer_id, subtotal, discount, tax, total,
       payment_method, receipt_number) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(saleId, branch_id, req.user.id, customerId, subtotal, numericDiscount, numericTax, total, payment_method, receiptNumber);
    const insertItem = transactionDb.prepare(
      `INSERT INTO sale_items (id, sale_id, service_id, service_name, quantity, unit_price, line_total)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    );
    for (const item of resolvedItems) {
      await insertItem.run(item.id, saleId, item.service_id, item.service_name, item.quantity, item.unit_price, item.line_total);
    }
  });
  await runTxn();

  const sale = await db.prepare(`
    SELECT s.*, u.name as cashier_name
    FROM sales s
    LEFT JOIN users u ON u.id = s.user_id
    WHERE s.id = ?
  `).get(saleId);

  res.status(201).json({
    sale,
    items: resolvedItems,
    branch,
    receipt_print_payload: printService.buildReceipt({ branch, sale, items: resolvedItems }),
  });

  sendPostSaleNotifications(sale, branch, resolvedItems, customer).catch((err) =>
    console.error('[sales] notification error:', err)
  );
  } catch (error) {
    next(error);
  }
});

async function sendPostSaleNotifications(sale, branch, items, customer) {
  if (customer && customer.phone) {
    const msg = whatsapp.buildCustomerReceiptMessage(sale, branch, items);
    const result = await whatsapp.sendText(customer.phone, msg);
    if (result.success) {
      await db.prepare('UPDATE sales SET whatsapp_sent_customer = TRUE WHERE id = ?').run(sale.id);
    }
  }
  const ownerNumber = process.env.OWNER_WHATSAPP_NUMBER;
  if (ownerNumber) {
    const msg = whatsapp.buildOwnerAlertMessage(sale, branch);
    const result = await whatsapp.sendText(ownerNumber, msg);
    if (result.success) {
      await db.prepare('UPDATE sales SET whatsapp_sent_owner = TRUE WHERE id = ?').run(sale.id);
    }
  }
  const ownerEmail = process.env.OWNER_EMAIL;
  if (ownerEmail) {
    const emailResult = await emailService.sendAdminSaleEmail(ownerEmail, sale, branch, items);
    if (emailResult.success) {
      await db.prepare('UPDATE sales SET email_sent_owner = TRUE WHERE id = ?').run(sale.id);
    }
  }
}

// List sales — branch_manager and owner only (cashiers cannot browse all sales)
router.get('/', requireBranchManager, async (req, res, next) => {
  try {
  const branchId = scopeBranchId(req);
  const { from, to, payment_method, receipt_number, customer_name, customer_phone, vehicle, vehicle_type, search, limit } = req.query;

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

  const genericSearch = (search ?? customer_name ?? customer_phone ?? vehicle ?? receipt_number)?.toString().trim();
  if (genericSearch) {
    query += ' AND (' +
      'c.name LIKE ? OR ' +
      'c.phone LIKE ? OR ' +
      'c.vehicle_number LIKE ? OR ' +
      'c.vehicle_model LIKE ? OR ' +
      's.receipt_number LIKE ?' +
      ')';
    const searchTerm = `%${genericSearch}%`;
    params.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
  }

  if (vehicle_type) { query += ' AND c.vehicle_type = ?'; params.push(vehicle_type); }
  query += ' ORDER BY s.created_at DESC';
  const parsedLimit = Number.parseInt(limit, 10);
  if (Number.isInteger(parsedLimit) && parsedLimit > 0) {
    query += ' LIMIT ?';
    params.push(parsedLimit);
  }

    const sales = await db.prepare(query).all(...params);
    res.json(sales);
  } catch (error) {
    next(error);
  }
});

// GET /api/sales/summary — branch_manager and owner only
router.get('/summary', requireBranchManager, async (req, res, next) => {
  try {
  const branchId = scopeBranchId(req);
  const today = new Date().toISOString().slice(0, 10);

  let query = `
    SELECT b.id, b.name as branch_name,
           COUNT(s.id) as sale_count,
           COALESCE(SUM(s.total), 0) as revenue,
           COALESCE(SUM(CASE WHEN date(s.created_at) = ? THEN s.total ELSE 0 END), 0) as today_revenue,
           COUNT(CASE WHEN date(s.created_at) = ? THEN 1 END) as today_count,
           COALESCE(SUM(CASE WHEN date(s.created_at) = ? AND c.vehicle_type = 'bike' THEN s.total ELSE 0 END), 0) as today_bike_revenue,
           COUNT(CASE WHEN date(s.created_at) = ? AND c.vehicle_type = 'bike' THEN 1 END) as today_bike_count,
           COALESCE(SUM(CASE WHEN date(s.created_at) = ? AND c.vehicle_type = 'car' THEN s.total ELSE 0 END), 0) as today_car_revenue,
           COUNT(CASE WHEN date(s.created_at) = ? AND c.vehicle_type = 'car' THEN 1 END) as today_car_count,
           COALESCE(SUM(CASE WHEN date(s.created_at) = ? AND c.vehicle_type = 'rikshaw' THEN s.total ELSE 0 END), 0) as today_rikshaw_revenue,
           COUNT(CASE WHEN date(s.created_at) = ? AND c.vehicle_type = 'rikshaw' THEN 1 END) as today_rikshaw_count,
           COALESCE(SUM(CASE WHEN date(s.created_at) = ? AND c.vehicle_type = 'suv' THEN s.total ELSE 0 END), 0) as today_suv_revenue,
           COUNT(CASE WHEN date(s.created_at) = ? AND c.vehicle_type = 'suv' THEN 1 END) as today_suv_count,
           COALESCE(SUM(CASE WHEN date(s.created_at) = ? AND c.vehicle_type = 'coaster' THEN s.total ELSE 0 END), 0) as today_coaster_revenue,
           COUNT(CASE WHEN date(s.created_at) = ? AND c.vehicle_type = 'coaster' THEN 1 END) as today_coaster_count,
           COALESCE(SUM(CASE WHEN date(s.created_at) = ? AND c.vehicle_type = 'truck' THEN s.total ELSE 0 END), 0) as today_truck_revenue,
           COUNT(CASE WHEN date(s.created_at) = ? AND c.vehicle_type = 'truck' THEN 1 END) as today_truck_count
    FROM branches b
    LEFT JOIN sales s ON s.branch_id = b.id AND s.status = 'paid'
    LEFT JOIN customers c ON c.id = s.customer_id
  `;
  const params = [today, today, today, today, today, today, today, today, today, today, today, today, today, today, today, today];

  if (branchId) { query += ' WHERE b.id = ?'; params.push(branchId); }
  query += ' GROUP BY b.id ORDER BY revenue DESC';

    const summary = await db.prepare(query).all(...params);
    res.json(summary);
  } catch (error) {
    next(error);
  }
});

// GET /api/sales/monthly-summary — branch_manager and owner only
router.get('/monthly-summary', requireBranchManager, async (req, res, next) => {
  try {
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

    res.json(await db.prepare(query).all(...params));
  } catch (error) {
    next(error);
  }
});

// GET /api/sales/month-daily-summary?month=YYYY-MM — branch_manager and owner only
router.get('/month-daily-summary', requireBranchManager, async (req, res, next) => {
  try {
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

    res.json(await db.prepare(query).all(...params));
  } catch (error) {
    next(error);
  }
});

// GET /api/sales/:id — single sale with items (reprint) — branch_manager and owner only
router.get('/:id', requireBranchManager, async (req, res, next) => {
  try {
  const sale = await db.prepare(`
    SELECT s.*, b.name as branch_name, b.address as branch_address, b.phone as branch_phone,
           c.name as customer_name, c.phone as customer_phone,
           c.vehicle_number, c.vehicle_model,
           u.name as cashier_name
    FROM sales s
    JOIN branches b ON b.id = s.branch_id
    LEFT JOIN customers c ON c.id = s.customer_id
    LEFT JOIN users u ON u.id = s.user_id
    WHERE s.id = ?
  `).get(req.params.id);

  if (!sale) return res.status(404).json({ error: 'Sale not found' });

  // Branch scoping for non-owners
  if (req.user.role !== 'owner' && sale.branch_id !== req.user.branch_id) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const items = await db.prepare('SELECT * FROM sale_items WHERE sale_id = ?').all(req.params.id);
  res.json({ sale, items });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/sales/:id - owner/admin only
router.delete('/:id', requireOwner, async (req, res, next) => {
  try {
    const sale = await db.prepare('SELECT id, customer_id FROM sales WHERE id = ?').get(req.params.id);
    if (!sale) return res.status(404).json({ error: 'Sale not found' });

    const removeSale = db.transaction(async (transactionDb) => {
      await transactionDb.prepare('DELETE FROM sale_items WHERE sale_id = ?').run(req.params.id);
      await transactionDb.prepare('DELETE FROM sales WHERE id = ?').run(req.params.id);
      if (sale.customer_id) await transactionDb.prepare('DELETE FROM customers WHERE id = ?').run(sale.customer_id);
    });
    await removeSale();
    res.json({ deleted: true });
  } catch (error) {
    next(error);
  }
});

// POST /api/sales/:id/mark-printed — open to cashier and above (needed post-checkout)
router.post('/:id/mark-printed', requireCashierOrAbove, async (req, res, next) => {
  try {
    const result = await db.prepare('UPDATE sales SET printed = TRUE WHERE id = ?').run(req.params.id);
    if (!result.changes) return res.status(404).json({ error: 'Sale not found' });
    res.json({ updated: true });
  } catch (error) {
    next(error);
  }
});



// POST /api/sales/:id/resend-notifications — branch_manager and owner only
router.post('/:id/resend-notifications', requireBranchManager, async (req, res) => {
  const saleId = req.params.id;

  const sale = await db.prepare('SELECT * FROM sales WHERE id = ?').get(saleId);
  if (!sale) return res.status(404).json({ error: 'Sale not found' });

  // Branch scoping for non-owners
  if (req.user.role !== 'owner' && sale.branch_id !== req.user.branch_id) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const branch = await db.prepare('SELECT * FROM branches WHERE id = ?').get(sale.branch_id);
  const items = await db.prepare('SELECT * FROM sale_items WHERE sale_id = ?').all(saleId);
  const customer = sale.customer_id ? await db.prepare('SELECT * FROM customers WHERE id = ?').get(sale.customer_id) : null;

  const results = { customer: null, owner_whatsapp: null, owner_email: null };

  try {
    if (customer && customer.phone) {
      const msg = whatsapp.buildCustomerReceiptMessage(sale, branch, items);
      const r = await whatsapp.sendText(customer.phone, msg);
      results.customer = r;
      if (r.success) await db.prepare('UPDATE sales SET whatsapp_sent_customer = TRUE WHERE id = ?').run(saleId);
    }

    const ownerNumber = process.env.OWNER_WHATSAPP_NUMBER;
    if (ownerNumber) {
      const msg = whatsapp.buildOwnerAlertMessage(sale, branch);
      const r = await whatsapp.sendText(ownerNumber, msg);
      results.owner_whatsapp = r;
      if (r.success) await db.prepare('UPDATE sales SET whatsapp_sent_owner = TRUE WHERE id = ?').run(saleId);
    }

    const ownerEmail = process.env.OWNER_EMAIL;
    if (ownerEmail) {
      const r = await emailService.sendAdminSaleEmail(ownerEmail, sale, branch, items);
      results.owner_email = r;
      if (r.success) await db.prepare('UPDATE sales SET email_sent_owner = TRUE WHERE id = ?').run(saleId);
    }

    res.json({ ok: true, results });
  } catch (err) {
    console.error('[sales] resend-notifications error:', err);
    res.status(500).json({ error: err.message || String(err) });
  }
});

module.exports = router;
