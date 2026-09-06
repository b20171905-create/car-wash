const db = require('../db');

const DEFAULTS = {
  paper_columns: 42,
  left_padding: 0,
  right_padding: 0,
  top_feed: 0,
  bottom_feed: 3,
  header_alignment: 'center',
};

let tableReady;

async function ensureTable() {
  if (!tableReady) {
    tableReady = db.prepare(`
      CREATE TABLE IF NOT EXISTS receipt_settings (
        id VARCHAR(32) PRIMARY KEY,
        paper_columns INTEGER NOT NULL DEFAULT 42,
        left_padding INTEGER NOT NULL DEFAULT 0,
        right_padding INTEGER NOT NULL DEFAULT 0,
        top_feed INTEGER NOT NULL DEFAULT 0,
        bottom_feed INTEGER NOT NULL DEFAULT 3,
        header_alignment VARCHAR(10) NOT NULL DEFAULT 'center',
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `).run();
  }
  await tableReady;
}

async function get() {
  await ensureTable();
  let settings = await db.prepare('SELECT * FROM receipt_settings WHERE id = ?').get('default');
  if (!settings) {
    await db.prepare(`INSERT INTO receipt_settings (id, paper_columns, left_padding, right_padding, top_feed, bottom_feed, header_alignment) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
      'default', DEFAULTS.paper_columns, DEFAULTS.left_padding, DEFAULTS.right_padding,
      DEFAULTS.top_feed, DEFAULTS.bottom_feed, DEFAULTS.header_alignment
    );
    settings = await db.prepare('SELECT * FROM receipt_settings WHERE id = ?').get('default');
  }
  return { ...DEFAULTS, ...settings };
}

async function update(values) {
  await ensureTable();
  const current = await get();
  const next = { ...current, ...values };
  await db.prepare(`
    UPDATE receipt_settings
    SET paper_columns = ?, left_padding = ?, right_padding = ?, top_feed = ?, bottom_feed = ?, header_alignment = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(next.paper_columns, next.left_padding, next.right_padding, next.top_feed, next.bottom_feed, next.header_alignment, 'default');
  return get();
}

module.exports = { DEFAULTS, get, update };
