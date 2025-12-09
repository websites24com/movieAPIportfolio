// Custom Error class for operational ( expected ) errors in the API

class AppError extends Error {
    constructor(message, statusCode) {
        super(message)

    this.statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    // mark as an operational, trusted error
    this.isOperational = true;
    // Capture the stack trace, excluding constructor call from it
    Error.captureStackTrace(this, this.constructor);
    }
}

module.exports = AppError;