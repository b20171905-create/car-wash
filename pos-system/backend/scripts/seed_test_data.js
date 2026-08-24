const { v4: uuid } = require('uuid');
const bcrypt = require('bcryptjs');
const db = require('../db');

const TEST_PREFIX = 'TEST-DATA-';
const branchCount = 5;
const saleCount = 500;
const testPassword = 'test1234';

const existingTestSale = db.prepare("SELECT id FROM sales WHERE receipt_number LIKE 'TEST-DATA-%' LIMIT 1").get();
if (existingTestSale) {
  console.log('Test data already exists. No changes made.');
  process.exit(0);
}

const services = db.prepare('SELECT id, name, price FROM services WHERE active = 1 ORDER BY name').all();
if (!services.length) throw new Error('No active services found. Run db/init.js first.');

const insertBranch = db.prepare('INSERT INTO branches (id, name, address, phone) VALUES (?, ?, ?, ?)');
const insertUser = db.prepare('INSERT INTO users (id, branch_id, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?, ?)');
const insertCustomer = db.prepare(
  'INSERT INTO customers (id, name, phone, vehicle_type, vehicle_number, vehicle_model) VALUES (?, ?, ?, ?, ?, ?)'
);
const insertSale = db.prepare(`
  INSERT INTO sales (id, branch_id, user_id, customer_id, subtotal, discount, tax, total, payment_method, status, receipt_number, created_at)
  VALUES (?, ?, ?, ?, ?, 0, 0, ?, ?, 'paid', ?, ?)
`);
const insertItem = db.prepare(`
  INSERT INTO sale_items (id, sale_id, service_id, service_name, quantity, unit_price, line_total)
  VALUES (?, ?, ?, ?, 1, ?, ?)
`);

const transaction = db.transaction(() => {
  const branches = [];
  const users = [];
  const passwordHash = bcrypt.hashSync(testPassword, 10);

  for (let index = 1; index <= branchCount; index += 1) {
    const branch = {
      id: uuid(),
      name: `Test Branch ${index}`,
      address: `Test Address ${index}`,
      phone: `0300000000${index}`,
    };
    insertBranch.run(branch.id, branch.name, branch.address, branch.phone);
    branches.push(branch);

    const user = {
      id: uuid(),
      name: `Test Cashier ${index}`,
      email: `test.cashier${index}@example.com`,
    };
    insertUser.run(user.id, branch.id, user.name, user.email, passwordHash, 'cashier');
    users.push(user);
  }

  for (let index = 0; index < saleCount; index += 1) {
    const branchIndex = index % branches.length;
    const branch = branches[branchIndex];
    const user = users[branchIndex];
    const service = services[index % services.length];
    const amount = Number(service.price);
    const saleId = uuid();
    const customerId = uuid();

    // Keep the newest 14 records in the current week for chart visibility.
    const daysAgo = index < 14 ? index % 7 : 15 + (index % 350);
    const createdAt = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
    createdAt.setHours(9 + (index % 9), index % 60, 0, 0);
    const timestamp = createdAt.toISOString().replace('T', ' ').slice(0, 19);
    const receipt = `${TEST_PREFIX}${String(index + 1).padStart(4, '0')}`;

    const vehicleType = index % 2 === 0 ? 'motor_bike' : 'car';
    const vehicleModel = vehicleType === 'car' ? 'Test Car' : 'Test Motor Bike';
    insertCustomer.run(customerId, `Test Customer ${index + 1}`, `92300000${String(index).padStart(4, '0')}`, vehicleType, `TEST-${String(index + 1).padStart(4, '0')}`, vehicleModel);
    insertSale.run(saleId, branch.id, user.id, customerId, amount, amount, 'cash', receipt, timestamp);
    insertItem.run(uuid(), saleId, service.id, service.name, amount, amount);
  }

  return { branches, users };
});

const { branches, users } = transaction();
console.log(`Created ${branches.length} test branches, ${users.length} test users, and ${saleCount} test sales.`);
console.log(`Test user password: ${testPassword}`);
console.log('Test users:');
users.forEach((user) => console.log(`  ${user.email}`));
console.log('Test records use receipt numbers beginning with TEST-DATA-.');
