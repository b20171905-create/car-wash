require('dotenv').config();
const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
const { v4: uuid } = require('uuid');
const bcrypt = require('bcryptjs');

const authRoutes = require('./routes/auth');
const branchRoutes = require('./routes/branches');
const serviceRoutes = require('./routes/services');
const salesRoutes = require('./routes/sales');
const usersRoutes = require('./routes/users');
const analyticsRoutes = require('./routes/analytics');
const db = require('./db');

const app = express();

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (ALLOWED_ORIGINS.length === 0 || ALLOWED_ORIGINS.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('CORS not allowed'));
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

app.use(express.json({ limit: '512kb' }));

app.get('/health', (req, res) => res.json({ ok: true, time: new Date().toISOString() }));

app.use('/api/auth', authRoutes);
app.use('/api/branches', branchRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/analytics', analyticsRoutes);

// ---------------------------------------------------------------------------
// Database initialization (one-time setup)
// ---------------------------------------------------------------------------
async function initializeDatabase() {
  try {
    console.log('[INIT] Waiting for database schema to be ready...');
    await db.databaseReady;
    console.log('[INIT] Database schema initialized!');

    const ownerEmail = process.env.OWNER_EMAIL;
    const ownerPassword = process.env.OWNER_PASSWORD;
    const ownerName = process.env.OWNER_NAME || 'Owner';

    if (!ownerEmail || !ownerPassword) {
      console.warn('[INIT] OWNER_EMAIL or OWNER_PASSWORD not set - skipping seed');
      return;
    }

    // Check if owner exists
    console.log('[INIT] Checking if owner account exists...');
    const existingOwner = await db.prepare(`SELECT id FROM users WHERE role = 'owner' LIMIT 1`).get();
    if (existingOwner) {
      console.log('[INIT] Owner account already exists - skipping seed');
      return;
    }

    console.log('[INIT] Creating initial data...');
    const branchId = uuid();
    const ownerId = uuid();

    // Create branch
    await db.prepare(`INSERT INTO branches (id, name, address, phone) VALUES (?, ?, ?, ?)`).run(
      branchId,
      'Main Branch',
      'Change this address',
      ''
    );
    console.log('[INIT] ✓ Created main branch');

    // Create owner user
    const passwordHash = bcrypt.hashSync(ownerPassword, 10);
    await db.prepare(`INSERT INTO users (id, branch_id, name, email, password_hash, role, active) VALUES (?, NULL, ?, ?, ?, 'owner', true)`).run(
      ownerId,
      ownerName,
      ownerEmail,
      passwordHash
    );
    console.log(`[INIT] ✓ Created owner account: ${ownerEmail}`);

    // Create services
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

    for (const [name, duration, price] of services) {
      await db.prepare(`INSERT INTO services (id, name, description, price, duration_minutes, active) VALUES (?, ?, ?, ?, ?, true)`).run(
        uuid(),
        name,
        '',
        price,
        duration
      );
    }
    console.log(`[INIT] ✓ Created ${services.length} services`);
    console.log('[INIT] ✅ Database initialization complete!');
  } catch (error) {
    console.error('[INIT] ❌ Initialization error:', error.message);
    console.error('[INIT] Stack:', error.stack);
  }
}

// ---------------------------------------------------------------------------
// Serve static React frontend files if present in public/
// ---------------------------------------------------------------------------
const publicPath = path.join(__dirname, 'public');
if (fs.existsSync(publicPath)) {
  app.use(express.static(publicPath));

  // SPA Fallback for client-side routing
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path === '/health') {
      return next();
    }
    res.sendFile(path.join(publicPath, 'index.html'));
  });
}

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message || 'Server error' });
});

const PORT = process.env.PORT || 4000;

if (require.main === module) {
  (async () => {
    try {
      // Run database initialization
      await initializeDatabase();
      
      // Start the server
      app.listen(PORT, () => {
        console.log(`✅  POS backend running → http://localhost:${PORT}`);
      });
    } catch (error) {
      console.error('❌ Failed to start server:', error);
      process.exit(1);
    }
  })();
}

module.exports = app;
