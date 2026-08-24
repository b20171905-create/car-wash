const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const dbPath = process.env.DB_PATH || './db/pos.sqlite';
const parentDir = path.dirname(dbPath);
if (!fs.existsSync(parentDir)) {
  fs.mkdirSync(parentDir, { recursive: true });
}
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

// Run schema on startup (idempotent - CREATE TABLE IF NOT EXISTS)
const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
db.exec(schema);

// SQLite does not apply new columns from CREATE TABLE IF NOT EXISTS to an
// existing database. Keep this lightweight migration here so deployments pick
// up the vehicle filter without requiring the one-time seed command.
const customerColumns = db.prepare('PRAGMA table_info(customers)').all();
if (!customerColumns.some((column) => column.name === 'vehicle_type')) {
  db.exec('ALTER TABLE customers ADD COLUMN vehicle_type TEXT');
}

module.exports = db;
