const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { createToken } = require('../services/auth');

const router = express.Router();

router.post('/login', async (req, res, next) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'email and password required' });

  try {
    const user = await db.prepare('SELECT * FROM users WHERE email = ? AND active = TRUE').get(email);
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const valid = bcrypt.compareSync(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    const token = createToken(user);
    res.json({
      token,
      user: { id: user.id, name: user.name, profile_photo: user.profile_photo, role: user.role, branch_id: user.branch_id },
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
