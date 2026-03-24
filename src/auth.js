const pool = require('./db');
const {
  generateMagicToken,
  generateRefreshToken,
  signAccessToken,
  getMagicLinkExpiry,
  getRefreshTokenExpiry
} = require('./tokens');
const { sendMagicLink } = require('./email');

// POST /auth/request - Send magic link
async function requestMagicLink(req, res) {
  const { email } = req.body;

  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Valid email required' });
  }

  try {
    // Find or create user
    let user;
    const userResult = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    if (userResult.rows.length === 0) {
      const insertResult = await pool.query(
        'INSERT INTO users (email) VALUES ($1) RETURNING id',
        [email.toLowerCase()]
      );
      user = insertResult.rows[0];
    } else {
      user = userResult.rows[0];
    }

    // Generate and save magic link token
    const token = generateMagicToken();
    const expiresAt = getMagicLinkExpiry();

    await pool.query(
      'INSERT INTO magic_links (user_id, token, expires_at) VALUES ($1, $2, $3)',
      [user.id, token, expiresAt]
    );

    // Send email
    await sendMagicLink(email, token);

    res.json({ message: 'Magic link sent' });
  } catch (error) {
    console.error('Error in requestMagicLink:', error);
    res.status(500).json({ error: 'Failed to send magic link' });
  }
}

// GET /auth/verify?token=TOKEN - Verify magic link
async function verifyMagicLink(req, res) {
  const { token } = req.query;

  if (!token) {
    return res.status(400).json({ error: 'Token required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Find magic link and user info
    const result = await client.query(
      `SELECT ml.id, ml.user_id, ml.used, ml.expires_at, u.email
       FROM magic_links ml
       JOIN users u ON ml.user_id = u.id
       WHERE ml.token = $1`,
      [token]
    );

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Invalid token' });
    }

    const magicLink = result.rows[0];

    // Check if already used
    if (magicLink.used) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Token already used' });
    }

    // Check if expired
    if (new Date() > new Date(magicLink.expires_at)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Token expired' });
    }

    // Mark token as used
    await client.query(
      'UPDATE magic_links SET used = true WHERE id = $1',
      [magicLink.id]
    );

    // Update last_login
    await client.query(
      'UPDATE users SET last_login = NOW() WHERE id = $1',
      [magicLink.user_id]
    );

    // Generate refresh token
    const refreshToken = generateRefreshToken();
    const refreshExpiresAt = getRefreshTokenExpiry();

    await client.query(
      'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
      [magicLink.user_id, refreshToken, refreshExpiresAt]
    );

    await client.query('COMMIT');

    // Generate access token
    const accessToken = signAccessToken(magicLink.user_id, magicLink.email);

    // Set refresh token as httpOnly cookie
    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
    });

    res.json({
      access_token: accessToken,
      user: {
        id: magicLink.user_id,
        email: magicLink.email
      }
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error in verifyMagicLink:', error);
    res.status(500).json({ error: 'Failed to verify token' });
  } finally {
    client.release();
  }
}

// POST /auth/refresh - Refresh access token
async function refreshAccessToken(req, res) {
  const refreshToken = req.cookies?.refresh_token;

  if (!refreshToken) {
    return res.status(401).json({ error: 'No refresh token' });
  }

  try {
    // Find refresh token and user info
    const result = await pool.query(
      `SELECT rt.id, rt.user_id, rt.revoked, rt.expires_at, u.email
       FROM refresh_tokens rt
       JOIN users u ON rt.user_id = u.id
       WHERE rt.token = $1`,
      [refreshToken]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }

    const tokenData = result.rows[0];

    // Check if revoked
    if (tokenData.revoked) {
      return res.status(401).json({ error: 'Refresh token revoked' });
    }

    // Check if expired
    if (new Date() > new Date(tokenData.expires_at)) {
      return res.status(401).json({ error: 'Refresh token expired' });
    }

    // Generate new access token
    const accessToken = signAccessToken(tokenData.user_id, tokenData.email);

    res.json({ access_token: accessToken });
  } catch (error) {
    console.error('Error in refreshAccessToken:', error);
    res.status(500).json({ error: 'Failed to refresh token' });
  }
}

// POST /auth/logout - Logout and revoke refresh token
async function logout(req, res) {
  const refreshToken = req.cookies?.refresh_token;

  if (refreshToken) {
    try {
      // Revoke the refresh token
      await pool.query(
        'UPDATE refresh_tokens SET revoked = true WHERE token = $1',
        [refreshToken]
      );
    } catch (error) {
      console.error('Error revoking refresh token:', error);
      // Continue with logout even if revoke fails
    }
  }

  // Clear cookie
  res.clearCookie('refresh_token');
  res.json({ message: 'Logged out' });
}

// GET /auth/me - Get current user info (protected)
async function getCurrentUser(req, res) {
  try {
    const result = await pool.query(
      'SELECT id, email, last_login FROM users WHERE id = $1',
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error in getCurrentUser:', error);
    res.status(500).json({ error: 'Failed to get user info' });
  }
}

// Note: Expired magic_links and used tokens can accumulate in the database.
// A cleanup job could be added later to periodically remove old records,
// but it's not implemented now to keep the service minimal.

module.exports = {
  requestMagicLink,
  verifyMagicLink,
  refreshAccessToken,
  logout,
  getCurrentUser
};