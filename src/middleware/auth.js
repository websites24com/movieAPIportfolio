// src/middleware/auth.js
//
// PURPOSE:
// This middleware "protects" routes.
// It allows access ONLY if a valid JWT is provided either:
// 1) in the Authorization header:  Authorization: Bearer <token>
// OR
// 2) in the HttpOnly cookie:       jwt=<token>
//
// After verification it will:
// - load the user from DB
// - check that the user is still active
// - attach the user to req.user
// - call next() so the request can continue

const jwt = require('jsonwebtoken');          // used to verify JWT signature + expiry
const db = require('../config/db');          // MySQL pool to load user
const AppError = require('../utils/appError'); // consistent API errors
const catchAsync = require('../utils/catchAsync'); // forward async errors to global handler

exports.protect = catchAsync(async (req, res, next) => {
  let token;

  // ------------------------------------------------------------
  // 1) Try to read token from Authorization header (Bearer)
  // Example header:
  // Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
  // ------------------------------------------------------------
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer ')
  ) {
    // split by space -> ["Bearer", "<token>"]
    token = req.headers.authorization.split(' ')[1];
  }

  // ------------------------------------------------------------
  // 2) If no Bearer token, try to read token from cookies
  // Requires cookie-parser middleware (you already installed it)
  // Cookie name we set in authController: "jwt"
  // ------------------------------------------------------------
  if (!token && req.cookies && req.cookies.jwt) {
    token = req.cookies.jwt;
  }

  // ------------------------------------------------------------
  // 3) If still no token -> user is not logged in
  // ------------------------------------------------------------
  if (!token) {
    return next(new AppError('You are not logged in. Please log in.', 401));
  }

  // ------------------------------------------------------------
  // 4) Verify token (signature + expiry)
  // jwt.verify throws if:
  // - token invalid
  // - token expired
  // - secret mismatch
  // ------------------------------------------------------------
  if (!process.env.JWT_SECRET) {
    // This is server misconfiguration, not user error
    throw new Error('JWT_SECRET is missing in environment variables');
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    // Convert JWT library errors into a clean operational AppError
    return next(new AppError('Invalid or expired token. Please log in again.', 401));
  }

  // decoded now contains payload we signed (id, role, iat, exp)
  // Example: { id: 5, role: 'USER', iat: 123..., exp: 123... }

  // ------------------------------------------------------------
  // 5) Load current user from DB
  // Why: user might be deleted/disabled after token was issued
  // ------------------------------------------------------------
  const result = await db.query(
    'SELECT id, name, email, role, provider, active, created_at FROM users WHERE id = ? LIMIT 1',
    [decoded.id]
  );
  const user = result[0][0];

  if (!user) {
    return next(new AppError('The user belonging to this token no longer exists.', 401));
  }

  // ------------------------------------------------------------
  // 6) Check if user is active
  // ------------------------------------------------------------
  if (user.active !== 1) {
    return next(new AppError('This account is disabled.', 403));
  }

  // ------------------------------------------------------------
  // 7) Attach user to request so next handlers can use it
  // Example: req.user.role, req.user.id
  // ------------------------------------------------------------
  req.user = user;

  // Optional: keep the decoded token too (sometimes useful)
  req.auth = decoded;

  // Continue to the next middleware/controller
  return next();
});


// -------------------------------------------------------------------
// AUTHORIZATION HELPERS
// -------------------------------------------------------------------

// 1) Restrict by role
// Usage: router.delete(..., auth.protect, auth.restrictTo('ADMIN'), ...)
exports.restrictTo = (...allowedRoles) => {
  return (req, res, next) => {
    // protect() must run before, because it sets req.user
    if (!req.user) {
      return next(new AppError('Not authenticated. Run protect() first.', 500));
    }

    // If user's role is not in the allowed list -> forbidden
    if (!allowedRoles.includes(req.user.role)) {
      return next(new AppError('You do not have permission to perform this action.', 403));
    }

    return next();
  };
};

// 2) Allow owner OR admin
// This is generic: it checks if a resource's owner_id matches req.user.id,
// OR if user is ADMIN.
//
// We will use it for movies (update/delete).
// IMPORTANT: it expects the resource to already be loaded and attached to req.resource

exports.restrictToOwnerOrAdmin = (req, res, next) => {
  // protect() must run before
  if (!req.user) {
    return next(new AppError('Not authenticated. Run protect() first.', 500));
  }

  // Admin can do anything
  if (req.user.role === 'ADMIN') {
    return next();
  }

  // If no loaded resource, we cannot compare owner_id safely
  if (!req.resource) {
    return next(new AppError('Resource not loaded. Attach req.resource first.', 500));
  }

  // Compare ownership
  // Ensure numeric comparison (MySQL can return numbers, but be safe)
  const ownerId = Number(req.resource.owner_id);
  const userId = Number(req.user.id);

  if (ownerId !== userId) {
    return next(new AppError('You do not have permission to modify this resource.', 403));
  }

  return next();
};
