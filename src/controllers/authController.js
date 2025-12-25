// src/controllers/authController.js
//
// GOAL OF THIS CONTROLLER (Bearer + Cookies):
// 1) On REGISTER / LOGIN / GOOGLE LOGIN we will:
//    - create/sign a JWT
//    - return the token in JSON (for Postman / mobile / any API client)
//    - ALSO set an HttpOnly cookie "jwt" (for browser apps)
//
// IMPORTANT LOGOUT FIX (cookie must be removed reliably):
// - Cookie deletion MUST match the cookie identity (name + path + etc.)
// - We centralize cookie options in ONE place below (baseJwtCookieOptions)
// - We ALWAYS set `path: '/'` so logout clears the same cookie that login sets

const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const db = require('../config/db');
const { sendEmail } = require('../utils/nodemailer');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');

// Google ID token verification (Google Identity Services -> send "credential" JWT to backend)
const { OAuth2Client } = require('google-auth-library');
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// -----------------------------------------------------------------------------
// Helpers (small, isolated, heavily commented)
// -----------------------------------------------------------------------------

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function validatePasswordOrThrow(password) {
  if (typeof password !== 'string') {
    throw new AppError('Password must be a string', 400);
  }

  const trimmed = password.trim();

  // NOTE: I am not changing your policy here; only keeping your existing logic.
  if (trimmed.length < 5) {
    throw new AppError('Password must be at least 5 characters long', 400);
  }

  if (trimmed.length > 128) {
    throw new AppError('Password must be at most 128 characters long', 400);
  }

  const hasLetter = /[A-Za-z]/.test(trimmed);
  const hasNumber = /[0-9]/.test(trimmed);

  if (!hasLetter || !hasNumber) {
    throw new AppError('Password must contain at least one letter and one number', 400);
  }
}

function signToken(payload) {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is missing in environment variables');
  }

  const expiresIn = process.env.JWT_EXPIRES_IN || '7d';
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn });
}

/**
 * Single source of truth for JWT cookie options.
 * This prevents logout "not working" due to cookie path mismatch.
 */
function baseJwtCookieOptions() {
  const isProd = process.env.NODE_ENV === 'production';

  return {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    path: '/', // CRITICAL: makes cookie global + ensures delete matches set
  };
}

/**
 * Set JWT as HttpOnly cookie.
 */
function setJwtCookie(res, token) {
  const cookieDays = Number(process.env.JWT_COOKIE_EXPIRES_IN || 7);
  const expires = new Date(Date.now() + cookieDays * 24 * 60 * 60 * 1000);

  res.cookie('jwt', token, {
    ...baseJwtCookieOptions(),
    expires,
  });
}

/**
 * Clear JWT cookie reliably (must match same options incl. path).
 */
function clearJwtCookie(res) {
  res.cookie('jwt', '', {
    ...baseJwtCookieOptions(),
    expires: new Date(0),
  });
}

/**
 * Send a unified auth response:
 * - set cookie for browsers
 * - return token in JSON for API clients
 */
function sendAuthResponse(res, user, statusCode) {
  const token = signToken({
    id: user.id,
    role: user.role,
  });

  setJwtCookie(res, token);

  return res.status(statusCode).json({
    status: 'success',
    token,
    data: {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        provider: user.provider,
        provider_id: user.provider_id || null,
        active: user.active,
        created_at: user.created_at,
      },
    },
  });
}

function getBaseUrl(req) {
  return process.env.APP_BASE_URL || `${req.protocol}://${req.get('host')}`;
}

async function enforcePasswordChangeRateLimit(userId) {
  const [rows] = await db.query(
    `SELECT
       password_change_count,
       password_change_window_start
     FROM users
     WHERE id = ?
     LIMIT 1`,
    [userId]
  );

  const info = rows[0];
  if (!info) {
    return { ok: false, error: new AppError('User not found', 404) };
  }

  const count = Number(info.password_change_count || 0);
  const windowStart = info.password_change_window_start;

  const shouldReset =
    !windowStart ||
    new Date(windowStart).getTime() <= Date.now() - 60 * 60 * 1000;

  if (shouldReset) {
    await db.query(
      `UPDATE users
       SET password_change_count = 0,
           password_change_window_start = NOW()
       WHERE id = ?
       LIMIT 1`,
      [userId]
    );
    return { ok: true };
  }

  if (count >= 3) {
    return { ok: false, error: new AppError('Too many password changes. Try again later.', 429) };
  }

  return { ok: true };
}

