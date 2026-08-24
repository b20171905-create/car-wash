const jwt = require('jsonwebtoken');
require('dotenv').config();

const SECRET = process.env.JWT_SECRET || 'dev_secret_change_me';

function createToken(user) {
  return jwt.sign(
    { id: user.id, role: user.role, branch_id: user.branch_id, name: user.name },
    SECRET,
    { expiresIn: '12h' }
  );
}

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

// Owner sees all branches; branch_manager/cashier are locked to their own branch.
function scopeBranchId(req) {
  if (req.user.role === 'owner') {
    return req.query.branch_id || null; // null = all branches
  }
  return req.user.branch_id;
}

module.exports = { createToken, requireAuth, scopeBranchId };
