const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { ensureOwnerCreated } = require('../db/seed');
const { createToken } = require('../services/auth');

const router = express.Router();

// GET /api/auth/status - Diagnostics endpoint to verify DB and owner account status
router.get('/status', async (req, res) => {
  try {
    await db.databaseReady;
    const usersCountRow = await db.prepare('SELECT COUNT(*) as count FROM users').get();
    const servicesCountRow = await db.prepare('SELECT COUNT(*) as count FROM services').get();
    const owner = await db.prepare("SELECT email, role, active, created_at FROM users WHERE role = 'owner' LIMIT 1").get();
    
    const userCount = usersCountRow ? (usersCountRow.count ?? usersCountRow['COUNT(*)'] ?? 0) : 0;
    const serviceCount = servicesCountRow ? (servicesCountRow.count ?? servicesCountRow['COUNT(*)'] ?? 0) : 0;

    res.json({
      ok: true,
      dbReady: true,
      userCount: Number(userCount),
      serviceCount: Number(serviceCount),
      ownerExists: !!owner,
      ownerEmail: owner ? owner.email : null,
      envOwnerEmail: process.env.OWNER_EMAIL || null,
    });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// POST /api/auth/seed - Explicit endpoint to seed or reset initial owner account
router.post('/seed', async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    const createdUser = await ensureOwnerCreated(email, password);
    if (!createdUser) {
      return res.status(400).json({ error: 'Failed to seed database. Specify email/password in body or environment variables.' });
    }
    res.json({
      message: 'Owner account seeded successfully',
      email: createdUser.email,
      role: createdUser.role,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/login - Main login endpoint
router.post('/login', async (req, res, next) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'email and password required' });

  try {
    await db.databaseReady;
    const cleanEmail = email.trim().toLowerCase();

    // 1. Try finding user by case-insensitive email
    let user = await db.prepare('SELECT * FROM users WHERE LOWER(TRIM(email)) = ? AND active = TRUE').get(cleanEmail);

    // 2. If user not found, check if users table is empty
    if (!user) {
      const usersCountRow = await db.prepare('SELECT COUNT(*) as count FROM users').get();
      const userCount = usersCountRow ? (usersCountRow.count ?? usersCountRow['COUNT(*)'] ?? 0) : 0;

      // If database has 0 users, auto-seed using the provided credentials
      if (Number(userCount) === 0) {
        console.log(`[AUTH] No users exist in database. Auto-seeding owner account with: ${cleanEmail}`);
        await ensureOwnerCreated(cleanEmail, password);
        user = await db.prepare('SELECT * FROM users WHERE LOWER(TRIM(email)) = ? AND active = TRUE').get(cleanEmail);
      }
    }

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const valid = bcrypt.compareSync(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = createToken(user);
    res.json({
      token,
      user: { id: user.id, name: user.name, profile_photo: user.profile_photo, role: user.role, branch_id: user.branch_id },
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
