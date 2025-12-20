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

// built-in Node module for secure random tokens + hashing

const crypto = require('crypto'); 


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
  const [existingRows] = await db.query( // NEW
    'SELECT id FROM users WHERE email = ? LIMIT 1',
    [email]
  );

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
  const [insertResult] = await db.query( // NEW
    `INSERT INTO users (name, email, password, provider, provider_id, role, active)
     VALUES (?, ?, ?, 'local', NULL, 'USER', 1)`,
    [name, email, hashedPassword]
  );

  // New user id created by AUTO_INCREMENT
  const newUserId = insertResult.insertId; // NEW

  // 6) Fetch created user (safe fields for response)
  const [createdRows] = await db.query( // NEW
    'SELECT id, name, email, role, provider, active, created_at FROM users WHERE id = ? LIMIT 1',
    [newUserId]
  );

  const createdUser = createdRows[0]; // NEW

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
  const [rows] = await db.query( // NEW
    'SELECT id, name, email, password, role, provider, active, created_at FROM users WHERE email = ? LIMIT 1',
    [email]
  );

  const user = rows[0]; // NEW

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

//
// POST /api/v1/auth/logout
//
// GOAL (Bearer + Cookies):
// - For browser apps: remove the HttpOnly cookie "jwt"
// - For API clients (Postman/mobile): there is nothing to "delete" server-side with pure JWT,
//   so we just return success and the client must delete/forget its stored Bearer token.
//
// IMPORTANT:
// - This is still useful even if you mainly use Bearer tokens,
//   because your app ALSO sets the jwt cookie on login/register.
//
exports.logout = catchAsync(async (req, res, next) => {
  // In production we usually keep secure cookies, in local dev it's false
  const isProd = (process.env.NODE_ENV === 'production');

  // Clear the cookie by overwriting it with a short-lived value
  // We must use SAME cookie options (at least: httpOnly, secure, sameSite)
  // so the browser matches and removes the correct cookie.
  res.cookie('jwt', '', {
    httpOnly: true,        // cookie is HttpOnly -> must clear it the same way
    secure: isProd,        // must match how it was set
    sameSite: 'lax',       // must match how it was set
    expires: new Date(0),  // Jan 1 1970 -> instantly expired
  });

  // Respond to client
  return res.status(200).json({
    status: 'success',
    data: {
      message: 'Logged out successfully.'
    }
  });
});

// NEW
// PATCH /api/v1/auth/change-password
// Body: { currentPassword, newPassword, newPasswordConfirm }
//
// FULL FUNCTION – rewritten cleanly, no [0][0]
exports.changePassword = catchAsync(async (req, res, next) => {
  // ------------------------------------------------------------
  // 1) Read values from request body
  // ------------------------------------------------------------
  const currentPassword = req.body.currentPassword;
  const newPassword = req.body.newPassword;
  const newPasswordConfirm = req.body.newPasswordConfirm;

  // ------------------------------------------------------------
  // 2) Validate required fields
  // ------------------------------------------------------------
  if (!currentPassword || !newPassword || !newPasswordConfirm) {
    return next(
      new AppError(
        'Please provide currentPassword, newPassword and newPasswordConfirm',
        400
      )
    );
  }

  // ------------------------------------------------------------
  // 3) Check new password confirmation
  // ------------------------------------------------------------
  if (newPassword !== newPasswordConfirm) {
    return next(
      new AppError('New password and confirmation do not match', 400)
    );
  }

  // ------------------------------------------------------------
  // 4) Prevent setting the same password again
  // ------------------------------------------------------------
  if (currentPassword === newPassword) {
    return next(
      new AppError(
        'New password must be different from current password',
        400
      )
    );
  }

  // ------------------------------------------------------------
  // 5) Get user ID from JWT (set by auth.protect middleware)
  // ------------------------------------------------------------
  const userId = req.user.id;

  // ------------------------------------------------------------
  // 6) Load user from database INCLUDING password hash
  // ------------------------------------------------------------
  const [rows] = await db.query(
    'SELECT id, name, email, password, role, provider, active, created_at FROM users WHERE id = ? LIMIT 1',
    [userId]
  );

  const user = rows[0];

  // ------------------------------------------------------------
  // 7) User existence check
  // ------------------------------------------------------------
  if (!user) {
    return next(new AppError('User not found', 404));
  }

  // ------------------------------------------------------------
  // 8) Check if account is active
  // ------------------------------------------------------------
  if (user.active !== 1) {
    return next(new AppError('This account is disabled.', 403));
  }

  // ------------------------------------------------------------
  // 9) Ensure user has a local password
  // (important for future Google-only users)
  // ------------------------------------------------------------
  if (!user.password) {
    return next(
      new AppError(
        'This account does not have a local password to change',
        400
      )
    );
  }

  // ------------------------------------------------------------
  // 10) Verify current password
  // ------------------------------------------------------------
  const isCorrect = await bcrypt.compare(
    currentPassword,
    user.password
  );

  if (!isCorrect) {
    return next(
      new AppError('Your current password is wrong', 401)
    );
  }

  // ------------------------------------------------------------
  // 11) Hash the new password
  // ------------------------------------------------------------
  const hashedNewPassword = await bcrypt.hash(newPassword, 12);

  // ------------------------------------------------------------
  // 12) Update password + password_changed_at in DB
  // ------------------------------------------------------------
  await db.query(
    'UPDATE users SET password = ?, password_changed_at = NOW() WHERE id = ? LIMIT 1',
    [hashedNewPassword, userId]
  );

  // ------------------------------------------------------------
  // 13) Reload updated user (safe fields only)
  // ------------------------------------------------------------
  const [updatedRows] = await db.query(
    'SELECT id, name, email, role, provider, active, created_at FROM users WHERE id = ? LIMIT 1',
    [userId]
  );

  const updatedUser = updatedRows[0];

  // ------------------------------------------------------------
  // 14) Send new JWT + refresh HttpOnly cookie
  // ------------------------------------------------------------
  return sendAuthResponse(res, updatedUser, 200);
});

