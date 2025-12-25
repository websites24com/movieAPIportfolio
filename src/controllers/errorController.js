// src/controllers/errorController.js

const AppError = require('../utils/appError');

// Helper: send detailed error in development
const sendErrorDev = (err, req, res) => {
  console.error('🔥 DEV ERROR:', err);

  return res.status(err.statusCode || 500).json({
    status: err.status || 'error',
    message: err.message,
    error: err,
    stack: err.stack,
  });
};

// Convert JWT errors into operational AppError (safe message)
const handleJWTError = () =>
  new AppError('Invalid token. Please log in again.', 401);

const handleJWTExpiredError = () =>
  new AppError('Your session has expired. Please log in again.', 401);

// Helper: send safe error in production
const sendErrorProd = (err, req, res) => {
  console.error('🔥 PROD ERROR:', err);

  // Operational, trusted error -> send message
  if (err.isOperational) {
    return res.status(err.statusCode).json({
      status: err.status,
      message: err.message,
    });
  }

  // Unknown / programming error -> generic
  return res.status(500).json({
    status: 'error',
    message: 'Something went wrong on the server.',
  });
};

module.exports = (err, req, res, next) => {
  if (res.headersSent) return next(err);

  // Defaults (do NOT clone the error)
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  const env = process.env.NODE_ENV || 'development';

  if (env === 'development') {
    return sendErrorDev(err, req, res);
  }

  // ---------------- PRODUCTION ----------------
  // Convert known errors into operational AppErrors
  let error = err;

  // JWT: invalid signature, malformed token, etc.
  if (error.name === 'JsonWebTokenError') {
    error = handleJWTError();
  }

  // JWT: expired token
  if (error.name === 'TokenExpiredError') {
    error = handleJWTExpiredError();
  }

  return sendErrorProd(error, req, res);
};
