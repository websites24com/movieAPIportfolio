// src/routes/movieRoutes.js
// ======================================================
// Movie routes. Each route is connected to a controller
// function that handles the logic and returns a response.
// ======================================================

const express = require('express');
const movieController = require('../controllers/movieController');
const authApiKey = require('../middlewares/authApiKey')
const auth = require('../middlewares/auth')

const router = express.Router();

// Apply API key to ALL routes under /movies

router.use(authApiKey)

// /api/v1/movies
router
.route('/')
.get(movieController.getAllMovies)
.post(auth.protect, movieController.createMovie)

// /api/v1/movies/popular
router.get('/popular', movieController.getMostPopularMovies);

// /api/v1/movies/:id
router
.route('/:id')
.get(movieController.getMovieById)
.patch(auth.protect, movieController.updateMovie)
.delete(auth.protect, movieController.deleteMovie)

module.exports = router;
