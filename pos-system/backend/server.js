require('dotenv').config();
const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const branchRoutes = require('./routes/branches');
const serviceRoutes = require('./routes/services');
const salesRoutes = require('./routes/sales');
const usersRoutes = require('./routes/users');
const analyticsRoutes = require('./routes/analytics');
const db = require('./db');
const { ensureOwnerCreated } = require('./db/seed');

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

app.get('/health', async (req, res) => {
  try {
    await db.databaseReady;
    await db.prepare('SELECT 1').get();
    res.json({ ok: true, db: 'connected', time: new Date().toISOString() });
  } catch (err) {
    console.error('[Health Check DB Error]:', err.message);
    res.status(500).json({ ok: false, db: 'error', error: err.message, time: new Date().toISOString() });
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/branches', branchRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/analytics', analyticsRoutes);

// Trigger seed automatically on server load once database schema is ready
db.databaseReady
  .then(() => ensureOwnerCreated())
  .catch((err) => console.error('[INIT] Error during auto-seed:', err.message));

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
  app.listen(PORT, () => {
    console.log(`✅  POS backend running → http://localhost:${PORT}`);
  });
}

module.exports = app;
