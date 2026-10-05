const test = require('node:test');
const assert = require('node:assert/strict');
const { formatReceiptNumber } = require('../services/receiptNumber');

test('receipt numbers are padded to at least three digits without truncation', () => {
  assert.equal(formatReceiptNumber(1), '001');
  assert.equal(formatReceiptNumber(999), '999');
  assert.equal(formatReceiptNumber(1000), '1000');
});