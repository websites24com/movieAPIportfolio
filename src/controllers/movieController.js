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
const { getPagination } = require('../utils/pagination');
const { getSearch } = require('../utils/search');
const { getFilters } = require('../utils/filters');
const { getSort } = require('../utils/sort')

// ------------------------------------------------------
// GET /api/v1/movies
// Returns ALL movies from the dataset.
// ------------------------------------------------------


exports.getAllMovies = catchAsync(async (req, res, next) => {
  // 1) Pagination
  const { page, limit, offset } = getPagination(req.query);

  // 2) Base conditions (none here)
  const baseConditions = [];
  const baseParams = [];

  // 3) Search + filters
  const { conditions: searchConditions, params: searchParams, search } = getSearch(req.query);
  const { conditions: filterConditions, params: filterParams } = getFilters(req.query);

  // 4) Merge all conditions and params
  const allConditions = [
    ...baseConditions,
    ...searchConditions,
    ...filterConditions,
  ];
  const allParams = [
    ...baseParams,
    ...searchParams,
    ...filterParams,
  ];

  // Build WHERE clause string
  const whereClause = allConditions.length
    ? 'WHERE ' + allConditions.join(' AND ')
    : '';

  // ORDER BY

  const orderByClause = getSort(req.query, {
    defaultSort: 'title',
    defaultOrder: 'ASC'
  })

  // 5) Get paginated movies
  const [movies] = await db.query(
    `SELECT * FROM movies ${whereClause} ${orderByClause} LIMIT ? OFFSET ?`,
    [...allParams, limit, offset]
  );

  // 6) Get total count with same conditions
  const [countRows] = await db.query(
    `SELECT COUNT(*) AS total FROM movies ${whereClause}`,
    allParams
  );
  const total = countRows[0].total;
  const totalPages = Math.ceil(total / limit);

  // 7) Response
  res.status(200).json({
    status: 'success',
    results: movies.length,
    meta: {
      page,
      limit,
      total,
      totalPages,
      search: search || null,
      sort: req.query.sort || 'title',
      order: req.query.order || 'asc'
    },
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
  // 1) Pagination
  const { page, limit, offset } = getPagination(req.query);

  // 2) Base condition: must always be most_popular = 1
  const baseConditions = ['most_popular = 1'];
  const baseParams = []; // no params needed for this condition

  // 3) Search + filters
  const { conditions: searchConditions, params: searchParams, search } = getSearch(req.query);
  const { conditions: filterConditions, params: filterParams } = getFilters(req.query);

  // 4) Merge all conditions and params
  const allConditions = [
    ...baseConditions,
    ...searchConditions,
    ...filterConditions,
  ];
  const allParams = [
    ...baseParams,
    ...searchParams,
    ...filterParams,
  ];

  // Build WHERE clause string
  const whereClause = allConditions.length
    ? 'WHERE ' + allConditions.join(' AND ')
    : '';

  // Order

  const orderByClause = getSort(req.query, {
    defaultSort: 'popularity',
    defaultOrder: 'DESC'
  })

  // 5) Get paginated popular movies (sorted by popularity DESC)
  const [movies] = await db.query(
    `SELECT * FROM movies ${whereClause} ${orderByClause} ORDER BY popularity DESC LIMIT ? OFFSET ?`,
    [...allParams, limit, offset]
  );

  // 6) Count total popular movies with same conditions
  const [countRows] = await db.query(
    `SELECT COUNT(*) AS total FROM movies ${whereClause}`,
    allParams
  );
  const total = countRows[0].total;
  const totalPages = Math.ceil(total / limit);

  // 7) Response
  res.status(200).json({
    status: 'success',
    results: movies.length,
    meta: {
      page,
      limit,
      total,
      totalPages,
      search: search || null,
      sort: req.query.sort || 'popularity',
      order: req.query.order || 'desc'
    },
    data: {
      movies,
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

const owner_id = req.user.id;


if (!title) {
    return next(new AppError('A movie must have at least a title', 400))
}



const sql = `
    INSERT INTO movies (
      owner_id,
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
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

   const params = [
    owner_id,
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


  // UPDATE

  // UPDATE movie (ONE QUERY ONLY)
// Rules enforced by SQL:
// - ADMIN can update any movie
// - USER can update only movies where owner_id = req.user.id
//
// IMPORTANT consequence of "one query only":
// - We do NOT return the updated movie object (no extra SELECT).
exports.updateMovie = catchAsync(async (req, res, next) => {
  const movieId = Number(req.params.id);

  // 1) Validate movie id
  if (Number.isNaN(movieId) || movieId <= 0) {
    return next(new AppError('Invalid movie ID', 400));
  }

  // 2) Build update fields dynamically
  // Never allow changing owner_id from request body (security).
  const keys = Object.keys(req.body).filter((k) => k !== 'owner_id');

  // If no allowed fields were sent, nothing to update
  if (keys.length === 0) {
    return next(new AppError('No fields provided to update', 400));
  }

  // 3) Prepare values in the same order as keys
  const values = keys.map((k) => {
    // Convert genre_ids array into JSON string for DB
    if (k === 'genre_ids') return JSON.stringify(req.body.genre_ids || []);
    return req.body[k];
  });

  // 4) Build WHERE based on role
  // Admin: WHERE id = ?
  // User : WHERE id = ? AND owner_id = ?
  let sql = `
    UPDATE movies
    SET ${keys.map((k) => `${k} = ?`).join(', ')}
    WHERE id = ?
  `;

  const params = [...values, movieId];

  // Only non-admin must match ownership
  if (req.user.role !== 'ADMIN') {
    sql += ` AND owner_id = ?`;
    params.push(req.user.id);
  }

  // 5) ONE database query
  const [result] = await db.query(sql, params);

  // 6) If no rows updated -> either:
  // - movie does not exist
  // - OR user does not own it (when not admin)
  if (result.affectedRows === 0) {
    return next(new AppError('Movie not found or you do not have permission to update it.', 403));
  }

  // 7) Return minimal success response (still professional API)
  return res.status(200).json({
    status: 'success',
    data: {
      message: `Movie ${movieId} updated successfully.`,
      affectedRows: result.affectedRows
    }
  });
});


  // DELETE

// DELETE movie (ONE QUERY ONLY)
// Rules enforced by SQL:
// - ADMIN can delete any movie
// - USER can delete only movies where owner_id = req.user.id
exports.deleteMovie = catchAsync(async (req, res, next) => {
  const movieId = Number(req.params.id);

  if (Number.isNaN(movieId) || movieId <= 0) {
    return next(new AppError('Invalid movie ID', 400));
  }

  let sql = `DELETE FROM movies WHERE id = ?`;
  const params = [movieId];

  if (req.user.role !== 'ADMIN') {
    sql += ` AND owner_id = ?`;
    params.push(req.user.id);
  }

  const [result] = await db.query(sql, params);

  if (result.affectedRows === 0) {
    return next(new AppError('Movie not found or you do not have permission to delete it.', 403));
  }

  return res.status(200).json({
    status: 'success',
    data: {
      message: `Movie ${movieId} deleted successfully.`,
      affectedRows: result.affectedRows
    }
  });
});
