// Configuration of Express application

const express = require('express');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const path = require('path');

const ensureCsrfCookie = require('./middlewares/ensureCsrfCookie.js');
const viewAuth = require('./middlewares/viewAuth');

const AppError = require('./utils/appError');
const globalErrorHandler = require('./controllers/errorController');

// Routes
const movieRoutes = require('./routes/movieRoutes');
const authRoutes = require('./routes/authRoutes');
const viewRoutes = require('./routes/viewRoutes');
const userRoutes = require('./routes/userRoutes');
const healthRoutes = require('./routes/healthRoutes');
const favoriteRoutes = require('./routes/favouriteRoutes.js');

const app = express();

// -------------------- SECURITY (FIRST) --------------------
// -------------------- SECURITY --------------------
app.use(
  helmet({
    // KEEP (same as yours)
    crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },

    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },


    // KEEP (same as yours)
    crossOriginEmbedderPolicy: false,

    // CHANGE: CSP aligned to GIS /gsi/ endpoints
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],

        // CHANGE: use the exact GIS script endpoint
        scriptSrc: [
          "'self'",
          "https://accounts.google.com/gsi/client"
        ],

        // CHANGE: use the exact GIS style endpoint
        styleSrc: [
          "'self'",
          "'unsafe-inline'",
          "https://accounts.google.com/gsi/style"
        ],

        // CHANGE: allow GIS iframes
        frameSrc: [
          "'self'",
          "https://accounts.google.com/gsi/"
        ],

        // CHANGE: allow GIS network calls
        connectSrc: [
          "'self'",
          "https://accounts.google.com/gsi/"
        ],

        // CHANGE: keep only what GIS needs
        imgSrc: [
          "'self'",
          "data:",
          "https://lh3.googleusercontent.com"
        ]
      }
    }
  })
);


// -------------------- LOGGING (EARLY) --------------------
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// -------------------- PARSERS --------------------
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// -------------------- VIEW ENGINE --------------------
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// -------------------- STATIC FILES --------------------
app.use(express.static(path.join(__dirname, '..', 'public')));

// -------------------- CSRF COOKIE --------------------
app.use(ensureCsrfCookie);

// -------------------- ATTACH USER FOR VIEWS --------------------
app.use(viewAuth.attachUserIfLoggedIn);

// -------------------- ROUTES --------------------
app.use('/', healthRoutes);
app.use('/api/v1', healthRoutes);
app.use('/api/v1/movies', movieRoutes);
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/favorites', favoriteRoutes)
app.use('/', viewRoutes);

// -------------------- 404 (EXPRESS 5) --------------------
app.all('/{*splat}', (req, res, next) => {
  next(new AppError(`Cannot ${req.method} ${req.originalUrl}`, 404));
});

// -------------------- GLOBAL ERROR HANDLER (LAST) --------------------
app.use(globalErrorHandler);

module.exports = app;
