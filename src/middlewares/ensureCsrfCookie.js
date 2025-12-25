// middlewares/requireCsrf.js
// Step 1: ensure every browser has a csrfToken cookie.
// This token is used to prove a request came from your own pages.

const crypto = require('crypto');

module.exports = function csrfCookie(req, res, next) {
  // If token already exists, keep it
  if (req.cookies && req.cookies.csrfToken) return next();

  // Create a random token
  const token = crypto.randomBytes(32).toString('hex');
  const isProd = process.env.NODE_ENV === 'production';

  // Store it in a cookie that JS can read (httpOnly: false)
  res.cookie('csrfToken', token, {
    httpOnly: false,
    secure: isProd,
    sameSite: 'lax',
    path: '/',
  });

  return next();
};
