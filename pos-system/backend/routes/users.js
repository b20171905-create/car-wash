const express = require('express');
const { v4: uuid } = require('uuid');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { requireAuth, requireOwner, requireBranchManager } = require('../services/auth');

const router = express.Router();
// All /api/users routes require a valid JWT
router.use(requireAuth);

// GET /api/users — branch_manager and owner only (cashiers blocked at middleware)
// branch_manager sees only their own branch; owner sees all
router.get('/', requireBranchManager, async (req, res, next) => {
  try {
  let query = `
    SELECT u.id, u.name, u.email, u.profile_photo, u.role, u.active, u.created_at,
           u.branch_id, b.name as branch_name
    FROM users u
    LEFT JOIN branches b ON b.id = u.branch_id
    WHERE u.active = 1
  `;
  const params = [];

  if (req.user.role === 'branch_manager') {
    query += ' AND u.branch_id = ?';
    params.push(req.user.branch_id);
  }

  query += ' ORDER BY u.created_at DESC';
    const users = await db.prepare(query).all(...params);
    res.json(users);
  } catch (error) {
    next(error);
  }
});

// POST /api/users — owner only
router.post('/', requireOwner, async (req, res, next) => {
  const { name, password, profile_photo = null, role, branch_id } = req.body;
  const email = req.body.email?.trim().toLowerCase();
  if (!name || !email || !password || !role) {
    return res.status(400).json({ error: 'name, email, password, and role are required' });
  }
  if (!['owner', 'branch_manager', 'cashier'].includes(role)) {
    return res.status(400).json({ error: 'Invalid role' });
  }
  if ((role === 'branch_manager' || role === 'cashier') && !branch_id) {
    return res.status(400).json({ error: 'branch_id required for branch_manager and cashier' });
  }

  try {
    const existing = await db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) return res.status(409).json({ error: 'Email already exists. Use a different email address.' });

    const id = uuid();
    const passwordHash = bcrypt.hashSync(password, 10);
    await db.prepare(
       `INSERT INTO users (id, branch_id, name, email, profile_photo, password_hash, role, active)
        VALUES (?, ?, ?, ?, ?, ?, ?, 1)`
      ).run(id, branch_id || null, name.trim(), email, profile_photo, passwordHash, role);

    const user = await db.prepare(
      `SELECT u.id, u.name, u.email, u.profile_photo, u.role, u.active, u.branch_id, b.name as branch_name
       FROM users u LEFT JOIN branches b ON b.id = u.branch_id WHERE u.id = ?`
    ).get(id);
    res.status(201).json(user);
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ error: 'Email already exists. Use a different email address.' });
    next(error);
  }
});

// PUT /api/users/:id — owner only
router.put('/:id', requireOwner, (req, res) => {
  const { name, email, profile_photo, role, branch_id, password } = req.body;
  const existing = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'User not found' });

  let passwordHash = existing.password_hash;
  if (password && password.length >= 6) {
    passwordHash = bcrypt.hashSync(password, 10);
  }

  db.prepare(
    `UPDATE users SET
       name = COALESCE(?, name),
      email = COALESCE(?, email),
      profile_photo = COALESCE(?, profile_photo),
       role = COALESCE(?, role),
       branch_id = COALESCE(?, branch_id),
       password_hash = ?
     WHERE id = ?`
  ).run(name, email, profile_photo, role, branch_id, passwordHash, req.params.id);

  const user = db.prepare(
    `SELECT u.id, u.name, u.email, u.profile_photo, u.role, u.active, u.branch_id, b.name as branch_name
     FROM users u LEFT JOIN branches b ON b.id = u.branch_id WHERE u.id = ?`
  ).get(req.params.id);
  res.json(user);
});

// DELETE /api/users/:id — soft delete, owner only, cannot delete own account
router.delete('/:id', requireOwner, (req, res) => {
  if (req.params.id === req.user.id) return res.status(400).json({ error: 'Cannot deactivate your own account' });

  db.prepare('UPDATE users SET active = 0 WHERE id = ?').run(req.params.id);
  res.json({ deactivated: true });
});

module.exports = router;
