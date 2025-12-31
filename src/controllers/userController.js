// src/controllers/userController.js
//
// User-focused endpoints (current user profile etc.)
// This keeps authController focused on login/register/reset flows.

const db = require('../config/db');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');

/**
 * GET /api/v1/users/me
 * Protected route:
 * - auth.protect must set req.user.id
 * - returns the currently authenticated user's profile
 */
exports.getMe = catchAsync(async (req, res, next) => {
  const userId = req.user && req.user.id;

  if (!userId) {
    return next(new AppError('Not authenticated', 401));
  }

  // Only safe fields (never return password)
  const [rows] = await db.query(
    `SELECT
       id,
       name,
       email,
       avatar_url,
       avatar_alt,
       avatar_title,
       role,
       provider,
       provider_id,
       active,
       created_at
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
    return next(new AppError('Account is disabled', 403));
  }

  return res.status(200).json({
    status: 'success',
    data: { user },
  });
});
