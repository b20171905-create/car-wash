CREATE TABLE IF NOT EXISTS branches (
  id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  address TEXT,
  phone VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(255) PRIMARY KEY,
  branch_id VARCHAR(255),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  profile_photo TEXT,
  password_hash TEXT NOT NULL,
  role ENUM('owner', 'branch_manager', 'cashier') NOT NULL,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (branch_id) REFERENCES branches(id)
);

CREATE TABLE IF NOT EXISTS services (
  id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  price DOUBLE NOT NULL,
  duration_minutes INT,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS customers (
  id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255),
  phone VARCHAR(50),
  vehicle_type ENUM('bike', 'car', 'rikshaw', 'suv', 'coaster', 'truck'),
  vehicle_number VARCHAR(100),
  vehicle_model VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sales (
  id VARCHAR(255) PRIMARY KEY,
  branch_id VARCHAR(255) NOT NULL,
  user_id VARCHAR(255) NOT NULL,
  customer_id VARCHAR(255),
  subtotal DOUBLE NOT NULL,
  discount DOUBLE DEFAULT 0,
  tax DOUBLE DEFAULT 0,
  total DOUBLE NOT NULL,
  payment_method ENUM('cash', 'card', 'upi', 'wallet', 'other') NOT NULL,
  status ENUM('paid', 'refunded', 'void') NOT NULL DEFAULT 'paid',
  receipt_number VARCHAR(20) UNIQUE,
  whatsapp_sent_customer BOOLEAN DEFAULT FALSE,
  whatsapp_sent_owner BOOLEAN DEFAULT FALSE,
  email_sent_owner BOOLEAN DEFAULT FALSE,
  printed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (branch_id) REFERENCES branches(id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (customer_id) REFERENCES customers(id)
);

CREATE TABLE IF NOT EXISTS sale_items (
  id VARCHAR(255) PRIMARY KEY,
  sale_id VARCHAR(255) NOT NULL,
  service_id VARCHAR(255) NOT NULL,
  service_name VARCHAR(255) NOT NULL,
  quantity INT DEFAULT 1,
  unit_price DOUBLE NOT NULL,
  line_total DOUBLE NOT NULL,
  FOREIGN KEY (sale_id) REFERENCES sales(id),
  FOREIGN KEY (service_id) REFERENCES services(id)
);

CREATE INDEX IF NOT EXISTS idx_sales_branch ON sales(branch_id);
CREATE INDEX IF NOT EXISTS idx_sales_created ON sales(created_at);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_users_active ON users(active);
