# TerrysHeath Auth Service

A standalone authentication service with magic link email authentication and JWT session management. This lightweight Node.js/Express app serves as the single identity layer for multiple applications (Flutter mobile apps, Next.js web app).

## Features

- Magic link email authentication
- JWT access tokens (15 minute expiry)
- Refresh tokens with httpOnly cookies (30 day expiry)
- PostgreSQL database with custom migration system
- AWS SES integration for sending emails
- CORS support for multiple origins
- RESTful API design
- Admin interface for user management

## Tech Stack

- **Node.js** with Express.js
- **PostgreSQL** for data persistence
- **AWS SES** for sending magic link emails (via SMTP)
- **JWT** for access and refresh tokens
- **pg** for direct database access (no ORM)
- **nodemailer** with SES SMTP transport

## Environment Variables

Create a `.env` file based on `.env.example` with the following variables:

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgres://user:pass@host/dbname` |
| `JWT_SECRET` | Secret key for signing JWTs | Random 32+ character string |
| `ADMIN_PASSWORD` | Password for admin panel access | Strong password |
| `ADMIN_SECRET` | Secret for signing admin cookies | Random 32+ character string |
| `AUTH_BASE_URL` | Base URL of this auth service | `https://auth.terryheath.com` |
| `APP_NAME` | Application name shown in emails | `Small Things` |
| `SES_SMTP_HOST` | AWS SES SMTP endpoint | `email-smtp.us-east-1.amazonaws.com` |
| `SES_SMTP_PORT` | AWS SES SMTP port | `465` |
| `SES_SMTP_USER` | AWS SES SMTP username | Your SMTP username |
| `SES_SMTP_PASS` | AWS SES SMTP password | Your SMTP password |
| `SES_FROM_EMAIL` | From email address | `noreply@terryheath.com` |
| `ALLOWED_ORIGINS` | Comma-separated allowed origins | `http://localhost:3000,https://app.terryheath.com` |
| `NODE_ENV` | Environment mode | `production` or `development` |
| `PORT` | Port to run the service | `3000` |

## Local Development

### Prerequisites

- Node.js 16+ installed
- PostgreSQL database running
- AWS SES configured with verified domain/email

### Setup

1. Clone the repository:
```bash
git clone <repository-url>
cd terryheath-auth
```

2. Install dependencies:
```bash
npm install
```

3. Create `.env` file:
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. Run database migrations:
```bash
npm run migrate
```

5. Start the development server:
```bash
npm run dev
```

The service will be available at `http://localhost:3000`.

## Railway Deployment

### Deploy Command

```bash
node migrate.js && node src/index.js
```

This command runs database migrations before starting the server, ensuring the database schema is up to date.

### Railway Configuration

1. Create a new Railway project
2. Add a PostgreSQL database service
3. Deploy this repository
4. Set all environment variables in Railway
5. Use the deploy command above

## API Endpoints

### POST /auth/request

Request a magic link to be sent to the specified email.

**Request:**
```json
{
  "email": "user@example.com"
}
```

**Response:**
```json
{
  "message": "Magic link sent"
}
```

### GET /auth/verify?token=TOKEN

Verify a magic link token and receive access/refresh tokens.

**Query Parameters:**
- `token`: The magic link token from the email

**Response:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "uuid",
    "email": "user@example.com"
  }
}
```

**Side Effects:**
- Sets `refresh_token` httpOnly cookie
- Marks magic link as used
- Updates user's `last_login` timestamp

### POST /auth/refresh

Refresh an expired access token using the refresh token cookie.

**Request:**
- Requires `refresh_token` httpOnly cookie

**Response:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs..."
}
```

### POST /auth/logout

Revoke the refresh token and clear the cookie.

**Request:**
- Optional `refresh_token` httpOnly cookie

**Response:**
```json
{
  "message": "Logged out"
}
```

### GET /auth/me

