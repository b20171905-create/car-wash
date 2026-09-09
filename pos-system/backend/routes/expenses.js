const express = require('express');
const { v4: uuid } = require('uuid');
const db = require('../db');
const { requireAuth, requireBranchManager } = require('../services/auth');

const router = express.Router();
router.use(requireAuth, requireBranchManager);

async function ensureTable() {
  await db.prepare(`CREATE TABLE IF NOT EXISTS expenses (
    id TEXT PRIMARY KEY,
    branch_id TEXT NOT NULL REFERENCES branches(id),
    user_id TEXT NOT NULL REFERENCES users(id),
    expense_date DATE NOT NULL,
    category TEXT NOT NULL,
    amount DOUBLE PRECISION NOT NULL,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`).run();
}

function branchFilter(req, params) {
  if (req.user.role === 'owner') return '';
  params.push(req.user.branch_id);
  return ' AND e.branch_id = ?';
}

router.get('/', async (req, res, next) => {
  try {
    await ensureTable();
    const expenseDate = req.query.date || new Date().toISOString().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(expenseDate)) return res.status(400).json({ error: 'date must use YYYY-MM-DD format' });
    const params = [expenseDate];
    const filter = branchFilter(req, params);
    const rows = await db.prepare(`SELECT e.*, b.name AS branch_name, u.name AS created_by
      FROM expenses e JOIN branches b ON b.id = e.branch_id JOIN users u ON u.id = e.user_id
      WHERE e.expense_date = ?${filter} ORDER BY e.created_at DESC`).all(...params);
    res.json(rows);
  } catch (error) { next(error); }
});

router.post('/', async (req, res, next) => {
  try {
    await ensureTable();
    const { expense_date, category, amount, notes, branch_id } = req.body;
    const selectedBranch = req.user.role === 'owner' ? branch_id : req.user.branch_id;
    if (!selectedBranch || !category?.trim() || !Number.isFinite(Number(amount)) || Number(amount) <= 0) {
      return res.status(400).json({ error: 'branch, category and a positive amount are required' });
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(expense_date || '')) return res.status(400).json({ error: 'expense_date must use YYYY-MM-DD format' });
    const id = uuid();
    await db.prepare('INSERT INTO expenses (id, branch_id, user_id, expense_date, category, amount, notes) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
      id, selectedBranch, req.user.id, expense_date, category.trim(), Number(amount), notes?.trim() || ''
    );
    res.status(201).json(await db.prepare('SELECT e.*, b.name AS branch_name, u.name AS created_by FROM expenses e JOIN branches b ON b.id = e.branch_id JOIN users u ON u.id = e.user_id WHERE e.id = ?').get(id));
  } catch (error) { next(error); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await ensureTable();
    const params = [req.params.id];
    const filter = branchFilter(req, params);
    const result = await db.prepare(`DELETE FROM expenses WHERE id = ?${filter.replace('e.', '')}`).run(...params);
    if (!result.changes) return res.status(404).json({ error: 'Expense not found' });
    res.json({ success: true });
  } catch (error) { next(error); }
});

module.exports = router;