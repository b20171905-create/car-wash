const express = require('express');
const { v4: uuid } = require('uuid');
const db = require('../db');
const { requireAuth, requireOwner } = require('../services/auth');

const router = express.Router();
// All /api/services routes require a valid JWT
router.use(requireAuth);

// GET / — open to all authenticated roles (cashiers need the catalogue for checkout)
router.get('/', async (req, res, next) => {
  try {
    const services = await db.prepare('SELECT * FROM services WHERE active = TRUE ORDER BY name').all();
    res.json(services);
  } catch (error) {
    next(error);
  }
});

router.post('/', requireOwner, async (req, res, next) => {
  const { name, description = '', price, duration_minutes = null, active = true } = req.body;
  if (!name || price === undefined || Number.isNaN(Number(price)) || Number(price) < 0) {
    return res.status(400).json({ error: 'Name and a valid non-negative price are required.' });
  }

  const id = uuid();
  try {
    await db.prepare(`
      INSERT INTO services (id, name, description, price, duration_minutes, active)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, name.trim(), description, Number(price), duration_minutes ? Number(duration_minutes) : null, Boolean(active));

    res.status(201).json(await db.prepare('SELECT * FROM services WHERE id = ?').get(id));
  } catch (error) {
    next(error);
  }
});

router.put('/:id', requireOwner, async (req, res, next) => {
  try {
  const current = await db.prepare('SELECT * FROM services WHERE id = ?').get(req.params.id);
  if (!current) return res.status(404).json({ error: 'Service not found.' });

  const { name = current.name, description = current.description, price = current.price,
    duration_minutes = current.duration_minutes, active = current.active } = req.body;
  if (!name || Number.isNaN(Number(price)) || Number(price) < 0) {
    return res.status(400).json({ error: 'Name and a valid non-negative price are required.' });
  }

  await db.prepare(`
    UPDATE services
    SET name = ?, description = ?, price = ?, duration_minutes = ?, active = ?
    WHERE id = ?
  `).run(name.trim(), description || '', Number(price), duration_minutes ? Number(duration_minutes) : null, active ? 1 : 0, req.params.id);

  res.json(await db.prepare('SELECT * FROM services WHERE id = ?').get(req.params.id));
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', requireOwner, async (req, res, next) => {
  try {
  const service = await db.prepare('SELECT id FROM services WHERE id = ?').get(req.params.id);
  if (!service) return res.status(404).json({ error: 'Service not found.' });

  const used = await db.prepare('SELECT 1 FROM sale_items WHERE service_id = ? LIMIT 1').get(req.params.id);
  if (used) {
    return res.status(409).json({ error: 'This service is used in sales. Deactivate it instead of deleting it.' });
  }

  await db.prepare('DELETE FROM services WHERE id = ?').run(req.params.id);
  res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
