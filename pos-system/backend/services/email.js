const nodemailer = require('nodemailer');
require('dotenv').config();

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = process.env.SMTP_PORT || 587;
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const FROM_EMAIL = process.env.FROM_EMAIL || SMTP_USER;

let transporter = null;
if (SMTP_HOST && SMTP_USER && SMTP_PASS) {
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: Number(SMTP_PORT) === 465, // true for 465, false for other ports
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
} else {
  console.warn('[email] SMTP not configured; owner email notifications will be skipped.');
}

async function sendAdminSaleEmail(toEmail, sale, branch, items) {
  if (!transporter) return { skipped: true };

  const lines = items.map(i => `- ${i.service_name} x${i.quantity}: ₹${i.line_total.toFixed(2)}`).join('\n');
  const subject = `New Payment: ${branch.name} — ₹${sale.total.toFixed(2)} (#${sale.receipt_number})`;
  const body = `A payment was received at ${branch.name}.

Receipt: ${sale.receipt_number}
Amount: ₹${sale.total.toFixed(2)}
Method: ${sale.payment_method === 'upi' ? 'Bank Transfer' : sale.payment_method}

Customer: ${sale.customer_id || 'N/A'}
Items:
${lines}

View in admin dashboard for details.`;

  try {
    const info = await transporter.sendMail({
      from: FROM_EMAIL,
      to: toEmail,
      subject,
      text: body,
    });
    return { success: true, info };
  } catch (err) {
    console.error('[email] send failed:', err.message);
    return { success: false, error: err.message };
  }
}

module.exports = {
  sendAdminSaleEmail,
};
