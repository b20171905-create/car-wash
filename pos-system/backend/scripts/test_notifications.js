const { v4: uuid } = require('uuid');
const db = require('../db');
const whatsapp = require('../services/whatsapp');
const emailService = require('../services/email');

async function run() {
  try {
    const branch = db.prepare('SELECT id, name FROM branches LIMIT 1').get();
    if (!branch) {
      console.error('No branch found. Create a branch first.');
      process.exit(1);
    }

    const service = db.prepare('SELECT id, name, price FROM services LIMIT 1').get();
    if (!service) {
      console.error('No service found. Seed services first.');
      process.exit(1);
    }

    const owner = db.prepare("SELECT * FROM users WHERE role = 'owner' LIMIT 1").get();
    if (!owner) {
      console.error('No owner user found. Run initdb.');
      process.exit(1);
    }

    const customerPhone = process.argv[2] || '923001234567'; // default test number

    // Create customer
    const customerId = uuid();
    db.prepare('INSERT INTO customers (id, name, phone, vehicle_number, vehicle_model) VALUES (?, ?, ?, ?, ?)')
      .run(customerId, 'Test Customer', customerPhone, 'TEST-123', 'TestModel');

    const saleId = uuid();
    const receiptNumber = `${branch.id.slice(0,4).toUpperCase()}-TEST-${Date.now()}`;

    const subtotal = service.price;
    const total = subtotal;

    db.prepare(`INSERT INTO sales (id, branch_id, user_id, customer_id, subtotal, discount, tax, total, payment_method, receipt_number) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(saleId, branch.id, owner.id, customerId, subtotal, 0, 0, total, 'cash', receiptNumber);

    const itemId = uuid();
    db.prepare('INSERT INTO sale_items (id, sale_id, service_id, service_name, quantity, unit_price, line_total) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(itemId, saleId, service.id, service.name, 1, service.price, service.price);

    console.log('Inserted test sale:', saleId, 'receipt:', receiptNumber);

    // Build items for messaging
    const items = [{ service_name: service.name, quantity: 1, line_total: service.price }];

    // Send customer WhatsApp
    const custResult = await whatsapp.sendText(customerPhone, whatsapp.buildCustomerReceiptMessage({ id: saleId, receipt_number: receiptNumber, total, payment_method: 'cash' }, branch, items));
    console.log('Customer WhatsApp result:', custResult);
    if (custResult && custResult.success) {
      db.prepare('UPDATE sales SET whatsapp_sent_customer = 1 WHERE id = ?').run(saleId);
    }

    // Send owner WhatsApp
    const ownerNumber = process.env.OWNER_WHATSAPP_NUMBER;
    if (ownerNumber) {
      const ownerMsg = whatsapp.buildOwnerAlertMessage({ id: saleId, total, receipt_number: receiptNumber, payment_method: 'cash' }, branch);
      const ownerResult = await whatsapp.sendText(ownerNumber, ownerMsg);
      console.log('Owner WhatsApp result:', ownerResult);
      if (ownerResult && ownerResult.success) {
        db.prepare('UPDATE sales SET whatsapp_sent_owner = 1 WHERE id = ?').run(saleId);
      }
    } else {
      console.log('OWNER_WHATSAPP_NUMBER not configured; skipping owner WhatsApp.');
    }

    // Send owner email
    const ownerEmail = process.env.OWNER_EMAIL;
    if (ownerEmail) {
      const emailResult = await emailService.sendAdminSaleEmail(ownerEmail, { id: saleId, total, receipt_number: receiptNumber }, branch, items);
      console.log('Owner Email result:', emailResult);
      if (emailResult && emailResult.success) {
        db.prepare('UPDATE sales SET email_sent_owner = 1 WHERE id = ?').run(saleId);
      }
    } else {
      console.log('OWNER_EMAIL not configured; skipping owner email.');
    }

    const saleRow = db.prepare('SELECT id, receipt_number, whatsapp_sent_customer, whatsapp_sent_owner, email_sent_owner FROM sales WHERE id = ?').get(saleId);
    console.log('Final sale flags:', saleRow);

    process.exit(0);
  } catch (err) {
    console.error('Test script failed:', err);
    process.exit(1);
  }
}

run();
