const express = require('express');
const db = require('../db');
const { requireAuth, requireBranchManager, scopeBranchId } = require('../services/auth');

const router = express.Router();
router.use(requireAuth, requireBranchManager);

function validateDate(value, field) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) {
    const error = new Error(`${field} must use YYYY-MM-DD format`);
    error.status = 400;
    throw error;
  }
  return value;
}

function normalizeReportDay(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  const text = String(value || '');
  const isoMatch = text.match(/^(\d{4}-\d{2}-\d{2})/);
  if (isoMatch) return isoMatch[1];
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
}

function getWeekStart(day) {
  const date = new Date(`${day}T12:00:00Z`);
  const offset = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - offset);
  return date.toISOString().slice(0, 10);
}

router.get('/profit-loss', async (req, res, next) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const from = validateDate(req.query.from || today.slice(0, 8) + '01', 'from');
    const to = validateDate(req.query.to || today, 'to');
    if (from > to) return res.status(400).json({ error: 'from date cannot be after to date' });

    const branchId = scopeBranchId(req);
    const requestedBranchId = req.user.role === 'owner' ? req.query.branch_id : branchId;
    const salesParams = [from, `${to} 23:59:59`];
    const expenseParams = [from, to];
    let salesFilter = '';
    let expenseFilter = '';
    if (requestedBranchId) {
      salesFilter = ' AND s.branch_id = ?';
      expenseFilter = ' AND e.branch_id = ?';
      salesParams.push(requestedBranchId);
      expenseParams.push(requestedBranchId);
    }

    const [sales, expenses, categories, dailySales, dailyExpenses] = await Promise.all([
      db.prepare(`SELECT COALESCE(SUM(s.total), 0) AS revenue, COUNT(s.id) AS sale_count
        FROM sales s
        WHERE s.status = 'paid' AND s.created_at >= ? AND s.created_at <= ?${salesFilter}`).get(...salesParams),
      db.prepare(`SELECT COALESCE(SUM(e.amount), 0) AS expenses, COUNT(e.id) AS expense_count
        FROM expenses e
        WHERE e.expense_date >= ? AND e.expense_date <= ?${expenseFilter}`).get(...expenseParams),
      db.prepare(`SELECT e.category, COALESCE(SUM(e.amount), 0) AS amount, COUNT(e.id) AS expense_count
        FROM expenses e
        WHERE e.expense_date >= ? AND e.expense_date <= ?${expenseFilter}
        GROUP BY e.category ORDER BY amount DESC`).all(...expenseParams),
      db.prepare(`SELECT DATE(s.created_at) AS day, COALESCE(SUM(s.total), 0) AS revenue
        FROM sales s
        WHERE s.status = 'paid' AND s.created_at >= ? AND s.created_at <= ?${salesFilter}
        GROUP BY DATE(s.created_at) ORDER BY day`).all(...salesParams),
      db.prepare(`SELECT e.expense_date AS day, COALESCE(SUM(e.amount), 0) AS expenses
        FROM expenses e
        WHERE e.expense_date >= ? AND e.expense_date <= ?${expenseFilter}
        GROUP BY e.expense_date ORDER BY day`).all(...expenseParams),
    ]);

    const revenue = Number(sales?.revenue || 0);
    const expensesTotal = Number(expenses?.expenses || 0);
    const dailyByDate = new Map();
    for (const item of dailySales) {
      const day = normalizeReportDay(item.day);
      if (day) dailyByDate.set(day, { revenue: Number(item.revenue || 0), expenses: 0 });
    }
    for (const item of dailyExpenses) {
      const day = normalizeReportDay(item.day);
      if (day) dailyByDate.set(day, { ...(dailyByDate.get(day) || { revenue: 0 }), expenses: Number(item.expenses || 0) });
    }
    const weeklyByStart = new Map();
    for (const [day, values] of dailyByDate) {
      const weekStart = getWeekStart(day);
      const week = weeklyByStart.get(weekStart) || { revenue: 0, expenses: 0 };
      week.revenue += values.revenue;
      week.expenses += values.expenses;
      weeklyByStart.set(weekStart, week);
    }
    res.json({
      from,
      to,
      branch_id: requestedBranchId || null,
      revenue,
      sale_count: Number(sales?.sale_count || 0),
      expenses: expensesTotal,
      expense_count: Number(expenses?.expense_count || 0),
      profit: revenue - expensesTotal,
      categories,
      daily: Array.from(dailyByDate.entries()).map(([day, values]) => ({ day, ...values })),
      weekly: Array.from(weeklyByStart.entries()).sort(([first], [second]) => first.localeCompare(second)).map(([week, values]) => ({ week, ...values })),
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
