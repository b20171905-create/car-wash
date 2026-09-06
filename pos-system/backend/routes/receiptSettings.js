const express = require('express');
const { requireOwner } = require('../services/auth');
const receiptSettings = require('../services/receiptSettings');

const router = express.Router();
router.use(requireOwner);

router.get('/', async (req, res, next) => {
  try {
    res.json(await receiptSettings.get());
  } catch (error) {
    next(error);
  }
});

router.put('/', async (req, res, next) => {
  try {
    const values = {
      paper_columns: Number(req.body.paper_columns),
      left_padding: Number(req.body.left_padding),
      right_padding: Number(req.body.right_padding),
      top_feed: Number(req.body.top_feed),
      bottom_feed: Number(req.body.bottom_feed),
      header_alignment: req.body.header_alignment,
    };
    if (!Number.isInteger(values.paper_columns) || values.paper_columns < 32 || values.paper_columns > 48) {
      return res.status(400).json({ error: 'Paper columns must be between 32 and 48' });
    }
    for (const field of ['left_padding', 'right_padding', 'top_feed', 'bottom_feed']) {
      if (!Number.isInteger(values[field]) || values[field] < 0 || values[field] > 10) {
        return res.status(400).json({ error: `${field} must be a whole number from 0 to 10` });
      }
    }
    if (!['left', 'center', 'right'].includes(values.header_alignment)) {
      return res.status(400).json({ error: 'Invalid header alignment' });
    }
    res.json(await receiptSettings.update(values));
  } catch (error) {
    next(error);
  }
});

module.exports = router;