// NEW
// POST /api/v1/auth/forgot-password
// Body: { email }
// What it does:
// 1) Find user by email
// 2) Generate a reset token (plain)
// 3) Store HASHED token + expiry in DB
// 4) Return the plain token (for Postman testing)
// Later: we will email the token link instead of returning it.
exports.forgotPassword = catchAsync(async (req, res, next) => { // NEW
  const email = req.body.email; // NEW

  // 1) Validate required field
  if (!email) { // NEW
    return next(new AppError('Please provide your email', 400)); // NEW
  }

  // 2) Find user by email
  // We select only what we need here.
  const [rows] = await db.query( // NEW
    'SELECT id, email, active FROM users WHERE email = ? LIMIT 1', // NEW
    [email] // NEW
  ); // NEW

  const user = rows[0]; // NEW

  // 3) If no user: do NOT reveal if email exists (security)
  // We still return success message to prevent account discovery.
  if (!user) { // NEW
    return res.status(200).json({ // NEW
      status: 'success', // NEW
      data: { // NEW
        message: 'If that email exists, a password reset token has been issued.' // NEW
      } // NEW
    }); // NEW
  } // NEW

  // 4) If account disabled: still do not reveal too much
  if (user.active !== 1) { // NEW
    return res.status(200).json({ // NEW
      status: 'success', // NEW
      data: { // NEW
        message: 'If that email exists, a password reset token has been issued.' // NEW
      } // NEW
    }); // NEW
  } // NEW

  // 5) Create reset token (PLAIN) and hashed version for DB
  // crypto.randomBytes(32) returns a Buffer of random bytes.
  // .toString('hex') converts it to a readable token string.
  const resetToken = crypto.randomBytes(32).toString('hex'); // NEW

  // Hash the token so DB does not store the plain token.
  // We use sha256 because it's fast and standard for token hashing.
  const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex'); // NEW

  // 6) Set expiry time (example: 10 minutes from now)
  // Date.now() is milliseconds since 1970. We add 10 minutes.
  const expires = new Date(Date.now() + 10 * 60 * 1000); // NEW

  // 7) Save hashed token + expiry in DB
  await db.query( // NEW
    'UPDATE users SET password_reset_token = ?, password_reset_expires = ? WHERE id = ? LIMIT 1', // NEW
    [hashedToken, expires, user.id] // NEW
  ); // NEW

  // 8) For NOW (Postman testing), return the plain token.
  // Later we will EMAIL a link like:
  // https://your-site.com/reset-password/<token>
  return res.status(200).json({ // NEW
    status: 'success', // NEW
    data: { // NEW
      message: 'Password reset token generated (testing mode).', // NEW
      resetToken // NEW
    } // NEW
  }); // NEW
});

