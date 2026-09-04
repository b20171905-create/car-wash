const express = require('express');
const ExcelJS = require('exceljs');
const { requireAuth, requireOwner } = require('../services/auth');
const db = require('../db');

const router = express.Router();
router.use(requireAuth, requireOwner);

function validateDate(value, field) {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const error = new Error(`${field} must use YYYY-MM-DD format`);
    error.status = 400;
    throw error;
  }
  return value;
}

function addSheet(workbook, name, rows) {
  const sheet = workbook.addWorksheet(name);
  const columns = rows.length ? Object.keys(rows[0]) : [];
  sheet.columns = columns.map((key) => ({ header: key, key, width: Math.min(Math.max(key.length + 2, 14), 28) }));
  if (rows.length) sheet.addRows(rows);
  sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F766E' } };
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  sheet.autoFilter = { from: 'A1', to: `${String.fromCharCode(64 + Math.max(columns.length, 1))}1` };
}

router.get('/excel', async (req, res, next) => {
  try {
    const from = validateDate(req.query.from, 'from');
    const to = validateDate(req.query.to, 'to');
    if (from && to && from > to) {
      return res.status(400).json({ error: 'from date cannot be after to date' });
    }

    let salesQuery = `
      SELECT s.id, s.receipt_number, s.created_at, b.name AS branch, u.name AS served_by,
             c.name AS customer, c.phone AS customer_phone, c.vehicle_type, c.vehicle_number,
             s.subtotal, s.discount, s.tax, s.total, s.payment_method, s.status, s.printed
      FROM sales s
      LEFT JOIN branches b ON b.id = s.branch_id
      LEFT JOIN users u ON u.id = s.user_id
      LEFT JOIN customers c ON c.id = s.customer_id
      WHERE 1 = 1
    `;
    const salesParams = [];
    if (from) { salesQuery += ' AND s.created_at >= ?'; salesParams.push(from); }
    if (to) { salesQuery += ' AND s.created_at <= ?'; salesParams.push(`${to} 23:59:59`); }
    salesQuery += ' ORDER BY s.created_at DESC';

    const [sales, saleItems, customers, services, branches, users] = await Promise.all([
      db.prepare(salesQuery).all(...salesParams),
      db.prepare(`
        SELECT si.id, si.sale_id, s.receipt_number, si.service_name, si.quantity,
               si.unit_price, si.line_total
        FROM sale_items si
        JOIN sales s ON s.id = si.sale_id
        WHERE 1 = 1 ${from ? 'AND s.created_at >= ?' : ''} ${to ? 'AND s.created_at <= ?' : ''}
        ORDER BY s.created_at DESC
      `).all(...salesParams),
      db.prepare('SELECT id, name, phone, vehicle_type, vehicle_number, vehicle_model, created_at FROM customers ORDER BY created_at DESC').all(),
      db.prepare('SELECT id, name, description, vehicle_type, price, duration_minutes, active, created_at FROM services ORDER BY name').all(),
      db.prepare('SELECT id, name, address, phone, created_at FROM branches ORDER BY name').all(),
      db.prepare('SELECT id, branch_id, name, email, role, active, created_at FROM users ORDER BY name').all(),
    ]);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Tiger Car Wash POS';
    workbook.created = new Date();
    addSheet(workbook, 'Sales', sales);
    addSheet(workbook, 'Sale Items', saleItems);
    addSheet(workbook, 'Customers', customers);
    addSheet(workbook, 'Services', services);
    addSheet(workbook, 'Branches', branches);
    addSheet(workbook, 'Users', users);

    const suffix = from || to ? `${from || 'all'}-to-${to || 'all'}` : 'all-data';
    const filename = `tiger-car-wash-${suffix}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(await workbook.xlsx.writeBuffer());
  } catch (error) {
    next(error);
  }
});

module.exports = router;
