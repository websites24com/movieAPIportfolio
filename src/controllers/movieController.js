// src/controllers/movieController.js
// ======================================================
// Controller functions for handling movie-related API requests.
// These functions are connected to routes, and each one returns
// JSON data to the client. All async controllers are wrapped
// with catchAsync so any error is forwarded to the global error
// handler without crashing the app.
// ======================================================

const db = require('../config/db');
const AppError = require('../utils/appError');
const catchAsync = require('../utils/catchAsync');


// ------------------------------------------------------
// GET /api/v1/movies
// Returns ALL movies from the dataset.
// ------------------------------------------------------
exports.getAllMovies = catchAsync(async (req, res, next) => {
   
    // Query all movies from MySQL
    const [rows] = await db.query('SELECT * FROM movies');

    res.status(200).json({
        status: 'success',
        results: rows.length,
        data: {
            movies: rows
        },
    });
});


// ------------------------------------------------------
// GET /api/v1/movies/popular
// Returns only movies where movie.most_popular === true
// ------------------------------------------------------
exports.getMostPopularMovies = catchAsync(async (req, res, next) => {
   
    const [rows] = await db.query(
        'SELECT * FROM movies WHERE most_popular = 1 ORDER BY popularity DESC'
    )

    res.status(200).json({
        status: 'success',
        results: rows.length,
        data: {
            movies: rows,
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

    // Validate ID

    if (Number.isNaN(id) || id <= 0) {
        return next(new AppError('Invalid movie ID', 400))
    }

    // Query db for movie

    const[rows] = await db.query('SELECT * FROM movies WHERE id = ?', [id])

    if (rows.length === 0) {
        // No movie found
        return next(new AppError(`Movie with ID ${id} not found`, 404))
    }

    const movie = rows[0];

    res.status(200).json({
        status: 'success',
        data: {
            movie,
            
        },
    });
});

// ------------------------------------------------------
// POST /api/v1/movies
// Creates a new movie in the MySQL database
// ------------------------------------------------------

exports.createMovie = catchAsync(async(req, res, next) => {
    const {
    title,
    original_title,
    overview,
    release_date,
    vote_average,
    vote_count,
    popularity,
    poster_path,
    backdrop_path,
    original_language,
    adult,
    video,
    most_popular,
    genre_ids
  } = req.body;


if (!title) {
    return next(new AppError('A movie must have at least a title', 400))
}

const sql = `
    INSERT INTO movies (
      title,
      original_title,
      overview,
      release_date,
      vote_average,
      vote_count,
      popularity,
      poster_path,
      backdrop_path,
      original_language,
      adult,
      video,
      most_popular,
      genre_ids
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

   const params = [
    title,
    original_title || null,
    overview || null,
    release_date || null,
    vote_average ?? 0.0,
    vote_count ?? 0,
    popularity ?? 0.0,
    poster_path || null,
    backdrop_path || null,
    original_language || null,
    adult ? 1 : 0,
    video ? 1 : 0,
    most_popular ? 1 : 0,
    JSON.stringify(genre_ids || [])
  ];

  // Insert into DB

  const [result] = await db.query(sql, params);

  // Fetch the newly-created movie

  const [rows] = await db.query('SELECT * FROM movies WHERE id = ?', [result.insertId])

  res.status(201).json({
    status: 'success',
    data: {
        movie: rows[0]
    }
  })
  })