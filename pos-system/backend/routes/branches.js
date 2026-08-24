const express = require('express');
const { v4: uuid } = require('uuid');
const db = require('../db');
const { requireAuth } = require('../services/auth');

const router = express.Router();
router.use(requireAuth);

router.get('/', (req, res) => {
  const branches = db.prepare('SELECT * FROM branches ORDER BY name').all();
  res.json(branches);
});

router.post('/', (req, res) => {
  if (req.user.role !== 'owner') return res.status(403).json({ error: 'Owner only' });
  const { name, address, phone } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });
  const id = uuid();
  db.prepare('INSERT INTO branches (id, name, address, phone) VALUES (?, ?, ?, ?)').run(
    id, name, address || '', phone || ''
  );
  res.status(201).json({ id, name, address, phone });
});

router.delete('/:id', (req, res) => {
  if (req.user.role !== 'owner') return res.status(403).json({ error: 'Owner only' });

  const branch = db.prepare('SELECT id, name FROM branches WHERE id = ?').get(req.params.id);
  if (!branch) return res.status(404).json({ error: 'Branch not found' });

  const hasUsers = db.prepare('SELECT 1 FROM users WHERE branch_id = ? LIMIT 1').get(req.params.id);
  const hasSales = db.prepare('SELECT 1 FROM sales WHERE branch_id = ? LIMIT 1').get(req.params.id);
  if (hasUsers || hasSales) {
    return res.status(409).json({ error: 'This branch has users or sales and cannot be deleted.' });
  }

  db.prepare('DELETE FROM branches WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
