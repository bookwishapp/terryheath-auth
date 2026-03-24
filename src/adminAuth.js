const crypto = require('crypto');

// Generate a signed admin session token
function generateAdminToken() {
  const timestamp = Date.now().toString();
  const random = crypto.randomBytes(16).toString('hex');
  const payload = `${timestamp}.${random}`;

  const signature = crypto
    .createHmac('sha256', process.env.ADMIN_SECRET)
    .update(payload)
    .digest('hex');

  return `${payload}.${signature}`;
}

// Verify an admin session token
function verifyAdminToken(token) {
  if (!token) return false;

  const parts = token.split('.');
  if (parts.length !== 3) return false;

  const [timestamp, random, signature] = parts;
  const payload = `${timestamp}.${random}`;

  const expectedSignature = crypto
    .createHmac('sha256', process.env.ADMIN_SECRET)
    .update(payload)
    .digest('hex');

  // Constant time comparison to prevent timing attacks
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
    return false;
  }

  // Check if token is expired (24 hours)
  const tokenTime = parseInt(timestamp, 10);
  const now = Date.now();
  const twentyFourHours = 24 * 60 * 60 * 1000;

  if (now - tokenTime > twentyFourHours) {
    return false;
  }

  return true;
}

// Check admin password
function checkAdminPassword(password) {
  return password === process.env.ADMIN_PASSWORD;
}

module.exports = {
  generateAdminToken,
  verifyAdminToken,
  checkAdminPassword
};