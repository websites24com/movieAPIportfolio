// src/controllers/authController.js
//
// GOAL OF THIS CONTROLLER (Bearer + Cookies):
// 1) On REGISTER / LOGIN we will:
//    - create/sign a JWT
//    - return the token in JSON (for Postman / mobile / any API client)
//    - ALSO set an HttpOnly cookie "jwt" (for browser apps)
//


// bcryptjs = password hashing + comparing hashes safely
const bcrypt = require('bcryptjs');

// jsonwebtoken = signing and verifying JWT tokens
const jwt = require('jsonwebtoken');

// db = your mysql2/promise pool
const db = require('../config/db');

// catchAsync = wrapper so thrown async errors go to your global error handler
const catchAsync = require('../utils/catchAsync');

// AppError = your operational error class (statusCode + message)
const AppError = require('../utils/appError');

//
// Helper #1: create JWT token string
//
function signToken(payload) {
  // JWT_SECRET must exist, otherwise server can't sign tokens.
  // This is a configuration error, not a "bad request".
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is missing in environment variables');
  }

  // Expiration is configurable. Example: "7d", "1h", "15m"
  // If not set, we default to 7 days.
  const expiresIn = process.env.JWT_EXPIRES_IN || '7d';

  // Sign and return the token string
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn });
}

//
// Helper #2: set JWT as HttpOnly cookie on the response
//
function setJwtCookie(res, token) {
  // Cookie security settings:
  // - httpOnly: JS cannot read it in the browser -> protects against XSS reading cookies
  // - secure: only sent over HTTPS (in production you should use true)
  // - sameSite: controls cross-site cookie sending
  //
  // NOTE: secure should be true on HTTPS hosting (production).
  // For local dev (http://localhost) secure must be false otherwise cookie won't set.
  const isProd = (process.env.NODE_ENV === 'production');

  // Optional: control cookie expiration. If not set, browser treats it as a session cookie.
  // We'll set it to "JWT_COOKIE_EXPIRES_DAYS" if provided, otherwise default 7 days.
  const cookieDays = Number(process.env.JWT_COOKIE_EXPIRES_IN || 7);

  // IMPORTANT: this creates a real Date object in the future.
  const expires = new Date(Date.now() + cookieDays * 24 * 60 * 60 * 1000);

  // Set cookie. Name: "jwt"
  res.cookie('jwt', token, {
    httpOnly: true,      // cannot be accessed by document.cookie in browser JS
    secure: isProd,      // true in prod HTTPS, false in local HTTP
    sameSite: 'lax',     // good default for many apps; stricter than 'none'
    expires,             // cookie expiry date
  });
}

//
// Helper #3: send response that supports BOTH client types
// - JSON contains token for Bearer usage
// - Cookie is set for browser usage
//
function sendAuthResponse(res, user, statusCode) {
  // Put only minimal safe data into the token.
  // Never store password/email inside the token unless you have a strong reason.
  const token = signToken({
    id: user.id,
    role: user.role,
  });

  // Set HttpOnly cookie (for browser apps)
  setJwtCookie(res, token);

  // ALSO return the token in JSON (for Postman / mobile / API clients)
  return res.status(statusCode).json({
    status: 'success',
    token, // <-- this is what you copy into Authorization: Bearer <token> in Postman
    data: {
      user: {
        // Return only safe fields
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        provider: user.provider,
        active: user.active,
        created_at: user.created_at,
      },
    },
  });
}

//
// POST /api/v1/auth/register
// Body: { name, email, password }
// Steps:
// 1) validate input
// 2) check email uniqueness
// 3) hash password
// 4) insert user
// 5) read created user
// 6) issue JWT -> return token + set cookie
//
exports.register = catchAsync(async (req, res, next) => {
  // 1) Read input from JSON body
  const name = req.body.name;
  const email = req.body.email;
  const password = req.body.password;

  // 2) Validate required fields
  if (!name || !email || !password) {
    return next(new AppError('Please provide name, email and password', 400));
  }

  // 3) Check if email already exists
  const existingResult = await db.query(
    'SELECT id FROM users WHERE email = ? LIMIT 1',
    [email]
  );
  const existingRows = existingResult[0];

  if (existingRows.length > 0) {
    // 409 = conflict (resource already exists)
    return next(new AppError('Email is already in use', 409));
  }

  // 4) Hash password using bcrypt
  // "12" is a common secure cost; you can increase later if needed.
  const hashedPassword = await bcrypt.hash(password, 12);

  // 5) Insert user into DB
  // - provider = 'local'
  // - role = 'USER'
  // - active = 1
  const insertResult = await db.query(
    `INSERT INTO users (name, email, password, provider, provider_id, role, active)
     VALUES (?, ?, ?, 'local', NULL, 'USER', 1)`,
    [name, email, hashedPassword]
  );

  // New user id created by AUTO_INCREMENT
  const newUserId = insertResult[0].insertId;

  // 6) Fetch created user (safe fields for response)
  const createdResult = await db.query(
    'SELECT id, name, email, role, provider, active, created_at FROM users WHERE id = ? LIMIT 1',
    [newUserId]
  );

  const createdUser = createdResult[0][0];

  // 7) Send JWT in JSON + set HttpOnly cookie
  return sendAuthResponse(res, createdUser, 201); // 201 = created
});

//
// POST /api/v1/auth/login
// Body: { email, password }
// Steps:
// 1) validate input
// 2) load user by email
// 3) check active
// 4) ensure local password exists
// 5) compare bcrypt hash
// 6) issue JWT -> return token + set cookie
//
exports.login = catchAsync(async (req, res, next) => {
  const email = req.body.email;
  const password = req.body.password;

  // 1) Validate required fields
  if (!email || !password) {
    return next(new AppError('Please provide email and password', 400));
  }

  // 2) Load user. We must select "password" for comparing.
  const userResult = await db.query(
    'SELECT id, name, email, password, role, provider, active, created_at FROM users WHERE email = ? LIMIT 1',
    [email]
  );

  const user = userResult[0][0];

  // 3) If user not found: generic message (don’t leak which part failed)
  if (!user) {
    return next(new AppError('Incorrect email or password', 401));
  }

  // 4) If account disabled: block login
  if (user.active !== 1) {
    return next(new AppError('Account is disabled', 403));
  }

  // 5) If no password: this user is likely Google-only later
  if (!user.password) {
    return next(new AppError('This account does not have a local password', 401));
  }

  // 6) Compare plaintext password with bcrypt hash from DB
  const ok = await bcrypt.compare(password, user.password);

  if (!ok) {
    return next(new AppError('Incorrect email or password', 401));
  }

  // 7) Send JWT in JSON + set HttpOnly cookie
  return sendAuthResponse(res, user, 200);
});

// Google OAuth endpoints will be implemented later (next phase).
exports.googleAuth = (req, res, next) => {
  return next(new AppError('Google auth not implemented yet', 501));
};

exports.googleCallback = (req, res, next) => {
  return next(new AppError('Google callback not implemented yet', 501));
};
