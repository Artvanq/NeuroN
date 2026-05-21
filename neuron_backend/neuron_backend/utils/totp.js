const { authenticator } = require('otplib');

authenticator.options = { window: 1 };

function generateTotpSecret() {
  return authenticator.generateSecret();
}

function buildOtpAuthUrl({ secret, username, issuer = 'Neuron' }) {
  return authenticator.keyuri(username, issuer, secret);
}

function verifyTotpCode(secret, token) {
  if (!secret || !token) return false;
  try {
    return authenticator.verify({ token: String(token).trim(), secret });
  } catch {
    return false;
  }
}

module.exports = {
  generateTotpSecret,
  buildOtpAuthUrl,
  verifyTotpCode,
};
