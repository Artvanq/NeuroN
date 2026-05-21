const { Resend } = require('resend');

let resendClient = null;

function isEmailConfigured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM);
}

function getClient() {
  if (!isEmailConfigured()) return null;
  if (!resendClient) {
    resendClient = new Resend(process.env.RESEND_API_KEY);
  }
  return resendClient;
}

function normalizeRecipient(email) {
  const value = String(email || '').trim().toLowerCase();
  return value || null;
}

async function sendEmail({ to, subject, html, text }) {
  const recipient = normalizeRecipient(to);
  const client = getClient();
  if (!recipient || !client) return { skipped: true };

  await client.emails.send({
    from: process.env.RESEND_FROM,
    to: recipient,
    subject: String(subject || 'Neuron'),
    html: String(html || ''),
    text: String(text || ''),
  });
  return { sent: true };
}

function appBaseUrl() {
  return (process.env.FRONTEND_URL || 'http://localhost:3000').split(',')[0].trim();
}

function makeUrl(path, query = {}) {
  const url = new URL(path, appBaseUrl());
  Object.entries(query).forEach(([k, v]) => {
    if (v != null) url.searchParams.set(k, String(v));
  });
  return url.toString();
}

module.exports = {
  isEmailConfigured,
  sendEmail,
  makeUrl,
};