async function incrementPasswordChangeCount(userId) {
  await db.query(
    `UPDATE users
     SET password_change_count = COALESCE(password_change_count, 0) + 1,
         password_change_window_start = COALESCE(password_change_window_start, NOW())
     WHERE id = ?
     LIMIT 1`,
    [userId]
  );
}

// -----------------------------------------------------------------------------
// Controllers
// -----------------------------------------------------------------------------

/**
 * POST /api/v1/auth/register
 * Body: { name, email, password }
 */
exports.register = catchAsync(async (req, res, next) => {
  const name = String(req.body.name || '').trim();
  const email = normalizeEmail(req.body.email);
  const password = req.body.password;

  if (!name || !email || !password) {
    return next(new AppError('Please provide name, email and password', 400));
  }

  validatePasswordOrThrow(password);

  const [existingRows] = await db.query(
    'SELECT id FROM users WHERE email = ? LIMIT 1',
    [email]
  );

  if (existingRows.length > 0) {
    return next(new AppError('Email is already in use', 409));
  }

  const hashedPassword = await bcrypt.hash(password, 12);

  const [insertResult] = await db.query(
    `INSERT INTO users (name, email, password, provider, provider_id, role, active)
     VALUES (?, ?, ?, 'local', NULL, 'USER', 1)`,
    [name, email, hashedPassword]
  );

  const newUserId = insertResult.insertId;

  const [createdRows] = await db.query(
    `SELECT id, name, email, role, provider, provider_id, active, created_at
     FROM users
     WHERE id = ?
     LIMIT 1`,
    [newUserId]
  );

  const createdUser = createdRows[0];
  return sendAuthResponse(res, createdUser, 201);
});

/**
 * POST /api/v1/auth/login
 * Body: { email, password }
 */
exports.login = catchAsync(async (req, res, next) => {
  const email = normalizeEmail(req.body.email);
  const password = req.body.password;

  if (!email || !password) {
    return next(new AppError('Please provide email and password', 400));
  }

  const [rows] = await db.query(
    `SELECT id, name, email, password, role, provider, provider_id, active, created_at
     FROM users
     WHERE email = ?
     LIMIT 1`,
    [email]
  );

  const user = rows[0];

  if (!user) {
    return next(new AppError('Incorrect email or password', 401));
  }

  if (Number(user.active) !== 1) {
    return next(new AppError('Account is disabled', 403));
  }

  if (!user.password) {
    return next(new AppError('This account does not have a local password', 401));
  }

  const ok = await bcrypt.compare(password, user.password);
  if (!ok) {
    return next(new AppError('Incorrect email or password', 401));
  }

  return sendAuthResponse(res, user, 200);
});

/**
 * POST /api/v1/auth/logout
 *
 * Correct behavior:
 * - clear the SAME cookie we set (same name + same cookie options + same path)
 */
exports.logout = catchAsync(async (req, res, next) => {
  clearJwtCookie(res);

  return res.status(200).json({
    status: 'success',
    data: { message: 'Logged out successfully.' },
  });
});

/**
 * PATCH /api/v1/auth/change-password
 * Body: { currentPassword, newPassword, newPasswordConfirm }
 * Protected route: requires auth.protect to set req.user.id
 */
