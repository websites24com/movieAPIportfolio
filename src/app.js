// Configuration of Express application

const express = require('express');
const helmet = require('helmet')
const morgan = require('morgan')
const cookieParser = require('cookie-parser');
const AppError = require('./utils/appError')
const globalErrorHandler = require('./controllers/errorController')

// DB
const db = require('./config/db');

// Routes
const movieRoutes = require('./routes/movieRoutes')
const authRoutes = require('./routes/authRoutes')

// Express

const app = express();

// HELMET Seucrity headers

app.use(helmet());

// Cookies

app.use(cookieParser());


// Public files

app.use(express.static('public'));


// Parse JSON request bodies (for POST/PUT/PATCH)

app.use(express.json());

// Request logger - only in development

if (process.env.Node_ENV === 'development') {
    app.use(morgan('dev'));
}

// Simple health-check route
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    name: 'Movie API',
    version: '1.0.0',
  });
});

// DB health-check route

app.get('/api/v1/db-check', async (req, res, next) => {
  try {
    const [rows] = await db.query('SELECT 1 + 1 AS result');
    res.json({
      status: 'success',
      db: 'connected',
      result: rows[0].result
    })
  } catch (err) {
    next(err)
  }
})

// Mount movie routes under /api/v1/movies

app.use('/api/v1/movies', movieRoutes);

// Mount auth routes

app.use('/api/v1/auth', authRoutes);

// --- 404 handler 

app.all('{*splat}', (req, res, next) => {
    // Create an AppError and pass to next()
   // This will be handled by the global error handler below
   next(
    new AppError(
        `Cannot ${req.method} ${req.originalUrl}`,
        404
    )
   )
   // ---------- Global error handling middleware ----------

   app.use(globalErrorHandler);
})



module.exports = app;