Get the current authenticated user's information.

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "last_login": "2024-01-01T12:00:00Z"
}
```

### GET /health

Health check endpoint.

**Response:**
```json
{
  "status": "healthy",
  "service": "auth"
}
```

## Admin Interface

The service includes a minimal admin interface for managing users and sessions. Access is protected by the `ADMIN_PASSWORD` environment variable.

### Admin Authentication

Admin sessions use HMAC-SHA256 signed cookies with 24-hour expiry. The cookie is:
- Named `admin_session`
- httpOnly, secure (in production), sameSite=strict
- Signed with `ADMIN_SECRET` environment variable
- Contains timestamp and random value for uniqueness

### Admin Endpoints

#### GET /admin/login

Shows the admin login form.

#### POST /admin/login

Authenticates admin with password.

**Request:**
- Form field: `password`

**Response:**
- Success: Redirects to `/admin` with session cookie
- Failure: Shows login form with error

#### GET /admin

Lists all users in the system (requires admin session).

**Features:**
- Shows email, created_at, last_login for each user
- Provides delete button for each user
- Links to individual user details

#### GET /admin/users/:id

Shows details for a specific user (requires admin session).

**Features:**
- User information (email, ID, timestamps)
- List of all refresh tokens (active, expired, revoked)
- "Revoke All Sessions" button to invalidate all active tokens

#### POST /admin/users/:id/delete

Deletes a user and all associated data (requires admin session).

**Effects:**
- Removes user record
- Cascades to delete all magic links and refresh tokens
- Redirects to `/admin`

#### POST /admin/users/:id/revoke-all

Revokes all active refresh tokens for a user (requires admin session).

**Effects:**
- Marks all non-revoked refresh tokens as revoked
- User will need to re-authenticate
- Redirects back to user details page

#### GET /admin/logout

Clears admin session cookie and redirects to login.

## Database Schema

### users
- `id` (UUID, primary key)
- `email` (text, unique)
- `created_at` (timestamptz)
- `last_login` (timestamptz)

### magic_links
- `id` (UUID, primary key)
- `user_id` (UUID, foreign key)
- `token` (text, unique)
- `expires_at` (timestamptz)
- `used` (boolean)
- `created_at` (timestamptz)

### refresh_tokens
- `id` (UUID, primary key)
- `user_id` (UUID, foreign key)
- `token` (text, unique)
- `expires_at` (timestamptz)
- `revoked` (boolean)
- `created_at` (timestamptz)

## Security Considerations

- Magic links expire in 15 minutes and are single-use
- Access tokens expire in 15 minutes
- Refresh tokens expire in 30 days
- Refresh tokens are stored as httpOnly cookies (not accessible via JavaScript)
- All tokens are revoked on logout
- CORS is configured to only allow specified origins
- Database queries use parameterized statements to prevent SQL injection

## Token Management

### Access Tokens
- JWT format with `sub` (user ID) and `email` claims
- 15-minute expiry
- Passed in `Authorization: Bearer` header

### Refresh Tokens
- Random UUID stored in database
- 30-day expiry
- Set as httpOnly, secure, sameSite=strict cookie
- Can be revoked via logout endpoint

## Maintenance Notes

- Expired magic links and used tokens accumulate in the database
- A cleanup job could be added later to periodically remove old records
- Currently no rate limiting is implemented to keep the service minimal
- No logging middleware beyond console output

## Client Integration

### Web Applications

```javascript
// Request magic link
await fetch('https://auth.terryheath.com/auth/request', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'user@example.com' })
});

// Verify magic link (from email)
const response = await fetch(`https://auth.terryheath.com/auth/verify?token=${token}`, {
  credentials: 'include' // Important for cookies
});
const { access_token, user } = await response.json();

// Use access token for authenticated requests
await fetch('https://auth.terryheath.com/auth/me', {
  headers: {
    'Authorization': `Bearer ${access_token}`
  }
});

// Refresh token
const refreshResponse = await fetch('https://auth.terryheath.com/auth/refresh', {
  method: 'POST',
  credentials: 'include' // Important for cookies
});
const { access_token: newToken } = await refreshResponse.json();
```

### Mobile Applications

Mobile apps should store tokens securely using platform-specific secure storage solutions and handle refresh token storage appropriately since httpOnly cookies may not be suitable for all mobile environments.

## License

MIT