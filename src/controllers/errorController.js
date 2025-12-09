// src/controllers/errorController.js
// =======================================================
// Global error handling middleware for the Movie API.
//
// - In DEVELOPMENT: show full error details (message, stack, raw error)
// - In PRODUCTION : show only safe messages for operational errors
//                   and a generic message for programming/unknown errors.
// =======================================================

// Helper: send detailed error in development
const sendErrorDev = (err, req, res) => {
  // Log full error in the console for the developer
  console.error('🔥 DEV ERROR:', err);

  res.status(err.statusCode || 500).json({
    status: err.status || 'error',
    message: err.message,
    // In dev we can expose more to make debugging easier:
    error: err,       // full error object
    stack: err.stack, // stack trace
  });
};

// Helper: send safe error in production
const sendErrorProd = (err, req, res) => {
  // Log only basic info in production (still helpful for logs)
  console.error('🔥 PROD ERROR:', err);

  // 1) Operational, trusted error: send the message to the client
  //    (these are typically created with AppError)
  if (err.isOperational) {
    return res.status(err.statusCode).json({
      status: err.status,
      message: err.message,
    });
  }

  // 2) Programming or unknown error: don't leak details to the client
  //    We still log it above for ourselves, but user gets a generic message.
  return res.status(500).json({
    status: 'error',
    message: 'Something went wrong on the server.',
  });
};

// -------------------------------------------------------
// MAIN GLOBAL ERROR HANDLER MIDDLEWARE
// This is the function passed to app.use(globalErrorHandler)
// -------------------------------------------------------
module.exports = (err, req, res, next) => {
  // If headers were already sent, delegate to Express's default handler.
  // This avoids the "Can't set headers after they are sent" error.
  if (res.headersSent) {
    return next(err);
  }

  // Ensure we have some default values
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  // Decide logic based on NODE_ENV
  const env = process.env.NODE_ENV || 'development';

  if (env === 'development') {
    // In development we want maximum information
    sendErrorDev(err, req, res);
  } else {
    // In production we only want safe messages
    // (We can clone the error if we want to transform it)
    const error = { ...err };
    // Important: message is not copied by spread for Error objects
    error.message = err.message;
    error.statusCode = err.statusCode;
    error.status = err.status;
    error.isOperational = err.isOperational;

    sendErrorProd(error, req, res);
  }
};
