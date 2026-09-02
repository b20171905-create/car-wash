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
    const branches = await db.prepare('SELECT * FROM branches WHERE active = TRUE ORDER BY name').all();
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

// DELETE /:id — owner only; archive the branch so historical records remain intact
router.delete('/:id', requireOwner, async (req, res, next) => {
  try {
  const branch = await db.prepare('SELECT id, name, active FROM branches WHERE id = ?').get(req.params.id);
  if (!branch) return res.status(404).json({ error: 'Branch not found' });
  if (!branch.active) return res.status(404).json({ error: 'Branch not found' });

  await db.prepare('UPDATE branches SET active = FALSE WHERE id = ?').run(req.params.id);
  res.json({ success: true, archived: true });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
