// One-time seed script: creates first branch + owner login + sample services.
// Run with: npm run initdb

const { v4: uuid } = require('uuid');
const bcrypt = require('bcryptjs');
const db = require('./index');

const branchId = uuid();
const ownerId = uuid();
// Ensure newer schema columns exist (for upgrades)
const tableInfo = db.prepare("PRAGMA table_info(sales)").all();
if (!tableInfo.find((c) => c.name === 'email_sent_owner')) {
  try {
    db.prepare("ALTER TABLE sales ADD COLUMN email_sent_owner INTEGER DEFAULT 0").run();
    console.log('Added email_sent_owner column to sales table');
  } catch (err) {
    console.warn('Failed to add email_sent_owner column (may already exist):', err.message);
  }
}

const userTableInfo = db.prepare("PRAGMA table_info(users)").all();
if (!userTableInfo.find((c) => c.name === 'profile_photo')) {
  db.prepare("ALTER TABLE users ADD COLUMN profile_photo TEXT").run();
  console.log('Added profile_photo column to users table');
}

const customerTableInfo = db.prepare("PRAGMA table_info(customers)").all();
if (!customerTableInfo.find((c) => c.name === 'vehicle_type')) {
  db.prepare("ALTER TABLE customers ADD COLUMN vehicle_type TEXT").run();
  console.log('Added vehicle_type column to customers table');
}

const existingOwner = db.prepare(`SELECT id FROM users WHERE role = 'owner' LIMIT 1`).get();

if (existingOwner) {
  console.log('Owner already exists. Skipping seed.');
  process.exit(0);
}

const ownerEmail = process.env.OWNER_EMAIL;
const ownerPassword = process.env.OWNER_PASSWORD;
const ownerName = process.env.OWNER_NAME || 'Owner';

if (!ownerEmail || !ownerPassword) {
  throw new Error('OWNER_EMAIL and OWNER_PASSWORD must be set in backend/.env before initializing the database.');
}

db.prepare(`INSERT INTO branches (id, name, address, phone) VALUES (?, ?, ?, ?)`)
  .run(branchId, 'Main Branch', 'Change this address', '');

const passwordHash = bcrypt.hashSync(ownerPassword, 10);
db.prepare(`INSERT INTO users (id, branch_id, name, email, password_hash, role) VALUES (?, NULL, ?, ?, ?, 'owner')`)
  .run(ownerId, ownerName, ownerEmail, passwordHash);

const services = [
  ['Bike Wash', 15, 150],
  ['Bike Wash YBR', 20, 250],
  ['Bike Diesel', 10, 100],
  ['Car Wash (SEDAN)', 30, 400],
  ['Car Wash (SUV)', 40, 600],
  ['Car Service (SEDAN)', 60, 700],
  ['Car Service (SUV)', 90, 1000],
  ['Rikshaw/AUTO Wash', 25, 400],
  ['Rikshaw/AUTO Service', 45, 500],
  ['Compound Polish', 120, 3000],
  ['Gernal Service', 180, 4000],
];

const insertService = db.prepare(
  `INSERT INTO services (id, name, description, price, duration_minutes) VALUES (?, ?, '', ?, ?)`
);
for (const [name, duration, price] of services) {
  insertService.run(uuid(), name, price, duration);
}

console.log('Seed complete.');
console.log(`Owner account created: ${ownerEmail}`);
console.log('Branch ID:', branchId);
