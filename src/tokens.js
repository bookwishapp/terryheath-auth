const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');

// Generate a secure random token for magic links
function generateMagicToken() {
  return crypto.randomBytes(32).toString('hex');
}

// Generate a UUID for refresh tokens
function generateRefreshToken() {
  return uuidv4();
}

// Sign an access token
function signAccessToken(userId, email) {
  return jwt.sign(
    {
      sub: userId,
      email
    },
    process.env.JWT_SECRET,
    {
      expiresIn: '15m'
    }
  );
}

// Verify an access token
function verifyAccessToken(token) {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    return null;
  }
}

// Calculate expiry dates
function getAccessTokenExpiry() {
  return new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
}

function getRefreshTokenExpiry() {
  return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
}

function getMagicLinkExpiry() {
  return new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
}

module.exports = {
  generateMagicToken,
  generateRefreshToken,
  signAccessToken,
  verifyAccessToken,
  getAccessTokenExpiry,
  getRefreshTokenExpiry,
  getMagicLinkExpiry
};