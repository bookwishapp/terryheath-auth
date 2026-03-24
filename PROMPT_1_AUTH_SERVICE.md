# Claude Code Prompt — Task 1: Auth Service

Build a standalone authentication service. This is a lightweight Node.js/Express app deployed on Railway with its own Postgres database. It is the single identity layer for multiple apps (Flutter mobile apps, a Next.js web app). Keep it simple and minimal — this does not need to be a platform.

---

## What to build

A REST API with magic link email authentication and JWT session management.

---

## Tech stack

- Node.js with Express
- PostgreSQL (Railway Postgres)
- AWS SES for sending magic link emails (SMTP credentials provided via env vars)
- JWT for access + refresh tokens
- `pg` for database access (no ORM)
- `nodemailer` with SES SMTP transport

---

## Database migrations

Use a simple custom migration runner. No external migration libraries.

### `migrate.js` (root level)
Reads all `.sql` files from `/migrations` in filename order. Tracks applied migrations in a `_migrations` table it creates if it doesn't exist. Skips already-applied migrations. Run with `node migrate.js`.

Railway deploy command: `node migrate.js && node src/index.js`

### `/migrations/001_initial.sql`
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_login TIMESTAMPTZ
);

CREATE TABLE magic_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  token TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  token TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## API endpoints

### POST /auth/request
Accepts `{ email }`. Creates or finds user. Generates a magic link token. Sends email via SES. Returns `{ message: "Magic link sent" }`.

Magic link email:
- Subject: "Sign in to [APP_NAME]"
- Body: Plain text. One link. `AUTH_BASE_URL/auth/verify?token=TOKEN`
- Token expires in 15 minutes.

### GET /auth/verify?token=TOKEN
Validates token (exists, not used, not expired). Marks token used. Updates `last_login`. Issues access JWT (15 min expiry) and refresh token (30 days). Sets refresh token as httpOnly cookie. Returns `{ access_token, user: { id, email } }`.

### POST /auth/refresh
Reads refresh token from httpOnly cookie. Validates it (exists, not revoked, not expired). Issues new access JWT. Returns `{ access_token }`.

### POST /auth/logout
Revokes the refresh token from cookie. Clears cookie. Returns `{ message: "Logged out" }`.

### GET /auth/me
Protected. Requires `Authorization: Bearer <access_token>` header. Returns `{ id, email, last_login }`.

---

## JWT

- Sign with `JWT_SECRET` env var
- Access token payload: `{ sub: userId, email }`
- Access token expiry: 15 minutes
- Refresh token: random UUID stored in DB, set as httpOnly cookie named `refresh_token`
- Cookie: httpOnly, secure, sameSite=strict, maxAge 30 days

---

## Middleware

- `authenticate` middleware: verifies Bearer token, attaches `req.user`
- CORS: allow origins from `ALLOWED_ORIGINS` env var (comma-separated)

---

## Environment variables

```
DATABASE_URL=
JWT_SECRET=
AUTH_BASE_URL=                  # e.g. https://auth.terryheath.com
APP_NAME=                       # e.g. "Small Things"
SES_SMTP_HOST=
SES_SMTP_PORT=465
SES_SMTP_USER=
SES_SMTP_PASS=
SES_FROM_EMAIL=                 # noreply@terryheath.com
ALLOWED_ORIGINS=                # comma-separated list
```

---

## File structure

```
/
  src/
    index.js          # Express app setup, routes
    db.js             # pg pool setup
    auth.js           # Route handlers
    middleware.js     # authenticate middleware
    email.js          # nodemailer SES transport + sendMagicLink()
    tokens.js         # JWT sign/verify, refresh token generation
  migrations/
    001_initial.sql
  migrate.js          # Migration runner
  package.json
  .env.example
  README.md
```

---

## README must include

- All env vars with descriptions
- How to run locally
- Railway deploy command: `node migrate.js && node src/index.js`
- API endpoint reference

---

## Rules

- No TypeScript — plain JavaScript
- No ORM — use `pg` directly
- No unnecessary dependencies
- Magic links are single-use and expire in 15 minutes
- Refresh tokens expire in 30 days
- Expired magic_links and used tokens can accumulate — add a comment noting a cleanup job could be added later, but don't build it now
- Do not add rate limiting, logging middleware, or other infrastructure — keep it minimal
