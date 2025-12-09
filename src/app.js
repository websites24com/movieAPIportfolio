// Configuration of Express application

const express = require('express');
const helmet = require('helmet')
const morgan = require('morgan')
const AppError = require('./utils/appError')
const globalErrorHandler = require('./controllers/errorController')
// Routes

const movieRoutes = require('./routes/movieRoutes')

// Express

const app = express();

// HELMET Seucrity headers

app.use(helmet());

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

// Mount movie routes under /api/v1/movies

app.use('/api/v1/movies', movieRoutes);



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