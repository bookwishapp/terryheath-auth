require('dotenv').config();

const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const { authenticate } = require('./middleware');
const {
  requestMagicLink,
  verifyMagicLink,
  refreshAccessToken,
  logout,
  getCurrentUser
} = require('./auth');

const app = express();
const PORT = process.env.PORT || 3000;

// Parse allowed origins from environment variable
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim())
  : ['http://localhost:3000'];

// CORS configuration
app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (e.g., mobile apps, Postman)
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true // Allow cookies to be sent cross-origin
}));

// Middleware
app.use(express.json());
app.use(cookieParser());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'auth' });
});

// Auth routes
app.post('/auth/request', requestMagicLink);
app.get('/auth/verify', verifyMagicLink);
app.post('/auth/refresh', refreshAccessToken);
app.post('/auth/logout', logout);
app.get('/auth/me', authenticate, getCurrentUser);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Auth service running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Allowed origins: ${allowedOrigins.join(', ')}`);
});