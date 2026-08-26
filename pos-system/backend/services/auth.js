const jwt = require('jsonwebtoken');
require('dotenv').config();

const SECRET = process.env.JWT_SECRET || 'dev_secret_change_me';

// ---------------------------------------------------------------------------
// Token helpers
// ---------------------------------------------------------------------------

function createToken(user) {
  return jwt.sign(
    { id: user.id, role: user.role, branch_id: user.branch_id, name: user.name },
    SECRET,
    { expiresIn: '12h' }
  );
}

// ---------------------------------------------------------------------------
// requireAuth — verifies JWT, attaches req.user
// ---------------------------------------------------------------------------
function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Missing token' });
  try {
    req.user = jwt.verify(token, SECRET);
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// ---------------------------------------------------------------------------
// requireRole(...roles) — generic role guard middleware factory
//
// Usage:  router.get('/foo', requireRole('owner', 'branch_manager'), handler)
// ---------------------------------------------------------------------------
function requireRole(...roles) {
  return function roleGuard(req, res, next) {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Access denied. Required role: ${roles.join(' or ')}. Your role: ${req.user.role}`,
      });
    }
    next();
  };
}

// ---------------------------------------------------------------------------
// Named shorthand guards (used directly as route middleware)
// ---------------------------------------------------------------------------

/** Only the owner (= admin) may proceed. */
const requireOwner = requireRole('owner');

/** Branch managers and owners may proceed; cashiers are blocked. */
const requireBranchManager = requireRole('branch_manager', 'owner');

/** Any authenticated user may proceed (cashier, branch_manager, owner). */
const requireCashierOrAbove = requireRole('cashier', 'branch_manager', 'owner');

// ---------------------------------------------------------------------------
// enforceBranchScope — middleware that sets req.scopedBranchId
//
// - owner: uses ?branch_id query param if provided, otherwise null (= all)
// - branch_manager: ALWAYS locked to their own branch_id (ignores query param)
// - cashier: should never reach analytics; but if it does → 403
// ---------------------------------------------------------------------------
function enforceBranchScope(req, res, next) {
  const role = req.user.role;
  if (role === 'owner') {
    req.scopedBranchId = req.query.branch_id || null;
  } else if (role === 'branch_manager') {
    // Hard-lock: ignore any branch_id query param the caller sends
    req.scopedBranchId = req.user.branch_id;
  } else {
    // cashiers (and any unknown role) must not access scoped analytics
    return res.status(403).json({ error: 'Access denied. Insufficient role.' });
  }
  next();
}

// ---------------------------------------------------------------------------
// scopeBranchId(req) — legacy helper kept for backwards compat in sales routes
// ---------------------------------------------------------------------------
function scopeBranchId(req) {
  if (req.user.role === 'owner') {
    return req.query.branch_id || null;
  }
  return req.user.branch_id;
}

module.exports = {
  createToken,
  requireAuth,
  requireRole,
  requireOwner,
  requireBranchManager,
  requireCashierOrAbove,
  enforceBranchScope,
  scopeBranchId,
};
