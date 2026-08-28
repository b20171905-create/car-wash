const express = require('express');
const { v4: uuid } = require('uuid');
const db = require('../db');
const { requireAuth, requireOwner, requireBranchManager } = require('../services/auth');

const router = express.Router();
// All /api/branches routes require a valid JWT
router.use(requireAuth);

// GET / — branch_manager and owner only (cashiers have no need to enumerate branches)
router.get('/', requireBranchManager, async (req, res, next) => {
  try {
    const branches = await db.prepare('SELECT * FROM branches ORDER BY name').all();
    res.json(branches);
  } catch (error) {
    next(error);
  }
});

// POST / — owner only
router.post('/', requireOwner, async (req, res, next) => {
  const { name, address, phone } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });
  const id = uuid();
  try {
    await db.prepare('INSERT INTO branches (id, name, address, phone) VALUES (?, ?, ?, ?)').run(
      id, name.trim(), address || '', phone || ''
    );
    res.status(201).json({ id, name: name.trim(), address: address || '', phone: phone || '' });
  } catch (error) {
    next(error);
  }
});

// PUT /:id — owner only
router.put('/:id', requireOwner, async (req, res, next) => {
  const { name, address, phone } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'name required' });

  try {
    const result = await db.prepare(
      'UPDATE branches SET name = ?, address = ?, phone = ? WHERE id = ?'
    ).run(name.trim(), address || '', phone || '', req.params.id);
    if (!result.changes) return res.status(404).json({ error: 'Branch not found' });
    res.json(await db.prepare('SELECT * FROM branches WHERE id = ?').get(req.params.id));
  } catch (error) {
    next(error);
  }
});

// DELETE /:id — owner only
router.delete('/:id', requireOwner, async (req, res, next) => {
  try {
  const branch = await db.prepare('SELECT id, name FROM branches WHERE id = ?').get(req.params.id);
  if (!branch) return res.status(404).json({ error: 'Branch not found' });

  const hasUsers = await db.prepare('SELECT 1 FROM users WHERE branch_id = ? LIMIT 1').get(req.params.id);
  const hasSales = await db.prepare('SELECT 1 FROM sales WHERE branch_id = ? LIMIT 1').get(req.params.id);
  if (hasUsers || hasSales) {
    return res.status(409).json({ error: 'This branch has users or sales and cannot be deleted.' });
  }

  await db.prepare('DELETE FROM branches WHERE id = ?').run(req.params.id);
  res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
