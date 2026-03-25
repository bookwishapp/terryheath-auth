const pool = require('./db');
const { isAdminConfigured, generateAdminToken, checkAdminPassword } = require('./adminAuth');

// Base HTML template
function htmlTemplate(title, content) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${title}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background: #f5f5f5;
          padding: 20px;
          line-height: 1.6;
        }
        .container {
          max-width: 1200px;
          margin: 0 auto;
          background: white;
          padding: 20px;
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        h1 { margin-bottom: 20px; color: #333; }
        h2 { margin-bottom: 15px; color: #555; }
        table {
          width: 100%;
          border-collapse: collapse;
          margin: 20px 0;
        }
        th, td {
          padding: 12px;
          text-align: left;
          border-bottom: 1px solid #ddd;
        }
        th {
          background-color: #f8f8f8;
          font-weight: 600;
        }
        tr:hover { background-color: #f5f5f5; }
        button, .btn {
          padding: 8px 16px;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
          text-decoration: none;
          display: inline-block;
        }
        .btn-danger {
          background-color: #dc3545;
          color: white;
        }
        .btn-danger:hover { background-color: #c82333; }
        .btn-primary {
          background-color: #007bff;
          color: white;
        }
        .btn-primary:hover { background-color: #0056b3; }
        .btn-secondary {
          background-color: #6c757d;
          color: white;
        }
        form.inline {
          display: inline;
        }
        .login-form {
          max-width: 400px;
          margin: 50px auto;
        }
        .form-group {
          margin-bottom: 15px;
        }
        label {
          display: block;
          margin-bottom: 5px;
          font-weight: 500;
        }
        input[type="password"], input[type="text"] {
          width: 100%;
          padding: 10px;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 16px;
        }
        .nav {
          margin-bottom: 20px;
          padding-bottom: 10px;
          border-bottom: 2px solid #f0f0f0;
        }
        .nav a {
          margin-right: 15px;
          color: #007bff;
          text-decoration: none;
        }
        .nav a:hover { text-decoration: underline; }
        .error {
          color: #dc3545;
          margin-bottom: 15px;
          padding: 10px;
          background-color: #f8d7da;
          border-radius: 4px;
        }
        .success {
          color: #155724;
          margin-bottom: 15px;
          padding: 10px;
          background-color: #d4edda;
          border-radius: 4px;
        }
        .timestamp { color: #666; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="container">
        ${content}
      </div>
    </body>
    </html>
  `;
}

// Helper function to render login form with optional error
function renderLoginForm(res, error = null) {
  const content = `
    <div class="login-form">
      <h1>Admin Login</h1>
      ${error ? `<div class="error">${error}</div>` : ''}
      <form method="POST" action="/admin/login">
        <div class="form-group">
          <label for="password">Admin Password</label>
          <input type="password" id="password" name="password" required autofocus>
        </div>
        <button type="submit" class="btn btn-primary">Login</button>
      </form>
    </div>
  `;
  res.send(htmlTemplate('Admin Login', content));
}

// GET /admin/login - Show login form
function showLoginForm(req, res) {
  if (!isAdminConfigured()) {
    return res.status(503).send(htmlTemplate('Admin Not Configured', `
      <div style="text-align: center; padding: 50px;">
        <h1>Admin Panel Not Configured</h1>
        <p style="margin-top: 20px;">The admin panel requires the following environment variables to be set:</p>
        <ul style="list-style: none; margin-top: 20px;">
          <li><code>ADMIN_PASSWORD</code></li>
          <li><code>ADMIN_SECRET</code></li>
        </ul>
        <p style="margin-top: 20px;">Please configure these in your deployment environment.</p>
      </div>
    `));
  }
  renderLoginForm(res);
}

// POST /admin/login - Handle login
async function handleLogin(req, res) {
  if (!isAdminConfigured()) {
    return res.status(503).json({ error: 'Admin panel not configured. ADMIN_PASSWORD and ADMIN_SECRET environment variables are required.' });
  }

  const { password } = req.body;

  if (!password || !checkAdminPassword(password)) {
    return renderLoginForm(res, 'Invalid password');
  }

  // Generate and set admin cookie
  const token = generateAdminToken();
  res.cookie('admin_session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  });

  res.redirect('/admin');
}

// GET /admin/logout - Logout admin
async function handleLogout(req, res) {
  res.clearCookie('admin_session');
  res.redirect('/admin/login');
}

// GET /admin - List all users
async function listUsers(req, res) {
  try {
    const result = await pool.query(
      'SELECT id, email, created_at, last_login FROM users ORDER BY created_at DESC'
    );

    const formatDate = (date) => {
      if (!date) return 'Never';
      return new Date(date).toLocaleString();
    };

    const userRows = result.rows.map(user => `
      <tr>
        <td><a href="/admin/users/${user.id}">${user.email}</a></td>
        <td class="timestamp">${formatDate(user.created_at)}</td>
        <td class="timestamp">${formatDate(user.last_login)}</td>
        <td>
          <form method="POST" action="/admin/users/${user.id}/delete" class="inline"
                onsubmit="return confirm('Delete user ${user.email}? This will also revoke all their sessions.')">
            <button type="submit" class="btn btn-danger">Delete</button>
          </form>
        </td>
      </tr>
    `).join('');

    const content = `
      <div class="nav">
        <a href="/admin">Users</a>
        <a href="/admin/logout">Logout</a>
      </div>
      <h1>Admin Dashboard</h1>
      <h2>Users (${result.rows.length})</h2>
      <table>
        <thead>
          <tr>
            <th>Email</th>
            <th>Created</th>
            <th>Last Login</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${userRows || '<tr><td colspan="4">No users found</td></tr>'}
        </tbody>
      </table>
    `;

    res.send(htmlTemplate('Admin - Users', content));
  } catch (error) {
    console.error('Error listing users:', error);
    res.status(500).send(htmlTemplate('Error', '<h1>Error loading users</h1>'));
  }
}

// GET /admin/users/:id - Show user details and refresh tokens
async function showUser(req, res) {
  const userId = req.params.id;

  try {
    // Get user info
    const userResult = await pool.query(
      'SELECT id, email, created_at, last_login FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).send(htmlTemplate('Not Found', '<h1>User not found</h1>'));
    }

    const user = userResult.rows[0];

    // Get refresh tokens
    const tokensResult = await pool.query(
      'SELECT id, token, expires_at, revoked, created_at FROM refresh_tokens WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );

    const formatDate = (date) => {
      if (!date) return 'Never';
      return new Date(date).toLocaleString();
    };

    const isExpired = (date) => new Date(date) < new Date();

    const tokenRows = tokensResult.rows.map(token => {
      const status = token.revoked ? 'Revoked' : isExpired(token.expires_at) ? 'Expired' : 'Active';
      const statusClass = status === 'Active' ? 'success' : 'error';

      return `
        <tr>
          <td><code>${token.token.substring(0, 8)}...${token.token.substring(token.token.length - 8)}</code></td>
          <td class="timestamp">${formatDate(token.created_at)}</td>
          <td class="timestamp">${formatDate(token.expires_at)}</td>
          <td><span class="${statusClass}">${status}</span></td>
        </tr>
      `;
    }).join('');

    const activeTokens = tokensResult.rows.filter(t => !t.revoked && !isExpired(t.expires_at)).length;

    const content = `
      <div class="nav">
        <a href="/admin">← Back to Users</a>
        <a href="/admin/logout">Logout</a>
      </div>
      <h1>User Details</h1>
      <div style="margin-bottom: 30px;">
        <p><strong>Email:</strong> ${user.email}</p>
        <p><strong>ID:</strong> <code>${user.id}</code></p>
        <p><strong>Created:</strong> ${formatDate(user.created_at)}</p>
        <p><strong>Last Login:</strong> ${formatDate(user.last_login)}</p>
      </div>

      <h2>Refresh Tokens (${tokensResult.rows.length} total, ${activeTokens} active)</h2>

      ${activeTokens > 0 ? `
        <form method="POST" action="/admin/users/${userId}/revoke-all" style="margin-bottom: 20px;"
              onsubmit="return confirm('Revoke all active sessions for this user?')">
          <button type="submit" class="btn btn-danger">Revoke All Sessions</button>
        </form>
      ` : ''}

      <table>
        <thead>
          <tr>
            <th>Token</th>
            <th>Created</th>
            <th>Expires</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${tokenRows || '<tr><td colspan="4">No refresh tokens found</td></tr>'}
        </tbody>
      </table>
    `;

    res.send(htmlTemplate(`Admin - User: ${user.email}`, content));
  } catch (error) {
    console.error('Error showing user:', error);
    res.status(500).send(htmlTemplate('Error', '<h1>Error loading user</h1>'));
  }
}

// POST /admin/users/:id/delete - Delete a user
async function deleteUser(req, res) {
  const userId = req.params.id;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Delete user (cascade will handle related records)
    const result = await client.query(
      'DELETE FROM users WHERE id = $1 RETURNING email',
      [userId]
    );

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).send(htmlTemplate('Not Found', '<h1>User not found</h1>'));
    }

    await client.query('COMMIT');
    console.log(`Admin deleted user: ${result.rows[0].email}`);
    res.redirect('/admin');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error deleting user:', error);
    res.status(500).send(htmlTemplate('Error', '<h1>Error deleting user</h1>'));
  } finally {
    client.release();
  }
}

// POST /admin/users/:id/revoke-all - Revoke all refresh tokens for a user
async function revokeAllSessions(req, res) {
  const userId = req.params.id;

  try {
    const result = await pool.query(
      'UPDATE refresh_tokens SET revoked = true WHERE user_id = $1 AND revoked = false',
      [userId]
    );

    console.log(`Admin revoked ${result.rowCount} sessions for user ${userId}`);
    res.redirect(`/admin/users/${userId}`);
  } catch (error) {
    console.error('Error revoking sessions:', error);
    res.status(500).send(htmlTemplate('Error', '<h1>Error revoking sessions</h1>'));
  }
}

module.exports = {
  showLoginForm,
  handleLogin,
  handleLogout,
  listUsers,
  showUser,
  deleteUser,
  revokeAllSessions
};