// NEW
// POST /api/v1/auth/reset-password/:token
// Body: { newPassword, newPasswordConfirm }
//
// Steps:
// 1) Read token from URL params
// 2) Hash token (because DB stores hashed token)
// 3) Find user by hashed token AND expiry > now
// 4) Validate new password + confirm
// 5) Hash new password
// 6) Update DB: password, password_changed_at, clear reset token fields
// 7) Issue new JWT + set cookie (sendAuthResponse)
exports.resetPassword = catchAsync(async (req, res, next) => { // NEW
  // ------------------------------------------------------------
  // 1) Read token from URL
  // Example: /api/v1/auth/reset-password/abcdef123...
  // ------------------------------------------------------------
  const token = req.params.token; // NEW

  if (!token) { // NEW
    return next(new AppError('Reset token is missing', 400)); // NEW
  } // NEW

  // ------------------------------------------------------------
  // 2) Read new password fields from body
  // ------------------------------------------------------------
  const newPassword = req.body.newPassword; // NEW
  const newPasswordConfirm = req.body.newPasswordConfirm; // NEW

  // ------------------------------------------------------------
  // 3) Validate required fields
  // ------------------------------------------------------------
  if (!newPassword || !newPasswordConfirm) { // NEW
    return next(new AppError('Please provide newPassword and newPasswordConfirm', 400)); // NEW
  } // NEW

  // ------------------------------------------------------------
  // 4) Confirm passwords match
  // ------------------------------------------------------------
  if (newPassword !== newPasswordConfirm) { // NEW
    return next(new AppError('New password and confirmation do not match', 400)); // NEW
  } // NEW

  // ------------------------------------------------------------
  // 5) Hash the token to compare with DB (DB stores hashed token)
  // ------------------------------------------------------------
  const hashedToken = crypto // NEW
    .createHash('sha256') // NEW
    .update(token) // NEW
    .digest('hex'); // NEW

  // ------------------------------------------------------------
  // 6) Find user by hashed token + valid expiry
  // IMPORTANT:
  // - password_reset_expires must be > NOW()
  // ------------------------------------------------------------
  const [rows] = await db.query( // NEW
    `SELECT id, name, email, role, provider, active, created_at
     FROM users
     WHERE password_reset_token = ?
       AND password_reset_expires IS NOT NULL
       AND password_reset_expires > NOW()
     LIMIT 1`, // NEW
    [hashedToken] // NEW
  ); // NEW

  const user = rows[0]; // NEW

  // ------------------------------------------------------------
  // 7) If token invalid or expired
  // ------------------------------------------------------------
  if (!user) { // NEW
    return next(new AppError('Token is invalid or has expired', 400)); // NEW
  } // NEW

  // ------------------------------------------------------------
  // 8) If account disabled: block reset
  // ------------------------------------------------------------
  if (user.active !== 1) { // NEW
    return next(new AppError('This account is disabled.', 403)); // NEW
  } // NEW

  // ------------------------------------------------------------
  // 9) Hash the new password
  // ------------------------------------------------------------
  const hashedNewPassword = await bcrypt.hash(newPassword, 12); // NEW

  // ------------------------------------------------------------
  // 10) Update password + clear reset fields so token can't be reused
  // ------------------------------------------------------------
  await db.query( // NEW
    `UPDATE users
     SET password = ?,
         password_changed_at = NOW(),
         password_reset_token = NULL,
         password_reset_expires = NULL
     WHERE id = ?
     LIMIT 1`, // NEW
    [hashedNewPassword, user.id] // NEW
  ); // NEW

  // ------------------------------------------------------------
  // 11) Reload updated user (safe fields for response)
  // ------------------------------------------------------------
  const [updatedRows] = await db.query( // NEW
    'SELECT id, name, email, role, provider, active, created_at FROM users WHERE id = ? LIMIT 1', // NEW
    [user.id] // NEW
  ); // NEW

  const updatedUser = updatedRows[0]; // NEW

  // ------------------------------------------------------------
  // 12) Send new JWT + refresh HttpOnly cookie
  // ------------------------------------------------------------
  return sendAuthResponse(res, updatedUser, 200); // NEW
});





// Google OAuth endpoints will be implemented later (next phase).
exports.googleAuth = (req, res, next) => {
  return next(new AppError('Google auth not implemented yet', 501));
};

exports.googleCallback = (req, res, next) => {
  return next(new AppError('Google callback not implemented yet', 501));
};