exports.changePassword = catchAsync(async (req, res, next) => {
  const currentPassword = req.body.currentPassword;
  const newPassword = req.body.newPassword;
  const newPasswordConfirm = req.body.newPasswordConfirm;

  if (!currentPassword || !newPassword || !newPasswordConfirm) {
    return next(new AppError(
      'Please provide currentPassword, newPassword and newPasswordConfirm',
      400
    ));
  }

  if (newPassword !== newPasswordConfirm) {
    return next(new AppError('New password and confirmation do not match', 400));
  }

  validatePasswordOrThrow(newPassword);

  if (currentPassword === newPassword) {
    return next(new AppError('New password must be different from current password', 400));
  }

  const userId = req.user && req.user.id;
  if (!userId) {
    return next(new AppError('Not authenticated', 401));
  }

  const [rows] = await db.query(
    `SELECT id, password, active
     FROM users
     WHERE id = ?
     LIMIT 1`,
    [userId]
  );

  const user = rows[0];

  if (!user) {
    return next(new AppError('User not found', 404));
  }

  if (Number(user.active) !== 1) {
    return next(new AppError('This account is disabled.', 403));
  }

  if (!user.password) {
    return next(new AppError('This account does not have a local password to change', 400));
  }

  const isCorrect = await bcrypt.compare(currentPassword, user.password);
  if (!isCorrect) {
    return next(new AppError('Your current password is wrong', 401));
  }

  const limitCheck = await enforcePasswordChangeRateLimit(userId);
  if (!limitCheck.ok) {
    return next(limitCheck.error);
  }

  const hashedNewPassword = await bcrypt.hash(newPassword, 12);

  await db.query(
    `UPDATE users
     SET password = ?,
         password_changed_at = NOW()
     WHERE id = ?
     LIMIT 1`,
    [hashedNewPassword, userId]
  );

  await incrementPasswordChangeCount(userId);

  const [updatedRows] = await db.query(
    `SELECT id, name, email, role, provider, provider_id, active, created_at
     FROM users
     WHERE id = ?
     LIMIT 1`,
    [userId]
  );

  const updatedUser = updatedRows[0];
  return sendAuthResponse(res, updatedUser, 200);
});

/**
 * POST /api/v1/auth/forgot-password
 * Body: { email }
 */
exports.forgotPassword = catchAsync(async (req, res, next) => {
  const email = normalizeEmail(req.body.email);

  if (!email) {
    return next(new AppError('Please provide your email', 400));
  }

  const [rows] = await db.query(
    'SELECT id, email, active FROM users WHERE email = ? LIMIT 1',
    [email]
  );

  const user = rows[0];

  const genericSuccess = () => res.status(200).json({
    status: 'success',
    data: { message: 'If that email exists, a password reset link has been sent.' },
  });

  if (!user || Number(user.active) !== 1) {
    return genericSuccess();
  }

  const resetToken = crypto.randomBytes(32).toString('hex');
  const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

  const expires = new Date(Date.now() + 10 * 60 * 1000);

  await db.query(
    `UPDATE users
     SET password_reset_token = ?,
         password_reset_expires = ?
     WHERE id = ?
     LIMIT 1`,
    [hashedToken, expires, user.id]
  );

  const baseUrl = getBaseUrl(req);
  const resetUrl = `${baseUrl}/reset-password/${resetToken}`;

  const html = `
    <p>You requested a password reset.</p>
    <p>Click the link below to set a new password:</p>
    <p><a href="${resetUrl}">${resetUrl}</a></p>
    <p>This link will expire in 10 minutes.</p>
  `;

  try {
    await sendEmail({
      to: user.email,
      subject: 'Password reset',
      html,
    });
  } catch (err) {
    await db.query(
      `UPDATE users
       SET password_reset_token = NULL,
           password_reset_expires = NULL
       WHERE id = ?
       LIMIT 1`,
      [user.id]
    );

    return next(new AppError('Email sending failed. Please try again later.', 500));
  }

  return res.status(200).json({
    status: 'success',
    data: { message: 'Password reset email sent.' },
  });
});

/**
 * PATCH /api/v1/auth/reset-password/:token
 * Body: { newPassword, newPasswordConfirm }
 */
