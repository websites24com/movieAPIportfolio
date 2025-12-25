// Middleware to protect routes using API KEY authentication

const AppError = require('../utils/appError');

module.exports = function authApiKey(req, res, next) {
  const clientKey =
    req.headers['x-api-key'] ||       // allow API key in header
    req.query.api_key;                // allow API key in URL

  const serverKey = process.env.API_KEY;

  // If no key provided or it doesn't match → reject request
  if (!clientKey || clientKey !== serverKey) {
    return next(
      new AppError('Invalid or missing API key', 401)
    );
  }

  // Key is valid → allow access
  next();
};
