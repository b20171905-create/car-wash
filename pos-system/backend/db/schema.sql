-- Central database schema. One DB, all branches, filtered by branch_id.

CREATE TABLE IF NOT EXISTS branches (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT,
  phone TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  branch_id TEXT REFERENCES branches(id), -- NULL for owner/admin who sees all branches
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  profile_photo TEXT,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('owner', 'branch_manager', 'cashier')),
  active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS services (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,          -- e.g. "Basic Wash", "Full Detailing", "Oil Change"
  description TEXT,
  price REAL NOT NULL,
  duration_minutes INTEGER,
  active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  name TEXT,
  phone TEXT,                  -- used for WhatsApp receipt, include country code
  vehicle_type TEXT CHECK (vehicle_type IN ('motor_bike', 'car') OR vehicle_type IS NULL),
  vehicle_number TEXT,
  vehicle_model TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sales (
  id TEXT PRIMARY KEY,
  branch_id TEXT NOT NULL REFERENCES branches(id),
  user_id TEXT NOT NULL REFERENCES users(id),      -- cashier who processed it
  customer_id TEXT REFERENCES customers(id),
  subtotal REAL NOT NULL,
  discount REAL DEFAULT 0,
  tax REAL DEFAULT 0,
  total REAL NOT NULL,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'card', 'upi', 'wallet', 'other')),
  status TEXT NOT NULL DEFAULT 'paid' CHECK (status IN ('paid', 'refunded', 'void')),
  receipt_number TEXT UNIQUE,
  whatsapp_sent_customer INTEGER DEFAULT 0,
  whatsapp_sent_owner INTEGER DEFAULT 0,
  email_sent_owner INTEGER DEFAULT 0,
  printed INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sale_items (
  id TEXT PRIMARY KEY,
  sale_id TEXT NOT NULL REFERENCES sales(id),
  service_id TEXT NOT NULL REFERENCES services(id),
  service_name TEXT NOT NULL,   -- snapshot in case service is renamed later
  quantity INTEGER DEFAULT 1,
  unit_price REAL NOT NULL,
  line_total REAL NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sales_branch ON sales(branch_id);
CREATE INDEX IF NOT EXISTS idx_sales_created ON sales(created_at);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_users_active ON users(active);
