// Sends WhatsApp messages via Meta's official WhatsApp Cloud API.
// Docs: https://developers.facebook.com/docs/whatsapp/cloud-api/guides/send-messages
//
// Requires: WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID in .env
// Note: outside a 24hr customer-initiated session window, Meta requires
// pre-approved "template" messages. For a receipt right after a sale this is
// usually fine as a free-form message if the customer messaged your business
// number before; otherwise register a simple "receipt" template in Meta
// Business Manager and switch sendTemplate() below.

const fetch = require('node-fetch');
require('dotenv').config();

const API_VERSION = process.env.WHATSAPP_API_VERSION || 'v20.0';
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const TOKEN = process.env.WHATSAPP_TOKEN;

const BASE_URL = `https://graph.facebook.com/${API_VERSION}/${PHONE_NUMBER_ID}/messages`;

async function sendText(toNumber, message) {
  if (!TOKEN || !PHONE_NUMBER_ID) {
    console.warn('[whatsapp] Skipped — WHATSAPP_TOKEN/WHATSAPP_PHONE_NUMBER_ID not configured.');
    return { skipped: true };
  }
  try {
    const res = await fetch(BASE_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: toNumber,
        type: 'text',
        text: { body: message },
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      console.error('[whatsapp] send failed:', data);
      return { success: false, error: data };
    }
    return { success: true, data };
  } catch (err) {
    console.error('[whatsapp] send error:', err.message);
    return { success: false, error: err.message };
  }
}

function buildCustomerReceiptMessage(sale, branch, items) {
  const lines = items
    .map((i) => `- ${i.service_name} x${i.quantity}: ₹${i.line_total.toFixed(2)}`)
    .join('\n');
  return (
    `Thank you for visiting ${branch.name}!\n\n` +
    `Receipt #${sale.receipt_number}\n` +
    `${lines}\n\n` +
    `Total: ₹${sale.total.toFixed(2)}\n` +
    `Payment: ${sale.payment_method === 'upi' ? 'BANK TRANSFER' : sale.payment_method.toUpperCase()}\n\n` +
    `See you again soon!`
  );
}

function buildOwnerAlertMessage(sale, branch) {
  return (
    `Payment received ✅\n` +
    `Branch: ${branch.name}\n` +
    `Amount: ₹${sale.total.toFixed(2)}\n` +
    `Method: ${sale.payment_method === 'upi' ? 'BANK TRANSFER' : sale.payment_method.toUpperCase()}\n` +
    `Receipt #${sale.receipt_number}`
  );
}

module.exports = {
  sendText,
  buildCustomerReceiptMessage,
  buildOwnerAlertMessage,
};
