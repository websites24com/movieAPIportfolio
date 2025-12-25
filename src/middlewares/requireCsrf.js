// middlewares/requireCsrf.js
//
// PURPOSE:
// Validate CSRF on state-changing routes.
//
// Strategy (double-submit cookie):
// - Server sets a readable cookie: csrfToken
// - Client must echo the same value in either:
//   a) header:  x-csrf-token
//   b) body:    _csrf
//
// If they don't match => block the request.

const AppError = require('../utils/appError');

module.exports = function requireCsrf(req, res, next) {
  const cookieToken = req.cookies?.csrfToken;

  // Accept token from header OR body
  const headerToken = req.headers['x-csrf-token'];
  const bodyToken = req.body?._csrf;

  const sentToken = headerToken || bodyToken;

  if (!cookieToken) {
    return next(new AppError('Missing CSRF cookie token.', 403));
  }

  if (!sentToken) {
    return next(new AppError('Missing CSRF token in request.', 403));
  }

  if (sentToken !== cookieToken) {
    return next(new AppError('Invalid CSRF token.', 403));
  }

  return next();
};
