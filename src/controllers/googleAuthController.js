// src/controllers/googleAuthController.js
//
// Only Google login/register logic lives here.
// Uses Google Identity Services ID token verification via google-auth-library.
// This keeps authController.js clean and avoids mixing providers.

const db = require('../config/db');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');

const { OAuth2Client } = require('google-auth-library');
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// We import shared helpers from authController WITHOUT circular imports by
// passing them in from authController (see below). For now we export a factory.
function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

/**
 * Factory that injects sendAuthResponse from authController.js
 * so we don't duplicate JWT/cookie logic here.
 */
exports.buildGoogleAuthHandler = function buildGoogleAuthHandler({ sendAuthResponse }) {
  if (typeof sendAuthResponse !== 'function') {
    throw new Error('buildGoogleAuthHandler requires sendAuthResponse function');
  }

  return catchAsync(async (req, res, next) => {
    const credential = req.body?.credential;

    if (!credential || typeof credential !== 'string') {
      return next(new AppError('Google credential (id_token) is missing', 400));
    }

    if (!process.env.GOOGLE_CLIENT_ID) {
      return next(new AppError('GOOGLE_CLIENT_ID is missing in environment variables', 500));
    }

    // 1) Verify Google ID token
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    if (!payload) return next(new AppError('Invalid Google token', 401));

    const googleSub = payload.sub;
    if (!googleSub) return next(new AppError('Google user id (sub) is missing', 401));

    // You want Google OR email login. Your register page requires email.
    const email = payload.email ? normalizeEmail(payload.email) : null;
    if (!email) return next(new AppError('Google account did not provide an email', 400));

    const emailVerified =
      payload.email_verified === true || payload.email_verified === 'true';

    if (!emailVerified) {
      return next(new AppError('Google email is not verified', 401));
    }

    const nameFromGoogle = String(payload.name || 'Google User').trim().slice(0, 100);

    // 2) Prefer lookup by google provider_id
    const [byProviderRows] = await db.query(
      `SELECT id, name, email, role, provider, provider_id, active, created_at
       FROM users
       WHERE provider = 'google' AND provider_id = ?
       LIMIT 1`,
      [googleSub]
    );

    let user = byProviderRows[0] || null;

    // 3) If not found, merge by email (so same person can use Google or mail)
    if (!user) {
      const [byEmailRows] = await db.query(
        `SELECT id, name, email, role, provider, provider_id, active, created_at
         FROM users
         WHERE email = ?
         LIMIT 1`,
        [email]
      );

      const existing = byEmailRows[0] || null;

      if (existing) {
        // Attach Google identity to existing user row
        await db.query(
          `UPDATE users
           SET provider = 'google',
               provider_id = ?
           WHERE id = ?
           LIMIT 1`,
          [googleSub, existing.id]
        );

        const [reloadedRows] = await db.query(
          `SELECT id, name, email, role, provider, provider_id, active, created_at
           FROM users
           WHERE id = ?
           LIMIT 1`,
          [existing.id]
        );

        user = reloadedRows[0] || existing;
      } else {
        // Create new Google user
        const [insertResult] = await db.query(
          `INSERT INTO users (name, email, password, provider, provider_id, role, active)
           VALUES (?, ?, NULL, 'google', ?, 'USER', 1)`,
          [nameFromGoogle, email, googleSub]
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
    }

    if (!user) return next(new AppError('Failed to authenticate with Google', 500));
    if (Number(user.active) !== 1) return next(new AppError('Account is disabled', 403));

    return sendAuthResponse(res, user, 200);
  });
};
