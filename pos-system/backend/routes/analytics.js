/**
 * routes/analytics.js
 *
 * Dedicated analytics router — mounted at /api/analytics
 *
 * Access matrix
 * ─────────────────────────────────────────────────────────────────────────────
 * cashier         → 403 on ALL routes (blocked by requireBranchManager)
 * branch_manager  → sees only their own branch (enforced by enforceBranchScope)
 * owner           → sees all branches (or a specific one via ?branch_id=)
 * ─────────────────────────────────────────────────────────────────────────────
 */

const express = require('express');
const db = require('../db');
const {
  requireAuth,
  requireBranchManager,
  enforceBranchScope,
} = require('../services/auth');

const router = express.Router();

// All analytics routes require authentication first
router.use(requireAuth);

// Then require at least branch_manager role — cashiers are blocked here
router.use(requireBranchManager);

// Then resolve and hard-lock branch scope
router.use(enforceBranchScope);

// ---------------------------------------------------------------------------
// GET /api/analytics/branch
// Summary stats per branch (today, overall, by vehicle type)
// ---------------------------------------------------------------------------
router.get('/branch', async (req, res, next) => {
  try {
  const branchId = req.scopedBranchId; // set by enforceBranchScope
  const today = new Date().toISOString().slice(0, 10);

  let query = `
    SELECT
      b.id,
      b.name                                                                         AS branch_name,
      COUNT(s.id)                                                                    AS sale_count,
      COALESCE(SUM(s.total), 0)                                                      AS revenue,
      COALESCE(SUM(CASE WHEN date(s.created_at) = ? THEN s.total ELSE 0 END), 0)    AS today_revenue,
      COUNT(CASE WHEN date(s.created_at) = ? THEN 1 END)                            AS today_count,
      COALESCE(SUM(CASE WHEN date(s.created_at) = ? AND c.vehicle_type = 'bike' THEN s.total ELSE 0 END), 0) AS today_bike_revenue,
      COUNT(CASE WHEN date(s.created_at) = ? AND c.vehicle_type = 'bike' THEN 1 END) AS today_bike_count,
      COALESCE(SUM(CASE WHEN date(s.created_at) = ? AND c.vehicle_type = 'car' THEN s.total ELSE 0 END), 0) AS today_car_revenue,
      COUNT(CASE WHEN date(s.created_at) = ? AND c.vehicle_type = 'car' THEN 1 END) AS today_car_count,
      COALESCE(SUM(CASE WHEN date(s.created_at) = ? AND c.vehicle_type = 'rikshaw' THEN s.total ELSE 0 END), 0) AS today_rikshaw_revenue,
      COUNT(CASE WHEN date(s.created_at) = ? AND c.vehicle_type = 'rikshaw' THEN 1 END) AS today_rikshaw_count,
      COALESCE(SUM(CASE WHEN date(s.created_at) = ? AND c.vehicle_type = 'suv' THEN s.total ELSE 0 END), 0) AS today_suv_revenue,
      COUNT(CASE WHEN date(s.created_at) = ? AND c.vehicle_type = 'suv' THEN 1 END) AS today_suv_count,
      COALESCE(SUM(CASE WHEN date(s.created_at) = ? AND c.vehicle_type = 'coaster' THEN s.total ELSE 0 END), 0) AS today_coaster_revenue,
      COUNT(CASE WHEN date(s.created_at) = ? AND c.vehicle_type = 'coaster' THEN 1 END) AS today_coaster_count,
      COALESCE(SUM(CASE WHEN date(s.created_at) = ? AND c.vehicle_type = 'truck' THEN s.total ELSE 0 END), 0) AS today_truck_revenue,
      COUNT(CASE WHEN date(s.created_at) = ? AND c.vehicle_type = 'truck' THEN 1 END) AS today_truck_count
    FROM branches b
    LEFT JOIN sales s ON s.branch_id = b.id AND s.status = 'paid'
    LEFT JOIN customers c ON c.id = s.customer_id
  `;
  const params = [today, today, today, today, today, today, today, today, today, today, today, today, today, today, today, today];

  // Hard WHERE clause — branch_manager can NEVER see other branches
  if (branchId) {
    query += ' WHERE b.id = ?';
    params.push(branchId);
  }

  query += ' GROUP BY b.id ORDER BY revenue DESC';

  res.json(await db.prepare(query).all(...params));
  } catch (error) {
    next(error);
  }
});

// ---------------------------------------------------------------------------
// GET /api/analytics/monthly?year=YYYY
// Monthly revenue totals (last 12 months or full year)
// ---------------------------------------------------------------------------
router.get('/monthly', async (req, res, next) => {
  try {
  const branchId = req.scopedBranchId;

  const selectedYear = req.query.year;
  if (selectedYear && !/^\d{4}$/.test(selectedYear)) {
    return res.status(400).json({ error: 'year must use YYYY format' });
  }

  const start = new Date();
  start.setDate(1);
  start.setMonth(start.getMonth() - 11);
  const from = selectedYear ? `${selectedYear}-01-01` : start.toISOString().slice(0, 10);

  let dateFilter = 'date(s.created_at) >= date(?)';
  const params = [from];

  if (selectedYear) {
    dateFilter = 'date(s.created_at) >= date(?) AND date(s.created_at) < date(?)';
    params.push(`${Number(selectedYear) + 1}-01-01`);
  }

  let query = `
    SELECT
      substr(s.created_at, 1, 7) AS month,
      COALESCE(SUM(s.total), 0)  AS revenue,
      COUNT(s.id)                AS sale_count
    FROM sales s
    WHERE s.status = 'paid' AND ${dateFilter}
  `;

  // Hard WHERE clause for branch scope
  if (branchId) {
    query += ' AND s.branch_id = ?';
    params.push(branchId);
  }

  query += ' GROUP BY substr(s.created_at, 1, 7) ORDER BY month';

  res.json(await db.prepare(query).all(...params));
  } catch (error) {
    next(error);
  }
});

// ---------------------------------------------------------------------------
// GET /api/analytics/daily?month=YYYY-MM
// Day-by-day breakdown for a given month
// ---------------------------------------------------------------------------
router.get('/daily', async (req, res, next) => {
  try {
  const branchId = req.scopedBranchId;
  const month = req.query.month || new Date().toISOString().slice(0, 7);

  if (!/^\d{4}-\d{2}$/.test(month)) {
    return res.status(400).json({ error: 'month must use YYYY-MM format' });
  }

  let query = `
    SELECT
      substr(s.created_at, 1, 10) AS day,
      COALESCE(SUM(s.total), 0)   AS revenue,
      COUNT(s.id)                 AS sale_count
    FROM sales s
    WHERE s.status = 'paid' AND substr(s.created_at, 1, 7) = ?
  `;
  const params = [month];

  // Hard WHERE clause for branch scope
  if (branchId) {
    query += ' AND s.branch_id = ?';
    params.push(branchId);
  }

  query += ' GROUP BY substr(s.created_at, 1, 10) ORDER BY day';

  res.json(await db.prepare(query).all(...params));
  } catch (error) {
    next(error);
  }
});

module.exports = router;
