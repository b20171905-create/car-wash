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
    WHERE u.active = TRUE
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
        VALUES (?, ?, ?, ?, ?, ?, ?, TRUE)`
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
router.put('/:id', requireOwner, async (req, res, next) => {
  try {
  const { name, email, profile_photo, role, branch_id, password } = req.body;
  const existing = await db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'User not found' });

  // Build dynamic update query
  const updates = [];
  const params = [];
  
  if (name !== undefined && name !== null) {
    updates.push('name = ?');
    params.push(name.trim());
  }
  if (email !== undefined && email !== null) {
    updates.push('email = ?');
    params.push(email.toLowerCase().trim());
  }
  if (profile_photo !== undefined) {
    updates.push('profile_photo = ?');
    params.push(profile_photo);
  }
  if (role !== undefined && role !== null) {
    updates.push('role = ?');
    params.push(role);
  }
  if (branch_id !== undefined) {
    updates.push('branch_id = ?');
    params.push(branch_id);
  }
  
  let passwordHash = existing.password_hash;
  if (password && password.length >= 6) {
    passwordHash = bcrypt.hashSync(password, 10);
    updates.push('password_hash = ?');
    params.push(passwordHash);
  }

  if (updates.length === 0) {
    return res.status(400).json({ error: 'No fields to update' });
  }

  params.push(req.params.id);
  await db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...params);

  const user = await db.prepare(
    `SELECT u.id, u.name, u.email, u.profile_photo, u.role, u.active, u.branch_id, b.name as branch_name
     FROM users u LEFT JOIN branches b ON b.id = u.branch_id WHERE u.id = ?`
  ).get(req.params.id);
  res.json(user);
  } catch (error) {
    next(error);
  }
});

// DELETE /api/users/:id — soft delete, owner only, cannot delete own account
router.delete('/:id', requireOwner, async (req, res, next) => {
  if (req.params.id === req.user.id) return res.status(400).json({ error: 'Cannot deactivate your own account' });

  try {
    const result = await db.prepare('UPDATE users SET active = FALSE WHERE id = ?').run(req.params.id);
    if (!result.changes) return res.status(404).json({ error: 'User not found' });
    res.json({ deactivated: true });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
