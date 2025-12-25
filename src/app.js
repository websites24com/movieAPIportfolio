// Configuration of Express application

const express = require('express');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const ensureCsrfCookie = require('./middlewares/ensureCsrfCookie.js');

const path = require('path');
const AppError = require('./utils/appError');
const globalErrorHandler = require('./controllers/errorController');

// Middlewares

const viewAuth = require('./middlewares/viewAuth');

// Routes
const movieRoutes = require('./routes/movieRoutes');
const authRoutes = require('./routes/authRoutes');
const viewRoutes = require('./routes/viewRoutes')
const healthRoutes = require('./routes/healthRoutes')

// -------------------- APP --------------------
const app = express();

// -------------------- SECURITY --------------------
app.use(
  helmet({
    // ✅ This is the key fix for Google Sign-In popup flows
    // Without it, window.opener becomes null for cross-origin popups.
    crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },

    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          "https://accounts.google.com",
          "https://accounts.gstatic.com",
          "https://ssl.gstatic.com"
        ],
        frameSrc: [
          "'self'",
          "https://accounts.google.com"
        ],
        connectSrc: [
          "'self'",
          "https://accounts.google.com",
          "https://accounts.gstatic.com",
          "https://ssl.gstatic.com"
        ],
        imgSrc: [
          "'self'",
          "data:",
          "https://accounts.google.com",
          "https://accounts.gstatic.com",
          "https://ssl.gstatic.com",
          "https://lh3.googleusercontent.com"
        ]
      }
    }
  })
);


// -------------------- PARSERS --------------------
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CSFR

app.use(ensureCsrfCookie);


// Middlewares

app.use(viewAuth.attachUserIfLoggedIn);


// -------------------- LOGGING --------------------
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// -------------------- VIEW ENGINE --------------------
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// -------------------- STATIC FILES --------------------
app.use(express.static(path.join(__dirname, '..', 'public')))


// -------------------- ROUTES --------------------

app.use('/', healthRoutes);              // GET /
app.use('/api/v1', healthRoutes);         // GET /api/v1/db-check
app.use('/api/v1/movies', movieRoutes);
app.use('/api/v1/auth', authRoutes);
app.use('/', viewRoutes)



// -------------------- 404 (EXPRESS 5) --------------------
app.all('/{*splat}', (req, res, next) => {
  next(
    new AppError(
      `Cannot ${req.method} ${req.originalUrl}`,
      404
    )
  );
});

// -------------------- GLOBAL ERROR HANDLER (LAST) --------------------
app.use(globalErrorHandler);

module.exports = app;
