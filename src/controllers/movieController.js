// src/controllers/movieController.js
// ======================================================
// Controller functions for handling movie-related API requests.
// These functions are connected to routes, and each one returns
// JSON data to the client. All async controllers are wrapped
// with catchAsync so any error is forwarded to the global error
// handler without crashing the app.
// ======================================================

const movies = require('../data/movies');
const movieDetails = require('../data/movieDetails');
const AppError = require('../utils/appError');
const catchAsync = require('../utils/catchAsync');


// ------------------------------------------------------
// GET /api/v1/movies
// Returns ALL movies from the dataset.
// ------------------------------------------------------
exports.getAllMovies = catchAsync(async (req, res, next) => {
    // In a real API this would be a DB query like:
    // const movies = await Movie.find();

    res.status(200).json({
        status: 'success',
        results: movies.length,
        data: {
            movies,
        },
    });
});


// ------------------------------------------------------
// GET /api/v1/movies/popular
// Returns only movies where movie.most_popular === true
// ------------------------------------------------------
exports.getMostPopularMovies = catchAsync(async (req, res, next) => {
    const popular = movies.filter((movie) => movie.most_popular);

    res.status(200).json({
        status: 'success',
        results: popular.length,
        data: {
            movies: popular,
        },
    });
});


// ------------------------------------------------------
// GET /api/v1/movies/:id
// Returns a single movie based on its numeric ID.
// We search both movies.js (basic info) and movieDetails.js.
// ------------------------------------------------------
exports.getMovieById = catchAsync(async (req, res, next) => {
    const id = Number(req.params.id);

    // Try to find movie in basic movie list
    const movie = movies.find((m) => m.id === id);

    if (!movie) {
        // If no movie found → create an AppError (operational error)
        return next(new AppError(`Movie with ID ${id} not found`, 404));
    }

    // Try to find full details for this movie
    const details = movieDetails.find((m) => m.id === id);

    res.status(200).json({
        status: 'success',
        data: {
            movie,
            details: details || null, // in case we don't have extended info
        },
    });
});