exports.resetPassword = catchAsync(async (req, res, next) => {
  const token = req.params.token;

  if (!token) {
    return next(new AppError('Reset token is missing', 400));
  }

  const newPassword = req.body.newPassword;
  const newPasswordConfirm = req.body.newPasswordConfirm;

  if (!newPassword || !newPasswordConfirm) {
    return next(new AppError('Please provide newPassword and newPasswordConfirm', 400));
  }

  if (newPassword !== newPasswordConfirm) {
    return next(new AppError('New password and confirmation do not match', 400));
  }

  validatePasswordOrThrow(newPassword);

  const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

  const [rows] = await db.query(
    `SELECT id, email, active
     FROM users
     WHERE password_reset_token = ?
       AND password_reset_expires IS NOT NULL
       AND password_reset_expires > NOW()
     LIMIT 1`,
    [hashedToken]
  );

  const user = rows[0];

  if (!user) {
    return next(new AppError('Token is invalid or has expired', 400));
  }

  if (Number(user.active) !== 1) {
    return next(new AppError('This account is disabled.', 403));
  }

  const limitCheck = await enforcePasswordChangeRateLimit(user.id);
  if (!limitCheck.ok) {
    return next(limitCheck.error);
  }

  const hashedNewPassword = await bcrypt.hash(newPassword, 12);

  await db.query(
    `UPDATE users
     SET password = ?,
         password_changed_at = NOW(),
         password_reset_token = NULL,
         password_reset_expires = NULL
     WHERE id = ?
     LIMIT 1`,
    [hashedNewPassword, user.id]
  );

  await incrementPasswordChangeCount(user.id);

  try {
    await sendEmail({
      to: user.email,
      subject: 'Password changed',
      html: `
        <p>Your password was successfully changed.</p>
        <p>If this wasn’t you, please contact support immediately.</p>
      `,
    });
  } catch (errEmail) {
    // Do not block login if confirmation email fails
  }

  const [updatedRows] = await db.query(
    `SELECT id, name, email, role, provider, provider_id, active, created_at
     FROM users
     WHERE id = ?
     LIMIT 1`,
    [user.id]
  );

  const updatedUser = updatedRows[0];
  return sendAuthResponse(res, updatedUser, 200);
});

/**
 * POST /api/v1/auth/google
 * Body: { credential: "<GOOGLE_ID_TOKEN>" }
 */
exports.googleAuth = catchAsync(async (req, res, next) => {
  const credential = req.body.credential;

  if (!credential || typeof credential !== 'string') {
    return next(new AppError('Google credential (id_token) is missing', 400));
  }

  const ticket = await googleClient.verifyIdToken({
    idToken: credential,
    audience: process.env.GOOGLE_CLIENT_ID,
  });

  const payload = ticket.getPayload();

  if (!payload) {
    return next(new AppError('Invalid Google token', 401));
  }

  const googleSub = payload.sub;
  const email = payload.email;
  const emailVerified = payload.email_verified;
  const nameFromGoogle = payload.name || 'Google User';

  if (!googleSub) {
    return next(new AppError('Google user id (sub) is missing', 401));
  }

  if (!email) {
    return next(new AppError('Google account did not provide an email', 400));
  }

  if (emailVerified !== true) {
    return next(new AppError('Google email is not verified', 401));
  }

  const normalizedEmail = normalizeEmail(email);

  const [byProviderRows] = await db.query(
    `SELECT id, name, email, role, provider, provider_id, active, created_at
     FROM users
     WHERE provider = 'google' AND provider_id = ?
     LIMIT 1`,
    [googleSub]
  );

  let user = byProviderRows[0] || null;

  if (!user) {
    const [byEmailRows] = await db.query(
      `SELECT id, name, email, role, provider, provider_id, active, created_at
       FROM users
       WHERE email = ?
       LIMIT 1`,
      [normalizedEmail]
    );

    user = byEmailRows[0] || null;

    if (user && user.provider !== 'google') {
      await db.query(
        `UPDATE users
         SET provider = 'google',
             provider_id = ?
         WHERE id = ?
         LIMIT 1`,
        [googleSub, user.id]
      );

      const [reloadedRows] = await db.query(
        `SELECT id, name, email, role, provider, provider_id, active, created_at
         FROM users
         WHERE id = ?
         LIMIT 1`,
        [user.id]
      );

      user = reloadedRows[0] || user;
    }
  }

  if (!user) {
    const [insertResult] = await db.query(
      `INSERT INTO users (name, email, password, provider, provider_id, role, active)
       VALUES (?, ?, NULL, 'google', ?, 'USER', 1)`,
      [nameFromGoogle, normalizedEmail, googleSub]
    );

    const newUserId = insertResult.insertId;

    const [createdRows] = await db.query(
      `SELECT id, name, email, role, provider, provider_id, active, created_at
       FROM users
       WHERE id = ?
       LIMIT 1`,
      [newUserId]
    );

    user = createdRows[0] || null;
  }

  if (!user) {
    return next(new AppError('Failed to authenticate with Google', 500));
  }

  if (Number(user.active) !== 1) {
    return next(new AppError('Account is disabled', 403));
  }

  return sendAuthResponse(res, user, 200);
});
