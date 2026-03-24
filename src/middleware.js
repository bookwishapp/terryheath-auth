const { verifyAccessToken } = require('./tokens');
const { verifyAdminToken } = require('./adminAuth');

// Authenticate middleware - verifies Bearer token and attaches req.user
async function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No valid authorization header' });
  }

  const token = authHeader.substring(7);
  const payload = verifyAccessToken(token);

  if (!payload) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  req.user = {
    id: payload.sub,
    email: payload.email
  };

  next();
}

// Admin authentication middleware - verifies admin cookie
async function authenticateAdmin(req, res, next) {
  const adminToken = req.cookies?.admin_session;

  if (!adminToken || !verifyAdminToken(adminToken)) {
    return res.redirect('/admin/login');
  }

  req.isAdmin = true;
  next();
}

module.exports = {
  authenticate,
  authenticateAdmin
};