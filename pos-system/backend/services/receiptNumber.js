const db = require('../db');

function formatReceiptNumber(value) {
  return String(value).padStart(3, '0');
}

async function nextReceiptNumber() {
  const dbType = (process.env.DB_CLIENT || '').toLowerCase();
  const isMysql = dbType === 'mysql' || (process.env.DATABASE_URL || '').startsWith('mysql');
  const query = isMysql
    ? 'SELECT COALESCE(MAX(CAST(receipt_number AS UNSIGNED)), 0) + 1 AS receipt_number FROM sales'
    : "SELECT nextval('receipt_number_seq') AS receipt_number";
  const result = await db.query(query);
  if (!result.rows || !result.rows[0]) {
    throw new Error('Failed to generate receipt number');
  }
  return formatReceiptNumber(result.rows[0].receipt_number);
}

module.exports = { formatReceiptNumber, nextReceiptNumber };