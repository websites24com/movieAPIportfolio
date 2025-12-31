// src/middleware/auth.js
//
// PURPOSE:
// Protect routes. Allow access ONLY if a valid JWT is provided either:
// 1) Authorization header:  Authorization: Bearer <token>
// OR
// 2) HttpOnly cookie:       jwt=<token>
//
// After verification it will:
// - load the user from DB
// - check user is active
// - invalidate token if password was changed after token was issued
// - attach the user to req.user
// - attach decoded token to req.auth
// - call next()

const jwt = require('jsonwebtoken');
const db = require('../config/db');
const AppError = require('../utils/appError');
const catchAsync = require('../utils/catchAsync');

exports.protect = catchAsync(async (req, res, next) => {
  let token;

  // 1) Authorization header (Bearer)
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }

  // 2) Cookie fallback
  if (!token && req.cookies && req.cookies.jwt) {
    token = req.cookies.jwt;
  }

  // 3) No token
  if (!token) {
    return next(new AppError('You are not logged in. Please log in.', 401));
  }

  // 4) Verify token
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is missing in environment variables');
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });

    if (!decoded || !decoded.id) {
      return next(new AppError('Invalid token payload. Please log in again.', 401));
    }
  } catch (err) {
    return next(new AppError('Invalid or expired token. Please log in again.', 401));
  }

  // 5) Load user from DB (include password_changed_at for token invalidation)
  const [rows] = await db.query(
    `SELECT
       id, name, email, role, provider, active, created_at,
       password_changed_at
     FROM users
     WHERE id = ?
     LIMIT 1`,
    [decoded.id]
  );

  const user = rows[0];

  if (!user) {
    return next(new AppError('The user belonging to this token no longer exists.', 401));
  }

  // 6) Active check (handle string/number)
  if (Number(user.active) !== 1) {
    return next(new AppError('This account is disabled.', 403));
  }

  // 7) Invalidate token if password changed after token was issued
  if (user.password_changed_at && decoded.iat) {
    const tokenIssuedAtMs = decoded.iat * 1000;
    const passwordChangedAtMs = new Date(user.password_changed_at).getTime();

    // 1s buffer avoids "same-second" edge cases
    if (passwordChangedAtMs > tokenIssuedAtMs + 1000) {
      return next(new AppError('Password was changed recently. Please log in again.', 401));
    }
  }

  // 8) Attach user and token payload
  req.user = user;
  req.auth = decoded;

  return next();
});

// -------------------------------------------------------------------
// AUTHORIZATION HELPERS
// -------------------------------------------------------------------

// Restrict by role
exports.restrictTo = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError('Not authenticated. Run protect() first.', 500));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(new AppError('You do not have permission to perform this action.', 403));
    }

    return next();
  };
};

// Allow owner OR admin
exports.restrictToOwnerOrAdmin = (req, res, next) => {
  if (!req.user) {
    return next(new AppError('Not authenticated. Run protect() first.', 500));
  }

  if (req.user.role === 'ADMIN') {
    return next();
  }

  if (!req.resource) {
    return next(new AppError('Resource not loaded. Attach req.resource first.', 500));
  }

  const ownerId = Number(req.resource.owner_id);
  const userId = Number(req.user.id);

  if (ownerId !== userId) {
    return next(new AppError('You do not have permission to modify this resource.', 403));
  }

  return next();
};
