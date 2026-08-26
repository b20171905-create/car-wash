require('dotenv').config();
const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const branchRoutes = require('./routes/branches');
const serviceRoutes = require('./routes/services');
const salesRoutes = require('./routes/sales');
const usersRoutes = require('./routes/users');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => res.json({ ok: true, time: new Date().toISOString() }));

app.use('/api/auth', authRoutes);
app.use('/api/branches', branchRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/users', usersRoutes);

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
